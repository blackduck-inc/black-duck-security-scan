import * as fs from 'fs'
import * as os from 'os'
import path from 'path'
import {APPLICATION_NAME, GITHUB_ENVIRONMENT_VARIABLES} from '../application-constants'
import {rmRF} from '@actions/io'
import {getGitHubWorkspaceDir} from 'actions-artifact-v2/lib/internal/shared/config'
import * as constants from '../application-constants'
import {readFileSync, writeFileSync} from 'fs'
import {InputData} from './input-data/input-data'
import {BlackDuckSCA} from './input-data/blackduck'
import {Polaris} from './input-data/polaris'
import {isNullOrEmptyValue} from './validators'
import * as inputs from './inputs'
import {debug, warning, info} from '@actions/core'
import * as https from 'https'
import {HttpClient} from 'typed-rest-client/HttpClient'
import {getSSLConfig, getSSLConfigHash, createHTTPSAgent} from './ssl-utils'
import {lt, gte, coerce} from 'semver'

export function isVersionLess(version1: string, version2: string): boolean {
  const v1 = coerce(version1)
  const v2 = coerce(version2)
  return v1 != null && v2 != null && lt(v1, v2)
}

export function isVersionGreaterOrEqual(version1: string, version2: string): boolean {
  const v1 = coerce(version1)
  const v2 = coerce(version2)
  return v1 != null && v2 != null && gte(v1, v2)
}

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
  return !appendFilePath ? path.join(pwd, constants.BRIDGE_LOCAL_DIRECTORY, sarifReportDirectory) : path.join(pwd, constants.BRIDGE_LOCAL_DIRECTORY, sarifReportDirectory, constants.SARIF_DEFAULT_FILE_NAME)
}
export function getIntegrationDefaultSarifReportPath(sarifReportDirectory: string, appendFilePath: boolean): string {
  const pwd = getGitHubWorkspaceDir()
  info(`Using Integration SARIF Report Directory: ${sarifReportDirectory}`)
  const uploadPath = !appendFilePath ? path.join(pwd, constants.INTEGRATIONS_LOCAL_DIRECTORY, sarifReportDirectory) : path.join(pwd, constants.INTEGRATIONS_LOCAL_DIRECTORY, sarifReportDirectory, constants.SARIF_DEFAULT_FILE_NAME)
  info(`Upload default path: ${uploadPath}`)
  return uploadPath
}

export function isPullRequestEvent(): boolean {
  const eventName = process.env[GITHUB_ENVIRONMENT_VARIABLES.GITHUB_EVENT_NAME] || ''
  debug(`Github Event Name: ${eventName}`)
  return eventName === 'pull_request' || false
}

export function isGitHubCloud(): boolean {
  const githubServerUrl = process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_SERVER_URL] || ''
  return githubServerUrl === constants.GITHUB_CLOUD_URL || constants.GITHUB_DATA_RESIDENCY_URL_PATTERN.test(githubServerUrl)
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

// Update SARIF file path in the input JSON
export function updatePolarisSarifPath(productInputFilPath: string, sarifPath: string): void {
  try {
    // Read and parse the JSON file
    const jsonContent = readFileSync(productInputFilPath, 'utf-8')
    const config = JSON.parse(jsonContent) as InputData<Polaris>

    // Check if SARIF report creation is enabled and path exists
    if (config.data?.polaris?.reports?.sarif?.file) {
      config.data.polaris.reports.sarif.file.path = sarifPath

      // Write back the updated JSON with proper formatting
      writeFileSync(productInputFilPath, JSON.stringify(config, null, 2))
    } else {
      // Ensure data structure exists
      config.data = config.data || {}
      config.data.polaris = config.data.polaris || {}
      config.data.polaris.reports = config.data.polaris.reports || {}
      config.data.polaris.reports.sarif = config.data.polaris.reports.sarif || {}
      config.data.polaris.reports.sarif.file = config.data.polaris.reports.sarif.file || {}

      // Update path and write back
      config.data.polaris.reports.sarif.file.path = sarifPath
      writeFileSync(productInputFilPath, JSON.stringify(config, null, 2))
    }
  } catch (error) {
    info('Error updating SARIF file path.')
  }
}
// Update SARIF file path in the input JSON
export function updateBlackDuckSarifPath(productInputFilPath: string, sarifPath: string): void {
  try {
    // Read and parse the JSON file
    const jsonContent = readFileSync(productInputFilPath, 'utf-8')
    const config = JSON.parse(jsonContent) as InputData<BlackDuckSCA>

    // Check if SARIF report creation is enabled and path exists
    if (config.data?.blackducksca?.reports?.sarif?.file) {
      config.data.blackducksca.reports.sarif.file.path = sarifPath

      // Write back the updated JSON with proper formatting
      writeFileSync(productInputFilPath, JSON.stringify(config, null, 2))
    } else {
      // Ensure data structure exists
      config.data = config.data || {}
      config.data.blackducksca = config.data.blackducksca || {}
      config.data.blackducksca.reports = config.data.blackducksca.reports || {}
      config.data.blackducksca.reports.sarif = config.data.blackducksca.reports.sarif || {}
      config.data.blackducksca.reports.sarif.file = config.data.blackducksca.reports.sarif.file || {}

      // Update path and write back
      config.data.blackducksca.reports.sarif.file.path = sarifPath
      writeFileSync(productInputFilPath, JSON.stringify(config, null, 2))
    }
  } catch (error) {
    info('Error updating SARIF file path.')
  }
}

