import {exec, ExecOptions} from '@actions/exec'
import {debug, info, warning} from '@actions/core'
import * as constants from '../../application-constants'
import {BRIDGE_CLI_DEFAULT_PATH_LINUX, BRIDGE_CLI_DEFAULT_PATH_MAC, BRIDGE_CLI_DEFAULT_PATH_WINDOWS, LINUX_PLATFORM_NAME, MAC_PLATFORM_NAME, NON_RETRY_HTTP_CODES, RETRY_COUNT, RETRY_DELAY_IN_MILLISECONDS, WINDOWS_PLATFORM_NAME} from '../../application-constants'
import path from 'path'
import {checkIfPathExists, cleanupTempDir, getSharedHttpClient, getSharedHttpsAgent, parseToBoolean, sleep} from '../utility'
import os from 'os'
import {validateBlackDuckInputs, validateCoverityInputs, validatePolarisInputs, validateScanTypes, validateSRMInputs} from '../validators'
import * as inputs from '../inputs'
import {ENABLE_NETWORK_AIR_GAP} from '../inputs'
import {BridgeToolsParameter} from '../tools-parameter'
import {DownloadFileResponse, getRemoteFile} from '../download-utility'
import fs from 'fs'
import {tryGetExecutablePath} from '@actions/io/lib/io-util'
import {rmRF} from '@actions/io'
import semver from 'semver'
import DomParser from 'dom-parser'
import * as url from 'node:url'
import * as https from 'node:https'

