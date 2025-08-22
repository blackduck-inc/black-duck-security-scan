import {ExecOptions} from '@actions/exec'
import {BridgeClientBase} from './bridge-client-base'
import * as inputs from '../inputs'
import {DISABLE_BRIDGE_WORKFLOW_UPDATE, ENABLE_NETWORK_AIR_GAP, POLARIS_WORKFLOW_VERSION} from '../inputs'
import * as constants from '../../application-constants'
import {BRIDGE_CLI_INPUT_OPTION, BRIDGE_CLI_SPACE, BRIDGE_CLI_STAGE_OPTION} from '../../application-constants'
import {DownloadFileResponse, extractZipped} from '../download-utility'
import {debug, info} from '@actions/core'
import path from 'path'
import {checkIfPathExists, getOSPlatform, parseToBoolean} from '../utility'
import {execSync} from 'node:child_process'

export class BridgeThinClient extends BridgeClientBase {
  private static readonly BRIDGE_TYPE = 'bridge-cli-thin-client'
  private static readonly BRIDGE_FILE_TYPE = 'bridge-cli'
  private readonly BRIDGE_CLI_UPDATE_COMMAND = '--update'
  private readonly BRIDGE_CLI_VERSION_COMMAND = '--version'
  private readonly BRIDGE_CLI_REGISTER_COMMAND = ' --register'
  private readonly BRIDGE_CLI_USE_COMMAND = '--use '

  private currentVersion: string | undefined
  private isBridgeCLIInstalled: boolean | undefined

  protected initializeUrls(): void {
    this.bridgeArtifactoryURL = constants.BRIDGE_CLI_ARTIFACTORY_URL.concat(this.getBridgeType()).concat('/')
    this.bridgeUrlLatestPattern = constants.BRIDGE_CLI_ARTIFACTORY_URL.concat(this.getBridgeType()).concat('/').concat('latest/').concat(this.getBridgeFileType()).concat(`-${getOSPlatform()}.zip`)
    this.bridgeUrlPattern = this.bridgeArtifactoryURL.concat('$version/').concat(this.getBridgeFileType()).concat('-$platform.zip')
  }

  getBridgeType(): string {
    return BridgeThinClient.BRIDGE_TYPE
  }

  getBridgeFileType(): string {
    return BridgeThinClient.BRIDGE_FILE_TYPE
  }

  protected async executeCommand(bridgeCommand: string, execOptions: ExecOptions): Promise<number> {
    if (!parseToBoolean(inputs.BRIDGE_REGISTRY_URL)) debug('Registry URL is empty')
    if (inputs.BRIDGE_REGISTRY_URL && (await this.runBridgeCommand(this.appendRegisterCommand(), execOptions)) !== 0) {
      throw new Error('Register command failed, returning early')
    }
    return this.runBridgeCommand(bridgeCommand, execOptions)
  }

  async downloadBridge(tempDir: string): Promise<void> {
    debug('Starting bridge download process...')
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
    const bridgeExecutable = path.join(this.bridgePath, this.getBridgeFileType())
    debug(`Getting bridge version from executable: ${bridgeExecutable}`)

    try {
      return execSync(`${bridgeExecutable} ${this.BRIDGE_CLI_VERSION_COMMAND}`).toString().trim()
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
    info('Bridge CLI directory '.concat(basePath))

    const platformFolderName = this.getBridgeFileType().concat('-').concat(getOSPlatform())
    this.bridgePath = path.join(basePath, platformFolderName)
    const isAirGapMode = parseToBoolean(ENABLE_NETWORK_AIR_GAP)
    if (isAirGapMode) await this.validateAirGapExecutable(this.bridgePath)
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
      .concat(this.handleBridgeUpdateCommand())
  }

  private appendRegisterCommand(): string {
    debug('Building register command')
    const registerCommand = `${this.bridgeExecutablePath} ${this.BRIDGE_CLI_REGISTER_COMMAND} ${inputs.BRIDGE_REGISTRY_URL}`
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

  private handleBridgeUpdateCommand(): string {
    const isBridgeUpdateDisabled = parseToBoolean(DISABLE_BRIDGE_WORKFLOW_UPDATE)
    info(isBridgeUpdateDisabled ? 'Bridge workflow update is disabled' : 'Bridge update command has been added.')
    return isBridgeUpdateDisabled ? '' : this.BRIDGE_CLI_UPDATE_COMMAND
  }

  protected async checkIfBridgeExistsInAirGap(): Promise<boolean> {
    await this.validateAndSetBridgePath()
    return Promise.resolve(true)
  }

  async validateBridgeVersion(version: string): Promise<boolean> {
    const versions = await this.getAllAvailableBridgeVersions()
    return versions.includes(version.trim())
  }

  protected getLatestVersionRegexPattern(): RegExp {
    return new RegExp(`(${BridgeThinClient.BRIDGE_FILE_TYPE}-(win64|linux64|linux_arm|macosx|macos_arm)\\.zip)`)
  }

  private async executeUseBridgeCommand(bridgeExecutable: string, bridgeVersion: string): Promise<void> {
    debug('Different bridge version found, running --use bridge command')
    const useBridgeCommand = `${bridgeExecutable} ${this.BRIDGE_CLI_USE_COMMAND} ${this.getBridgeFileType()}@${bridgeVersion}`
    try {
      execSync(useBridgeCommand, {stdio: 'pipe'})
      debug(`Successfully executed --use bridge command: ${useBridgeCommand} with version ${bridgeVersion}`)
    } catch (err) {
      debug(`Failed to execute --use bridge command: ${(err as Error).message}`)
      throw err
    }
  }
}
