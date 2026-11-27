import * as crypto from 'crypto'
import * as fs from 'fs'
import * as os from 'os'
import path from 'path'
import {downloadSignatureFile, readManifest, verifyBridgeBinary, verifyBundleFiles, verifyBundleSignature} from '../../../src/blackduck-security-action/bridge-integrity'
import * as constants from '../../../src/application-constants'
import * as toolCache from '../../../src/blackduck-security-action/tool-cache-local'

jest.mock('@actions/core')

const sha256 = (content: string): string => crypto.createHash('sha256').update(content).digest('hex')

let workDir: string

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-integrity-'))
})

afterEach(() => {
  fs.rmSync(workDir, {recursive: true, force: true})
  jest.restoreAllMocks()
})

// Creates a bundle folder with the given files and a matching manifest.json
function createBundle(files: Record<string, string>, executables: string[] = ['bridge-cli']): string {
  const bundleDir = path.join(workDir, 'bundle')
  fs.mkdirSync(bundleDir, {recursive: true})
  const entries = Object.entries(files).map(([relativePath, content]) => {
    const fullPath = path.join(bundleDir, relativePath)
    fs.mkdirSync(path.dirname(fullPath), {recursive: true})
    fs.writeFileSync(fullPath, content)
    const executable = executables.includes(relativePath)
    fs.chmodSync(fullPath, executable ? 0o755 : 0o644)
    return {path: relativePath, sha256: sha256(content), executable}
  })
  fs.writeFileSync(path.join(bundleDir, constants.BRIDGE_CLI_MANIFEST_FILE_NAME), JSON.stringify({files: entries}))
  return bundleDir
}

describe('CHECK 1: verifyBundleSignature', () => {
  const {publicKey, privateKey} = crypto.generateKeyPairSync('ec', {namedCurve: 'prime256v1'})
  const publicKeyPem = publicKey.export({type: 'spki', format: 'pem'}).toString()

  const writeZipAndSignature = (zipContent: string, signWith: crypto.KeyObject = privateKey): {zip: string; sig: string} => {
    const zip = path.join(workDir, 'bridge-cli-fips-bundle-linux64.zip')
    const sig = `${zip}.sig`
    fs.writeFileSync(zip, 'ORIGINAL ZIP BYTES')
    const signature = crypto.sign('sha256', Buffer.from(zipContent), {key: signWith, dsaEncoding: 'der'})
    fs.writeFileSync(sig, signature.toString('base64'))
    return {zip, sig}
  }

  it('accepts a valid signature', async () => {
    const {zip, sig} = writeZipAndSignature('ORIGINAL ZIP BYTES')
    await expect(verifyBundleSignature(zip, sig, publicKeyPem)).resolves.toBeUndefined()
  })

  it('rejects a tampered ZIP', async () => {
    const {zip, sig} = writeZipAndSignature('ORIGINAL ZIP BYTES')
    fs.writeFileSync(zip, 'TAMPERED ZIP BYTES')
    await expect(verifyBundleSignature(zip, sig, publicKeyPem)).rejects.toThrow(constants.FEDRAMP_INTEGRITY_SIGNATURE_INVALID_ERROR)
  })

  it('rejects a signature made with a different key', async () => {
    const other = crypto.generateKeyPairSync('ec', {namedCurve: 'prime256v1'})
    const {zip, sig} = writeZipAndSignature('ORIGINAL ZIP BYTES', other.privateKey)
    await expect(verifyBundleSignature(zip, sig, publicKeyPem)).rejects.toThrow(constants.FEDRAMP_INTEGRITY_SIGNATURE_INVALID_ERROR)
  })

  it('rejects a missing signature file', async () => {
    const {zip, sig} = writeZipAndSignature('ORIGINAL ZIP BYTES')
    fs.rmSync(sig)
    await expect(verifyBundleSignature(zip, sig, publicKeyPem)).rejects.toThrow(constants.FEDRAMP_INTEGRITY_SIGNATURE_INVALID_ERROR)
  })

  it('rejects a garbage signature', async () => {
    const {zip, sig} = writeZipAndSignature('ORIGINAL ZIP BYTES')
    fs.writeFileSync(sig, 'not-a-signature')
    await expect(verifyBundleSignature(zip, sig, publicKeyPem)).rejects.toThrow(constants.FEDRAMP_INTEGRITY_SIGNATURE_INVALID_ERROR)
  })

  it('rejects an invalid public key', async () => {
    const {zip, sig} = writeZipAndSignature('ORIGINAL ZIP BYTES')
    await expect(verifyBundleSignature(zip, sig, 'not a pem key')).rejects.toThrow(constants.FEDRAMP_INTEGRITY_SIGNATURE_INVALID_ERROR)
  })

  it('fails closed when no public key is configured', async () => {
    const {zip, sig} = writeZipAndSignature('ORIGINAL ZIP BYTES')
    await expect(verifyBundleSignature(zip, sig, '')).rejects.toThrow(constants.FEDRAMP_INTEGRITY_PUBLIC_KEY_MISSING_ERROR)
  })

  it('fails closed with the default (not yet embedded) public key', async () => {
    const {zip, sig} = writeZipAndSignature('ORIGINAL ZIP BYTES')
    expect(constants.BRIDGE_CLI_SIGNING_PUBLIC_KEY_PEM).toBe('')
    await expect(verifyBundleSignature(zip, sig)).rejects.toThrow(constants.FEDRAMP_INTEGRITY_PUBLIC_KEY_MISSING_ERROR)
  })
})

