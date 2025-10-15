import {ExecOptions} from '@actions/exec'
import {BridgeClientBase} from './bridge-client-base'
import {DownloadFileResponse, extractZipped} from '../download-utility'
import fs, {readFileSync} from 'fs'
import {debug, info} from '@actions/core'
import path from 'path'
import {checkIfPathExists} from '../utility'
import * as inputs from '../inputs'
import {rmRF} from '@actions/io'
import * as constants from '../../application-constants'

interface BridgeVersionInfo {
  bridgeUrl: string
  bridgeVersion: string
}

interface BridgeConstants {
  readonly BRIDGE_TYPE: string
  readonly BRIDGE_FILE_TYPE: string
  readonly VERSIONS_TXT: string
  readonly BRIDGE_FILE_NAME: string
}

interface BridgeRegexPatterns {
  readonly VERSION_PATTERN: RegExp
  readonly LATEST_VERSION: RegExp
  readonly URL_PATTERN: RegExp
}

interface BridgeErrorMessages {
  readonly AIR_GAP_VERSION_ERROR: string
  readonly AIR_GAP_URL_ERROR: string
  readonly LATEST_VERSION_ERROR: string
  readonly WORKFLOW_VERSION_WARNING: string
}

export class BridgeCliBundle extends BridgeClientBase {
  private static readonly CONSTANTS: BridgeConstants = {
    BRIDGE_TYPE: 'bridge-cli-bundle',
    BRIDGE_FILE_TYPE: 'bridge-cli',
    VERSIONS_TXT: 'versions.txt',
    BRIDGE_FILE_NAME: 'bridge-cli-bundle'
  } as const

  private static readonly REGEX: BridgeRegexPatterns = {
    get VERSION_PATTERN() {
      return new RegExp(`${BridgeCliBundle.CONSTANTS.BRIDGE_FILE_NAME}:\\s*([0-9.]+)`)
    },
    get LATEST_VERSION() {
      return new RegExp(`(${BridgeCliBundle.CONSTANTS.BRIDGE_FILE_NAME}-(win64|linux64|linux_arm|macosx|macos_arm)\\.zip)`)
    },
    get URL_PATTERN() {
      return new RegExp(`.*${BridgeCliBundle.CONSTANTS.BRIDGE_FILE_NAME}-([0-9.]*).*`)
    }
  } as const

  private static readonly ERROR_MESSAGES: BridgeErrorMessages = {
    AIR_GAP_VERSION_ERROR: "Unable to use the specified Bridge CLI version in air gap mode. Please provide a valid 'BRIDGE_CLI_BASE_URL'.",
    AIR_GAP_URL_ERROR: 'Air gap mode enabled and no BRIDGE_CLI_BASE_URL provided',
    LATEST_VERSION_ERROR: 'Unable to retrieve the latest Bridge CLI version from',
    WORKFLOW_VERSION_WARNING: 'Detected workflow version for Polaris, Black Duck SCA, Coverity, or SRM is not applicable for Bridge CLI Bundle.'
  } as const

  private osPlatform: string | undefined

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  async downloadBridge(tempDir: string): Promise<void> {
    debug('Starting bridge download process...')
    await this.clearExistingBridge()
    return super.downloadBridge(tempDir)
  }

  generateFormattedCommand(stage: string, stateFilePath: string): string {
    this.logWorkflowVersionInfo()
    const command = this.buildCommand(stage, stateFilePath)
    debug(`Generated command for stage: ${stage}, state file: ${stateFilePath} -> ${command}`)
    return command
  }

  getBridgeCLIDownloadDefaultPath(): string {
    return this.getBridgeCLIDownloadPathCommon(false)
  }

  async validateAndSetBridgePath(): Promise<void> {
    const basePath = this.validateAndGetBasePath()
    const platformFolderName = `${this.getBridgeType()}-${this.osPlatform || this.getPlatformName()}`
    this.bridgePath = path.join(basePath, platformFolderName)

    debug(`Bridge CLI directory ${this.bridgePath}`)

    if (this.isNetworkAirGapEnabled()) {
      await this.validateAirGapExecutable(this.bridgePath)
    }
  }

  async getBridgeVersion(): Promise<string> {
    const versionFilePath = this.getVersionFilePath()
    debug(`Reading bridge version from: ${versionFilePath}`)

    try {
      const versionContent = readFileSync(versionFilePath, 'utf-8')
      debug('Version file content read successfully')

      const version = this.extractVersionFromContent(versionContent)
      debug(`Extracted bridge version: ${version || 'not found'}`)
      return version
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      debug(`Error reading bridge version file: ${errorMessage}`)
      return ''
    }
  }

