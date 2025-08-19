import {ExecOptions} from '@actions/exec'
import {BridgeClientBase} from './bridge-client-base'
import * as inputs from '../inputs'
import {BRIDGE_WORKFLOW_DISABLE_UPDATE, ENABLE_NETWORK_AIR_GAP, POLARIS_WORKFLOW_VERSION} from '../inputs'
import * as constants from '../../application-constants'
import {BRIDGE_CLI_INPUT_OPTION, BRIDGE_CLI_SPACE, BRIDGE_CLI_STAGE_OPTION, BRIDGE_DOWNLOAD_URL_REGEX} from '../../application-constants'
import {DownloadFileResponse, extractZipped} from '../download-utility'
import {debug, info} from '@actions/core'
import path from 'path'
import {checkIfPathExists, getOSPlatform, parseToBoolean} from '../utility'
import {execSync} from 'node:child_process'

export class BridgeThinClient extends BridgeClientBase {
  private static readonly BRIDGE_TYPE = 'bridge-cli-thin-client'
  private static readonly BRIDGE_FILE_TYPE = 'bridge-cli'
  private cachedBridgeVersion: string | null = null
  private currentVersion: string | undefined
  private isBridgeCLIInstalled: boolean | undefined

  protected initializeUrls(): void {
    this.bridgeArtifactoryURL = constants.BRIDGE_CLI_ARTIFACTORY_URL.concat(this.getBridgeType()).concat('/')
    this.bridgeUrlLatestPattern = constants.BRIDGE_CLI_ARTIFACTORY_URL.concat(this.getBridgeType()).concat('/').concat('latest/').concat(this.getBridgeFileType()).concat(`-${getOSPlatform()}.zip`)
    this.bridgeUrlPattern = this.bridgeArtifactoryURL.concat('$version/').concat(this.getBridgeFileType()).concat('-$platform.zip')
  }

  protected getBridgeType(): string {
    return BridgeThinClient.BRIDGE_TYPE
  }

  protected getBridgeFileType(): string {
    return BridgeThinClient.BRIDGE_FILE_TYPE
  }

  protected async executeCommand(bridgeCommand: string, execOptions: ExecOptions): Promise<number> {
    if (inputs.REGISTER_URL && (await this.runBridgeCommand(this.appendRegisterCommand(), execOptions)) !== 0) {
      throw new Error('Register command failed, returning early')
    }
    return this.runBridgeCommand(bridgeCommand, execOptions)
  }