describe('signature download', () => {
  it('downloads <bundle>.zip.sig next to the bundle', async () => {
    const downloadSpy = jest.spyOn(toolCache, 'downloadTool').mockResolvedValue('/tmp/x.zip.sig')
    const result = await downloadSignatureFile('https://repo.blackduck.com/x/bridge-cli-fips-bundle/3.9.0/bridge-cli-fips-bundle-3.9.0-linux64.zip', workDir)
    expect(result).toBe('/tmp/x.zip.sig')
    expect(downloadSpy).toHaveBeenCalledWith('https://repo.blackduck.com/x/bridge-cli-fips-bundle/3.9.0/bridge-cli-fips-bundle-3.9.0-linux64.zip.sig', path.join(workDir, 'bridge-cli-fips-bundle-3.9.0-linux64.zip.sig'))
  })

  it('fails closed when the signature cannot be downloaded', async () => {
    jest.spyOn(toolCache, 'downloadTool').mockRejectedValue(new Error('Unexpected HTTP response: 404'))
    await expect(downloadSignatureFile('https://repo.blackduck.com/x/bridge.zip', workDir)).rejects.toThrow(constants.FEDRAMP_INTEGRITY_SIGNATURE_DOWNLOAD_ERROR)
  })
})

describe('manifest parsing', () => {
  const writeManifest = (content: unknown): string => {
    const bundleDir = path.join(workDir, 'bundle')
    fs.mkdirSync(bundleDir, {recursive: true})
    fs.writeFileSync(path.join(bundleDir, constants.BRIDGE_CLI_MANIFEST_FILE_NAME), typeof content === 'string' ? content : JSON.stringify(content))
    return bundleDir
  }
  const goodHash = sha256('x')

  it('parses a valid manifest', () => {
    const dir = writeManifest({files: [{path: 'bridge-cli', sha256: goodHash.toUpperCase(), executable: true}]})
    expect(readManifest(dir).files).toEqual([{path: 'bridge-cli', sha256: goodHash, executable: true}])
  })

  it.each([
    ['missing manifest', null],
    ['invalid JSON', '{not json'],
    ['no files array', {}],
    ['empty files array', {files: []}],
    ['bad sha256', {files: [{path: 'a', sha256: 'abc'}]}],
    ['path traversal', {files: [{path: '../evil', sha256: goodHash}]}],
    ['absolute path', {files: [{path: '/etc/passwd', sha256: goodHash}]}],
    ['drive path', {files: [{path: 'C:/evil', sha256: goodHash}]}],
    ['duplicate path', {files: [{path: 'a', sha256: goodHash}, {path: 'a', sha256: goodHash}]}]
  ])('rejects %s', (_name, content) => {
    const dir = content === null ? path.join(workDir, 'empty') : writeManifest(content)
    fs.mkdirSync(dir, {recursive: true})
    expect(() => readManifest(dir)).toThrow(constants.FEDRAMP_INTEGRITY_MANIFEST_INVALID_ERROR)
  })
})