export abstract class BridgeClientBase {
  bridgeExecutablePath: string
  bridgePath: string
  protected bridgeArtifactoryURL: string
  protected bridgeUrlPattern: string
  protected bridgeUrlLatestPattern: string

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
    this.initializeUrls()
  }

  abstract getBridgeFileType(): string
  abstract getBridgeVersion(): Promise<string>
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
  protected abstract updateBridgeCLIVersion(requestedVersion: string): Promise<{bridgeUrl: string; bridgeVersion: string}>
  protected abstract verifyRegexCheck(url: string): RegExpMatchArray | null

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

  private async cleanupOnError(tempDir: string): Promise<void> {
    try {
      await cleanupTempDir(tempDir)
    } catch (cleanupError) {
      debug(`Failed to cleanup temp directory: ${cleanupError}`)
    }
  }

  /**
   * Validates that at least one scan type is configured
   * @throws Error if no scan types are configured
   */
  private validateRequiredScanTypes(): void {
    const invalidParams: string[] = validateScanTypes()
    if (invalidParams.length === 4) {
      throw new Error(constants.SCAN_TYPE_REQUIRED_ERROR.replace('{0}', constants.POLARIS_SERVER_URL_KEY).replace('{1}', constants.COVERITY_URL_KEY).replace('{2}', constants.BLACKDUCKSCA_URL_KEY).replace('{3}', constants.SRM_URL_KEY))
    }
  }

  /**
   * Builds commands for all configured tools and aggregates validation errors
   * @param tempDir Temporary directory path
   * @returns Object containing formatted command and validation errors
   */
  private async buildCommandForAllTools(tempDir: string): Promise<{formattedCommand: string; validationErrors: string[]}> {
    let formattedCommand = ''
    const validationErrors: string[] = []

    // Build command for Polaris
    const polarisResult = this.buildPolarisCommand(tempDir)
    formattedCommand = formattedCommand.concat(polarisResult.command)
    validationErrors.push(...polarisResult.errors)

    // Build command for Coverity
    const coverityResult = this.buildCoverityCommand(tempDir)
    formattedCommand = formattedCommand.concat(coverityResult.command)
    validationErrors.push(...coverityResult.errors)

    // Build command for BlackDuck
    const blackduckResult = this.buildBlackDuckCommand(tempDir)
    formattedCommand = formattedCommand.concat(blackduckResult.command)
    validationErrors.push(...blackduckResult.errors)

    // Build command for SRM
    const srmResult = this.buildSRMCommand(tempDir)
    formattedCommand = formattedCommand.concat(srmResult.command)
    validationErrors.push(...srmResult.errors)

    return {formattedCommand, validationErrors}
  }

  /**
   * Builds command for Polaris tool
   * @param tempDir Temporary directory path
   * @returns Command string and validation errors
   */
  private buildPolarisCommand(tempDir: string): {command: string; errors: string[]} {
    const polarisErrors: string[] = validatePolarisInputs()
    let command = ''

    if (polarisErrors.length === 0 && inputs.POLARIS_SERVER_URL) {
      const polarisCommandFormatter = new BridgeToolsParameter(tempDir)
      const polarisParams = polarisCommandFormatter.getFormattedCommandForPolaris()
      command = this.generateFormattedCommand(polarisParams.stage, polarisParams.stateFilePath, polarisParams.workflowVersion)
    }

    return {command, errors: polarisErrors}
  }

  /**
   * Builds command for Coverity tool
   * @param tempDir Temporary directory path
   * @returns Command string and validation errors
   */
  private buildCoverityCommand(tempDir: string): {command: string; errors: string[]} {
    const coverityErrors: string[] = validateCoverityInputs()
    let command = ''

    if (coverityErrors.length === 0 && inputs.COVERITY_URL) {
      const coverityCommandFormatter = new BridgeToolsParameter(tempDir)
      const coverityParams = coverityCommandFormatter.getFormattedCommandForCoverity()
      command = this.generateFormattedCommand(coverityParams.stage, coverityParams.stateFilePath, coverityParams.workflowVersion)
    }

    return {command, errors: coverityErrors}
  }

  /**
   * Builds command for BlackDuck tool
   * @param tempDir Temporary directory path
   * @returns Command string and validation errors
   */
  private buildBlackDuckCommand(tempDir: string): {command: string; errors: string[]} {
    const blackduckErrors: string[] = validateBlackDuckInputs()
    let command = ''

    if (blackduckErrors.length === 0 && inputs.BLACKDUCKSCA_URL) {
      const blackDuckCommandFormatter = new BridgeToolsParameter(tempDir)
      const blackduckParams = blackDuckCommandFormatter.getFormattedCommandForBlackduck()
      command = this.generateFormattedCommand(blackduckParams.stage, blackduckParams.stateFilePath, blackduckParams.workflowVersion)
    }

    return {command, errors: blackduckErrors}
  }

  /**
   * Builds command for SRM tool
   * @param tempDir Temporary directory path
   * @returns Command string and validation errors
   */
  private buildSRMCommand(tempDir: string): {command: string; errors: string[]} {
    const srmErrors: string[] = validateSRMInputs()
    let command = ''

    if (srmErrors.length === 0 && inputs.SRM_URL) {
      const srmCommandFormatter = new BridgeToolsParameter(tempDir)
      const srmParams = srmCommandFormatter.getFormattedCommandForSRM()
      command = this.generateFormattedCommand(srmParams.stage, srmParams.stateFilePath, srmParams.workflowVersion)
    }

    return {command, errors: srmErrors}
  }

  /**
   * Handles validation errors and command validation
   * @param validationErrors Array of validation errors
   * @param formattedCommand The formatted command string
   * @throws Error if no command was generated and there are validation errors
   */
  private handleValidationErrors(validationErrors: string[], formattedCommand: string): void {
    if (validationErrors.length > 0 || formattedCommand.length === 0) {
      throw new Error(validationErrors.join(','))
    }
  }

  /**
   * Adds diagnostics option to command if enabled
   * @param formattedCommand The base command
   * @returns Command with diagnostics option if enabled
   */
  private addDiagnosticsIfEnabled(formattedCommand: string): string {
    return parseToBoolean(inputs.INCLUDE_DIAGNOSTICS) ? formattedCommand.concat(BridgeToolsParameter.SPACE).concat(BridgeToolsParameter.DIAGNOSTICS_OPTION) : formattedCommand
  }

  /**
   * Gets the bridge CLI download default path with optional bridge type
   * @param includeBridgeType Whether to include the bridge type in the path
   * @returns The complete default download path
   */
  protected getBridgeCLIDownloadPathCommon(includeBridgeType = false): string {
    return includeBridgeType ? path.join(this.getBasePath(), this.getBridgeType()) : this.getBasePath()
  }

  private getBasePath(): string {
    const osName = process.platform
    const basePaths: Record<string, {env: string; dir: string}> = {
      [MAC_PLATFORM_NAME]: {env: 'HOME', dir: BRIDGE_CLI_DEFAULT_PATH_MAC},
      [LINUX_PLATFORM_NAME]: {env: 'HOME', dir: BRIDGE_CLI_DEFAULT_PATH_LINUX},
      [WINDOWS_PLATFORM_NAME]: {env: 'USERPROFILE', dir: BRIDGE_CLI_DEFAULT_PATH_WINDOWS}
    }
    const base = basePaths[osName]
    return base ? path.join(process.env[base.env] as string, base.dir) : ''
  }

  protected getBridgeDefaultPath(): string {
    return this.getBasePath() ? path.join(this.getBasePath(), this.getBridgeType()) : ''
  }

  async downloadBridge(tempDir: string): Promise<void> {
    try {
      const isAirGap = parseToBoolean(ENABLE_NETWORK_AIR_GAP)
      if (isAirGap) {
        info('Network air gap is enabled.')
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

  private async getBridgeUrlAndVersion(isAirGap: boolean): Promise<{bridgeUrl: string; bridgeVersion: string}> {
    debug(`Bridge CLI download URL: ${inputs.BRIDGE_CLI_DOWNLOAD_URL}`)
    if (inputs.BRIDGE_CLI_DOWNLOAD_URL) {
      debug('Using provided Bridge CLI download URL')
      return await this.processDownloadUrl()
    }

    if (inputs.BRIDGE_CLI_DOWNLOAD_VERSION) {
      debug(`Using specified Bridge CLI version: ${inputs.BRIDGE_CLI_DOWNLOAD_VERSION}`)
      return await this.processVersion()
    }

    debug('No specific URL or version provided, using latest version')
    return await this.processLatestVersion(isAirGap)
  }

  private async processDownloadUrl(): Promise<{bridgeUrl: string; bridgeVersion: string}> {
    const bridgeUrl = inputs.BRIDGE_CLI_DOWNLOAD_URL
    const versionInfo = this.verifyRegexCheck(bridgeUrl)
    let bridgeVersion = ''

    if (versionInfo != null) {
      bridgeVersion = versionInfo[1]
      if (!bridgeVersion) {
        bridgeVersion = await this.getBridgeVersionFromLatestURL(bridgeUrl.replace(this.getLatestVersionRegexPattern(), 'versions.txt'))
      }
    }

    return {bridgeUrl, bridgeVersion}
  }

  private async processVersion(): Promise<{bridgeUrl: string; bridgeVersion: string}> {
    const requestedVersion = inputs.BRIDGE_CLI_DOWNLOAD_VERSION
    if (await this.isBridgeInstalled(requestedVersion)) {
      info('Bridge CLI already exists')
      return {bridgeUrl: '', bridgeVersion: requestedVersion}
    }
    return await this.updateBridgeCLIVersion(requestedVersion)
  }

  private async processLatestVersion(isAirGap: boolean): Promise<{bridgeUrl: string; bridgeVersion: string}> {
    if (isAirGap && (await this.checkIfBridgeExistsInAirGap())) {
      info('Bridge CLI already exists')
      return {bridgeUrl: '', bridgeVersion: ''}
    }

    info('Checking for latest version of Bridge to download and configure')
    const bridgeVersion = await this.getBridgeVersionFromLatestURL(this.bridgeArtifactoryURL.concat('latest/versions.txt'))
    const bridgeUrl = this.bridgeUrlLatestPattern

    return {bridgeUrl, bridgeVersion}
  }

  /**
   * Executes a bridge command with consistent debug logging
   * @param bridgeCommand The command to execute
   * @param execOptions Execution options
   * @returns Promise with exit code
   */
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

  async executeBridgeCommand(bridgeCommand: string, workingDirectory: string): Promise<number> {
    const osName: string = process.platform
    if (osName === MAC_PLATFORM_NAME || osName === LINUX_PLATFORM_NAME || osName === WINDOWS_PLATFORM_NAME) {
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
      let retryCountLocal = RETRY_COUNT
      let retryDelay = RETRY_DELAY_IN_MILLISECONDS

      do {
        try {
          const response = await this.makeHttpsGetRequest(latestVersionsUrl)

          if (!NON_RETRY_HTTP_CODES.has(Number(response.statusCode))) {
            retryDelay = await this.retrySleepHelper('Getting latest Bridge CLI versions has been failed, Retries left: ', retryCountLocal, retryDelay)
            retryCountLocal--
          } else if (response.statusCode === 200) {
            retryCountLocal = 0
            const htmlResponse = response.body.trim()
            const lines = htmlResponse.split('\n')
            for (const line of lines) {
              if (line.includes('bridge-cli-bundle')) {
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

  async setBridgeExecutablePath(): Promise<void> {
    if (process.platform === WINDOWS_PLATFORM_NAME) {
      this.bridgeExecutablePath = await tryGetExecutablePath(this.bridgePath.concat('\\bridge-cli'), ['.exe'])
    } else if (process.platform === MAC_PLATFORM_NAME || process.platform === LINUX_PLATFORM_NAME) {
      this.bridgeExecutablePath = await tryGetExecutablePath(this.bridgePath.concat('/bridge-cli'), [])
    }
  }

  getVersionUrl(version: string): string {
    const platform = this.getPlatformForVersion(version)
    return this.bridgeUrlPattern.replace(/\$version/g, version).replace('$platform', platform)
  }

  private getPlatformForVersion(version: string): string {
    if (process.platform === MAC_PLATFORM_NAME) {
      const isARM = !os.cpus()[0].model.includes('Intel')
      const isValidVersionForARM = semver.gte(version, constants.MIN_SUPPORTED_BRIDGE_CLI_MAC_ARM_VERSION)
      return this.selectPlatform(version, isARM, isValidVersionForARM, this.MAC_ARM_PLATFORM, this.MAC_PLATFORM, constants.MIN_SUPPORTED_BRIDGE_CLI_MAC_ARM_VERSION)
    }

    if (process.platform === LINUX_PLATFORM_NAME) {
      const isARM = /^(arm.*|aarch.*)$/.test(process.arch)
      const isValidVersionForARM = semver.gte(version, constants.MIN_SUPPORTED_BRIDGE_CLI_LINUX_ARM_VERSION)
      return this.selectPlatform(version, isARM, isValidVersionForARM, this.LINUX_ARM_PLATFORM, this.LINUX_PLATFORM, constants.MIN_SUPPORTED_BRIDGE_CLI_LINUX_ARM_VERSION)
    }

    return this.WINDOWS_PLATFORM
  }

  async validateAirGapExecutable(bridgePath: string): Promise<void> {
    const executablePath = path.join(bridgePath, this.getBridgeFileType())
    debug(`Validating air gap executable at: ${executablePath}`)

    const executableExists = checkIfPathExists(executablePath)

    if (!executableExists) {
      if (inputs.BRIDGE_CLI_DOWNLOAD_URL) {
        debug(`Executable missing in air gap mode, will download from: ${inputs.BRIDGE_CLI_DOWNLOAD_URL}`)
      } else {
        const errorMessage = constants.BRIDGE_EXECUTABLE_NOT_FOUND_ERROR.concat(bridgePath)
        debug(`Air gap validation failed: ${errorMessage}`)
        throw new Error(errorMessage)
      }
    }
  }

  async getAllAvailableBridgeVersions(): Promise<string[]> {
    let htmlResponse = ''
    const httpClient = getSharedHttpClient()
    let retryCountLocal = RETRY_COUNT
    let retryDelay = RETRY_DELAY_IN_MILLISECONDS
    let httpResponse
    const versionArray: string[] = []
    do {
      httpResponse = await httpClient.get(this.bridgeArtifactoryURL, {
        Accept: 'text/html'
      })

      if (!NON_RETRY_HTTP_CODES.has(Number(httpResponse.message.statusCode))) {
        retryDelay = await this.retrySleepHelper('Getting all available bridge versions has been failed, Retries left: ', retryCountLocal, retryDelay)
        retryCountLocal--
      } else {
        retryCountLocal = 0
        htmlResponse = await httpResponse.readBody()

        const domParser = new DomParser()
        const doms = domParser.parseFromString(htmlResponse)
        const elems = doms.getElementsByTagName('a') //querySelectorAll('a')

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

  private async makeHttpsGetRequest(targetUrl: string): Promise<{statusCode: number; body: string}> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new url.URL(targetUrl)
      const agent = getSharedHttpsAgent()

      const requestOptions: https.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        agent,
        headers: {
          Accept: 'text/html',
          'User-Agent': 'BlackDuckSecurityAction'
        }
      }

      const req = https.request(requestOptions, res => {
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

        res.on('error', err => {
          reject(err)
        })
      })

      req.on('error', err => {
        reject(err)
      })

      req.setTimeout(30000, () => {
        req.destroy()
        reject(new Error('Request timeout'))
      })

      req.end()
    })
  }
}
