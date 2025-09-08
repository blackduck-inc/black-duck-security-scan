import {ExecOptions} from '@actions/exec'
import {BridgeClientBase} from './bridge-client-base'
import * as constants from '../../application-constants'
import {BRIDGE_CLI_INPUT_OPTION, BRIDGE_CLI_SPACE, BRIDGE_CLI_STAGE_OPTION} from '../../application-constants'
import {DownloadFileResponse, extractZipped} from '../download-utility'
import fs, {readFileSync} from 'fs'
import {debug, info} from '@actions/core'
import path, {join} from 'path'
import {checkIfPathExists, getOSPlatform, parseToBoolean} from '../utility'
import * as inputs from '../inputs'
import {BLACKDUCKSCA_WORKFLOW_VERSION, BRIDGE_CLI_DOWNLOAD_URL, COVERITY_WORKFLOW_VERSION, ENABLE_NETWORK_AIR_GAP, POLARIS_WORKFLOW_VERSION, SRM_WORKFLOW_VERSION} from '../inputs'
import {rmRF} from '@actions/io'

export class BridgeCliBundle extends BridgeClientBase {
  private static readonly BRIDGE_TYPE = 'bridge-cli-bundle'
  private static readonly BRIDGE_FILE_TYPE = 'bridge-cli'
  private readonly VERSIONS_TXT = 'versions.txt'

  private osPlatform: string | undefined
  private static get VERSION_PATTERN(): RegExp {
    return new RegExp(`${this.BRIDGE_TYPE}:\\s*([0-9.]+)`)
  }

  async downloadBridge(tempDir: string): Promise<void> {
    debug('Starting bridge download process...')

    if (fs.existsSync(this.bridgePath)) {
      info('Clear the existing bridge folder, if available from '.concat(this.bridgePath))
      await rmRF(this.bridgePath)
    }

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
    let basePath: string
    if (inputs.BRIDGE_CLI_INSTALL_DIRECTORY_KEY) {
      basePath = path.join(inputs.BRIDGE_CLI_INSTALL_DIRECTORY_KEY, this.getBridgeType())
    } else {
      basePath = this.getBridgeDefaultPath()
    }
    info('Bridge CLI directory '.concat(basePath))

    const platformFolderName = this.getBridgeType()
      .concat('-')
      .concat(this.osPlatform || getOSPlatform())
    this.bridgePath = path.join(basePath, platformFolderName)
    const isAirGapMode = parseToBoolean(ENABLE_NETWORK_AIR_GAP)
    if (isAirGapMode) await this.validateAirGapExecutable(this.bridgePath)
  }

  async getBridgeVersion(): Promise<string> {
    const versionFilePath = join(this.bridgePath, this.VERSIONS_TXT)
    debug(`Reading bridge version from: ${versionFilePath}`)

    try {
      const versionContent = readFileSync(versionFilePath, 'utf-8')
      debug('Version file content read successfully')

      const bundleMatch = versionContent.match(BridgeCliBundle.VERSION_PATTERN)
      const version = bundleMatch?.[1] || ''

      debug(`Extracted bridge version: ${version || 'not found'}`)
      return version
    } catch (error) {
      debug(`Error reading bridge version file: ${(error as Error).message}`)
      return ''
    }
  }

  async checkIfVersionExists(bridgeVersion: string, bridgeVersionFilePath: string): Promise<boolean> {
    try {
      const contents = readFileSync(bridgeVersionFilePath, 'utf-8')
      return [BridgeCliBundle.BRIDGE_TYPE].some(type => contents.includes(`${type}: ${bridgeVersion}`))
    } catch (e) {
      info('Error reading version file content: '.concat((e as Error).message))
    }
    return false
  }

  async isBridgeInstalled(bridgeVersion: string): Promise<boolean> {
    if (!this.bridgePath) {
      await this.validateAndSetBridgePath()
    }

    const versionFilePath = this.getVersionFilePath()

    if (!checkIfPathExists(versionFilePath)) {
      debug('Bridge CLI version file could not be found at '.concat(this.bridgePath))
      return false
    }

    debug('Version file found at '.concat(this.bridgePath))
    return await this.checkIfVersionExists(bridgeVersion, versionFilePath)
  }

  async validateBridgeVersion(version: string): Promise<boolean> {
    const versions = await this.getAllAvailableBridgeVersions()
    return versions.includes(version.trim())
  }

  protected async executeCommand(bridgeCommand: string, execOptions: ExecOptions): Promise<number> {
    return this.runBridgeCommand(bridgeCommand, execOptions)
  }