  async checkIfVersionExists(bridgeVersion: string, bridgeVersionFilePath: string): Promise<boolean> {
    try {
      const contents = readFileSync(bridgeVersionFilePath, 'utf-8')
      return this.isVersionInContent(bridgeVersion, contents)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      info(`Error reading version file content: ${errorMessage}`)
      return false
    }
  }

  async isBridgeInstalled(bridgeVersion: string): Promise<boolean> {
    if (!this.bridgePath) {
      await this.validateAndSetBridgePath()
    }

    const versionFilePath = this.getVersionFilePath()

    if (!checkIfPathExists(versionFilePath)) {
      debug(`Bridge CLI version file could not be found at ${versionFilePath}`)
      return false
    }

    debug(`Version file found at ${versionFilePath}`)
    return await this.checkIfVersionExists(bridgeVersion, versionFilePath)
  }

  async validateBridgeVersion(version: string): Promise<boolean> {
    const versions = await this.getAllAvailableBridgeVersions()
    return versions.includes(version.trim())
  }

  async executeCommand(bridgeCommand: string, execOptions: ExecOptions): Promise<number> {
    return this.runBridgeCommand(bridgeCommand, execOptions)
  }

  getBridgeType(): string {
    return BridgeCliBundle.CONSTANTS.BRIDGE_TYPE
  }

  getBridgeFileType(): string {
    return BridgeCliBundle.CONSTANTS.BRIDGE_FILE_TYPE
  }

  getBridgeFileNameType(): string {
    return BridgeCliBundle.CONSTANTS.BRIDGE_FILE_NAME
  }

  verifyRegexCheck(bridgeUrl: string): RegExpMatchArray | null {
    return bridgeUrl.match(BridgeCliBundle.REGEX.URL_PATTERN)
  }

  // ============================================================================
  // PROTECTED METHODS
  // ============================================================================

  protected async handleBridgeDownload(downloadResponse: DownloadFileResponse, extractZippedFilePath: string): Promise<void> {
    const extractPath = path.join(extractZippedFilePath, this.getBridgeType())
    debug(`Starting bridge download handling - extracting to: ${extractPath}`)

    await this.processDownloadedBridge(downloadResponse, extractPath)
  }

  protected async updateBridgeCLIVersion(requestedVersion: string): Promise<BridgeVersionInfo> {
    if (await this.validateBridgeVersion(requestedVersion)) {
      const bridgeUrl = this.getVersionUrl(requestedVersion).trim()
      return {bridgeUrl, bridgeVersion: requestedVersion}
    }

    throw new Error(constants.BRIDGE_VERSION_NOT_FOUND_ERROR)
  }

  protected async checkIfBridgeExistsInAirGap(): Promise<boolean> {
    if (!this.bridgePath) {
      await this.validateAndSetBridgePath()
    }
    const executablePath = path.join(this.bridgePath, this.getBridgeFileType())
    debug(`Validating air gap executable at: ${executablePath}`)
    return checkIfPathExists(executablePath)
  }

  protected getLatestVersionRegexPattern(): RegExp {
    return BridgeCliBundle.REGEX.LATEST_VERSION
  }

  protected async processBaseUrlWithLatest(): Promise<BridgeVersionInfo> {
    const normalizedVersionUrl = this.getNormalizedVersionUrl()
    const bridgeVersion = await this.getBridgeVersionFromLatestURL(normalizedVersionUrl)

    if (!bridgeVersion) {
      throw new Error(`${BridgeCliBundle.ERROR_MESSAGES.LATEST_VERSION_ERROR} ${normalizedVersionUrl}. Stopping execution.`)
    }

    if (await this.isBridgeInstalled(bridgeVersion)) {
      info('Bridge CLI already exists')
      return {bridgeUrl: '', bridgeVersion}
    }

    debug(`Retrieved bridge version: ${bridgeVersion}`)
    return {bridgeUrl: this.bridgeUrlLatestPattern, bridgeVersion}
  }

  protected async processLatestVersion(): Promise<BridgeVersionInfo> {
    const bridgeExists = await this.checkIfBridgeExistsLocally()

    if (bridgeExists) {
      try {
        const versionInfo = await this.handleExistingBridge()
        if (versionInfo) {
          return versionInfo
        }
      } catch (error) {
        debug(`Error checking bridge version: ${(error as Error).message}. Proceeding with latest version download.`)
      }
    }

    return this.processBaseUrlWithLatest()
  }

