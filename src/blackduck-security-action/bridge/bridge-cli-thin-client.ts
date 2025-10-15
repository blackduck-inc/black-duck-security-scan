import {ExecOptions} from '@actions/exec'
import {BridgeClientBase} from './bridge-client-base'
import * as inputs from '../inputs'
import {debug, info} from '@actions/core'
import path from 'path'
import {checkIfPathExists, getOSPlatform, parseToBoolean} from '../utility'
import {execSync} from 'node:child_process'
import * as constants from '../../application-constants'
import {DownloadFileResponse, extractZipped} from '../download-utility'

interface BridgeVersionInfo {
  bridgeUrl: string
  bridgeVersion: string
}

export class BridgeCliThinClient extends BridgeClientBase {
  private static readonly BRIDGE_TYPE = 'bridge-cli-thin-client'
  private static readonly BRIDGE_FILE_TYPE = 'bridge-cli'
  private static readonly BRIDGE_FILE_NAME = 'bridge-cli'
  private static readonly BRIDGE_CLI_COMMANDS = {
    UPDATE: '--update',
    VERSION: '--version',
    REGISTER: ' --register',
    USE: '--use'
  } as const

  private currentVersion: string | undefined

  private static readonly ERROR_MESSAGES = {
    AIR_GAP_VERSION_ERROR: "Unable to use the specified Bridge CLI version in air gap mode. Please provide a valid 'BRIDGE_CLI_BASE_URL'.",
    AIR_GAP_URL_ERROR: 'Air gap mode enabled and no BRIDGE_CLI_BASE_URL provided',
    LATEST_VERSION_ERROR: 'Unable to retrieve the latest Bridge CLI version from',
    WORKFLOW_VERSION_WARNING: 'Detected workflow version for Polaris, Black Duck SCA, Coverity, or SRM is not applicable for Bridge CLI Bundle.'
  } as const

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  getBridgeType(): string {
    return BridgeCliThinClient.BRIDGE_TYPE
  }

  getBridgeFileNameType(): string {
    return BridgeCliThinClient.BRIDGE_FILE_NAME
  }

  getBridgeFileType(): string {
    return BridgeCliThinClient.BRIDGE_FILE_TYPE
  }

  generateFormattedCommand(stage: string, stateFilePath: string, workflowVersion?: string): string {
    debug(`Generating command for stage: ${stage}, state file: ${stateFilePath}`)
    const command = this.buildCommand(stage, stateFilePath, workflowVersion)
    info(`Generated command: ${command}`)
    return command
  }

  async getBridgeVersion(): Promise<string> {
    const bridgeExecutable = this.getBridgeExecutablePath()
    debug(`Getting bridge version from executable: ${bridgeExecutable}`)

    try {
      return execSync(`${bridgeExecutable} ${BridgeCliThinClient.BRIDGE_CLI_COMMANDS.VERSION}`).toString().trim()
    } catch (error) {
      throw new Error(`Failed to get bridge version: ${(error as Error).message}`)
    }
  }

  async validateAndSetBridgePath(): Promise<void> {
    let basePath: string
    if (inputs.BRIDGE_CLI_INSTALL_DIRECTORY_KEY) {
      basePath = path.join(inputs.BRIDGE_CLI_INSTALL_DIRECTORY_KEY, this.getBridgeType())
    } else {
      basePath = this.getBridgeDefaultPath()
    }
    info(`Bridge CLI directory ${basePath}`)

    const platformFolderName = this.getBridgeFileType().concat('-').concat(getOSPlatform())
    this.bridgePath = path.join(basePath, platformFolderName)
    if (this.isNetworkAirGapEnabled()) await this.validateAirGapExecutable(this.bridgePath)
  }

  getBridgeCLIDownloadDefaultPath(): string {
    return this.getBridgeCLIDownloadPathCommon(true)
  }

  async isBridgeInstalled(bridgeVersion: string): Promise<boolean> {
    try {
      await this.ensureBridgePathIsSet()
      const bridgeExecutable = this.getBridgeExecutablePath()

      if (!checkIfPathExists(bridgeExecutable)) {
        debug('Bridge executable does not exist')
        return false
      }

      this.currentVersion = await this.getBridgeVersion()
      return this.currentVersion === bridgeVersion
    } catch (error: unknown) {
      debug(`Failed to get bridge version: ${(error as Error).message}`)
      throw error
    }
  }

  async validateBridgeVersion(version: string): Promise<boolean> {
    const versions = await this.getAllAvailableBridgeVersions()
    return versions.includes(version.trim())
  }

  setupBridgeUrls(baseUrl: string): void {
    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
    const bridgeType = this.getBridgeType()
    const fileNameType = this.getBridgeFileNameType()
    const platformName = this.getPlatformName()

    this.bridgeArtifactoryURL = `${normalizedBaseUrl}${bridgeType}`
    this.bridgeUrlPattern = `${normalizedBaseUrl}${bridgeType}/$version/${fileNameType}-$platform.zip`
    this.bridgeUrlLatestPattern = `${normalizedBaseUrl}${bridgeType}/latest/${fileNameType}-${platformName}.zip`
  }