  async downloadBridge(tempDir: string): Promise<void> {
    debug('Starting bridge download process...')
    this.handleAirGapValidation()
    debug('URL validation completed, proceeding with download')
    return super.downloadBridge(tempDir)
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

  generateFormattedCommand(stage: string, stateFilePath: string): string {
    debug(`Generating command for stage: ${stage}, state file: ${stateFilePath}`)

    const command = this.buildCommand(stage, stateFilePath)

    info(`Generated command: ${command}`)
    return command
  }

  protected verifyRegexCheck(bridgeUrl: string): RegExpMatchArray | null {
    const bridgeType = `${this.getBridgeFileType()}-${getOSPlatform()}`

    // First check if URL contains "latest" - if so, return a match with empty string
    if (bridgeUrl.includes('/latest/')) {
      debug(`URL contains 'latest', returning empty string as version`)
      return ['', ''] as RegExpMatchArray
    }

    const pattern = new RegExp(`${this.getBridgeType()}\\/([\\d.]+)\\/.*${bridgeType}\\.zip`)
    debug(`Verifying URL pattern for bridge type: ${bridgeType}`)

    const result = bridgeUrl.match(pattern)
    debug(`URL pattern verification result: ${result ? 'match found' : 'no match'}`)

    return result
  }

  async getBridgeVersion(): Promise<string> {
    if (this.cachedBridgeVersion !== null) {
      return this.cachedBridgeVersion
    }

    const bridgeExecutable = path.join(this.bridgePath, this.getBridgeFileType())
    debug(`Getting bridge version from executable: ${bridgeExecutable}`)

    try {
      this.cachedBridgeVersion = execSync(`${bridgeExecutable} --version`).toString().trim()
      return this.cachedBridgeVersion
    } catch (error) {
      throw new Error(`Failed to get bridge version: ${(error as Error).message}`)
    }
  }

  async validateAndSetBridgePath(): Promise<void> {
    const basePath = inputs.BRIDGE_CLI_INSTALL_DIRECTORY_KEY || this.getBridgeDefaultPath()
    info('Bridge CLI directory '.concat(basePath))

    const platformFolderName = this.getBridgeFileType().concat('-').concat(getOSPlatform())
    this.bridgePath = path.join(basePath, platformFolderName)
    const isAirGapMode = parseToBoolean(ENABLE_NETWORK_AIR_GAP)
    if (isAirGapMode) await this.validateAirGapExecutable(this.bridgePath)
  }

  private handleAirGapValidation(): void {
    if (parseToBoolean(ENABLE_NETWORK_AIR_GAP) && inputs.BRIDGE_CLI_DOWNLOAD_URL?.match(BRIDGE_DOWNLOAD_URL_REGEX)) {
      debug('Air gap mode detected with download URL matching regex pattern')
    }
  }

  private buildCommand(stage: string, stateFilePath: string): string {
    return BRIDGE_CLI_STAGE_OPTION.concat(BRIDGE_CLI_SPACE)
      .concat(stage)
      .concat(POLARIS_WORKFLOW_VERSION ? '@'.concat(POLARIS_WORKFLOW_VERSION) : '')
      .concat(BRIDGE_CLI_SPACE)
      .concat(BRIDGE_CLI_INPUT_OPTION)
      .concat(BRIDGE_CLI_SPACE)
      .concat(stateFilePath)
      .concat(BRIDGE_CLI_SPACE)
      .concat(this.handleUpdateCommand())
  }

  private appendRegisterCommand(): string {
    debug('Building register command')
    const registerCommand = `${this.bridgeExecutablePath} --register ${inputs.REGISTER_URL}`
    debug(`Register command built: ${registerCommand}`)
    return registerCommand
  }

  getBridgeCLIDownloadDefaultPath(): string {
    return this.getBridgeCLIDownloadPathCommon(true)
  }

  async isBridgeInstalled(bridgeVersion: string): Promise<boolean> {
    try {
      await this.ensureBridgePathIsSet()
      const bridgeExecutable = this.getBridgeExecutablePath()

      if (!this.isBridgeExecutableAvailable(bridgeExecutable)) {
        return false
      }

      this.currentVersion = await this.getBridgeVersion()
      this.isBridgeCLIInstalled = this.isVersionMatch(bridgeVersion, this.currentVersion)
      return this.isBridgeCLIInstalled
    } catch (error: unknown) {
      debug(`Failed to get bridge version: ${(error as Error).message}`)
      throw error
    }
  }

  protected async updateBridgeCLIVersion(requestedVersion: string): Promise<{bridgeUrl: string; bridgeVersion: string}> {
    // Refactored for clarity and conciseness
    if (parseToBoolean(ENABLE_NETWORK_AIR_GAP)) {
      await this.executeUseBridgeCommand(this.getBridgeExecutablePath(), requestedVersion)
      return {bridgeUrl: '', bridgeVersion: requestedVersion}
    } else {
      const bridgeUrl = this.getVersionUrl(requestedVersion).trim()
      return {bridgeUrl, bridgeVersion: requestedVersion}
    }
  }

  private async ensureBridgePathIsSet(): Promise<void> {
    if (!this.bridgePath) {
      await this.validateAndSetBridgePath()
    }
  }

  private getBridgeExecutablePath(): string {
    return path.join(this.bridgePath, this.getBridgeFileType())
  }

  private isBridgeExecutableAvailable(bridgeExecutable: string): boolean {
    if (!checkIfPathExists(bridgeExecutable)) {
      debug('Bridge executable does not exist')
      return false
    }
    return true
  }

  private isVersionMatch(expectedVersion: string, currentVersion: string): boolean {
    return expectedVersion === currentVersion
  }

  private handleUpdateCommand(): string {
    if (parseToBoolean(BRIDGE_WORKFLOW_DISABLE_UPDATE)) {
      info('Bridge workflow update is disabled')
      return ''
    }
    info('Running Bridge update command')
    return '--update'
  }

  protected async checkIfBridgeExistsInAirGap(): Promise<boolean> {
    await this.validateAndSetBridgePath()
    return Promise.resolve(true)
  }

  async validateBridgeVersion(version: string): Promise<boolean> {
    const versions = await this.getAllAvailableBridgeVersions()
    return versions.includes(version.trim())
  }
}