  protected createVersionInfo(currentVersion: string, latestVersion?: string): BridgeVersionInfo {
    if (latestVersion && this.shouldUpdateBridge(currentVersion, latestVersion)) {
      info('Bridge CLI already exists')
      debug(`Bridge CLI exists with version ${currentVersion}, but latest version ${latestVersion} is available. Updating to latest.`)
      return {
        bridgeUrl: this.bridgeUrlLatestPattern,
        bridgeVersion: latestVersion
      }
    }
    debug('Bridge CLI already exists with the latest version')
    return {
      bridgeUrl: '',
      bridgeVersion: currentVersion
    }
  }

  protected setupBridgeUrls(baseUrl: string): void {
    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
    this.bridgeArtifactoryURL = `${normalizedBaseUrl}${this.getBridgeType()}`
    this.bridgeUrlPattern = `${normalizedBaseUrl}${this.getBridgeType()}/$version/${this.getBridgeFileNameType()}-$version-$platform.zip`
    this.bridgeUrlLatestPattern = `${normalizedBaseUrl}${this.getBridgeType()}/latest/${this.getBridgeFileNameType()}-${this.getPlatformName()}.zip`
  }

  protected async initializeUrls(): Promise<void> {
    this.osPlatform = this.getPlatformName()
    this.setupBridgeUrls(await this.determineBaseUrl())
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async clearExistingBridge(): Promise<void> {
    if (fs.existsSync(this.bridgePath)) {
      info(`Clear the existing bridge folder, if available from ${this.bridgePath}`)
      await rmRF(this.bridgePath)
    }
  }

  private extractVersionFromContent(versionContent: string): string {
    const bundleMatch = versionContent.match(BridgeCliBundle.REGEX.VERSION_PATTERN)
    return bundleMatch?.[1] || ''
  }

  private isVersionInContent(bridgeVersion: string, contents: string): boolean {
    return contents.includes(`${BridgeCliBundle.CONSTANTS.BRIDGE_TYPE}: ${bridgeVersion}`)
  }

  private async processDownloadedBridge(downloadResponse: DownloadFileResponse, extractPath: string): Promise<void> {
    await extractZipped(downloadResponse.filePath, extractPath)
    debug('Bridge archive extraction completed')

    await this.moveBridgeFiles(downloadResponse.filePath, extractPath)
    debug('Bridge files moved to final location')

    await this.cleanupEmptyDirectory(extractPath)
  }

  private async cleanupEmptyDirectory(extractPath: string): Promise<void> {
    try {
      if (fs.existsSync(extractPath) && fs.readdirSync(extractPath).length === 0) {
        fs.rmdirSync(extractPath)
        debug(`Removed empty extraction directory: ${extractPath}`)
      }
    } catch (error) {
      debug(`Failed to cleanup directory ${extractPath}: ${(error as Error).message}`)
    }
  }

  private async moveBridgeFiles(downloadFilePath: string, extractPath: string): Promise<void> {
    const zipFileName = path.basename(downloadFilePath, '.zip')
    const sourceFile = path.join(extractPath, zipFileName)

    debug(`Moving bridge files from ${sourceFile} to ${this.bridgePath}`)
    try {
      fs.renameSync(sourceFile, this.bridgePath)
    } catch (error) {
      throw new Error(`Failed to move bridge files: ${(error as Error).message}`)
    }
  }

  private logWorkflowVersionInfo(): void {
    const workflowVersions = [inputs.POLARIS_WORKFLOW_VERSION, inputs.BLACKDUCKSCA_WORKFLOW_VERSION, inputs.SRM_WORKFLOW_VERSION, inputs.COVERITY_WORKFLOW_VERSION]

    if (workflowVersions.some(version => version)) {
      info(BridgeCliBundle.ERROR_MESSAGES.WORKFLOW_VERSION_WARNING)
    }
  }

  private buildCommand(stage: string, stateFilePath: string): string {
    return [constants.BRIDGE_CLI_STAGE_OPTION, stage, constants.BRIDGE_CLI_INPUT_OPTION, stateFilePath].join(constants.BRIDGE_CLI_SPACE)
  }

  private getVersionFilePath(): string {
    return path.join(this.bridgePath, BridgeCliBundle.CONSTANTS.VERSIONS_TXT)
  }

  private async handleExistingBridge(): Promise<BridgeVersionInfo | null> {
    const currentVersion = await this.getBridgeVersion()

    if (!currentVersion) {
      return null
    }

    const latestVersionInfo = await this.getLatestVersionInfo()
    return this.createVersionInfo(currentVersion, latestVersionInfo.bridgeVersion)
  }
}