// Extract File name from the formatted command
export function extractInputJsonFilename(command: string): string {
  const match = command.match(/--input\s+([^\s]+)/)
  if (match && match[1]) {
    // Extract just the filename from the full path
    const fullPath = match[1]
    return fullPath || ''
  }
  return ''
}

export function updateSarifFilePaths(productInputFileName: string, bridgeVersion: string, productInputFilPath: string): void {
  if (productInputFileName === 'polaris_input.json') {
    const sarifPath = isVersionLess(bridgeVersion, constants.VERSION) ? (isNullOrEmptyValue(inputs.POLARIS_REPORTS_SARIF_FILE_PATH) ? path.join(constants.BRIDGE_LOCAL_DIRECTORY, constants.POLARIS_SARIF_GENERATOR_DIRECTORY, constants.SARIF_DEFAULT_FILE_NAME) : inputs.POLARIS_REPORTS_SARIF_FILE_PATH.trim()) : isNullOrEmptyValue(inputs.POLARIS_REPORTS_SARIF_FILE_PATH) ? constants.INTEGRATIONS_POLARIS_DEFAULT_SARIF_FILE_PATH : inputs.POLARIS_REPORTS_SARIF_FILE_PATH.trim()
    updatePolarisSarifPath(productInputFilPath, sarifPath)
  }

  if (productInputFileName === 'bd_input.json') {
    const sarifPath = isVersionLess(bridgeVersion, constants.VERSION) ? (isNullOrEmptyValue(inputs.BLACKDUCKSCA_REPORTS_SARIF_FILE_PATH) ? path.join(constants.BRIDGE_LOCAL_DIRECTORY, constants.BLACKDUCK_SARIF_GENERATOR_DIRECTORY, constants.SARIF_DEFAULT_FILE_NAME) : inputs.BLACKDUCKSCA_REPORTS_SARIF_FILE_PATH.trim()) : isNullOrEmptyValue(inputs.BLACKDUCKSCA_REPORTS_SARIF_FILE_PATH) ? constants.INTEGRATIONS_BLACKDUCK_SCA_DEFAULT_SARIF_FILE_PATH : inputs.BLACKDUCKSCA_REPORTS_SARIF_FILE_PATH.trim()
    updateBlackDuckSarifPath(productInputFilPath, sarifPath)
  }
}

export function updateCoverityConfigForBridgeVersion(productInputFileName: string, bridgeVersion: string, productInputFilePath: string): void {
  if (productInputFileName === 'coverity_input.json') {
    try {
      const inputFileContent = readFileSync(productInputFilePath, 'utf-8')
      const covData = JSON.parse(inputFileContent)

      // Use semantic version comparison
      if (covData.data?.coverity?.prcomment && isVersionLess(bridgeVersion, constants.COVERITY_PRCOMMENT_NEW_FORMAT_VERSION)) {
        // Convert new format to legacy format for Bridge CLI < 3.9.0
        debug(`Bridge CLI version ${bridgeVersion} < 3.9.0, converting to legacy automation format`)

        // Move prcomment to automation and remove prcomment
        covData.data.coverity.automation = {prcomment: true}
        delete covData.data.coverity.prcomment

        // Write the updated content back to the file
        writeFileSync(productInputFilePath, JSON.stringify(covData, null, 2))

        info('Converted Coverity PR comment configuration to legacy format for compatibility with Bridge CLI < 3.9.0')
      }
    } catch (error) {
      debug(`Failed to update Coverity configuration for bridge version compatibility: ${error}`)
    }
  }
}