  // ============================================================================
  // PROTECTED METHODS
  // ============================================================================

  protected async initializeUrls(): Promise<void> {
    this.setupBridgeUrls(await this.determineBaseUrl())
  }

  protected async executeCommand(bridgeCommand: string, execOptions: ExecOptions): Promise<number> {
    if (!inputs.BRIDGE_CLI_REGISTRY_URL) debug('Registry URL is empty')
    if (inputs.BRIDGE_CLI_REGISTRY_URL && (await this.runBridgeCommand(this.buildRegisterCommand(), execOptions)) !== 0) {
      throw new Error('Register command failed, returning early')
    }
    return this.runBridgeCommand(bridgeCommand, execOptions)
  }

  protected async handleBridgeDownload(downloadResponse: DownloadFileResponse, extractZippedFilePath: string): Promise<void> {
    debug(`Starting bridge download handling - extracting to: ${extractZippedFilePath}`)

    // Extract the zip file name without extension to create the target folder
    const zipFileName = path.basename(downloadResponse.filePath, '.zip')
    const targetExtractionPath = path.join(extractZippedFilePath, zipFileName)

    debug(`Creating target extraction folder: ${targetExtractionPath}`)

    await extractZipped(downloadResponse.filePath, targetExtractionPath)
    debug('Bridge archive extraction completed to '.concat(extractZippedFilePath))
  }

  protected verifyRegexCheck(bridgeUrl: string): RegExpMatchArray | null {
    const bridgeType = `${this.getBridgeFileType()}-${getOSPlatform()}`

    // First check if URL contains "latest" - if so, return a match with empty string
    if (bridgeUrl.includes('/latest/')) {
      debug(`URL contains 'latest', returning empty string as version`)
      return ['', ''] as RegExpMatchArray
    }

    return this.matchVersionPattern(bridgeUrl, bridgeType)
  }

  protected async updateBridgeCLIVersion(requestedVersion: string): Promise<{bridgeUrl: string; bridgeVersion: string}> {
    const bridgeExecutablePath = this.getBridgeExecutablePath()
    const executableExists = checkIfPathExists(bridgeExecutablePath)

    // Always validate version for both air gap and non-air gap modes
    const isValidVersion = await this.validateBridgeVersion(requestedVersion)
    if (!isValidVersion) {
      throw new Error(constants.BRIDGE_VERSION_NOT_FOUND_ERROR)
    }

    // Use existing executable or provide download URL
    if (executableExists) {
      info('Bridge CLI already exists, download has been skipped')
      await this.executeUseBridgeCommand(bridgeExecutablePath, requestedVersion)
      return {bridgeUrl: '', bridgeVersion: requestedVersion}
    }

    return {bridgeUrl: this.getVersionUrl(requestedVersion), bridgeVersion: requestedVersion}
  }

  protected async checkIfBridgeExistsInAirGap(): Promise<boolean> {
    if (!this.bridgePath) {
      await this.validateAndSetBridgePath()
    }
    const executablePath = this.getBridgeExecutablePath()
    debug(`Validating air gap executable at: ${executablePath}`)
    return checkIfPathExists(executablePath)
  }

  protected getLatestVersionRegexPattern(): RegExp {
    return new RegExp(`(${BridgeCliThinClient.BRIDGE_FILE_TYPE}-(win64|linux64|linux_arm|macosx|macos_arm)\\.zip)`)
  }

  protected async processBaseUrlWithLatest(): Promise<BridgeVersionInfo> {
    const normalizedVersionUrl = this.getNormalizedVersionUrl()
    const bridgeVersion = await this.getBridgeVersionFromLatestURL(normalizedVersionUrl)

    if (!bridgeVersion) {
      throw new Error(`${BridgeCliThinClient.ERROR_MESSAGES.LATEST_VERSION_ERROR} ${normalizedVersionUrl}. Stopping execution.`)
    }

    debug(`Retrieved bridge version: ${bridgeVersion}`)
    return {bridgeUrl: this.bridgeUrlLatestPattern, bridgeVersion}
  }

  protected async processLatestVersion(): Promise<BridgeVersionInfo> {
    if (!(await this.checkIfBridgeExistsLocally())) {
      return this.processBaseUrlWithLatest()
    }

    try {
      // Use cached version if available, otherwise get it once
      this.currentVersion ??= await this.getBridgeVersion()
      const latestVersionInfo = await this.getLatestVersionInfo()

      if (latestVersionInfo.bridgeVersion && this.currentVersion !== latestVersionInfo.bridgeVersion) {
        info('Bridge CLI already exists, download has been skipped')
        debug(`Bridge CLI already exists with version ${this.currentVersion}, but latest version ${latestVersionInfo.bridgeVersion} is available. Updating to latest.`)
        await this.executeUseBridgeCommand(this.getBridgeExecutablePath(), latestVersionInfo.bridgeVersion)
        this.currentVersion = latestVersionInfo.bridgeVersion
        return {bridgeUrl: '', bridgeVersion: latestVersionInfo.bridgeVersion}
      }

      info('Bridge CLI already exists, download has been skipped')
      return {bridgeUrl: '', bridgeVersion: this.currentVersion}
    } catch (error) {
      debug(`Error checking bridge version: ${(error as Error).message}. Proceeding with latest version download.`)
      return this.processBaseUrlWithLatest()
    }
  }