  protected initializeUrls(): void {
    this.osPlatform = getOSPlatform()
    this.bridgeArtifactoryURL = constants.BRIDGE_CLI_ARTIFACTORY_URL.concat(this.getBridgeType()).concat('/')
    this.bridgeUrlPattern = this.bridgeArtifactoryURL.concat('$version/').concat(this.getBridgeType()).concat('-$version-$platform.zip')
    this.bridgeUrlLatestPattern = constants.BRIDGE_CLI_ARTIFACTORY_URL.concat(this.getBridgeType()).concat('/').concat('latest/').concat(this.getBridgeType()).concat(`-${this.osPlatform}.zip`)
  }

  getBridgeType(): string {
    return BridgeCliBundle.BRIDGE_TYPE
  }

  getBridgeFileType(): string {
    return BridgeCliBundle.BRIDGE_FILE_TYPE
  }

  protected async handleBridgeDownload(downloadResponse: DownloadFileResponse, extractZippedFilePath: string): Promise<void> {
    extractZippedFilePath = extractZippedFilePath.concat(path.sep, this.getBridgeType())

    debug(`Starting bridge download handling - extracting to: ${extractZippedFilePath}`)

    await extractZipped(downloadResponse.filePath, extractZippedFilePath)
    debug('Bridge archive extraction completed')

    await this.moveBridgeFiles(downloadResponse.filePath, extractZippedFilePath)
    debug('Bridge files moved to final location')

    if (fs.existsSync(extractZippedFilePath) && fs.readdirSync(extractZippedFilePath).length === 0) {
      fs.rmdirSync(extractZippedFilePath)
      debug('Removed empty extraction directory: '.concat(extractZippedFilePath))
    }
  }

  protected async updateBridgeCLIVersion(requestedVersion: string): Promise<{bridgeUrl: string; bridgeVersion: string}> {
    if (parseToBoolean(ENABLE_NETWORK_AIR_GAP) && BRIDGE_CLI_DOWNLOAD_URL === '' && requestedVersion !== '') {
      throw new Error("Unable to use the specified Bridge CLI version in air gap mode. Please provide a valid 'BRIDGE_CLI_DOWNLOAD_URL'.")
    } else {
      if (await this.validateBridgeVersion(requestedVersion)) {
        const bridgeUrl = this.getVersionUrl(requestedVersion).trim()
        return {bridgeUrl, bridgeVersion: requestedVersion}
      }
      throw new Error(constants.BRIDGE_VERSION_NOT_FOUND_ERROR)
    }
  }

  protected async checkIfBridgeExistsInAirGap(): Promise<boolean> {
    await this.validateAndSetBridgePath()
    return Promise.resolve(true)
  }

  verifyRegexCheck(bridgeUrl: string): RegExpMatchArray | null {
    debug(`Verifying URL pattern for bridge type: ${this.getBridgeType()}`)
    const result = bridgeUrl.match(`.*${this.getBridgeType()}-([0-9.]*).*.`)
    debug(`URL pattern verification result: ${result ? 'match found' : 'no match'}`)
    return result
  }

  private async moveBridgeFiles(downloadFilePath: string, extractPath: string): Promise<void> {
    const zipFileName = path.basename(downloadFilePath, '.zip')
    const sourceFile = path.join(extractPath, zipFileName)

    debug('Rename folder from '.concat(sourceFile).concat(' to ').concat(this.bridgePath))
    fs.renameSync(sourceFile, this.bridgePath)
  }

  private logWorkflowVersionInfo(): void {
    if (POLARIS_WORKFLOW_VERSION || BLACKDUCKSCA_WORKFLOW_VERSION || SRM_WORKFLOW_VERSION || COVERITY_WORKFLOW_VERSION) {
      info('Detected workflow version for Polaris, Black Duck SCA, Coverity, or SRM is not applicable for Bridge CLI Bundle.')
    }
  }

  private buildCommand(stage: string, stateFilePath: string): string {
    return BRIDGE_CLI_STAGE_OPTION.concat(BRIDGE_CLI_SPACE).concat(stage).concat(BRIDGE_CLI_SPACE).concat(BRIDGE_CLI_INPUT_OPTION).concat(BRIDGE_CLI_SPACE).concat(stateFilePath)
  }

  private getVersionFilePath(): string {
    return path.join(this.bridgePath, this.VERSIONS_TXT)
  }

  protected getLatestVersionRegexPattern(): RegExp {
    return new RegExp(`(${BridgeCliBundle.BRIDGE_TYPE}-(win64|linux64|linux_arm|macosx|macos_arm)\\.zip)`)
  }
}
