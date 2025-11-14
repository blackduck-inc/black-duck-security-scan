import {exec, ExecOptions} from '@actions/exec'
import {debug, info, warning} from '@actions/core'
import * as constants from '../../application-constants'
import path from 'path'
import {checkIfPathExists, cleanupTempDir, getSharedHttpClient, getSharedHttpsAgent, parseToBoolean, sleep} from '../utility'
import os from 'os'
import {validateBlackDuckInputs, validateCoverityInputs, validatePolarisInputs, validateScanTypes, validateSRMInputs} from '../validators'
import * as inputs from '../inputs'
import {BridgeToolsParameter} from '../tools-parameter'
import {DownloadFileResponse, getRemoteFile} from '../download-utility'
import fs from 'fs'
import {tryGetExecutablePath} from '@actions/io/lib/io-util'
import {rmRF} from '@actions/io'
import semver from 'semver'
import DomParser from 'dom-parser'
import * as https from 'node:https'

interface BridgeUrlVersion {
  bridgeUrl: string
  bridgeVersion: string
}

interface CommandResult {
  command: string
  errors: string[]
}

interface HttpResponse {
  statusCode: number
  body: string
}

interface PlatformConfig {
  env: string
  dir: string
}

type ScanTool = 'polaris' | 'coverity' | 'blackduck' | 'srm'

export abstract class BridgeClientBase {
  bridgeExecutablePath: string
  bridgePath: string
  protected bridgeArtifactoryURL: string
  protected bridgeUrlPattern: string
  protected bridgeUrlLatestPattern: string

  protected readonly PLATFORMS = {
    WINDOWS: 'win64',
    LINUX: 'linux64',
    LINUX_ARM: 'linux_arm',
    MAC: 'macosx',
    MAC_ARM: 'macos_arm'
  } as const

  protected readonly WINDOWS_PLATFORM = 'win64'
  protected readonly LINUX_PLATFORM = 'linux64'
  protected readonly LINUX_ARM_PLATFORM = 'linux_arm'
  protected readonly MAC_PLATFORM = 'macosx'
  protected readonly MAC_ARM_PLATFORM = 'macos_arm'

  constructor() {
    this.bridgeExecutablePath = ''
    this.bridgePath = ''
    this.bridgeArtifactoryURL = ''
    this.bridgeUrlPattern = ''
    this.bridgeUrlLatestPattern = ''
  }

  // ============================================================================
  // ABSTRACT METHODS
  // ============================================================================

  abstract getBridgeFileType(): string

  abstract getBridgeVersion(): Promise<string>

  abstract getBridgeFileNameType(): string

  abstract getBridgeType(): string

  abstract generateFormattedCommand(stage: string, stateFilePath: string, workflowVersion?: string): string

  abstract isBridgeInstalled(bridgeVersion: string): Promise<boolean>

  abstract validateAndSetBridgePath(): Promise<void>

  protected abstract checkIfBridgeExistsInAirGap(): Promise<boolean>

  protected abstract executeCommand(bridgeCommand: string, execOptions: ExecOptions): Promise<number>

  protected abstract getLatestVersionRegexPattern(): RegExp

  protected abstract getBridgeCLIDownloadDefaultPath(): string

  protected abstract handleBridgeDownload(downloadResponse: DownloadFileResponse, extractZippedFilePath: string, bridgePathType?: string, pathSeparator?: string): Promise<void>

  protected abstract initializeUrls(): void

  protected abstract processBaseUrlWithLatest(): Promise<{bridgeUrl: string; bridgeVersion: string}>

  protected abstract processLatestVersion(isAirGap: boolean): Promise<{bridgeUrl: string; bridgeVersion: string}>

  protected abstract updateBridgeCLIVersion(requestedVersion: string): Promise<{
    bridgeUrl: string
    bridgeVersion: string
  }>

  protected abstract verifyRegexCheck(bridgeUrl: string): RegExpMatchArray | null

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  async prepareCommand(tempDir: string): Promise<string> {
    try {
      this.validateRequiredScanTypes()

      const {formattedCommand, validationErrors} = await this.buildCommandForAllTools(tempDir)

      this.handleValidationErrors(validationErrors, formattedCommand)

      const finalCommand = this.addDiagnosticsIfEnabled(formattedCommand)

      debug(`Formatted command: ${finalCommand}`)
      return finalCommand
    } catch (e) {
      const errorObject = e instanceof Error ? e : new Error(String(e))

      await this.cleanupOnError(tempDir)

      debug(`Error in prepareCommand: ${errorObject.message}`)
      debug(`Stack trace: ${errorObject.stack || 'No stack trace available'}`)

      throw errorObject
    }
  }