  protected async shouldSkipAirGapDownload(): Promise<boolean> {
    const bridgeExists = await this.checkIfBridgeExistsInAirGap()

    // If bridge doesn't exist, don't skip download (let it proceed)
    if (!bridgeExists) {
      return false
    }

    // If no base URL provided, skip download (existing behavior)
    if (!inputs.BRIDGE_CLI_BASE_URL) {
      return true
    }

    // If base URL is provided (with or without version), handle upgrade logic
    if (inputs.BRIDGE_CLI_BASE_URL) {
      info('Air gap mode with base URL specified - checking for version update')

      try {
        // Get current installed version
        this.currentVersion ??= await this.getBridgeVersion()

        let targetVersion: string

        if (inputs.BRIDGE_CLI_DOWNLOAD_VERSION) {
          // Version explicitly provided
          targetVersion = inputs.BRIDGE_CLI_DOWNLOAD_VERSION
          info(`Target version specified: ${targetVersion}`)
        } else {
          // No version provided - use latest
          info('No version specified, determining latest version')
          const latestVersionInfo = await this.getLatestVersionInfo()
          targetVersion = latestVersionInfo.bridgeVersion
          info(`Latest version determined: ${targetVersion}`)
        }

        if (this.currentVersion !== targetVersion) {
          info(`Current version: ${this.currentVersion}, Target version: ${targetVersion} - updating bridge`)
          // Execute the --use command to switch to the target version
          await this.executeUseBridgeCommand(this.getBridgeExecutablePath(), targetVersion)
          return true // Skip download as we've handled the update via --use command
        } else {
          info(`Bridge already at target version: ${targetVersion}`)
          return true // Skip download as versions match
        }
      } catch (error) {
        debug(`Error checking version for air gap update: ${(error as Error).message}`)
        // If version check fails, allow download to proceed
        return false
      }
    }

    // Default: skip if bridge exists
    return true
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private buildCommand(stage: string, stateFilePath: string, workflowVersion?: string): string {
    const parts = [constants.BRIDGE_CLI_STAGE_OPTION, stage + (workflowVersion ? `@${workflowVersion}` : ''), constants.BRIDGE_CLI_INPUT_OPTION, stateFilePath, this.handleBridgeUpdateCommand()].filter(part => part)
    return parts.join(constants.BRIDGE_CLI_SPACE)
  }

  private buildRegisterCommand(): string {
    debug('Building register command')
    const registerCommand = `${this.bridgeExecutablePath} ${BridgeCliThinClient.BRIDGE_CLI_COMMANDS.REGISTER} ${inputs.BRIDGE_CLI_REGISTRY_URL}`
    debug(`Register command built: ${registerCommand}`)
    return registerCommand
  }

  private handleBridgeUpdateCommand(): string {
    const isBridgeUpdateEnabled = parseToBoolean(inputs.ENABLE_WORKFLOW_UPDATE)
    info(isBridgeUpdateEnabled ? 'Bridge update command has been added.' : 'Bridge workflow update is disabled')
    return isBridgeUpdateEnabled ? BridgeCliThinClient.BRIDGE_CLI_COMMANDS.UPDATE : ''
  }

  private async ensureBridgePathIsSet(): Promise<void> {
    if (!this.bridgePath) {
      await this.validateAndSetBridgePath()
    }
  }

  private async executeUseBridgeCommand(bridgeExecutable: string, bridgeVersion: string): Promise<void> {
    debug('Different bridge version found, running --use bridge command')
    const useBridgeCommand = `${bridgeExecutable} ${BridgeCliThinClient.BRIDGE_CLI_COMMANDS.USE} ${this.getBridgeFileType()}@${bridgeVersion}`
    try {
      execSync(useBridgeCommand, {stdio: 'pipe'})
      debug(`Successfully executed --use bridge command: ${useBridgeCommand} with version ${bridgeVersion}`)
    } catch (err) {
      debug(`Failed to execute --use bridge command: ${(err as Error).message}`)
      throw err
    }
  }

  private async handleRegistrationIfNeeded(execOptions: ExecOptions): Promise<void> {
    if (!inputs.BRIDGE_CLI_REGISTRY_URL) {
      debug('Registry URL is empty')
      return
    }

    const registerExitCode = await this.runBridgeCommand(this.buildRegisterCommand(), execOptions)
    if (registerExitCode !== 0) {
      throw new Error('Register command failed, returning early')
    }
  }
  private matchVersionPattern(bridgeUrl: string, bridgeType: string): RegExpMatchArray | null {
    const pattern = new RegExp(`${BridgeCliThinClient.BRIDGE_TYPE}\\/([\\d.]+)\\/.*${bridgeType}\\.zip`)
    debug(`Verifying URL pattern for bridge type: ${bridgeType}`)

    const result = bridgeUrl.match(pattern)
    debug(`URL pattern verification result: ${result ? 'match found' : 'no match'}`)

    return result
  }
}
