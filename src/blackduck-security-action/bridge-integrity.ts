import * as crypto from 'crypto'
import * as fs from 'fs'
import path from 'path'
import {error, info} from '@actions/core'
import * as constants from '../application-constants'
import {downloadTool} from './tool-cache-local'

// FedRAMP Bridge CLI integrity checks (SI-7). All failures fail closed: they throw and are never overridable.
//   CHECK 1: verify the downloaded ZIP signature (ECDSA P-256 + SHA-256) before extraction
//   CHECK 2: verify every extracted file against manifest.json (SHA-256, executable bit, no extra files)
//   CHECK 3: re-verify the bridge-cli binary immediately before execution

const LOG_PREFIX = '[FedRAMP integrity]'
const BRIDGE_BINARY_NAMES = ['bridge-cli', 'bridge-cli.exe']
const MAX_REPORTED_PROBLEMS = 10

export interface ManifestEntry {
  path: string
  sha256: string
  executable?: boolean
}

export interface BridgeManifest {
  files: ManifestEntry[]
}

// Audit log the failure (details never include secrets or key material) and fail closed
function fail(check: string, detail: string, message: string): never {
  error(`${LOG_PREFIX} ${check} failed: ${detail}`)
  throw new Error(message)
}

async function sha256File(filePath: string): Promise<string> {
  const hash = crypto.createHash('sha256')
  for await (const chunk of fs.createReadStream(filePath)) {
    hash.update(chunk)
  }
  return hash.digest('hex')
}

// Downloads <bundle>.zip.sig next to the downloaded bundle
export async function downloadSignatureFile(bundleUrl: string, destDir: string): Promise<string> {
  try {
    const signatureUrl = new URL(bundleUrl)
    signatureUrl.pathname = signatureUrl.pathname.concat(constants.BRIDGE_CLI_SIGNATURE_FILE_SUFFIX)
    const destFile = path.join(destDir, path.basename(signatureUrl.pathname))
    return await downloadTool(signatureUrl.toString(), destFile)
  } catch (e) {
    return fail('CHECK 1', `signature file download failed (${(e as Error).message})`, constants.FEDRAMP_INTEGRITY_SIGNATURE_DOWNLOAD_ERROR)
  }
}

// CHECK 1: the signature file holds a base64-encoded DER ECDSA signature over the ZIP bytes
export async function verifyBundleSignature(zipFilePath: string, signatureFilePath: string, publicKeyPem: string = constants.BRIDGE_CLI_SIGNING_PUBLIC_KEY_PEM): Promise<void> {
  if (!publicKeyPem) {
    fail('CHECK 1', 'signing public key is not configured', constants.FEDRAMP_INTEGRITY_PUBLIC_KEY_MISSING_ERROR)
  }
  let valid = false
  try {
    const signature = Buffer.from(fs.readFileSync(signatureFilePath, 'utf-8').trim(), 'base64')
    const verifier = crypto.createVerify('sha256')
    for await (const chunk of fs.createReadStream(zipFilePath)) {
      verifier.update(chunk)
    }
    valid = verifier.verify({key: publicKeyPem, dsaEncoding: 'der'}, signature)
  } catch (e) {
    debugReason(e)
    valid = false
  }
  if (!valid) {
    fail('CHECK 1', `signature verification failed for ${path.basename(zipFilePath)}`, constants.FEDRAMP_INTEGRITY_SIGNATURE_INVALID_ERROR)
  }
  info(`${LOG_PREFIX} CHECK 1 passed: signature verified for ${path.basename(zipFilePath)}`)
}

function debugReason(e: unknown): void {
  // Reason is logged without any key or signature content
  info(`${LOG_PREFIX} signature verification error: ${(e as Error).name}`)
}