  async downloadBridge(tempDir: string): Promise<void> {
    try {
      const isAirGap = parseToBoolean(inputs.ENABLE_NETWORK_AIR_GAP)
      if (inputs.BRIDGE_CLI_BASE_URL || (!isAirGap && !inputs.BRIDGE_CLI_BASE_URL)) {
        this.initializeUrls()
      }

      if (isAirGap) {
        info('Network air gap is enabled.')
        const shouldSkipDownload = await this.shouldSkipAirGapDownload()
        if (shouldSkipDownload) {
          info('Bridge CLI already exists')
          return
        }
      }

      const {bridgeUrl, bridgeVersion} = await this.getBridgeUrlAndVersion(isAirGap)
      info('Bridge CLI version is - '.concat(bridgeVersion))
      if (!bridgeUrl) {
        return
      }

      if (await this.isBridgeInstalled(bridgeVersion)) {
        info('Bridge CLI already exists')
        return
      }
      info('Downloading and configuring Bridge from URL - '.concat(bridgeUrl))
      const downloadResponse: DownloadFileResponse = await getRemoteFile(tempDir, bridgeUrl)
      let extractZippedFilePath: string = inputs.BRIDGE_CLI_INSTALL_DIRECTORY_KEY || this.getBridgeCLIDownloadDefaultPath()
      if (inputs.BRIDGE_CLI_INSTALL_DIRECTORY_KEY) {
        extractZippedFilePath = path.join(inputs.BRIDGE_CLI_INSTALL_DIRECTORY_KEY, this.getBridgeType())
      }
      // Only clear existing bridge folder if it exists to avoid unnecessary I/O
      if (fs.existsSync(this.bridgePath)) {
        info('Clear the existing bridge folder, if available from '.concat(this.bridgePath))
        await rmRF(this.bridgePath)
      }

      await this.handleBridgeDownload(downloadResponse, extractZippedFilePath)
      info('Download and configuration of Bridge CLI completed')
    } catch (e) {
      const errorObject = (e as Error).message
      await cleanupTempDir(tempDir)
      if (errorObject.includes('404') || errorObject.toLowerCase().includes('invalid url')) {
        let runnerOS = ''
        if (process.env['RUNNER_OS']) {
          runnerOS = process.env['RUNNER_OS']
        }
        return Promise.reject(new Error(constants.BRIDGE_CLI_URL_NOT_VALID_OS_ERROR.concat(runnerOS, ' runner')))
      } else if (errorObject.toLowerCase().includes('empty')) {
        return Promise.reject(new Error(constants.PROVIDED_BRIDGE_CLI_URL_EMPTY_ERROR))
      } else {
        return Promise.reject(new Error(errorObject))
      }
    }
  }

  async executeBridgeCommand(bridgeCommand: string, workingDirectory: string): Promise<number> {
    const osName: string = process.platform
    if (osName === constants.MAC_PLATFORM_NAME || osName === constants.LINUX_PLATFORM_NAME || osName === constants.WINDOWS_PLATFORM_NAME) {
      const execOp: ExecOptions = {
        cwd: workingDirectory
      }
      try {
        return await this.executeCommand(bridgeCommand, execOp)
      } catch (errorObject) {
        throw errorObject
      }
    }
    return -1
  }

  async getBridgeVersionFromLatestURL(latestVersionsUrl: string): Promise<string> {
    try {
      let retryCountLocal = constants.RETRY_COUNT
      let retryDelay = constants.RETRY_DELAY_IN_MILLISECONDS

      do {
        try {
          const response = await this.makeHttpsGetRequest(latestVersionsUrl)

          if (!constants.NON_RETRY_HTTP_CODES.has(Number(response.statusCode))) {
            retryDelay = await this.retrySleepHelper('Getting latest Bridge CLI versions has been failed, Retries left: ', retryCountLocal, retryDelay)
            retryCountLocal--
          } else if (response.statusCode === 200) {
            retryCountLocal = 0
            const htmlResponse = response.body.trim()
            const lines = htmlResponse.split('\n')
            for (const line of lines) {
              if (line.includes(this.getBridgeType())) {
                return line.split(':')[1].trim()
              }
            }
          }
        } catch (err) {
          retryDelay = await this.retrySleepHelper('Getting latest Bridge CLI versions has been failed, Retries left: ', retryCountLocal, retryDelay)
          retryCountLocal--
        }

        if (retryCountLocal === 0) {
          warning('Unable to retrieve the most recent version from Artifactory URL')
        }
      } while (retryCountLocal > 0)
    } catch (e) {
      debug('Error reading version file content: '.concat((e as Error).message))
    }
    return ''
  }