// Singleton HTTPS agent cache for downloads (with proper system + custom CA combination)
let _httpsAgentCache: https.Agent | null = null
let _httpsAgentConfigHash: string | null = null

// Singleton HTTP client cache for GitHub API operations
let _httpClientCache: HttpClient | null = null
let _httpClientConfigHash: string | null = null

/**
 * Creates an HTTPS agent with SSL configuration based on action inputs.
 * Uses singleton pattern to reuse the same agent instance when configuration hasn't changed.
 * This properly combines system CAs with custom CAs unlike typed-rest-client.
 * Use this for direct HTTPS operations like file downloads.
 *
 * @returns HTTPS agent configured with appropriate SSL settings
 */
export function createSSLConfiguredHttpsAgent(targetUrl: string): https.Agent {
  const currentConfigHash = getSSLConfigHash()

  // Return cached agent if configuration hasn't changed
  if (_httpsAgentCache && _httpsAgentConfigHash === currentConfigHash) {
    debug('Reusing existing HTTPS agent instance')
    return _httpsAgentCache
  }

  // Get SSL configuration and create agent
  const sslConfig = getSSLConfig()
  _httpsAgentCache = createHTTPSAgent(sslConfig, targetUrl)

  // Cache the configuration hash
  _httpsAgentConfigHash = currentConfigHash
  debug('Created new HTTPS agent instance with SSL configuration')

  return _httpsAgentCache
}

/**
 * Creates an HttpClient instance with SSL configuration based on action inputs.
 * Uses singleton pattern to reuse the same client instance when configuration hasn't changed.
 * This uses typed-rest-client for structured API operations (GitHub API).
 * Note: typed-rest-client has limitations with combining system CAs + custom CAs.
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

  // Get SSL configuration
  const sslConfig = getSSLConfig()

  if (sslConfig.trustAllCerts) {
    debug('SSL certificate verification disabled for HttpClient (NETWORK_SSL_TRUST_ALL=true)')
    _httpClientCache = new HttpClient(userAgent, [], {ignoreSslError: true})
  } else if (sslConfig.customCA) {
    debug(`Using custom CA certificate for HttpClient: ${inputs.NETWORK_SSL_CERT_FILE}`)
    try {
      // Note: typed-rest-client has limitations with combining system CAs + custom CAs
      // For downloads, use createSSLConfiguredHttpsAgent() which properly combines CAs
      // For API operations, this fallback to caFile option (custom CA only) is acceptable
      _httpClientCache = new HttpClient(userAgent, [], {
        allowRetries: true,
        maxRetries: 3,
        cert: {
          caFile: inputs.NETWORK_SSL_CERT_FILE
        }
      })
      debug('HttpClient configured with custom CA certificate (Note: typed-rest-client limitation - system CAs not combined)')
    } catch (err) {
      warning(`Failed to configure custom CA certificate, using default HttpClient: ${err}`)
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
 * Gets a shared HTTPS agent with SSL configuration.
 * This properly combines system CAs with custom CAs for direct HTTPS operations.
 * Use this for file downloads and direct HTTPS requests.
 *
 * @returns HTTPS agent configured with appropriate SSL settings
 */
export function getSharedHttpsAgent(targetUrl: string): https.Agent {
  return createSSLConfiguredHttpsAgent(targetUrl)
}

/**
 * Gets a shared HttpClient instance with SSL configuration.
 * This is for GitHub API operations using typed-rest-client.
 * Use this for structured API operations that need typed responses.
 *
 * @returns HttpClient instance configured with appropriate SSL settings
 */
export function getSharedHttpClient(): HttpClient {
  return createSSLConfiguredHttpClient('BlackDuckSecurityAction')
}

/**
 * Clears both HTTPS agent and HTTP client caches. Useful for testing or when you need to force recreation.
 */
export function clearHttpClientCache(): void {
  _httpsAgentCache = null
  _httpsAgentConfigHash = null
  _httpClientCache = null
  _httpClientConfigHash = null
  debug('HTTP client and HTTPS agent caches cleared')
}
export function validateSourceUploadValue(bridgeVersion: string): void {
  if (isVersionGreaterOrEqual(bridgeVersion, constants.SOURCE_UPLOAD_UNSUPPORTED_BRIDGE_VERSION) && !isNullOrEmptyValue(inputs.POLARIS_ASSESSMENT_MODE)) {
    info('polaris_assessment_mode is deprecated. Use polaris_test_sast_location=remote and/or polaris_test_sca_location=remote for source upload scans instead.')
  }
}
