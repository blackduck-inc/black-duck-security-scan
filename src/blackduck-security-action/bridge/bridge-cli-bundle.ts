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

export class BridgeCliBundle extends BridgeClientBase {
  private static readonly BRIDGE_TYPE = 'bridge-cli-bundle'
  private static readonly BRIDGE_FILE_TYPE = 'bridge-cli'
  private static readonly VERSIONS_TXT = 'versions.txt'
  private static readonly BRIDGE_FILE_NAME = 'bridge-cli-bundle'

  private static readonly REGEX = {
    VERSION_PATTERN: new RegExp(`${BridgeCliBundle.BRIDGE_FILE_NAME}:\\s*([0-9.]+)`),
    LATEST_VERSION: new RegExp(`(${BridgeCliBundle.BRIDGE_FILE_NAME}-(win64|linux64|linux_arm|macosx|macos_arm)\\.zip)`),
    URL_PATTERN: new RegExp(`.*${BridgeCliBundle.BRIDGE_FILE_NAME}-([0-9.]*).*`)
  }

  private static readonly ERROR_MESSAGES = {
    AIR_GAP_VERSION_ERROR: "Unable to use the specified Bridge CLI version in air gap mode. Please provide a valid 'BRIDGE_CLI_BASE_URL'.",
    AIR_GAP_URL_ERROR: 'Air gap mode enabled and no BRIDGE_CLI_BASE_URL provided',
    LATEST_VERSION_ERROR: 'Unable to retrieve the latest Bridge CLI version from',
    WORKFLOW_VERSION_WARNING: 'Detected workflow version for Polaris, Black Duck SCA, Coverity, or SRM is not applicable for Bridge CLI Bundle.'
  }

  private osPlatform: string | undefined

  private static get VERSION_PATTERN(): RegExp {
    return BridgeCliBundle.REGEX.VERSION_PATTERN
  }