  async setBridgeExecutablePath(): Promise<void> {
    if (process.platform === constants.WINDOWS_PLATFORM_NAME) {
      this.bridgeExecutablePath = await tryGetExecutablePath(this.bridgePath.concat('\\bridge-cli'), ['.exe'])
    } else if (process.platform === constants.MAC_PLATFORM_NAME || process.platform === constants.LINUX_PLATFORM_NAME) {
      this.bridgeExecutablePath = await tryGetExecutablePath(this.bridgePath.concat('/bridge-cli'), [])
    }
  }

  getVersionUrl(version: string): string {
    const platform = this.getPlatformForVersion(version)
    return this.bridgeUrlPattern.replace(/\$version/g, version).replace('$platform', platform)
  }

  async validateAirGapExecutable(bridgePath: string): Promise<void> {
    const executablePath = path.join(bridgePath, this.getBridgeFileType())
    debug(`Validating air gap executable at: ${executablePath}`)

    const executableExists = checkIfPathExists(executablePath)
    if (!executableExists) {
      if (!inputs.BRIDGE_CLI_BASE_URL) {
        debug(`No BRIDGE_CLI_BASE_URL provided`)
        throw new Error('No BRIDGE_CLI_BASE_URL provided')
      }
    }
  }

  async getAllAvailableBridgeVersions(): Promise<string[]> {
    let htmlResponse = ''
    const httpClient = getSharedHttpClient()
    let retryCountLocal = constants.RETRY_COUNT
    let retryDelay = constants.RETRY_DELAY_IN_MILLISECONDS
    let httpResponse
    const versionArray: string[] = []
    do {
      httpResponse = await httpClient.get(this.bridgeArtifactoryURL, {
        Accept: 'text/html'
      })

      if (!constants.NON_RETRY_HTTP_CODES.has(Number(httpResponse.message.statusCode))) {
        retryDelay = await this.retrySleepHelper('Getting all available bridge versions has been failed, Retries left: ', retryCountLocal, retryDelay)
        retryCountLocal--
      } else {
        retryCountLocal = 0
        htmlResponse = await httpResponse.readBody()

        const domParser = new DomParser()
        const doms = domParser.parseFromString(htmlResponse)
        const elems = doms.getElementsByTagName('a')

        if (elems != null) {
          for (const el of elems) {
            const content = el.textContent
            if (content != null) {
              const v = content.match('^[0-9]+.[0-9]+.[0-9]+')

              if (v != null && v.length === 1) {
                versionArray.push(v[0])
              }
            }
          }
        }
      }

      if (retryCountLocal === 0 && !(versionArray.length > 0)) {
        warning('Unable to retrieve the Bridge Versions from Artifactory')
      }
    } while (retryCountLocal > 0)
    return versionArray
  }

  isNetworkAirGapEnabled(): boolean {
    return parseToBoolean(inputs.ENABLE_NETWORK_AIR_GAP)
  }

  // ============================================================================
  // PROTECTED METHODS
  // ============================================================================

  protected getBridgeCLIDownloadPathCommon(includeBridgeType = false): string {
    return includeBridgeType ? path.join(this.getBasePath(), this.getBridgeType()) : this.getBasePath()
  }

  protected getBridgeDefaultPath(): string {
    return this.getBasePath() ? path.join(this.getBasePath(), this.getBridgeType()) : ''
  }

  protected async checkIfBridgeExistsLocally(): Promise<boolean> {
    try {
      await this.validateAndSetBridgePath()
      const bridgeExecutablePath = this.getBridgeExecutablePath()
      return checkIfPathExists(bridgeExecutablePath)
    } catch (error) {
      debug(`Error checking if bridge exists locally: ${(error as Error).message}`)
      return false
    }
  }

  protected async getLatestVersionInfo(): Promise<BridgeUrlVersion> {
    return this.processBaseUrlWithLatest()
  }