describe('CHECK 2: verifyBundleFiles', () => {
  it('accepts an untouched bundle', async () => {
    const dir = createBundle({'bridge-cli': 'binary', 'adapters/a.json': '{}', 'versions.txt': 'bridge-cli-fips-bundle: 3.9.0'})
    await expect(verifyBundleFiles(dir, readManifest(dir))).resolves.toBeUndefined()
  })

  it('rejects a modified file', async () => {
    const dir = createBundle({'bridge-cli': 'binary', 'adapters/a.json': '{}'})
    fs.writeFileSync(path.join(dir, 'adapters/a.json'), '{"tampered":true}')
    await expect(verifyBundleFiles(dir, readManifest(dir))).rejects.toThrow('hash mismatch: adapters/a.json')
  })

  it('rejects a missing file', async () => {
    const dir = createBundle({'bridge-cli': 'binary', 'adapters/a.json': '{}'})
    fs.rmSync(path.join(dir, 'adapters/a.json'))
    await expect(verifyBundleFiles(dir, readManifest(dir))).rejects.toThrow('missing: adapters/a.json')
  })

  it('rejects an extra file', async () => {
    const dir = createBundle({'bridge-cli': 'binary'})
    fs.writeFileSync(path.join(dir, 'malware.sh'), 'evil')
    await expect(verifyBundleFiles(dir, readManifest(dir))).rejects.toThrow('unexpected file: malware.sh')
  })

  it('rejects an extra file in a nested folder', async () => {
    const dir = createBundle({'bridge-cli': 'binary'})
    fs.mkdirSync(path.join(dir, 'adapters'))
    fs.writeFileSync(path.join(dir, 'adapters', 'extra.bin'), 'evil')
    await expect(verifyBundleFiles(dir, readManifest(dir))).rejects.toThrow('unexpected file: adapters/extra.bin')
  })

  it('reports every problem together', async () => {
    const dir = createBundle({'bridge-cli': 'binary', 'a.txt': 'a'})
    fs.writeFileSync(path.join(dir, 'a.txt'), 'changed')
    fs.writeFileSync(path.join(dir, 'extra.txt'), 'extra')
    await expect(verifyBundleFiles(dir, readManifest(dir))).rejects.toThrow(/hash mismatch: a\.txt; unexpected file: extra\.txt/)
  })

  const itPosix = process.platform === 'win32' ? it.skip : it
  itPosix('rejects a changed executable bit', async () => {
    const dir = createBundle({'bridge-cli': 'binary'})
    fs.chmodSync(path.join(dir, 'bridge-cli'), 0o644)
    await expect(verifyBundleFiles(dir, readManifest(dir))).rejects.toThrow('executable bit mismatch: bridge-cli')
  })
})

describe('CHECK 3: verifyBridgeBinary', () => {
  it('accepts an untouched binary', async () => {
    const dir = createBundle({'bridge-cli': 'binary'})
    await expect(verifyBridgeBinary(dir, readManifest(dir))).resolves.toBeUndefined()
  })

  it('rejects a binary replaced after CHECK 2', async () => {
    const dir = createBundle({'bridge-cli': 'binary'})
    const manifest = readManifest(dir)
    await verifyBundleFiles(dir, manifest)
    fs.writeFileSync(path.join(dir, 'bridge-cli'), 'replaced after check 2')
    await expect(verifyBridgeBinary(dir, manifest)).rejects.toThrow(constants.FEDRAMP_INTEGRITY_BINARY_MISMATCH_ERROR)
  })

  it('rejects when the binary is missing', async () => {
    const dir = createBundle({'bridge-cli': 'binary'})
    const manifest = readManifest(dir)
    fs.rmSync(path.join(dir, 'bridge-cli'))
    await expect(verifyBridgeBinary(dir, manifest)).rejects.toThrow(constants.FEDRAMP_INTEGRITY_BINARY_MISMATCH_ERROR)
  })

  it('rejects when the binary is not listed in the manifest', async () => {
    const dir = createBundle({'other.txt': 'x'})
    await expect(verifyBridgeBinary(dir, readManifest(dir))).rejects.toThrow(constants.FEDRAMP_INTEGRITY_BINARY_MISMATCH_ERROR)
  })
})