export function readManifest(bundleDir: string): BridgeManifest {
  const manifestPath = path.join(bundleDir, constants.BRIDGE_CLI_MANIFEST_FILE_NAME)
  let parsed: any
  try {
    parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
  } catch {
    return fail('manifest', `${constants.BRIDGE_CLI_MANIFEST_FILE_NAME} could not be read or parsed`, constants.FEDRAMP_INTEGRITY_MANIFEST_INVALID_ERROR)
  }
  const files = parsed?.files
  if (!Array.isArray(files) || files.length === 0) {
    return fail('manifest', 'no files are listed', constants.FEDRAMP_INTEGRITY_MANIFEST_INVALID_ERROR)
  }
  const seen = new Set<string>()
  const entries: ManifestEntry[] = []
  for (const file of files) {
    const relativePath = typeof file?.path === 'string' ? file.path.replace(/\\/g, '/') : ''
    const sha256 = typeof file?.sha256 === 'string' ? file.sha256.toLowerCase() : ''
    const unsafePath = !relativePath || path.isAbsolute(relativePath) || /^[a-zA-Z]:/.test(relativePath) || relativePath.split('/').includes('..')
    if (unsafePath || !/^[a-f0-9]{64}$/.test(sha256) || seen.has(relativePath)) {
      return fail('manifest', 'an entry has an invalid, unsafe or duplicate path, or an invalid sha256', constants.FEDRAMP_INTEGRITY_MANIFEST_INVALID_ERROR)
    }
    seen.add(relativePath)
    entries.push({path: relativePath, sha256, executable: typeof file.executable === 'boolean' ? file.executable : undefined})
  }
  return {files: entries}
}

function listFiles(rootDir: string, currentDir: string = rootDir): string[] {
  const result: string[] = []
  for (const dirent of fs.readdirSync(currentDir, {withFileTypes: true})) {
    const fullPath = path.join(currentDir, dirent.name)
    if (dirent.isDirectory()) {
      result.push(...listFiles(rootDir, fullPath))
    } else {
      result.push(path.relative(rootDir, fullPath).replace(/\\/g, '/'))
    }
  }
  return result
}

// CHECK 2: every file must match the manifest, and no extra files may exist
export async function verifyBundleFiles(bundleDir: string, manifest: BridgeManifest): Promise<void> {
  const problems: string[] = []
  const root = path.resolve(bundleDir)
  for (const entry of manifest.files) {
    const fullPath = path.resolve(root, entry.path)
    if (!fullPath.startsWith(root.concat(path.sep)) || !fs.existsSync(fullPath)) {
      problems.push(`missing: ${entry.path}`)
      continue
    }
    if ((await sha256File(fullPath)) !== entry.sha256) {
      problems.push(`hash mismatch: ${entry.path}`)
    }
    if (process.platform !== 'win32' && entry.executable !== undefined) {
      const isExecutable = (fs.statSync(fullPath).mode & 0o111) !== 0
      if (isExecutable !== entry.executable) {
        problems.push(`executable bit mismatch: ${entry.path}`)
      }
    }
  }
  const expected = new Set(manifest.files.map(entry => entry.path))
  for (const relativePath of listFiles(root)) {
    if (relativePath !== constants.BRIDGE_CLI_MANIFEST_FILE_NAME && !expected.has(relativePath)) {
      problems.push(`unexpected file: ${relativePath}`)
    }
  }
  if (problems.length > 0) {
    problems.forEach(problem => error(`${LOG_PREFIX} CHECK 2 failed: ${problem}`))
    const summary = problems.slice(0, MAX_REPORTED_PROBLEMS).join('; ').concat(problems.length > MAX_REPORTED_PROBLEMS ? `; and ${problems.length - MAX_REPORTED_PROBLEMS} more` : '')
    throw new Error(constants.FEDRAMP_INTEGRITY_FILE_MISMATCH_ERROR.replace('{0}', summary))
  }
  info(`${LOG_PREFIX} CHECK 2 passed: ${manifest.files.length} files verified against ${constants.BRIDGE_CLI_MANIFEST_FILE_NAME}`)
}

// CHECK 3: re-hash the bridge-cli binary right before it is executed
export async function verifyBridgeBinary(bundleDir: string, manifest: BridgeManifest): Promise<void> {
  const entry = manifest.files.find(file => BRIDGE_BINARY_NAMES.includes(file.path))
  if (!entry) {
    fail('CHECK 3', 'the bridge-cli binary is not listed in the manifest', constants.FEDRAMP_INTEGRITY_BINARY_MISMATCH_ERROR)
  }
  const binaryPath = path.join(bundleDir, entry.path)
  if (!fs.existsSync(binaryPath) || (await sha256File(binaryPath)) !== entry.sha256) {
    fail('CHECK 3', `${entry.path} does not match the manifest`, constants.FEDRAMP_INTEGRITY_BINARY_MISMATCH_ERROR)
  }
  info(`${LOG_PREFIX} CHECK 3 passed: ${entry.path} verified immediately before execution`)
}