  protected getBridgeExecutablePath(): string {
    if (process.platform === constants.WINDOWS_PLATFORM_NAME) {
      return path.join(this.bridgePath, 'bridge-cli.exe')
    } else {
      return path.join(this.bridgePath, 'bridge-cli')
    }
  }

  protected async retrySleepHelper(message: string, retryCountLocal: number, retryDelay: number): Promise<number> {
    info(
      message
        .concat(String(retryCountLocal))
        .concat(', Waiting: ')
        .concat(String(retryDelay / 1000))
        .concat(' Seconds')
    )
    await sleep(retryDelay)
    // Delayed exponentially starting from 15 seconds
    retryDelay = retryDelay * 2
    return retryDelay
  }

  protected selectPlatform(version: string, isARM: boolean, isValidVersionForARM: boolean, armPlatform: string, defaultPlatform: string, minVersion: string): string {
    if (isARM && !isValidVersionForARM) {
      info(`Detected Bridge CLI version (${version}) below the minimum ARM support requirement (${minVersion}). Defaulting to ${defaultPlatform} platform.`)
      return defaultPlatform
    }
    return isARM && isValidVersionForARM ? armPlatform : defaultPlatform
  }

  protected async runBridgeCommand(bridgeCommand: string, execOptions: ExecOptions): Promise<number> {
    await this.setBridgeExecutablePath()
    debug('Bridge executable path:'.concat(this.bridgePath))
    if (!this.bridgeExecutablePath) {
      throw new Error(constants.BRIDGE_EXECUTABLE_NOT_FOUND_ERROR.concat(this.bridgePath))
    }
    debug(`Executing bridge command: ${bridgeCommand}`)
    const result = await exec(this.bridgeExecutablePath.concat(' ', bridgeCommand), [], execOptions)
    debug(`Bridge command execution completed with exit code: ${result}`)
    return result
  }

  protected async determineBaseUrl(): Promise<string> {
    return inputs.BRIDGE_CLI_BASE_URL || constants.BRIDGE_CLI_ARTIFACTORY_URL
  }

  protected getNormalizedVersionUrl(): string {
    return this.bridgeUrlLatestPattern.replace(this.getLatestVersionRegexPattern(), 'versions.txt')
  }

  protected getPlatformName(): string {
    const platformMap: Record<string, () => string> = {
      [constants.MAC_PLATFORM_NAME]: () => {
        const isARM = !os.cpus()[0].model.includes('Intel')
        return isARM ? this.PLATFORMS.MAC_ARM : this.PLATFORMS.MAC
      },
      [constants.LINUX_PLATFORM_NAME]: () => {
        const isARM = /^(arm.*|aarch.*)$/.test(process.arch)
        return isARM ? this.PLATFORMS.LINUX_ARM : this.PLATFORMS.LINUX
      }
    }

    const platformHandler = platformMap[process.platform]
    return platformHandler ? platformHandler() : this.PLATFORMS.WINDOWS
  }

