import * as fs from 'fs'
import * as os from 'os'
import path from 'path'
import {APPLICATION_NAME, GITHUB_ENVIRONMENT_VARIABLES} from '../application-constants'
import {rmRF} from '@actions/io'
import {getGitHubWorkspaceDir} from 'actions-artifact-v2/lib/internal/shared/config'
import * as constants from '../application-constants'
import {debug, warning} from '@actions/core'
import {HttpClient} from 'typed-rest-client/HttpClient'
import * as inputs from './inputs'

export function cleanUrl(url: string): string {
  if (url && url.endsWith('/')) {
    return url.slice(0, url.length - 1)
  }
  return url
}

export async function createTempDir(): Promise<string> {
  const appPrefix = APPLICATION_NAME
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), appPrefix))

  return tempDir
}

export async function cleanupTempDir(tempDir: string): Promise<void> {
  if (tempDir && fs.existsSync(tempDir)) {
    await rmRF(tempDir)
  }
}

export function checkIfGithubHostedAndLinux(): boolean {
  return String(process.env['RUNNER_NAME']).includes('Hosted Agent') && (process.platform === 'linux' || process.platform === 'darwin')
}

export function parseToBoolean(value: string | boolean): boolean {
  if (value !== null && value !== '' && (value.toString().toLowerCase() === 'true' || value === true)) {
    return true
  }
  return false
}

export function isBoolean(value: string | boolean): boolean {
  if (value !== null && value !== '' && (value.toString().toLowerCase() === 'true' || value === true || value.toString().toLowerCase() === 'false' || value === false)) {
    return true
  }
  return false
}

export function checkIfPathExists(fileOrDirectoryPath: string): boolean {
  if (fileOrDirectoryPath && fs.existsSync(fileOrDirectoryPath.trim())) {
    return true
  }
  return false
}

export async function sleep(duration: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, duration)
  })
}

export function getDefaultSarifReportPath(sarifReportDirectory: string, appendFilePath: boolean): string {
  const pwd = getGitHubWorkspaceDir()
  return !appendFilePath ? path.join(pwd, constants.INTEGRATIONS_LOCAL_DIRECTORY, sarifReportDirectory) : path.join(pwd, constants.INTEGRATIONS_LOCAL_DIRECTORY, sarifReportDirectory, constants.SARIF_DEFAULT_FILE_NAME)
}

export function isPullRequestEvent(): boolean {
  const eventName = process.env[GITHUB_ENVIRONMENT_VARIABLES.GITHUB_EVENT_NAME] || ''
  debug(`Github Event Name: ${eventName}`)
  return eventName === 'pull_request' || false
}

export function isGitHubCloud(): boolean {
  const githubServerUrl = process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_SERVER_URL] || ''
  return githubServerUrl === constants.GITHUB_CLOUD_URL
}

export function getRealSystemTime(): string {
  return String(new Date().getTime())
}

export function checkJobResult(buildStatus?: string): string | undefined {
  if (buildStatus && Object.values(constants.BUILD_STATUS).includes(buildStatus as constants.BUILD_STATUS)) {
    return buildStatus
  } else if (buildStatus) {
    debug(`Unsupported value for ${constants.MARK_BUILD_STATUS_KEY}: ${buildStatus}`)
  }
  return undefined
}

// Singleton HTTP client cache
let _httpClientCache: HttpClient | null = null
let _httpClientConfigHash: string | null = null

/**
 * Gets the current SSL configuration as a hash to detect changes
 */
function getSSLConfigHash(): string {
  const trustAll = parseToBoolean(inputs.NETWORK_SSL_TRUST_ALL)
  const certFile = inputs.NETWORK_SSL_CERT_FILE?.trim() || ''
  return `trustAll:${trustAll}|certFile:${certFile}`
}

/**
 * Creates an HttpClient instance with SSL configuration based on action inputs.
 * Uses singleton pattern to reuse the same client instance when configuration hasn't changed.
 *
 * @param userAgent The user agent string to use for the HTTP client (default: "BlackDuckSecurityAction")
 * @returns HttpClient instance configured with appropriate SSL settings
 */
export function createSSLConfiguredHttpClient(userAgent = 'BlackDuckSecurityAction'): HttpClient {
  const currentConfigHash = getSSLConfigHash()

  // Return cached client if configuration hasn't changed
  if (_httpClientCache && _httpClientConfigHash === currentConfigHash) {
    debug(`Reusing existing HttpClient instance with user agent: ${userAgent}`)
    return _httpClientCache
  }

  // Create new HTTP client with current configuration
  const trustAllCerts = parseToBoolean(inputs.NETWORK_SSL_TRUST_ALL)

  if (trustAllCerts) {
    debug('SSL certificate verification disabled for HttpClient (NETWORK_SSL_TRUST_ALL=true)')
    _httpClientCache = new HttpClient(userAgent, [], {ignoreSslError: true})
  } else if (inputs.NETWORK_SSL_CERT_FILE) {
    debug(`Using custom CA certificate for HttpClient: ${inputs.NETWORK_SSL_CERT_FILE}`)
    try {
      // Read and validate the certificate file exists and is readable
      fs.readFileSync(inputs.NETWORK_SSL_CERT_FILE, 'utf8')
      debug('Successfully validated custom CA certificate file')

      // Configure HttpClient with custom CA certificate
      _httpClientCache = new HttpClient(userAgent, [], {
        allowRetries: true,
        maxRetries: 3,
        cert: {
          caFile: inputs.NETWORK_SSL_CERT_FILE
        }
      })
      debug('HttpClient configured with custom CA certificate')
    } catch (err) {
      warning(`Failed to read custom CA certificate file, using default HttpClient: ${err}`)
      _httpClientCache = new HttpClient(userAgent)
    }
  } else {
    debug('Using default HttpClient with system SSL certificates')
    _httpClientCache = new HttpClient(userAgent)
  }

  // Cache the configuration hash
  _httpClientConfigHash = currentConfigHash
  debug(`Created new HttpClient instance with user agent: ${userAgent}`)

  return _httpClientCache
}

/**
 * Gets a shared HttpClient instance with SSL configuration.
 * This is a convenience method that uses a default user agent.
 *
 * @returns HttpClient instance configured with appropriate SSL settings
 */
export function getSharedHttpClient(): HttpClient {
  return createSSLConfiguredHttpClient('BlackDuckSecurityAction')
}

/**
 * Clears the HTTP client cache. Useful for testing or when you need to force recreation.
 */
export function clearHttpClientCache(): void {
  _httpClientCache = null
  _httpClientConfigHash = null
  debug('HTTP client cache cleared')
}