  // ---------------- Protected Methods ----------------
  protected async handleBridgeDownload(downloadResponse: DownloadFileResponse, extractZippedFilePath: string): Promise<void> {
    const extractPath = path.join(extractZippedFilePath, this.getBridgeType())
    debug(`Starting bridge download handling - extracting to: ${extractPath}`)

    await this.extractAndMoveBridge(downloadResponse, extractPath)
    await this.cleanupEmptyDirectory(extractPath)
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

  protected createUpdateVersionInfo(currentVersion: string, latestVersion: string): BridgeVersionInfo {
    info(`Bridge CLI already exists`)
    debug(`Bridge CLI exists with version ${currentVersion}, but latest version ${latestVersion} is available. Updating to latest.`)
    return {
      bridgeUrl: this.bridgeUrlLatestPattern,
      bridgeVersion: latestVersion
    }
  }

  protected createCurrentVersionInfo(currentVersion: string): BridgeVersionInfo {
    info('Bridge CLI already exists with the latest version')
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
    const baseUrl = await this.determineBaseUrl()

    if (baseUrl && baseUrl.trim() !== '') {
      this.setupBridgeUrls(baseUrl)
    }
  }

  // ---------------- Public Methods ----------------
  async downloadBridge(tempDir: string): Promise<void> {
    debug('Starting bridge download process...')
    await this.clearExistingBridge()
    return super.downloadBridge(tempDir)
  }

  generateFormattedCommand(stage: string, stateFilePath: string): string {
    debug(`Generating command for stage: ${stage}, state file: ${stateFilePath}`)
    this.logWorkflowVersionInfo()
    const command = this.buildCommand(stage, stateFilePath)
    info(`Generated command: ${command}`)
    return command
  }

  getBridgeCLIDownloadDefaultPath(): string {
    return this.getBridgeCLIDownloadPathCommon(false)
  }

  async validateAndSetBridgePath(): Promise<void> {
    const basePath = inputs.BRIDGE_CLI_INSTALL_DIRECTORY_KEY ? path.join(inputs.BRIDGE_CLI_INSTALL_DIRECTORY_KEY, this.getBridgeType()) : this.getBridgeDefaultPath()
    info(`Bridge CLI directory ${basePath}`)

    this.bridgePath = this.constructBridgePath(basePath)

    if (this.isAirGapMode()) {
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
    return BridgeCliBundle.BRIDGE_TYPE
  }

  getBridgeFileType(): string {
    return BridgeCliBundle.BRIDGE_FILE_TYPE
  }

  getBridgeFileNameType(): string {
    return BridgeCliBundle.BRIDGE_FILE_NAME
  }

  verifyRegexCheck(bridgeUrl: string): RegExpMatchArray | null {
    return bridgeUrl.match(BridgeCliBundle.REGEX.URL_PATTERN)
  }

  // ---------------- Private Methods ----------------
  private async clearExistingBridge(): Promise<void> {
    if (fs.existsSync(this.bridgePath)) {
      info(`Clear the existing bridge folder, if available from ${this.bridgePath}`)
      await rmRF(this.bridgePath)
    }
  }

  private constructBridgePath(basePath: string): string {
    const platformFolderName = `${this.getBridgeType()}-${this.osPlatform || this.getPlatformName()}`
    return path.join(basePath, platformFolderName)
  }

  private extractVersionFromContent(versionContent: string): string {
    const bundleMatch = versionContent.match(BridgeCliBundle.VERSION_PATTERN)
    return bundleMatch?.[1] || ''
  }

  private isVersionInContent(bridgeVersion: string, contents: string): boolean {
    return contents.includes(`${BridgeCliBundle.BRIDGE_TYPE}: ${bridgeVersion}`)
  }

  private async extractAndMoveBridge(downloadResponse: DownloadFileResponse, extractPath: string): Promise<void> {
    await extractZipped(downloadResponse.filePath, extractPath)
    debug('Bridge archive extraction completed')

    await this.moveBridgeFiles(downloadResponse.filePath, extractPath)
    debug('Bridge files moved to final location')
  }

  private async cleanupEmptyDirectory(extractPath: string): Promise<void> {
    if (fs.existsSync(extractPath) && fs.readdirSync(extractPath).length === 0) {
      fs.rmdirSync(extractPath)
      debug(`Removed empty extraction directory: ${extractPath}`)
    }
  }

  private async moveBridgeFiles(downloadFilePath: string, extractPath: string): Promise<void> {
    const zipFileName = path.basename(downloadFilePath, '.zip')
    const sourceFile = path.join(extractPath, zipFileName)

    debug(`Rename folder from ${sourceFile} to ${this.bridgePath}`)
    fs.renameSync(sourceFile, this.bridgePath)
  }

  private logWorkflowVersionInfo(): void {
    if (inputs.POLARIS_WORKFLOW_VERSION || inputs.BLACKDUCKSCA_WORKFLOW_VERSION || inputs.SRM_WORKFLOW_VERSION || inputs.COVERITY_WORKFLOW_VERSION) {
      info(BridgeCliBundle.ERROR_MESSAGES.WORKFLOW_VERSION_WARNING)
    }
  }

  private buildCommand(stage: string, stateFilePath: string): string {
    return [constants.BRIDGE_CLI_STAGE_OPTION, stage, constants.BRIDGE_CLI_INPUT_OPTION, stateFilePath].join(constants.BRIDGE_CLI_SPACE)
  }

  private getVersionFilePath(): string {
    return path.join(this.bridgePath, BridgeCliBundle.VERSIONS_TXT)
  }

  private async handleExistingBridge(): Promise<BridgeVersionInfo | null> {
    const currentVersion = await this.getBridgeVersion()

    if (!currentVersion) {
      return null
    }

    const latestVersionInfo = await this.getLatestVersionInfo()

    if (this.shouldUpdateBridge(currentVersion, latestVersionInfo.bridgeVersion)) {
      return this.createUpdateVersionInfo(currentVersion, latestVersionInfo.bridgeVersion)
    }

    return this.createCurrentVersionInfo(currentVersion)
  }
}