  protected async makeHttpsGetRequest(requestUrl: string): Promise<HttpResponse> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(requestUrl)
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        agent: getSharedHttpsAgent(requestUrl)
      }

      const req = https.request(options, res => {
        let body = ''
        res.on('data', chunk => {
          body += chunk
        })
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            body
          })
        })
      })

      req.on('error', reject)
      req.end()
    })
  }

  protected shouldUpdateBridge(currentVersion: string, latestVersion: string): boolean {
    return currentVersion !== latestVersion
  }

  protected async shouldSkipAirGapDownload(): Promise<boolean> {
    // Default behavior: skip if bridge exists and no base URL is provided
    return (await this.checkIfBridgeExistsInAirGap()) && inputs.BRIDGE_CLI_BASE_URL === ''
  }

  protected validateAndGetBasePath(): string {
    debug('Starting validateAndGetBasePath()')

    if (inputs.BRIDGE_CLI_INSTALL_DIRECTORY_KEY) {
      debug(`Custom install directory provided: ${inputs.BRIDGE_CLI_INSTALL_DIRECTORY_KEY}`)
      if (!checkIfPathExists(inputs.BRIDGE_CLI_INSTALL_DIRECTORY_KEY)) {
        debug(`Custom install directory does not exist: ${inputs.BRIDGE_CLI_INSTALL_DIRECTORY_KEY}`)
        throw new Error(constants.BRIDGE_INSTALL_DIRECTORY_NOT_FOUND_ERROR)
      }
      return path.join(inputs.BRIDGE_CLI_INSTALL_DIRECTORY_KEY, this.getBridgeType())
    }
    return this.getBridgeDefaultPath()
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async cleanupOnError(tempDir: string): Promise<void> {
    try {
      await cleanupTempDir(tempDir)
    } catch (cleanupError) {
      debug(`Failed to cleanup temp directory: ${cleanupError}`)
    }
  }

  private validateRequiredScanTypes(): void {
    const invalidParams: string[] = validateScanTypes()
    if (invalidParams.length === 4) {
      throw new Error(constants.SCAN_TYPE_REQUIRED_ERROR.replace('{0}', constants.POLARIS_SERVER_URL_KEY).replace('{1}', constants.COVERITY_URL_KEY).replace('{2}', constants.BLACKDUCKSCA_URL_KEY).replace('{3}', constants.SRM_URL_KEY))
    }
  }

  private async buildCommandForAllTools(tempDir: string): Promise<{
    formattedCommand: string
    validationErrors: string[]
  }> {
    const toolBuilders: (() => CommandResult)[] = [() => this.buildScanToolCommand('polaris', tempDir, validatePolarisInputs, inputs.POLARIS_SERVER_URL), () => this.buildScanToolCommand('coverity', tempDir, validateCoverityInputs, inputs.COVERITY_URL), () => this.buildScanToolCommand('blackduck', tempDir, validateBlackDuckInputs, inputs.BLACKDUCKSCA_URL), () => this.buildScanToolCommand('srm', tempDir, validateSRMInputs, inputs.SRM_URL)]

    const results = toolBuilders.map((builder: () => CommandResult) => builder())

    return {
      formattedCommand: results.map((r: CommandResult) => r.command).join(''),
      validationErrors: results.flatMap((r: CommandResult) => r.errors)
    }
  }

  private buildScanToolCommand(toolName: ScanTool, tempDir: string, validator: () => string[], serverUrl: string | undefined): CommandResult {
    const errors = validator()
    let command = ''

    if (errors.length === 0 && serverUrl) {
      const commandFormatter = new BridgeToolsParameter(tempDir)
      const params = this.getToolParams(commandFormatter, toolName)
      command = this.generateFormattedCommand(params.stage, params.stateFilePath, params.workflowVersion)
    }

    return {command, errors}
  }

  private getToolParams(
    formatter: BridgeToolsParameter,
    toolName: ScanTool
  ): {
    stage: string
    stateFilePath: string
    workflowVersion: string
  } {
    const methodMap = {
      polaris: () => formatter.getFormattedCommandForPolaris(),
      coverity: () => formatter.getFormattedCommandForCoverity(),
      blackduck: () => formatter.getFormattedCommandForBlackduck(),
      srm: () => formatter.getFormattedCommandForSRM()
    }

    return methodMap[toolName]()
  }

  private handleValidationErrors(validationErrors: string[], formattedCommand: string): void {
    if (validationErrors.length > 0 || formattedCommand.length === 0) {
      throw new Error(validationErrors.join(','))
    }
  }

  private addDiagnosticsIfEnabled(formattedCommand: string): string {
    return parseToBoolean(inputs.INCLUDE_DIAGNOSTICS) ? formattedCommand.concat(BridgeToolsParameter.SPACE).concat(BridgeToolsParameter.DIAGNOSTICS_OPTION) : formattedCommand
  }

  private getBasePath(): string {
    const platformConfigs: Record<string, PlatformConfig> = {
      [constants.MAC_PLATFORM_NAME]: {env: 'HOME', dir: constants.BRIDGE_CLI_DEFAULT_PATH_MAC},
      [constants.LINUX_PLATFORM_NAME]: {env: 'HOME', dir: constants.BRIDGE_CLI_DEFAULT_PATH_LINUX},
      [constants.WINDOWS_PLATFORM_NAME]: {env: 'USERPROFILE', dir: constants.BRIDGE_CLI_DEFAULT_PATH_WINDOWS}
    }

    const config = platformConfigs[process.platform]
    if (!config) {
      return ''
    }

    const envValue = process.env[config.env]
    return envValue ? path.join(envValue, config.dir) : ''
  }

  private async getBridgeUrlAndVersion(isAirGap: boolean): Promise<BridgeUrlVersion> {
    const {BRIDGE_CLI_BASE_URL: baseUrl, BRIDGE_CLI_DOWNLOAD_URL: downloadUrl, BRIDGE_CLI_DOWNLOAD_VERSION: version} = inputs

    // Air gap specific validation
    if (isAirGap) {
      // Scenario 1: Air gap + no baseURL + version provided = Error
      if (!baseUrl && version && !downloadUrl) {
        throw new Error("Unable to use the specified Bridge CLI version in air gap mode. Please provide a valid 'BRIDGE_CLI_BASE_URL'.")
      }

      // Scenarios 5 & 6: Air gap + no baseURL + downloadURL = Error
      if (!baseUrl && downloadUrl) {
        throw new Error('Air gap mode enabled and no BRIDGE_CLI_BASE_URL provided. BRIDGE_CLI_DOWNLOAD_URL requires BRIDGE_CLI_BASE_URL in air gap mode.')
      }
    }

    // Precedence handling and deprecation warnings
    if (baseUrl && downloadUrl) {
      info('Both BRIDGE_CLI_BASE_URL and BRIDGE_CLI_DOWNLOAD_URL provided. Using BRIDGE_CLI_BASE_URL.')
      debug('BRIDGE_CLI_DOWNLOAD_URL is ignored when BRIDGE_CLI_BASE_URL is provided.')
    }

    // Process based on priority: baseUrl + version > baseUrl + latest > downloadUrl > version > latest
    if (baseUrl) {
      if (version) {
        info(`Using BRIDGE_CLI_BASE_URL with specified version: ${version}`)
        return this.processVersion()
      }
      info('Using BRIDGE_CLI_BASE_URL to fetch the latest version.')
      return this.processLatestVersion(isAirGap)
    }

    if (downloadUrl) {
      info('BRIDGE_CLI_DOWNLOAD_URL is deprecated and will be removed in an upcoming release. Please migrate to using BRIDGE_CLI_DOWNLOAD_VERSION in combination with BRIDGE_CLI_BASE_URL.')
      return this.processDownloadUrl()
    }

    if (version) {
      info(`Using specified version: ${version}`)
      return this.processVersion()
    }

    info('Checking for latest version of Bridge to download and configure')
    return this.processLatestVersion(isAirGap)
  }

  private async processDownloadUrl(): Promise<BridgeUrlVersion> {
    const bridgeUrl = inputs.BRIDGE_CLI_DOWNLOAD_URL
    const versionInfo = this.verifyRegexCheck(bridgeUrl)
    let bridgeVersion = ''

    if (versionInfo && versionInfo.length > 1) {
      bridgeVersion = versionInfo[1] || (await this.getBridgeVersionFromLatestURL(bridgeUrl.replace(this.getLatestVersionRegexPattern(), 'versions.txt')))
    }

    return {bridgeUrl, bridgeVersion}
  }

  private async processVersion(): Promise<BridgeUrlVersion> {
    const requestedVersion = inputs.BRIDGE_CLI_DOWNLOAD_VERSION

    if (await this.isBridgeInstalled(requestedVersion)) {
      info('Bridge CLI already exists')
      return {bridgeUrl: '', bridgeVersion: requestedVersion}
    }

    return this.updateBridgeCLIVersion(requestedVersion)
  }

  private getPlatformForVersion(version: string): string {
    if (process.platform === constants.MAC_PLATFORM_NAME) {
      const isARM = !os.cpus()[0].model.includes('Intel')
      const isValidVersionForARM = semver.gte(version, constants.MIN_SUPPORTED_BRIDGE_CLI_MAC_ARM_VERSION)
      return this.selectPlatform(version, isARM, isValidVersionForARM, this.MAC_ARM_PLATFORM, this.MAC_PLATFORM, constants.MIN_SUPPORTED_BRIDGE_CLI_MAC_ARM_VERSION)
    }

    if (process.platform === constants.LINUX_PLATFORM_NAME) {
      const isARM = /^(arm.*|aarch.*)$/.test(process.arch)
      const isValidVersionForARM = semver.gte(version, constants.MIN_SUPPORTED_BRIDGE_CLI_LINUX_ARM_VERSION)
      return this.selectPlatform(version, isARM, isValidVersionForARM, this.LINUX_ARM_PLATFORM, this.LINUX_PLATFORM, constants.MIN_SUPPORTED_BRIDGE_CLI_LINUX_ARM_VERSION)
    }

    return this.WINDOWS_PLATFORM
  }
}
