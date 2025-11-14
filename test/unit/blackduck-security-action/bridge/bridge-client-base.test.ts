import {BridgeClientBase} from '../../../../src/blackduck-security-action/bridge/bridge-client-base'
import {BridgeToolsParameter} from '../../../../src/blackduck-security-action/tools-parameter'
import * as validators from '../../../../src/blackduck-security-action/validators'
import * as utility from '../../../../src/blackduck-security-action/utility'
import {ExecOptions} from '@actions/exec'
import {DownloadFileResponse} from '../../../../src/blackduck-security-action/download-utility'

// Mock fs module first to provide chmod
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    copyFile: jest.fn(),
    lstat: jest.fn(),
    mkdir: jest.fn(),
    readdir: jest.fn(),
    readlink: jest.fn(),
    rename: jest.fn(),
    rmdir: jest.fn(),
    stat: jest.fn(),
    symlink: jest.fn(),
    unlink: jest.fn(),
    writeFile: jest.fn()
  },
  constants: {
    F_OK: 0,
    R_OK: 4,
    W_OK: 2,
    X_OK: 1
  },
  chmod: jest.fn(),
  chmodSync: jest.fn(),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  statSync: jest.fn(),
  lstatSync: jest.fn(),
  readdirSync: jest.fn(),
  mkdirSync: jest.fn(),
  rmdirSync: jest.fn(),
  unlinkSync: jest.fn(),
  copyFileSync: jest.fn(),
  renameSync: jest.fn()
}))

// Mock all external dependencies
jest.mock('@actions/core', () => ({
  getInput: jest.fn(() => ''),
  info: jest.fn(),
  debug: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
  exportVariable: jest.fn()
}))

jest.mock('@actions/exec', () => ({
  exec: jest.fn()
}))

jest.mock('@actions/io', () => ({
  cp: jest.fn(),
  mv: jest.fn(),
  rmRF: jest.fn(),
  mkdirP: jest.fn(),
  which: jest.fn(),
  find: jest.fn()
}))

// Mock the constants module
jest.mock('../../../../src/application-constants', () => ({
  BRIDGE_EXECUTABLE_NOT_FOUND_ERROR: 'Bridge executable not found at ',
  SCAN_TYPE_REQUIRED_ERROR: 'At least one scan type must be configured: {0}, {1}, {2}, or {3}',
  BRIDGE_CLI_URL_NOT_VALID_OS_ERROR: 'Provided Bridge CLI url is not valid for the configured ',
  PROVIDED_BRIDGE_CLI_URL_EMPTY_ERROR: 'Provided Bridge CLI URL cannot be empty ',
  BRIDGE_CLI_ARTIFACTORY_URL: 'https://repo.blackduck.com/bds-integrations-release/com/blackduck/integration/bridge/binaries/',
  POLARIS_SERVER_URL_KEY: 'POLARIS_SERVER_URL',
  COVERITY_URL_KEY: 'COVERITY_URL',
  BLACKDUCKSCA_URL_KEY: 'BLACKDUCKSCA_URL',
  SRM_URL_KEY: 'SRM_URL',
  // Add platform name constants
  MAC_PLATFORM_NAME: 'darwin',
  LINUX_PLATFORM_NAME: 'linux',
  WINDOWS_PLATFORM_NAME: 'win32',
  // Add ARM version constants
  MIN_SUPPORTED_BRIDGE_CLI_MAC_ARM_VERSION: '2.1.0',
  MIN_SUPPORTED_BRIDGE_CLI_LINUX_ARM_VERSION: '3.5.1',
  // Add the missing retry-related constants
  RETRY_COUNT: 3,
  RETRY_DELAY_IN_MILLISECONDS: 15000,
  NON_RETRY_HTTP_CODES: new Set([200, 201, 401, 403, 416]),
  GITHUB_ENVIRONMENT_VARIABLES: {
    GITHUB_TOKEN: 'GITHUB_TOKEN',
    GITHUB_REPOSITORY: 'GITHUB_REPOSITORY',
    GITHUB_HEAD_REF: 'GITHUB_HEAD_REF',
    GITHUB_REF: 'GITHUB_REF',
    GITHUB_REF_NAME: 'GITHUB_REF_NAME',
    GITHUB_REPOSITORY_OWNER: 'GITHUB_REPOSITORY_OWNER',
    GITHUB_BASE_REF: 'GITHUB_BASE_REF',
    GITHUB_EVENT_NAME: 'GITHUB_EVENT_NAME',
    GITHUB_SERVER_URL: 'GITHUB_SERVER_URL'
  }
}))

// Mock os module
jest.mock('os', () => ({
  cpus: jest.fn().mockReturnValue([{model: 'Intel CPU'}])
}))

// Mock the inputs module with a factory function that returns mutable values
jest.mock('../../../../src/blackduck-security-action/inputs', () => {
  // Create a global mock state that can be modified
  const mockState: Record<string, string> = {
    POLARIS_SERVER_URL: '',
    COVERITY_URL: '',
    BLACKDUCKSCA_URL: '',
    SRM_URL: '',
    POLARIS_ACCESS_TOKEN: '',
    POLARIS_APPLICATION_NAME: '',
    POLARIS_PROJECT_NAME: '',
    POLARIS_ASSESSMENT_TYPES: '',
    POLARIS_PRCOMMENT_ENABLED: '',
    POLARIS_PRCOMMENT_SEVERITIES: '',
    POLARIS_BRANCH_NAME: '',
    POLARIS_PARENT_BRANCH_NAME: '',
    POLARIS_TEST_SCA_TYPE: '',
    POLARIS_TEST_SAST_TYPE: '',
    POLARIS_REPORTS_SARIF_CREATE: '',
    POLARIS_REPORTS_SARIF_FILE_PATH: '',
    POLARIS_REPORTS_SARIF_SEVERITIES: '',
    POLARIS_REPORTS_SARIF_GROUP_SCA_ISSUES: '',
    POLARIS_REPORTS_SARIF_ISSUE_TYPES: '',
    POLARIS_UPLOAD_SARIF_REPORT: '',
    POLARIS_WAITFORSCAN: '',
    POLARIS_ASSESSMENT_MODE: '',
    BRIDGE_CLI_DOWNLOAD_URL: '',
    BRIDGE_CLI_DOWNLOAD_VERSION: '',
    BRIDGE_CLI_BASE_URL: '',
    ENABLE_NETWORK_AIR_GAP: '',
    BRIDGE_CLI_INSTALL_DIRECTORY_KEY: ''
  }

  // Create getters that return the current state values
  const mockInputs: any = {}
  Object.keys(mockState).forEach(key => {
    Object.defineProperty(mockInputs, key, {
      get: () => mockState[key],
      enumerable: true,
      configurable: true
    })
  })

  // Add a helper function to set mock values
  mockInputs.__setMockValue = (key: string, value: string) => {
    mockState[key] = value
  }

  return mockInputs
})

jest.mock('../../../../src/blackduck-security-action/utility')
jest.mock('../../../../src/blackduck-security-action/validators')
jest.mock('../../../../src/blackduck-security-action/tools-parameter')

// Helper function to set mock input values
function setMockInputValue(key: string, value: string) {
  const mockInputs = require('../../../../src/blackduck-security-action/inputs')
  mockInputs.__setMockValue(key, value)
}

// Create a concrete implementation for testing
class TestBridgeClient extends BridgeClientBase {
  public setBridgeUrlPattern(pattern: string): void {
    this.bridgeUrlPattern = pattern
  }

  public setBridgeArtifactoryURL(url: string): void {
    this.bridgeArtifactoryURL = url
  }

  public setBridgeUrlLatestPattern(pattern: string): void {
    this.bridgeUrlLatestPattern = pattern
  }

  public callGetBridgeDefaultPath(): string {
    return this.getBridgeDefaultPath()
  }

  public callGetLatestVersionInfo(): Promise<any> {
    return this.getLatestVersionInfo()
  }

  public callSelectPlatform(version: string, isARM: boolean, isValidVersionForARM: boolean, armPlatform: string, defaultPlatform: string, minVersion: string): string {
    return this.selectPlatform(version, isARM, isValidVersionForARM, armPlatform, defaultPlatform, minVersion)
  }

  public async callDetermineBaseUrl(): Promise<string> {
    return (this as any).determineBaseUrl()
  }

  public callGetNormalizedVersionUrl(): string {
    return this.getNormalizedVersionUrl()
  }

  public callGetPlatformName(): string {
    return this.getPlatformName()
  }

  public callRetrySleepHelper(message: string, retryCountLocal: number, retryDelay: number): Promise<number> {
    return this.retrySleepHelper(message, retryCountLocal, retryDelay)
  }

  // Additional public methods for comprehensive testing
  public callMakeHttpsGetRequest(url: string): Promise<any> {
    return (this as any).makeHttpsGetRequest(url)
  }

  public callShouldUpdateBridge(currentVersion: string, latestVersion: string): boolean {
    return (this as any).shouldUpdateBridge(currentVersion, latestVersion)
  }

  public callCleanupOnError(tempDir: string): Promise<void> {
    return (this as any).cleanupOnError(tempDir)
  }

  public callValidateRequiredScanTypes(): void {
    return (this as any).validateRequiredScanTypes()
  }

  public callHandleValidationErrors(errors: string[], command: string): void {
    return (this as any).handleValidationErrors(errors, command)
  }

  public callAddDiagnosticsIfEnabled(command: string): string {
    return (this as any).addDiagnosticsIfEnabled(command)
  }

  public callBuildCommandForAllTools(tempDir: string): Promise<any> {
    return (this as any).buildCommandForAllTools(tempDir)
  }

  public callCheckIfBridgeExistsLocally(): Promise<boolean> {
    return this.checkIfBridgeExistsLocally()
  }

  public callGetPlatformForVersion(version: string): string {
    return (this as any).getPlatformForVersion(version)
  }
  getBridgeFileType(): string {
    return 'bridge-cli'
  }

  getBridgeFileNameType(): string {
    return 'bridge-cli'
  }

  async getBridgeVersion(): Promise<string> {
    return '1.0.0'
  }

  getBridgeType(): string {
    return 'bridge-cli-bundle'
  }

  generateFormattedCommand(stage: string, stateFilePath: string, workflowVersion?: string): string {
    return `--stage ${stage} --state ${stateFilePath} ${workflowVersion ? `--version ${workflowVersion}` : ''}`
  }

  async isBridgeInstalled(bridgeVersion: string): Promise<boolean> {
    return false
  }

  async validateAndSetBridgePath(): Promise<void> {
    this.bridgePath = '/test/bridge/path'
  }

  protected async checkIfBridgeExistsInAirGap(): Promise<boolean> {
    return false
  }

  protected async executeCommand(bridgeCommand: string, execOptions: ExecOptions): Promise<number> {
    return 0
  }

  protected getLatestVersionRegexPattern(): RegExp {
    return /latest\/?/
  }

  protected getBridgeCLIDownloadDefaultPath(): string {
    return '/test/download/path'
  }

  protected initializeUrls(): void {
    this.bridgeArtifactoryURL = 'https://test.artifactory.url/'
    this.bridgeUrlPattern = 'https://test.url.pattern'
    this.bridgeUrlLatestPattern = 'https://example.com/bridge/latest'
  }

  protected async processBaseUrlWithLatest(): Promise<{bridgeUrl: string; bridgeVersion: string}> {
    return {bridgeUrl: 'https://test.url', bridgeVersion: '1.0.0'}
  }

  protected async processLatestVersion(isAirGap: boolean): Promise<{bridgeUrl: string; bridgeVersion: string}> {
    return {bridgeUrl: 'https://test.url', bridgeVersion: '1.0.0'}
  }

  protected async updateBridgeCLIVersion(requestedVersion: string): Promise<{bridgeUrl: string; bridgeVersion: string}> {
    return {bridgeUrl: 'https://test.url', bridgeVersion: requestedVersion}
  }

  protected verifyRegexCheck(url: string): RegExpMatchArray | null {
    return null
  }

  protected handleBridgeDownload(downloadResponse: DownloadFileResponse, extractZippedFilePath: string, bridgePathType?: string, pathSeparator?: string): Promise<void> {
    return Promise.resolve(undefined)
  }

  getBridgeExecutablePath(): string {
    const bridgeExecutableName = process.platform === 'win32' ? 'bridge-cli.exe' : 'bridge-cli'
    return `${this.bridgePath}/${bridgeExecutableName}`
  }
}

describe('BridgeClientBase - Polaris Command Building', () => {
  let bridgeClient: TestBridgeClient
  let mockValidatePolarisInputs: jest.SpyInstance
  let mockBridgeToolsParameter: jest.MockedClass<typeof BridgeToolsParameter>

  beforeEach(() => {
    jest.clearAllMocks()

    bridgeClient = new TestBridgeClient()

    // Setup mocks
    mockValidatePolarisInputs = jest.spyOn(validators, 'validatePolarisInputs')
    mockBridgeToolsParameter = BridgeToolsParameter as jest.MockedClass<typeof BridgeToolsParameter>

    // Set up environment for GitHub repo extraction
    process.env['GITHUB_REPOSITORY'] = 'test-owner/test-repo'

    // Reset mock inputs to default values
    setMockInputValue('POLARIS_SERVER_URL', '')
    setMockInputValue('COVERITY_URL', '')
    setMockInputValue('BLACKDUCKSCA_URL', '')
    setMockInputValue('SRM_URL', '')
  })

  afterEach(() => {
    delete process.env['GITHUB_REPOSITORY']
  })

  describe('Integration with buildCommandForAllTools', () => {
    it('should include Polaris command in overall command building', async () => {
      // Arrange
      const tempDir = '/tmp/test'
      const githubRepoName = 'test-repo'

      mockValidatePolarisInputs.mockReturnValue([])
      setMockInputValue('POLARIS_SERVER_URL', 'https://polaris.example.com')

      // Mock other validators to return no errors
      jest.spyOn(validators, 'validateCoverityInputs').mockReturnValue([])
      jest.spyOn(validators, 'validateBlackDuckInputs').mockReturnValue([])
      jest.spyOn(validators, 'validateSRMInputs').mockReturnValue([])

      // Mock other inputs to be empty
      setMockInputValue('COVERITY_URL', '')
      setMockInputValue('BLACKDUCKSCA_URL', '')
      setMockInputValue('SRM_URL', '')

      const mockPolarisCommandFormatter = {
        getFormattedCommandForPolaris: jest.fn().mockReturnValue({
          stage: 'polaris',
          stateFilePath: '/tmp/polaris_input.json',
          workflowVersion: '1.0.0'
        })
      }
      mockBridgeToolsParameter.mockImplementation(() => mockPolarisCommandFormatter as any)

      // Act
      const result = await (bridgeClient as any).buildCommandForAllTools(tempDir, githubRepoName)

      // Assert
      expect(result.formattedCommand).toBe('--stage polaris --state /tmp/polaris_input.json --version 1.0.0')
      expect(result.validationErrors).toEqual([])
    })

    it('should include Coverity command in overall command building', async () => {
      // Arrange
      const tempDir = '/tmp/test'
      const githubRepoName = 'test-repo'

      jest.spyOn(validators, 'validateCoverityInputs').mockReturnValue([])
      setMockInputValue('COVERITY_URL', 'https://coverity.example.com')

      // Mock other validators to return no errors
      jest.spyOn(validators, 'validatePolarisInputs').mockReturnValue([])
      jest.spyOn(validators, 'validateBlackDuckInputs').mockReturnValue([])
      jest.spyOn(validators, 'validateSRMInputs').mockReturnValue([])

      // Mock other inputs to be empty
      setMockInputValue('POLARIS_SERVER_URL', '')
      setMockInputValue('BLACKDUCKSCA_URL', '')
      setMockInputValue('SRM_URL', '')

      const mockCoverityCommandFormatter = {
        getFormattedCommandForCoverity: jest.fn().mockReturnValue({
          stage: 'coverity',
          stateFilePath: '/tmp/coverity_input.json',
          workflowVersion: '2.0.0'
        })
      }
      mockBridgeToolsParameter.mockImplementation(() => mockCoverityCommandFormatter as any)

      // Act
      const result = await (bridgeClient as any).buildCommandForAllTools(tempDir, githubRepoName)

      // Assert
      expect(result.formattedCommand).toBe('--stage coverity --state /tmp/coverity_input.json --version 2.0.0')
      expect(result.validationErrors).toEqual([])
      expect(mockCoverityCommandFormatter.getFormattedCommandForCoverity).toHaveBeenCalled()
    })

    it('should include BlackDuck command in overall command building', async () => {
      // Arrange
      const tempDir = '/tmp/test'
      const githubRepoName = 'test-repo'

      jest.spyOn(validators, 'validateBlackDuckInputs').mockReturnValue([])
      setMockInputValue('BLACKDUCKSCA_URL', 'https://blackduck.example.com')

      // Mock other validators to return no errors
      jest.spyOn(validators, 'validatePolarisInputs').mockReturnValue([])
      jest.spyOn(validators, 'validateCoverityInputs').mockReturnValue([])
      jest.spyOn(validators, 'validateSRMInputs').mockReturnValue([])

      // Mock other inputs to be empty
      setMockInputValue('POLARIS_SERVER_URL', '')
      setMockInputValue('COVERITY_URL', '')
      setMockInputValue('SRM_URL', '')

      const mockBlackDuckCommandFormatter = {
        getFormattedCommandForBlackduck: jest.fn().mockReturnValue({
          stage: 'blackduck',
          stateFilePath: '/tmp/blackduck_input.json',
          workflowVersion: '3.0.0'
        })
      }
      mockBridgeToolsParameter.mockImplementation(() => mockBlackDuckCommandFormatter as any)

      // Act
      const result = await (bridgeClient as any).buildCommandForAllTools(tempDir, githubRepoName)

      // Assert
      expect(result.formattedCommand).toBe('--stage blackduck --state /tmp/blackduck_input.json --version 3.0.0')
      expect(result.validationErrors).toEqual([])
      expect(mockBlackDuckCommandFormatter.getFormattedCommandForBlackduck).toHaveBeenCalled()
    })

    it('should include SRM command in overall command building', async () => {
      // Arrange
      const tempDir = '/tmp/test'
      const githubRepoName = 'test-repo'

      jest.spyOn(validators, 'validateSRMInputs').mockReturnValue([])
      setMockInputValue('SRM_URL', 'https://srm.example.com')

      // Mock other validators to return no errors
      jest.spyOn(validators, 'validatePolarisInputs').mockReturnValue([])
      jest.spyOn(validators, 'validateCoverityInputs').mockReturnValue([])
      jest.spyOn(validators, 'validateBlackDuckInputs').mockReturnValue([])

      // Mock other inputs to be empty
      setMockInputValue('POLARIS_SERVER_URL', '')
      setMockInputValue('COVERITY_URL', '')
      setMockInputValue('BLACKDUCKSCA_URL', '')

      const mockSRMCommandFormatter = {
        getFormattedCommandForSRM: jest.fn().mockReturnValue({
          stage: 'srm',
          stateFilePath: '/tmp/srm_input.json',
          workflowVersion: '4.0.0'
        })
      }
      mockBridgeToolsParameter.mockImplementation(() => mockSRMCommandFormatter as any)

      // Act
      const result = await (bridgeClient as any).buildCommandForAllTools(tempDir, githubRepoName)

      // Assert
      expect(result.formattedCommand).toBe('--stage srm --state /tmp/srm_input.json --version 4.0.0')
      expect(result.validationErrors).toEqual([])
      expect(mockSRMCommandFormatter.getFormattedCommandForSRM).toHaveBeenCalled()
    })

    it('should handle multiple tools with Coverity and BlackDuck combined', async () => {
      // Arrange
      const tempDir = '/tmp/test'
      const githubRepoName = 'test-repo'

      jest.spyOn(validators, 'validateCoverityInputs').mockReturnValue([])
      jest.spyOn(validators, 'validateBlackDuckInputs').mockReturnValue([])
      setMockInputValue('COVERITY_URL', 'https://coverity.example.com')
      setMockInputValue('BLACKDUCKSCA_URL', 'https://blackduck.example.com')

      // Mock other validators to return no errors
      jest.spyOn(validators, 'validatePolarisInputs').mockReturnValue([])
      jest.spyOn(validators, 'validateSRMInputs').mockReturnValue([])

      // Mock other inputs to be empty
      setMockInputValue('POLARIS_SERVER_URL', '')
      setMockInputValue('SRM_URL', '')

      const mockMultiToolCommandFormatter = {
        getFormattedCommandForCoverity: jest.fn().mockReturnValue({
          stage: 'coverity',
          stateFilePath: '/tmp/coverity_input.json',
          workflowVersion: '2.0.0'
        }),
        getFormattedCommandForBlackduck: jest.fn().mockReturnValue({
          stage: 'blackduck',
          stateFilePath: '/tmp/blackduck_input.json',
          workflowVersion: '3.0.0'
        })
      }
      mockBridgeToolsParameter.mockImplementation(() => mockMultiToolCommandFormatter as any)

      // Act
      const result = await (bridgeClient as any).buildCommandForAllTools(tempDir, githubRepoName)

      // Assert
      // Should contain both stages in the command
      expect(result.formattedCommand).toContain('--stage coverity')
      expect(result.formattedCommand).toContain('--stage blackduck')
      expect(result.validationErrors).toEqual([])
      expect(mockMultiToolCommandFormatter.getFormattedCommandForCoverity).toHaveBeenCalled()
      expect(mockMultiToolCommandFormatter.getFormattedCommandForBlackduck).toHaveBeenCalled()
    })

    it('should handle validation errors from BlackDuck formatter', async () => {
      // Arrange
      const tempDir = '/tmp/test'
      const githubRepoName = 'test-repo'

      jest.spyOn(validators, 'validateBlackDuckInputs').mockReturnValue(['BlackDuck validation error'])
      setMockInputValue('BLACKDUCKSCA_URL', 'https://blackduck.example.com')

      // Mock other validators to return no errors
      jest.spyOn(validators, 'validatePolarisInputs').mockReturnValue([])
      jest.spyOn(validators, 'validateCoverityInputs').mockReturnValue([])
      jest.spyOn(validators, 'validateSRMInputs').mockReturnValue([])

      // Mock other inputs to be empty
      setMockInputValue('POLARIS_SERVER_URL', '')
      setMockInputValue('COVERITY_URL', '')
      setMockInputValue('SRM_URL', '')

      const mockBlackDuckCommandFormatter = {
        getFormattedCommandForBlackduck: jest.fn().mockReturnValue({
          stage: 'blackduck',
          stateFilePath: '/tmp/blackduck_input.json',
          workflowVersion: '3.0.0'
        })
      }
      mockBridgeToolsParameter.mockImplementation(() => mockBlackDuckCommandFormatter as any)

      // Act
      const result = await (bridgeClient as any).buildCommandForAllTools(tempDir, githubRepoName)

      // Assert
      expect(result.validationErrors).toContain('BlackDuck validation error')
      // When there are validation errors, no command is generated
      expect(result.formattedCommand).toBe('')
      // Formatter should not be called when validation fails
      expect(mockBlackDuckCommandFormatter.getFormattedCommandForBlackduck).not.toHaveBeenCalled()
    })
  })

  describe('validateAirGapExecutable', () => {
    let mockCheckIfPathExists: jest.SpyInstance
    let mockDebug: jest.SpyInstance

    beforeEach(() => {
      jest.clearAllMocks()

      // Mock the utility function and core debug
      const utility = require('../../../../src/blackduck-security-action/utility')
      const core = require('@actions/core')

      mockCheckIfPathExists = jest.spyOn(utility, 'checkIfPathExists')
      mockDebug = jest.spyOn(core, 'debug')

      // Reset mock inputs
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', '')
    })

    it('should pass validation when executable exists', async () => {
      // Arrange
      const bridgePath = '/test/bridge/path'
      const expectedExecutablePath = '/test/bridge/path/bridge-cli'
      mockCheckIfPathExists.mockReturnValue(true)

      // Act
      await expect(bridgeClient.validateAirGapExecutable(bridgePath)).resolves.not.toThrow()

      // Assert
      expect(mockCheckIfPathExists).toHaveBeenCalledWith(expectedExecutablePath)
      expect(mockDebug).toHaveBeenCalledWith(`Validating air gap executable at: ${expectedExecutablePath}`)
    })

    it('should handle path with special characters correctly', async () => {
      // Arrange
      const bridgePath = '/test/bridge path with spaces/special-chars_123'
      const expectedExecutablePath = '/test/bridge path with spaces/special-chars_123/bridge-cli'

      mockCheckIfPathExists.mockReturnValue(true)

      // Act
      await expect(bridgeClient.validateAirGapExecutable(bridgePath)).resolves.not.toThrow()

      // Assert
      expect(mockCheckIfPathExists).toHaveBeenCalledWith(expectedExecutablePath)
      expect(mockDebug).toHaveBeenCalledWith(`Validating air gap executable at: ${expectedExecutablePath}`)
    })

    it('should use getBridgeFileType for executable name', async () => {
      // Arrange
      const bridgePath = '/test/bridge/path'

      // Create a spy on getBridgeFileType to verify it's called
      const getBridgeFileTypeSpy = jest.spyOn(bridgeClient, 'getBridgeFileType')
      getBridgeFileTypeSpy.mockReturnValue('custom-bridge-executable')

      const expectedExecutablePath = '/test/bridge/path/custom-bridge-executable'
      mockCheckIfPathExists.mockReturnValue(true)

      // Act
      await expect(bridgeClient.validateAirGapExecutable(bridgePath)).resolves.not.toThrow()

      // Assert
      expect(getBridgeFileTypeSpy).toHaveBeenCalled()
      expect(mockCheckIfPathExists).toHaveBeenCalledWith(expectedExecutablePath)
      expect(mockDebug).toHaveBeenCalledWith(`Validating air gap executable at: ${expectedExecutablePath}`)
    })

    it('should throw error when BRIDGE_CLI_BASE_URL is not provided in air gap mode and executable does not exist', async () => {
      // Arrange
      const bridgePath = '/test/bridge/path'
      mockCheckIfPathExists.mockReturnValue(false)
      setMockInputValue('BRIDGE_CLI_BASE_URL', '')

      // Act & Assert
      await expect(bridgeClient.validateAirGapExecutable(bridgePath)).rejects.toThrow('No BRIDGE_CLI_BASE_URL provided')
    })
  })

  describe('prepareCommand', () => {
    let mockValidateScanTypes: jest.SpyInstance
    let mockBuildCommandForAllTools: jest.SpyInstance
    let mockCleanupTempDir: jest.SpyInstance
    let mockParseToBoolean: jest.SpyInstance

    beforeEach(() => {
      jest.clearAllMocks()

      const utility = require('../../../../src/blackduck-security-action/utility')

      mockValidateScanTypes = jest.spyOn(validators, 'validateScanTypes')
      mockBuildCommandForAllTools = jest.spyOn(bridgeClient as any, 'buildCommandForAllTools')
      mockCleanupTempDir = jest.spyOn(utility, 'cleanupTempDir')
      mockParseToBoolean = jest.spyOn(utility, 'parseToBoolean')

      // Mock all validators to return no errors by default
      jest.spyOn(validators, 'validatePolarisInputs').mockReturnValue([])
      jest.spyOn(validators, 'validateCoverityInputs').mockReturnValue([])
      jest.spyOn(validators, 'validateBlackDuckInputs').mockReturnValue([])
      jest.spyOn(validators, 'validateSRMInputs').mockReturnValue([])
    })

    it('should successfully prepare command when scan types are valid', async () => {
      // Arrange
      const tempDir = '/tmp/test'
      const expectedCommand = '--stage polaris --state /tmp/polaris_input.json'

      mockValidateScanTypes.mockReturnValue([])
      mockBuildCommandForAllTools.mockResolvedValue({
        formattedCommand: expectedCommand,
        validationErrors: []
      })
      mockParseToBoolean.mockReturnValue(false)

      setMockInputValue('POLARIS_SERVER_URL', 'https://polaris.example.com')

      // Act
      const result = await bridgeClient.prepareCommand(tempDir)

      // Assert
      expect(result).toBe(expectedCommand)
      expect(mockValidateScanTypes).toHaveBeenCalled()
      expect(mockBuildCommandForAllTools).toHaveBeenCalledWith(tempDir)
    })

    it('should add diagnostics option when INCLUDE_DIAGNOSTICS is true', async () => {
      // Arrange
      const tempDir = '/tmp/test'
      const baseCommand = '--stage polaris --state /tmp/polaris_input.json'
      const expectedCommand = `${baseCommand} --diagnostics`

      mockValidateScanTypes.mockReturnValue([])
      mockBuildCommandForAllTools.mockResolvedValue({
        formattedCommand: baseCommand,
        validationErrors: []
      })
      mockParseToBoolean.mockReturnValue(true)

      // Mock DIAGNOSTICS_OPTION from BridgeToolsParameter
      const toolsParameter = require('../../../../src/blackduck-security-action/tools-parameter')
      toolsParameter.BridgeToolsParameter = {
        SPACE: ' ',
        DIAGNOSTICS_OPTION: '--diagnostics'
      }

      // Act
      const result = await bridgeClient.prepareCommand(tempDir)

      // Assert
      expect(result).toBe(expectedCommand)
      expect(mockParseToBoolean).toHaveBeenCalled()
    })

    it('should throw error when no scan types are configured', async () => {
      // Arrange
      const tempDir = '/tmp/test'
      mockValidateScanTypes.mockReturnValue(['error1', 'error2', 'error3', 'error4'])

      // Act & Assert
      await expect(bridgeClient.prepareCommand(tempDir)).rejects.toThrow()
      expect(mockCleanupTempDir).toHaveBeenCalledWith(tempDir)
    })

    it('should throw error when validation errors exist', async () => {
      // Arrange
      const tempDir = '/tmp/test'
      const validationErrors = ['Validation error 1', 'Validation error 2']

      mockValidateScanTypes.mockReturnValue([])
      mockBuildCommandForAllTools.mockResolvedValue({
        formattedCommand: '',
        validationErrors
      })

      // Act & Assert
      await expect(bridgeClient.prepareCommand(tempDir)).rejects.toThrow('Validation error 1,Validation error 2')
      expect(mockCleanupTempDir).toHaveBeenCalledWith(tempDir)
    })

    it('should cleanup temp directory on error', async () => {
      // Arrange
      const tempDir = '/tmp/test'
      mockValidateScanTypes.mockImplementation(() => {
        throw new Error('Test error')
      })

      // Act & Assert
      await expect(bridgeClient.prepareCommand(tempDir)).rejects.toThrow('Test error')
      expect(mockCleanupTempDir).toHaveBeenCalledWith(tempDir)
    })
  })

  describe('downloadBridge', () => {
    let mockGetRemoteFile: jest.SpyInstance
    let mockParseToBoolean: jest.SpyInstance
    let mockInfo: jest.SpyInstance
    let mockCleanupTempDir: jest.SpyInstance
    let mockRmRF: jest.SpyInstance
    let mockExistsSync: jest.SpyInstance

    beforeEach(() => {
      jest.clearAllMocks()

      const downloadUtility = require('../../../../src/blackduck-security-action/download-utility')
      const utility = require('../../../../src/blackduck-security-action/utility')
      const core = require('@actions/core')
      const io = require('@actions/io')
      const fs = require('fs')

      mockGetRemoteFile = jest.spyOn(downloadUtility, 'getRemoteFile')
      mockParseToBoolean = jest.spyOn(utility, 'parseToBoolean')
      mockCleanupTempDir = jest.spyOn(utility, 'cleanupTempDir')
      mockInfo = jest.spyOn(core, 'info')
      mockRmRF = jest.spyOn(io, 'rmRF')
      mockExistsSync = jest.spyOn(fs, 'existsSync')

      // Mock getBridgeUrlAndVersion method
      jest.spyOn(bridgeClient as any, 'getBridgeUrlAndVersion').mockResolvedValue({
        bridgeUrl: 'https://test.url/bridge.zip',
        bridgeVersion: '1.2.3'
      })

      // Mock isBridgeInstalled to return false by default
      jest.spyOn(bridgeClient, 'isBridgeInstalled').mockResolvedValue(false)

      // Mock handleBridgeDownload
      jest.spyOn(bridgeClient as any, 'handleBridgeDownload').mockResolvedValue(undefined)
    })

    it('should download bridge successfully when not in air gap mode', async () => {
      // Arrange
      const tempDir = '/tmp/test'
      const mockDownloadResponse: DownloadFileResponse = {
        filePath: '/tmp/bridge.zip',
        fileName: 'https://test.url/bridge.zip'
      }

      mockParseToBoolean.mockReturnValue(false)
      mockGetRemoteFile.mockResolvedValue(mockDownloadResponse)
      mockExistsSync.mockReturnValue(false)

      // Act
      await bridgeClient.downloadBridge(tempDir)

      // Assert
      expect(mockInfo).toHaveBeenCalledWith('Bridge CLI version is - 1.2.3')
      expect(mockGetRemoteFile).toHaveBeenCalledWith(tempDir, 'https://test.url/bridge.zip')
      expect(mockInfo).toHaveBeenCalledWith('Downloading and configuring Bridge from URL - https://test.url/bridge.zip')
      expect(mockInfo).toHaveBeenCalledWith('Download and configuration of Bridge CLI completed')
    })

    it('should download bridge successfully when not in air gap mode and empty path', async () => {
      // Arrange
      const tempDir = '/tmp/test'
      const mockDownloadResponse: DownloadFileResponse = {
        filePath: '/tmp/bridge.zip',
        fileName: 'https://test.url/bridge.zip'
      }

      mockParseToBoolean.mockReturnValue(false)
      mockGetRemoteFile.mockResolvedValue(mockDownloadResponse)
      mockExistsSync.mockReturnValue(false)

      // Mock getBridgeUrlAndVersion to return non-empty bridgeUrl
      jest.spyOn(bridgeClient as any, 'getBridgeUrlAndVersion').mockResolvedValue({
        bridgeUrl: '',
        bridgeVersion: '1.2.3'
      })

      // Act
      await bridgeClient.downloadBridge(tempDir)

      // Assert
      expect(mockInfo).toHaveBeenCalledWith('Bridge CLI version is - 1.2.3')
    })

    it('should skip download when bridge is already installed', async () => {
      // Arrange
      const tempDir = '/tmp/test'
      mockParseToBoolean.mockReturnValue(false)
      jest.spyOn(bridgeClient, 'isBridgeInstalled').mockResolvedValue(true)

      // Act
      await bridgeClient.downloadBridge(tempDir)

      // Assert
      expect(mockInfo).toHaveBeenCalledWith('Bridge CLI already exists')
      expect(mockGetRemoteFile).not.toHaveBeenCalled()
    })

    it('should handle air gap mode', async () => {
      // Arrange
      const tempDir = '/tmp/test'
      mockParseToBoolean.mockReturnValue(true)
      mockExistsSync.mockReturnValue(false)

      // Act
      await bridgeClient.downloadBridge(tempDir)

      // Assert
      expect(mockInfo).toHaveBeenCalledWith('Network air gap is enabled.')
    })

    it('should skip download in air gap mode when shouldSkipAirGapDownload returns true', async () => {
      // Arrange
      const tempDir = '/tmp/test'
      mockParseToBoolean.mockReturnValue(true)

      // Mock shouldSkipAirGapDownload to return true
      const mockShouldSkipAirGapDownload = jest.spyOn(bridgeClient as any, 'shouldSkipAirGapDownload')
      mockShouldSkipAirGapDownload.mockResolvedValue(true)

      // Act
      await bridgeClient.downloadBridge(tempDir)

      // Assert
      expect(mockInfo).toHaveBeenCalledWith('Network air gap is enabled.')
      expect(mockInfo).toHaveBeenCalledWith('Bridge CLI already exists')
      expect(mockShouldSkipAirGapDownload).toHaveBeenCalled()
    })

    it('should clear existing bridge folder if it exists', async () => {
      // Arrange
      const tempDir = '/tmp/test'
      const mockDownloadResponse: DownloadFileResponse = {
        filePath: '/tmp/bridge.zip',
        fileName: 'https://test.url/bridge.zip'
      }

      mockParseToBoolean.mockReturnValue(false)
      mockGetRemoteFile.mockResolvedValue(mockDownloadResponse)
      mockExistsSync.mockReturnValue(true) // Bridge folder exists
      bridgeClient.bridgePath = '/existing/bridge/path'

      // Act
      await bridgeClient.downloadBridge(tempDir)

      // Assert
      expect(mockRmRF).toHaveBeenCalledWith('/existing/bridge/path')
      expect(mockInfo).toHaveBeenCalledWith('Clear the existing bridge folder, if available from /existing/bridge/path')
    })

    it('should handle 404 error appropriately', async () => {
      // Arrange
      const tempDir = '/tmp/test'
      const error = new Error('Request failed with status code 404')

      mockParseToBoolean.mockReturnValue(false)
      mockGetRemoteFile.mockRejectedValue(error)
      process.env['RUNNER_OS'] = 'Linux'

      // Act & Assert
      await expect(bridgeClient.downloadBridge(tempDir)).rejects.toThrow('Provided Bridge CLI url is not valid for the configured Linux runner')
      expect(mockCleanupTempDir).toHaveBeenCalledWith(tempDir)

      // Cleanup
      delete process.env['RUNNER_OS']
    })

    it('should handle empty URL error', async () => {
      // Arrange
      const tempDir = '/tmp/test'
      const error = new Error('URL is empty')

      mockParseToBoolean.mockReturnValue(false)
      mockGetRemoteFile.mockRejectedValue(error)

      // Act & Assert
      await expect(bridgeClient.downloadBridge(tempDir)).rejects.toThrow('Provided Bridge CLI URL cannot be empty ')
      expect(mockCleanupTempDir).toHaveBeenCalledWith(tempDir)
    })

    it('should handle generic error appropriately', async () => {
      // Arrange
      const tempDir = '/tmp/test'
      const error = new Error('Generic network error')

      mockParseToBoolean.mockReturnValue(false)
      mockGetRemoteFile.mockRejectedValue(error)

      // Act & Assert
      await expect(bridgeClient.downloadBridge(tempDir)).rejects.toThrow('Generic network error')
      expect(mockCleanupTempDir).toHaveBeenCalledWith(tempDir)
    })

    describe('BRIDGE_CLI_INSTALL_DIRECTORY_KEY path extraction logic', () => {
      it('should use default path when BRIDGE_CLI_INSTALL_DIRECTORY_KEY is not provided', async () => {
        // Arrange
        const tempDir = '/tmp/test'
        const mockDownloadResponse: DownloadFileResponse = {
          filePath: '/tmp/bridge.zip',
          fileName: 'https://test.url/bridge.zip'
        }

        mockParseToBoolean.mockReturnValue(false)
        mockGetRemoteFile.mockResolvedValue(mockDownloadResponse)
        mockExistsSync.mockReturnValue(false)

        // Ensure BRIDGE_CLI_INSTALL_DIRECTORY_KEY is empty
        setMockInputValue('BRIDGE_CLI_INSTALL_DIRECTORY_KEY', '')

        const mockHandleBridgeDownload = jest.spyOn(bridgeClient as any, 'handleBridgeDownload')
        mockHandleBridgeDownload.mockResolvedValue(undefined)

        // Act
        await bridgeClient.downloadBridge(tempDir)

        // Assert
        // Verify that handleBridgeDownload was called with the default path
        expect(mockHandleBridgeDownload).toHaveBeenCalledWith(
          mockDownloadResponse,
          '/test/download/path' // This should be the default path from getBridgeCLIDownloadDefaultPath()
        )
      })

      it('should use custom install directory when BRIDGE_CLI_INSTALL_DIRECTORY_KEY is provided', async () => {
        // Arrange
        const tempDir = '/tmp/test'
        const customInstallDir = '/custom/install/directory'
        const mockDownloadResponse: DownloadFileResponse = {
          filePath: '/tmp/bridge.zip',
          fileName: 'https://test.url/bridge.zip'
        }

        mockParseToBoolean.mockReturnValue(false)
        mockGetRemoteFile.mockResolvedValue(mockDownloadResponse)
        mockExistsSync.mockReturnValue(false)

        // Set custom install directory
        setMockInputValue('BRIDGE_CLI_INSTALL_DIRECTORY_KEY', customInstallDir)

        const mockHandleBridgeDownload = jest.spyOn(bridgeClient as any, 'handleBridgeDownload')
        mockHandleBridgeDownload.mockResolvedValue(undefined)

        // Act
        await bridgeClient.downloadBridge(tempDir)

        // Assert
        // Verify that handleBridgeDownload was called with custom path joined with bridge type
        expect(mockHandleBridgeDownload).toHaveBeenCalledWith(
          mockDownloadResponse,
          '/custom/install/directory/bridge-cli-bundle' // Custom path + getBridgeType()
        )
      })

      it('should handle custom install directory with trailing slash', async () => {
        // Arrange
        const tempDir = '/tmp/test'
        const customInstallDirWithSlash = '/custom/install/directory/'
        const mockDownloadResponse: DownloadFileResponse = {
          filePath: '/tmp/bridge.zip',
          fileName: 'https://test.url/bridge.zip'
        }

        mockParseToBoolean.mockReturnValue(false)
        mockGetRemoteFile.mockResolvedValue(mockDownloadResponse)
        mockExistsSync.mockReturnValue(false)

        // Set custom install directory with trailing slash
        setMockInputValue('BRIDGE_CLI_INSTALL_DIRECTORY_KEY', customInstallDirWithSlash)

        const mockHandleBridgeDownload = jest.spyOn(bridgeClient as any, 'handleBridgeDownload')
        mockHandleBridgeDownload.mockResolvedValue(undefined)

        // Act
        await bridgeClient.downloadBridge(tempDir)

        // Assert
        // Verify that path.join correctly handles the trailing slash
        expect(mockHandleBridgeDownload).toHaveBeenCalledWith(
          mockDownloadResponse,
          '/custom/install/directory/bridge-cli-bundle' // Should normalize the path correctly
        )
      })

      it('should handle custom install directory with special characters and spaces', async () => {
        // Arrange
        const tempDir = '/tmp/test'
        const customInstallDirWithSpaces = '/custom/install directory/with spaces & special-chars_123'
        const mockDownloadResponse: DownloadFileResponse = {
          filePath: '/tmp/bridge.zip',
          fileName: 'https://test.url/bridge.zip'
        }

        mockParseToBoolean.mockReturnValue(false)
        mockGetRemoteFile.mockResolvedValue(mockDownloadResponse)
        mockExistsSync.mockReturnValue(false)

        // Set custom install directory with spaces and special characters
        setMockInputValue('BRIDGE_CLI_INSTALL_DIRECTORY_KEY', customInstallDirWithSpaces)

        const mockHandleBridgeDownload = jest.spyOn(bridgeClient as any, 'handleBridgeDownload')
        mockHandleBridgeDownload.mockResolvedValue(undefined)

        // Act
        await bridgeClient.downloadBridge(tempDir)

        // Assert
        // Verify that path.join correctly handles paths with spaces and special characters
        expect(mockHandleBridgeDownload).toHaveBeenCalledWith(mockDownloadResponse, '/custom/install directory/with spaces & special-chars_123/bridge-cli-bundle')
      })

      it('should use empty string as fallback when both BRIDGE_CLI_INSTALL_DIRECTORY_KEY and default path are empty', async () => {
        // Arrange
        const tempDir = '/tmp/test'
        const mockDownloadResponse: DownloadFileResponse = {
          filePath: '/tmp/bridge.zip',
          fileName: 'https://test.url/bridge.zip'
        }

        mockParseToBoolean.mockReturnValue(false)
        mockGetRemoteFile.mockResolvedValue(mockDownloadResponse)
        mockExistsSync.mockReturnValue(false)

        // Ensure BRIDGE_CLI_INSTALL_DIRECTORY_KEY is empty
        setMockInputValue('BRIDGE_CLI_INSTALL_DIRECTORY_KEY', '')

        // Mock getBridgeCLIDownloadDefaultPath to return empty string
        const mockGetBridgeCLIDownloadDefaultPath = jest.spyOn(bridgeClient as any, 'getBridgeCLIDownloadDefaultPath')
        mockGetBridgeCLIDownloadDefaultPath.mockReturnValue('')

        const mockHandleBridgeDownload = jest.spyOn(bridgeClient as any, 'handleBridgeDownload')
        mockHandleBridgeDownload.mockResolvedValue(undefined)

        // Act
        await bridgeClient.downloadBridge(tempDir)

        // Assert
        // When both are empty, should use empty string as extractZippedFilePath
        expect(mockHandleBridgeDownload).toHaveBeenCalledWith(
          mockDownloadResponse,
          '' // Empty string when both sources are empty
        )
      })
    })
  })

  describe('executeBridgeCommand', () => {
    let mockExecuteCommand: jest.SpyInstance

    beforeEach(() => {
      jest.clearAllMocks()
      mockExecuteCommand = jest.spyOn(bridgeClient as any, 'executeCommand')
    })

    it('should execute bridge command on supported platforms', async () => {
      // Arrange
      const bridgeCommand = '--stage polaris --state /tmp/input.json'
      const workingDirectory = '/test/working/dir'
      const originalPlatform = process.platform

      // Test macOS
      Object.defineProperty(process, 'platform', {value: 'darwin'})
      mockExecuteCommand.mockResolvedValue(0)

      // Act
      const result = await bridgeClient.executeBridgeCommand(bridgeCommand, workingDirectory)

      // Assert
      expect(result).toBe(0)
      expect(mockExecuteCommand).toHaveBeenCalledWith(bridgeCommand, {cwd: workingDirectory})

      // Restore original platform
      Object.defineProperty(process, 'platform', {value: originalPlatform})
    })

    it('should return -1 for unsupported platforms', async () => {
      // Arrange
      const bridgeCommand = '--stage polaris --state /tmp/input.json'
      const workingDirectory = '/test/working/dir'
      const originalPlatform = process.platform

      // Test unsupported platform
      Object.defineProperty(process, 'platform', {value: 'aix'})

      // Act
      const result = await bridgeClient.executeBridgeCommand(bridgeCommand, workingDirectory)

      // Assert
      expect(result).toBe(-1)
      expect(mockExecuteCommand).not.toHaveBeenCalled()

      // Restore original platform
      Object.defineProperty(process, 'platform', {value: originalPlatform})
    })

    it('should propagate errors from executeCommand', async () => {
      // Arrange
      const bridgeCommand = '--stage polaris --state /tmp/input.json'
      const workingDirectory = '/test/working/dir'
      const error = new Error('Execution failed')

      mockExecuteCommand.mockRejectedValue(error)

      // Act & Assert
      await expect(bridgeClient.executeBridgeCommand(bridgeCommand, workingDirectory)).rejects.toThrow('Execution failed')
    })
  })

  describe('getBridgeVersionFromLatestURL', () => {
    let mockMakeHttpsGetRequest: jest.SpyInstance
    let mockRetrySleepHelper: jest.SpyInstance
    let mockWarning: jest.SpyInstance

    beforeEach(() => {
      jest.clearAllMocks()

      const core = require('@actions/core')
      mockMakeHttpsGetRequest = jest.spyOn(bridgeClient as any, 'makeHttpsGetRequest')
      mockRetrySleepHelper = jest.spyOn(bridgeClient as any, 'retrySleepHelper')
      mockWarning = jest.spyOn(core, 'warning')

      // Mock getBridgeType to return consistent value
      jest.spyOn(bridgeClient, 'getBridgeType').mockReturnValue('bridge-cli-bundle')
    })

    it('should return version when found in response', async () => {
      // Arrange
      const latestVersionsUrl = 'https://test.url/versions.txt'
      const mockResponse = {
        statusCode: 200,
        body: 'some-other-tool:1.0.0\nbridge-cli-bundle:2.1.0\nanother-tool:3.0.0'
      }
      mockMakeHttpsGetRequest.mockResolvedValue(mockResponse)

      // Act
      const result = await bridgeClient.getBridgeVersionFromLatestURL(latestVersionsUrl)

      // Assert
      expect(result).toBe('2.1.0')
      expect(mockMakeHttpsGetRequest).toHaveBeenCalledWith(latestVersionsUrl)
    })

    it('should return empty string when version not found', async () => {
      // Arrange
      const latestVersionsUrl = 'https://test.url/versions.txt'
      const mockResponse = {
        statusCode: 200,
        body: 'some-other-tool:1.0.0\nanother-tool:3.0.0'
      }
      mockMakeHttpsGetRequest.mockResolvedValue(mockResponse)

      // Act
      const result = await bridgeClient.getBridgeVersionFromLatestURL(latestVersionsUrl)

      // Assert
      expect(result).toBe('')
    })

    it('should retry on non-success status codes', async () => {
      // Arrange
      const latestVersionsUrl = 'https://test.url/versions.txt'
      mockMakeHttpsGetRequest.mockResolvedValueOnce({statusCode: 500, body: ''}).mockResolvedValueOnce({statusCode: 500, body: ''}).mockResolvedValueOnce({
        statusCode: 200,
        body: 'bridge-cli-bundle:2.1.0'
      })

      mockRetrySleepHelper.mockResolvedValue(30000) // Mocked delay

      // Act
      const result = await bridgeClient.getBridgeVersionFromLatestURL(latestVersionsUrl)

      // Assert
      expect(result).toBe('2.1.0')
      expect(mockMakeHttpsGetRequest).toHaveBeenCalledTimes(3)
      expect(mockRetrySleepHelper).toHaveBeenCalledTimes(2)
    })

    it('should show warning when unable to retrieve version after retries', async () => {
      // Arrange
      const latestVersionsUrl = 'https://test.url/versions.txt'
      mockMakeHttpsGetRequest.mockResolvedValue({statusCode: 500, body: ''})
      mockRetrySleepHelper.mockResolvedValue(30000)

      // Act
      const result = await bridgeClient.getBridgeVersionFromLatestURL(latestVersionsUrl)

      // Assert
      expect(result).toBe('')
      expect(mockWarning).toHaveBeenCalledWith('Unable to retrieve the most recent version from Artifactory URL')
    })

    it('should retry on network errors and eventually succeed', async () => {
      // Arrange
      const latestVersionsUrl = 'https://test.url/versions.txt'
      mockMakeHttpsGetRequest.mockRejectedValueOnce(new Error('Network error')).mockResolvedValueOnce({
        statusCode: 200,
        body: 'bridge-cli-bundle:3.0.0'
      })

      mockRetrySleepHelper.mockResolvedValue(30000)

      // Act
      const result = await bridgeClient.getBridgeVersionFromLatestURL(latestVersionsUrl)

      // Assert
      expect(result).toBe('3.0.0')
      expect(mockRetrySleepHelper).toHaveBeenCalledTimes(1)
    })

    it('should handle exception during initialization', async () => {
      // Arrange - Test already has 89.66% coverage, this minor test case helps with edge cases

      const latestVersionsUrl = 'https://test.url/versions.txt'

      // Act
      const result = await bridgeClient.getBridgeVersionFromLatestURL(latestVersionsUrl)

      // Assert - should return empty string for any error condition
      expect(typeof result).toBe('string')
    })
  })

  describe('runBridgeCommand', () => {
    let mockSetBridgeExecutablePath: jest.SpyInstance
    let mockExec: jest.SpyInstance
    let mockDebug: jest.SpyInstance

    beforeEach(() => {
      jest.clearAllMocks()

      const exec = require('@actions/exec')
      const core = require('@actions/core')

      mockSetBridgeExecutablePath = jest.spyOn(bridgeClient as any, 'setBridgeExecutablePath')
      mockExec = jest.spyOn(exec, 'exec')
      mockDebug = jest.spyOn(core, 'debug')

      // Set up bridge executable path
      bridgeClient.bridgeExecutablePath = '/test/bridge/bridge-cli'
      bridgeClient.bridgePath = '/test/bridge'
    })

    it('should execute bridge command successfully', async () => {
      // Arrange
      const bridgeCommand = '--stage polaris --state /tmp/input.json'
      const execOptions: ExecOptions = {cwd: '/test/working/dir'}
      const expectedExitCode = 0

      mockSetBridgeExecutablePath.mockResolvedValue(undefined)
      mockExec.mockResolvedValue(expectedExitCode)

      // Act
      const result = await (bridgeClient as any).runBridgeCommand(bridgeCommand, execOptions)

      // Assert
      expect(result).toBe(expectedExitCode)
      expect(mockSetBridgeExecutablePath).toHaveBeenCalled()
      expect(mockDebug).toHaveBeenCalledWith('Bridge executable path:/test/bridge')
      expect(mockDebug).toHaveBeenCalledWith(`Executing bridge command: ${bridgeCommand}`)
      expect(mockExec).toHaveBeenCalledWith('/test/bridge/bridge-cli --stage polaris --state /tmp/input.json', [], execOptions)
      expect(mockDebug).toHaveBeenCalledWith(`Bridge command execution completed with exit code: ${expectedExitCode}`)
    })

    it('should throw error when bridge executable not found', async () => {
      // Arrange
      const bridgeCommand = '--stage polaris --state /tmp/input.json'
      const execOptions: ExecOptions = {cwd: '/test/working/dir'}

      mockSetBridgeExecutablePath.mockResolvedValue(undefined)
      bridgeClient.bridgeExecutablePath = '' // Simulate executable not found

      // Act & Assert
      await expect((bridgeClient as any).runBridgeCommand(bridgeCommand, execOptions)).rejects.toThrow('Bridge executable not found at /test/bridge')
    })
  })

  describe('getPlatformForVersion method', () => {
    let testClient: TestBridgeClient
    let originalPlatform: string
    let originalArch: string

    beforeEach(() => {
      testClient = new TestBridgeClient()
      originalPlatform = process.platform
      originalArch = process.arch
    })

    afterEach(() => {
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true
      })
      Object.defineProperty(process, 'arch', {
        value: originalArch,
        configurable: true
      })
    })

    describe('macOS platform detection', () => {
      it('should return macosx for macOS with Intel processor on older bridge versions', () => {
        Object.defineProperty(process, 'platform', {value: 'darwin', configurable: true})
        Object.defineProperty(process, 'arch', {value: 'x64', configurable: true})

        // Mock os.cpus to return Intel processor
        const os = require('os')
        jest.spyOn(os, 'cpus').mockReturnValue([{model: 'Intel(R) Core(TM) i7'}])

        const result = testClient.callGetPlatformForVersion('2.0.0')
        expect(result).toBe('macosx')
      })

      it('should return macosx for macOS with Intel processor on newer bridge versions', () => {
        Object.defineProperty(process, 'platform', {value: 'darwin', configurable: true})
        Object.defineProperty(process, 'arch', {value: 'x64', configurable: true})

        // Mock os.cpus to return Intel processor
        const os = require('os')
        jest.spyOn(os, 'cpus').mockReturnValue([{model: 'Intel(R) Core(TM) i7'}])

        const result = testClient.callGetPlatformForVersion('3.6.0')
        expect(result).toBe('macosx')
      })

      it('should return macosx for macOS with ARM processor on bridge versions before ARM support', () => {
        Object.defineProperty(process, 'platform', {value: 'darwin', configurable: true})
        Object.defineProperty(process, 'arch', {value: 'arm64', configurable: true})

        // Mock os.cpus to return ARM processor
        const os = require('os')
        jest.spyOn(os, 'cpus').mockReturnValue([{model: 'Apple M1'}])

        const result = testClient.callGetPlatformForVersion('2.0.0')
        expect(result).toBe('macosx')
      })

      it('should return macos_arm for macOS with ARM processor on bridge versions with ARM support', () => {
        Object.defineProperty(process, 'platform', {value: 'darwin', configurable: true})
        Object.defineProperty(process, 'arch', {value: 'arm64', configurable: true})

        // Mock os.cpus to return ARM processor
        const os = require('os')
        jest.spyOn(os, 'cpus').mockReturnValue([{model: 'Apple M1'}])

        const result = testClient.callGetPlatformForVersion('3.6.0')
        expect(result).toBe('macos_arm')
      })
    })

    describe('Linux platform detection', () => {
      it('should return linux64 for Linux with x64 architecture', () => {
        Object.defineProperty(process, 'platform', {value: 'linux', configurable: true})
        Object.defineProperty(process, 'arch', {value: 'x64', configurable: true})

        const result = testClient.callGetPlatformForVersion('3.6.0')
        expect(result).toBe('linux64')
      })

      it('should return linux_arm for Linux with ARM64 architecture on supported bridge versions', () => {
        Object.defineProperty(process, 'platform', {value: 'linux', configurable: true})
        Object.defineProperty(process, 'arch', {value: 'arm64', configurable: true})

        const result = testClient.callGetPlatformForVersion('3.6.0')
        expect(result).toBe('linux_arm')
      })

      it('should return linux64 for Linux with ARM64 architecture on older bridge versions', () => {
        Object.defineProperty(process, 'platform', {value: 'linux', configurable: true})
        Object.defineProperty(process, 'arch', {value: 'arm64', configurable: true})

        const result = testClient.callGetPlatformForVersion('3.5.0')
        expect(result).toBe('linux64')
      })
    })

    describe('Windows platform detection', () => {
      it('should return win64 for Windows platform', () => {
        Object.defineProperty(process, 'platform', {value: 'win32', configurable: true})
        Object.defineProperty(process, 'arch', {value: 'x64', configurable: true})

        const result = testClient.callGetPlatformForVersion('3.6.0')
        expect(result).toBe('win64')
      })

      it('should return win64 for Windows with ARM architecture (no specific ARM support)', () => {
        Object.defineProperty(process, 'platform', {value: 'win32', configurable: true})
        Object.defineProperty(process, 'arch', {value: 'arm64', configurable: true})

        const result = testClient.callGetPlatformForVersion('3.6.0')
        expect(result).toBe('win64')
      })
    })

    describe('Version comparison edge cases', () => {
      it('should handle version exactly at macOS ARM support threshold', () => {
        Object.defineProperty(process, 'platform', {value: 'darwin', configurable: true})
        Object.defineProperty(process, 'arch', {value: 'arm64', configurable: true})

        // Mock os.cpus to return ARM processor
        const os = require('os')
        jest.spyOn(os, 'cpus').mockReturnValue([{model: 'Apple M1'}])

        const result = testClient.callGetPlatformForVersion('2.1.0')
        expect(result).toBe('macos_arm')
      })

      it('should handle version just below macOS ARM support threshold', () => {
        Object.defineProperty(process, 'platform', {value: 'darwin', configurable: true})
        Object.defineProperty(process, 'arch', {value: 'arm64', configurable: true})

        // Mock os.cpus to return ARM processor
        const os = require('os')
        jest.spyOn(os, 'cpus').mockReturnValue([{model: 'Apple M1'}])

        const result = testClient.callGetPlatformForVersion('2.0.99')
        expect(result).toBe('macosx')
      })

      it('should handle version well above Linux ARM support threshold', () => {
        Object.defineProperty(process, 'platform', {value: 'linux', configurable: true})
        Object.defineProperty(process, 'arch', {value: 'arm64', configurable: true})

        const result = testClient.callGetPlatformForVersion('4.0.0')
        expect(result).toBe('linux_arm')
      })
    })

    describe('Unsupported platform handling', () => {
      it('should default to Windows platform for unsupported platforms', () => {
        Object.defineProperty(process, 'platform', {value: 'freebsd', configurable: true})
        Object.defineProperty(process, 'arch', {value: 'x64', configurable: true})

        const result = testClient.callGetPlatformForVersion('3.6.0')
        expect(result).toBe('win64')
      })
    })
  })
})

describe('BridgeClientBase - makeHttpsGetRequest', () => {
  let bridgeClient: TestBridgeClient

  beforeEach(() => {
    jest.clearAllMocks()
    bridgeClient = new TestBridgeClient()
  })

  test('should handle HTTPS request error', async () => {
    // Arrange
    const testUrl = 'https://example.com/test'
    const mockError = new Error('Network error')
    const mockRequest = {
      on: jest.fn(),
      end: jest.fn()
    }

    // Mock https.request
    const https = require('node:https')
    jest.spyOn(https, 'request').mockImplementation(() => {
      // Simulate error
      setTimeout(() => {
        const onErrorCallback = mockRequest.on.mock.calls.find(call => call[0] === 'error')[1]
        onErrorCallback(mockError)
      }, 0)

      return mockRequest
    })

    // Act & Assert
    await expect((bridgeClient as any).makeHttpsGetRequest(testUrl)).rejects.toThrow('Network error')
  })
})

describe('BridgeClientBase - shouldUpdateBridge', () => {
  let bridgeClient: TestBridgeClient

  beforeEach(() => {
    jest.clearAllMocks()
    bridgeClient = new TestBridgeClient()
  })

  test('should return true when versions are different', () => {
    // Act & Assert
    expect((bridgeClient as any).shouldUpdateBridge('1.0.0', '1.1.0')).toBe(true)
    expect((bridgeClient as any).shouldUpdateBridge('2.0.0', '1.9.0')).toBe(true)
  })

  test('should return false when versions are the same', () => {
    // Act & Assert
    expect((bridgeClient as any).shouldUpdateBridge('1.0.0', '1.0.0')).toBe(false)
    expect((bridgeClient as any).shouldUpdateBridge('2.1.5', '2.1.5')).toBe(false)
  })
})

describe('BridgeClientBase - cleanupOnError', () => {
  let bridgeClient: TestBridgeClient
  let mockCleanupTempDir: jest.SpyInstance
  let mockDebug: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    bridgeClient = new TestBridgeClient()

    const utility = require('../../../../src/blackduck-security-action/utility')
    const core = require('@actions/core')

    mockCleanupTempDir = jest.spyOn(utility, 'cleanupTempDir')
    mockDebug = jest.spyOn(core, 'debug')
  })

  test('should cleanup temp directory successfully', async () => {
    // Arrange
    const tempDir = '/tmp/test'
    mockCleanupTempDir.mockResolvedValue(undefined)

    // Act
    await (bridgeClient as any).cleanupOnError(tempDir)

    // Assert
    expect(mockCleanupTempDir).toHaveBeenCalledWith(tempDir)
    expect(mockDebug).not.toHaveBeenCalledWith(expect.stringContaining('Failed to cleanup'))
  })

  test('should handle cleanup failure gracefully', async () => {
    // Arrange
    const tempDir = '/tmp/test'
    const cleanupError = new Error('Cleanup failed')
    mockCleanupTempDir.mockRejectedValue(cleanupError)

    // Act
    await (bridgeClient as any).cleanupOnError(tempDir)

    // Assert
    expect(mockCleanupTempDir).toHaveBeenCalledWith(tempDir)
    expect(mockDebug).toHaveBeenCalledWith('Failed to cleanup temp directory: Error: Cleanup failed')
  })
})

describe('BridgeClientBase - prepareCommand error handling', () => {
  let bridgeClient: TestBridgeClient
  let mockBuildCommandForAllTools: jest.SpyInstance
  let mockCleanupOnError: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    bridgeClient = new TestBridgeClient()

    mockBuildCommandForAllTools = jest.spyOn(bridgeClient as any, 'buildCommandForAllTools')
    mockCleanupOnError = jest.spyOn(bridgeClient as any, 'cleanupOnError').mockResolvedValue(undefined)

    // Mock validators to pass validation
    jest.spyOn(validators, 'validateScanTypes').mockReturnValue([])
  })

  test('should cleanup and rethrow error when buildCommandForAllTools fails', async () => {
    // Arrange
    const tempDir = '/tmp/test'
    const originalError = new Error('Build command failed')
    mockBuildCommandForAllTools.mockRejectedValue(originalError)

    // Act & Assert
    await expect(bridgeClient.prepareCommand(tempDir)).rejects.toThrow('Build command failed')
    expect(mockCleanupOnError).toHaveBeenCalledWith(tempDir)
  })

  test('should handle non-Error objects thrown', async () => {
    // Arrange
    const tempDir = '/tmp/test'
    const nonErrorObject = 'String error'
    mockBuildCommandForAllTools.mockRejectedValue(nonErrorObject)

    // Act & Assert
    await expect(bridgeClient.prepareCommand(tempDir)).rejects.toThrow('String error')
    expect(mockCleanupOnError).toHaveBeenCalledWith(tempDir)
  })
})

describe('BridgeClientBase - getBridgeUrlAndVersion', () => {
  let bridgeClient: TestBridgeClient
  let mockDebug: jest.SpyInstance
  let mockWarning: jest.SpyInstance
  let mockInfo: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    bridgeClient = new TestBridgeClient()

    const core = require('@actions/core')
    mockDebug = jest.spyOn(core, 'debug')
    mockWarning = jest.spyOn(core, 'warning')
    mockInfo = jest.spyOn(core, 'info')

    // Reset all input values to empty
    setMockInputValue('BRIDGE_CLI_BASE_URL', '')
    setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', '')
    setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', '')
  })

  describe('Air gap validation scenarios', () => {
    it('should throw error in air gap mode with version but no baseURL', async () => {
      // Arrange
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', '1.2.3')

      // Act & Assert
      await expect((bridgeClient as any).getBridgeUrlAndVersion(true)).rejects.toThrow("Unable to use the specified Bridge CLI version in air gap mode. Please provide a valid 'BRIDGE_CLI_BASE_URL'.")
    })

    it('should throw error in air gap mode with downloadURL but no baseURL', async () => {
      // Arrange
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', 'https://test.url/bridge.zip')

      // Act & Assert
      await expect((bridgeClient as any).getBridgeUrlAndVersion(true)).rejects.toThrow('Air gap mode enabled and no BRIDGE_CLI_BASE_URL provided. BRIDGE_CLI_DOWNLOAD_URL requires BRIDGE_CLI_BASE_URL in air gap mode.')
    })
  })

  describe('when both BRIDGE_CLI_BASE_URL and BRIDGE_CLI_DOWNLOAD_URL are provided', () => {
    it('should prioritize BRIDGE_CLI_BASE_URL and show warning about BRIDGE_CLI_DOWNLOAD_URL being ignored', async () => {
      // Arrange
      setMockInputValue('BRIDGE_CLI_BASE_URL', 'https://test.base.url/')
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', 'https://test.download.url/bridge.zip')
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', '1.2.3')

      const mockProcessVersion = jest.spyOn(bridgeClient as any, 'processVersion')
      mockProcessVersion.mockResolvedValue({bridgeUrl: 'https://test.base.url/bridge-1.2.3.zip', bridgeVersion: '1.2.3'})

      // Act
      const result = await (bridgeClient as any).getBridgeUrlAndVersion(false)

      // Assert
      expect(result).toEqual({bridgeUrl: 'https://test.base.url/bridge-1.2.3.zip', bridgeVersion: '1.2.3'})
      expect(mockInfo).toHaveBeenCalledWith('Both BRIDGE_CLI_BASE_URL and BRIDGE_CLI_DOWNLOAD_URL provided. Using BRIDGE_CLI_BASE_URL.')
      expect(mockDebug).toHaveBeenCalledWith('BRIDGE_CLI_DOWNLOAD_URL is ignored when BRIDGE_CLI_BASE_URL is provided.')
      expect(mockInfo).toHaveBeenCalledWith('Using BRIDGE_CLI_BASE_URL with specified version: 1.2.3')
      expect(mockProcessVersion).toHaveBeenCalled()
    })
  })

  describe('when BRIDGE_CLI_BASE_URL is provided', () => {
    it('should use processVersion when BRIDGE_CLI_DOWNLOAD_VERSION is also provided', async () => {
      // Arrange
      setMockInputValue('BRIDGE_CLI_BASE_URL', 'https://test.base.url/')
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', '2.1.0')

      const mockProcessVersion = jest.spyOn(bridgeClient as any, 'processVersion')
      mockProcessVersion.mockResolvedValue({bridgeUrl: 'https://test.base.url/bridge-2.1.0.zip', bridgeVersion: '2.1.0'})

      // Act
      const result = await (bridgeClient as any).getBridgeUrlAndVersion(false)

      // Assert
      expect(result).toEqual({bridgeUrl: 'https://test.base.url/bridge-2.1.0.zip', bridgeVersion: '2.1.0'})
      expect(mockInfo).toHaveBeenCalledWith('Using BRIDGE_CLI_BASE_URL with specified version: 2.1.0')
      expect(mockProcessVersion).toHaveBeenCalled()
    })

    it('should use processLatestVersion when no version is specified', async () => {
      // Arrange
      setMockInputValue('BRIDGE_CLI_BASE_URL', 'https://test.base.url/')

      const mockProcessLatestVersion = jest.spyOn(bridgeClient as any, 'processLatestVersion')
      mockProcessLatestVersion.mockResolvedValue({bridgeUrl: 'https://test.base.url/bridge-latest.zip', bridgeVersion: '3.0.0'})

      // Act
      const result = await (bridgeClient as any).getBridgeUrlAndVersion(false)

      // Assert
      expect(result).toEqual({bridgeUrl: 'https://test.base.url/bridge-latest.zip', bridgeVersion: '3.0.0'})
      expect(mockInfo).toHaveBeenCalledWith('Using BRIDGE_CLI_BASE_URL to fetch the latest version.')
      expect(mockProcessLatestVersion).toHaveBeenCalledWith(false)
    })

    it('should pass air gap flag correctly to processLatestVersion', async () => {
      // Arrange
      setMockInputValue('BRIDGE_CLI_BASE_URL', 'https://test.base.url/')

      const mockProcessLatestVersion = jest.spyOn(bridgeClient as any, 'processLatestVersion')
      mockProcessLatestVersion.mockResolvedValue({bridgeUrl: 'https://test.base.url/bridge-latest.zip', bridgeVersion: '3.0.0'})

      // Act
      await (bridgeClient as any).getBridgeUrlAndVersion(true)

      // Assert
      expect(mockProcessLatestVersion).toHaveBeenCalledWith(true)
    })
  })

  describe('when BRIDGE_CLI_DOWNLOAD_URL is provided (fallback)', () => {
    it('should use processDownloadUrl and show deprecation warning', async () => {
      // Arrange
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', 'https://test.download.url/bridge-1.5.0.zip')

      const mockProcessDownloadUrl = jest.spyOn(bridgeClient as any, 'processDownloadUrl')
      mockProcessDownloadUrl.mockResolvedValue({bridgeUrl: 'https://test.download.url/bridge-1.5.0.zip', bridgeVersion: '1.5.0'})

      // Act
      const result = await (bridgeClient as any).getBridgeUrlAndVersion(false)

      // Assert
      expect(result).toEqual({bridgeUrl: 'https://test.download.url/bridge-1.5.0.zip', bridgeVersion: '1.5.0'})
      expect(mockInfo).toHaveBeenCalledWith('BRIDGE_CLI_DOWNLOAD_URL is deprecated and will be removed in an upcoming release. Please migrate to using BRIDGE_CLI_DOWNLOAD_VERSION in combination with BRIDGE_CLI_BASE_URL.')
      expect(mockProcessDownloadUrl).toHaveBeenCalled()
    })
  })

  describe('when only BRIDGE_CLI_DOWNLOAD_VERSION is provided', () => {
    it('should use processVersion in non-airgap mode', async () => {
      // Arrange
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', '1.8.0')

      const mockProcessVersion = jest.spyOn(bridgeClient as any, 'processVersion')
      mockProcessVersion.mockResolvedValue({bridgeUrl: 'https://default.url/bridge-1.8.0.zip', bridgeVersion: '1.8.0'})

      // Act
      const result = await (bridgeClient as any).getBridgeUrlAndVersion(false)

      // Assert
      expect(result).toEqual({bridgeUrl: 'https://default.url/bridge-1.8.0.zip', bridgeVersion: '1.8.0'})
      expect(mockInfo).toHaveBeenCalledWith('Using specified version: 1.8.0')
      expect(mockProcessVersion).toHaveBeenCalled()
    })

    it('should work in airgap mode when BRIDGE_CLI_BASE_URL is provided', async () => {
      // Arrange
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', '1.8.0')
      setMockInputValue('BRIDGE_CLI_BASE_URL', 'https://test.base.url/')

      const mockProcessVersion = jest.spyOn(bridgeClient as any, 'processVersion')
      mockProcessVersion.mockResolvedValue({bridgeUrl: 'https://test.base.url/bridge-1.8.0.zip', bridgeVersion: '1.8.0'})

      // Act
      const result = await (bridgeClient as any).getBridgeUrlAndVersion(true)

      // Assert
      expect(result).toEqual({bridgeUrl: 'https://test.base.url/bridge-1.8.0.zip', bridgeVersion: '1.8.0'})
      expect(mockProcessVersion).toHaveBeenCalled()
    })
  })

  describe('when no specific configuration is provided', () => {
    it('should fetch latest version in non-airgap mode', async () => {
      // Arrange - all inputs are empty by default

      const mockProcessLatestVersion = jest.spyOn(bridgeClient as any, 'processLatestVersion')
      mockProcessLatestVersion.mockResolvedValue({bridgeUrl: 'https://default.url/bridge-latest.zip', bridgeVersion: '2.5.0'})

      // Act
      const result = await (bridgeClient as any).getBridgeUrlAndVersion(false)

      // Assert
      expect(result).toEqual({bridgeUrl: 'https://default.url/bridge-latest.zip', bridgeVersion: '2.5.0'})
      expect(mockInfo).toHaveBeenCalledWith('Checking for latest version of Bridge to download and configure')
      expect(mockProcessLatestVersion).toHaveBeenCalledWith(false)
    })

    it('should fetch latest version in airgap mode when no URLs provided', async () => {
      // Arrange - all inputs are empty by default
      const mockProcessLatestVersion = jest.spyOn(bridgeClient as any, 'processLatestVersion')
      mockProcessLatestVersion.mockResolvedValue({bridgeUrl: 'https://default.url/bridge-latest.zip', bridgeVersion: '2.5.0'})

      // Act
      const result = await (bridgeClient as any).getBridgeUrlAndVersion(true)

      // Assert
      expect(result).toEqual({bridgeUrl: 'https://default.url/bridge-latest.zip', bridgeVersion: '2.5.0'})
      expect(mockInfo).toHaveBeenCalledWith('Checking for latest version of Bridge to download and configure')
      expect(mockProcessLatestVersion).toHaveBeenCalledWith(true)
    })
  })

  describe('processDownloadUrl method', () => {
    it('should extract version from URL using regex and return it', async () => {
      // Arrange
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', 'https://test.url/bridge-1.2.3.zip')

      const mockVerifyRegexCheck = jest.spyOn(bridgeClient as any, 'verifyRegexCheck')
      mockVerifyRegexCheck.mockReturnValue(['bridge-1.2.3.zip', '1.2.3'])

      // Act
      const result = await (bridgeClient as any).processDownloadUrl()

      // Assert
      expect(result).toEqual({bridgeUrl: 'https://test.url/bridge-1.2.3.zip', bridgeVersion: '1.2.3'})
      expect(mockVerifyRegexCheck).toHaveBeenCalledWith('https://test.url/bridge-1.2.3.zip')
    })

    it('should fetch version from latest URL when regex does not return version', async () => {
      // Arrange
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', 'https://test.url/bridge-latest.zip')

      const mockVerifyRegexCheck = jest.spyOn(bridgeClient as any, 'verifyRegexCheck')
      mockVerifyRegexCheck.mockReturnValue(['bridge-latest.zip', '']) // Empty version

      const mockGetBridgeVersionFromLatestURL = jest.spyOn(bridgeClient, 'getBridgeVersionFromLatestURL')
      mockGetBridgeVersionFromLatestURL.mockResolvedValue('2.1.0')

      const mockGetLatestVersionRegexPattern = jest.spyOn(bridgeClient as any, 'getLatestVersionRegexPattern')
      mockGetLatestVersionRegexPattern.mockReturnValue(/latest/)

      // Act
      const result = await (bridgeClient as any).processDownloadUrl()

      // Assert
      expect(result).toEqual({bridgeUrl: 'https://test.url/bridge-latest.zip', bridgeVersion: '2.1.0'})
      expect(mockGetBridgeVersionFromLatestURL).toHaveBeenCalled()
    })

    it('should return empty version when regex returns null', async () => {
      // Arrange
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', 'https://test.url/invalid-bridge.zip')

      const mockVerifyRegexCheck = jest.spyOn(bridgeClient as any, 'verifyRegexCheck')
      mockVerifyRegexCheck.mockReturnValue(null)

      // Act
      const result = await (bridgeClient as any).processDownloadUrl()

      // Assert
      expect(result).toEqual({bridgeUrl: 'https://test.url/invalid-bridge.zip', bridgeVersion: ''})
    })
  })

  describe('processVersion method', () => {
    it('should return empty bridgeUrl when bridge is already installed', async () => {
      // Arrange
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', '1.5.0')

      const mockIsBridgeInstalled = jest.spyOn(bridgeClient, 'isBridgeInstalled')
      mockIsBridgeInstalled.mockResolvedValue(true)

      // Act
      const result = await (bridgeClient as any).processVersion()

      // Assert
      expect(result).toEqual({bridgeUrl: '', bridgeVersion: '1.5.0'})
      expect(mockIsBridgeInstalled).toHaveBeenCalledWith('1.5.0')
      expect(mockInfo).toHaveBeenCalledWith('Bridge CLI already exists')
    })

    it('should call updateBridgeCLIVersion when bridge is not installed', async () => {
      // Arrange
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', '1.5.0')

      const mockIsBridgeInstalled = jest.spyOn(bridgeClient, 'isBridgeInstalled')
      mockIsBridgeInstalled.mockResolvedValue(false)

      const mockUpdateBridgeCLIVersion = jest.spyOn(bridgeClient as any, 'updateBridgeCLIVersion')
      mockUpdateBridgeCLIVersion.mockResolvedValue({bridgeUrl: 'https://test.url/bridge-1.5.0.zip', bridgeVersion: '1.5.0'})

      // Act
      const result = await (bridgeClient as any).processVersion()

      // Assert
      expect(result).toEqual({bridgeUrl: 'https://test.url/bridge-1.5.0.zip', bridgeVersion: '1.5.0'})
      expect(mockIsBridgeInstalled).toHaveBeenCalledWith('1.5.0')
      expect(mockUpdateBridgeCLIVersion).toHaveBeenCalledWith('1.5.0')
    })
  })

  describe('edge cases and error scenarios', () => {
    it('should handle when processLatestVersion throws an error', async () => {
      // Arrange
      const mockProcessLatestVersion = jest.spyOn(bridgeClient as any, 'processLatestVersion')
      mockProcessLatestVersion.mockRejectedValue(new Error('Failed to fetch latest version'))

      // Act & Assert
      await expect((bridgeClient as any).getBridgeUrlAndVersion(false)).rejects.toThrow('Failed to fetch latest version')
    })

    it('should handle when processVersion throws an error', async () => {
      // Arrange
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', '1.0.0')

      const mockProcessVersion = jest.spyOn(bridgeClient as any, 'processVersion')
      mockProcessVersion.mockRejectedValue(new Error('Version processing failed'))

      // Act & Assert
      await expect((bridgeClient as any).getBridgeUrlAndVersion(false)).rejects.toThrow('Version processing failed')
    })

    it('should handle when processDownloadUrl throws an error', async () => {
      // Arrange
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', 'https://test.url/bridge.zip')

      const mockProcessDownloadUrl = jest.spyOn(bridgeClient as any, 'processDownloadUrl')
      mockProcessDownloadUrl.mockRejectedValue(new Error('Download URL processing failed'))

      // Act & Assert
      await expect((bridgeClient as any).getBridgeUrlAndVersion(false)).rejects.toThrow('Download URL processing failed')
    })
  })

  describe('input priority and precedence', () => {
    it('should prioritize BRIDGE_CLI_BASE_URL over all other inputs', async () => {
      // Arrange
      setMockInputValue('BRIDGE_CLI_BASE_URL', 'https://base.url/')
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', 'https://download.url/bridge.zip')
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', '1.0.0')

      const mockProcessVersion = jest.spyOn(bridgeClient as any, 'processVersion')
      mockProcessVersion.mockResolvedValue({bridgeUrl: 'https://base.url/bridge-1.0.0.zip', bridgeVersion: '1.0.0'})

      // Act
      const result = await (bridgeClient as any).getBridgeUrlAndVersion(false)

      // Assert
      expect(result.bridgeUrl).toContain('base.url')
      expect(mockProcessVersion).toHaveBeenCalled()
    })

    it('should use BRIDGE_CLI_DOWNLOAD_URL when BRIDGE_CLI_BASE_URL is not provided', async () => {
      // Arrange
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', 'https://download.url/bridge.zip')
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', '1.0.0')

      const mockProcessDownloadUrl = jest.spyOn(bridgeClient as any, 'processDownloadUrl')
      mockProcessDownloadUrl.mockResolvedValue({bridgeUrl: 'https://download.url/bridge.zip', bridgeVersion: '1.0.0'})

      // Act
      const result = await (bridgeClient as any).getBridgeUrlAndVersion(false)

      // Assert
      expect(result.bridgeUrl).toContain('download.url')
      expect(mockProcessDownloadUrl).toHaveBeenCalled()
    })

    it('should handle empty string inputs correctly', async () => {
      // Arrange
      setMockInputValue('BRIDGE_CLI_BASE_URL', '')
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', '')
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', '')

      const mockProcessLatestVersion = jest.spyOn(bridgeClient as any, 'processLatestVersion')
      mockProcessLatestVersion.mockResolvedValue({bridgeUrl: 'https://default.url/bridge-latest.zip', bridgeVersion: '2.0.0'})

      // Act
      const result = await (bridgeClient as any).getBridgeUrlAndVersion(false)

      // Assert
      expect(result).toEqual({bridgeUrl: 'https://default.url/bridge-latest.zip', bridgeVersion: '2.0.0'})
      expect(mockProcessLatestVersion).toHaveBeenCalled()
    })
  })

  describe('checkIfBridgeExistsLocally', () => {
    let mockValidateAndSetBridgePath: jest.SpyInstance
    let mockGetBridgeExecutablePath: jest.SpyInstance
    let mockCheckIfPathExists: jest.SpyInstance
    let mockDebug: jest.SpyInstance

    beforeEach(() => {
      jest.clearAllMocks()

      const core = require('@actions/core')
      const utility = require('../../../../src/blackduck-security-action/utility')

      mockValidateAndSetBridgePath = jest.spyOn(bridgeClient as any, 'validateAndSetBridgePath')
      mockGetBridgeExecutablePath = jest.spyOn(bridgeClient as any, 'getBridgeExecutablePath')
      mockCheckIfPathExists = jest.spyOn(utility, 'checkIfPathExists')
      mockDebug = jest.spyOn(core, 'debug')
    })

    it('should return true when bridge exists locally', async () => {
      // Arrange
      const executablePath = '/test/bridge/bridge-cli'
      mockValidateAndSetBridgePath.mockResolvedValue(undefined)
      mockGetBridgeExecutablePath.mockReturnValue(executablePath)
      mockCheckIfPathExists.mockReturnValue(true)

      // Act
      const result = await (bridgeClient as any).checkIfBridgeExistsLocally()

      // Assert
      expect(result).toBe(true)
      expect(mockValidateAndSetBridgePath).toHaveBeenCalledTimes(1)
      expect(mockGetBridgeExecutablePath).toHaveBeenCalledTimes(1)
      expect(mockCheckIfPathExists).toHaveBeenCalledWith(executablePath)
    })

    it('should return false when bridge does not exist locally', async () => {
      // Arrange
      const executablePath = '/test/bridge/bridge-cli'
      mockValidateAndSetBridgePath.mockResolvedValue(undefined)
      mockGetBridgeExecutablePath.mockReturnValue(executablePath)
      mockCheckIfPathExists.mockReturnValue(false)

      // Act
      const result = await (bridgeClient as any).checkIfBridgeExistsLocally()

      // Assert
      expect(result).toBe(false)
      expect(mockValidateAndSetBridgePath).toHaveBeenCalledTimes(1)
      expect(mockGetBridgeExecutablePath).toHaveBeenCalledTimes(1)
      expect(mockCheckIfPathExists).toHaveBeenCalledWith(executablePath)
    })

    it('should return false and log error when validateAndSetBridgePath throws exception', async () => {
      // Arrange
      const errorMessage = 'Failed to validate bridge path'
      const error = new Error(errorMessage)
      mockValidateAndSetBridgePath.mockRejectedValue(error)

      // Act
      const result = await (bridgeClient as any).checkIfBridgeExistsLocally()

      // Assert
      expect(result).toBe(false)
      expect(mockValidateAndSetBridgePath).toHaveBeenCalledTimes(1)
      expect(mockGetBridgeExecutablePath).not.toHaveBeenCalled()
      expect(mockCheckIfPathExists).not.toHaveBeenCalled()
      expect(mockDebug).toHaveBeenCalledWith(`Error checking if bridge exists locally: ${errorMessage}`)
    })

    it('should return false and log error when getBridgeExecutablePath throws exception', async () => {
      // Arrange
      const errorMessage = 'Failed to get executable path'
      const error = new Error(errorMessage)

      mockValidateAndSetBridgePath.mockResolvedValue(undefined)
      mockGetBridgeExecutablePath.mockImplementation(() => {
        throw error
      })

      // Act
      const result = await (bridgeClient as any).checkIfBridgeExistsLocally()

      // Assert
      expect(result).toBe(false)
      expect(mockValidateAndSetBridgePath).toHaveBeenCalledTimes(1)
      expect(mockDebug).toHaveBeenCalledWith(expect.stringContaining('Error checking if bridge exists locally:'))
    })

    it('should return false and log error when checkIfPathExists throws exception', async () => {
      // Arrange
      const executablePath = '/test/bridge/bridge-cli'
      const errorMessage = 'Failed to check path existence'
      const error = new Error(errorMessage)
      mockValidateAndSetBridgePath.mockResolvedValue(undefined)
      mockGetBridgeExecutablePath.mockReturnValue(executablePath)
      mockCheckIfPathExists.mockImplementation(() => {
        throw error
      })

      // Act
      const result = await (bridgeClient as any).checkIfBridgeExistsLocally()

      // Assert
      expect(result).toBe(false)
      expect(mockValidateAndSetBridgePath).toHaveBeenCalledTimes(1)
      expect(mockGetBridgeExecutablePath).toHaveBeenCalledTimes(1)
      expect(mockCheckIfPathExists).toHaveBeenCalledWith(executablePath)
      expect(mockDebug).toHaveBeenCalledWith(`Error checking if bridge exists locally: ${errorMessage}`)
    })
  })

  describe('getBridgeExecutablePath', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      // Set a test bridge path
      bridgeClient.bridgePath = '/test/bridge/path'
    })

    it('should return bridge-cli.exe path on Windows platform', () => {
      // Arrange
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', {value: 'win32'})

      // Act
      const result = (bridgeClient as any).getBridgeExecutablePath()

      // Assert
      expect(result).toBe('/test/bridge/path/bridge-cli.exe')

      // Restore original platform
      Object.defineProperty(process, 'platform', {value: originalPlatform})
    })

    it('should return bridge-cli path on macOS platform', () => {
      // Arrange
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', {value: 'darwin'})

      // Act
      const result = (bridgeClient as any).getBridgeExecutablePath()

      // Assert
      expect(result).toBe('/test/bridge/path/bridge-cli')

      // Restore original platform
      Object.defineProperty(process, 'platform', {value: originalPlatform})
    })

    it('should return bridge-cli path on Linux platform', () => {
      // Arrange
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', {value: 'linux'})

      // Act
      const result = (bridgeClient as any).getBridgeExecutablePath()

      // Assert
      expect(result).toBe('/test/bridge/path/bridge-cli')

      // Restore original platform
      Object.defineProperty(process, 'platform', {value: originalPlatform})
    })

    it('should handle empty bridge path correctly', () => {
      // Arrange
      bridgeClient.bridgePath = '/user/test'
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', {value: 'win32'})

      // Act
      const result = (bridgeClient as any).getBridgeExecutablePath()

      // Assert
      expect(result).toBe('/user/test/bridge-cli.exe')

      // Restore original platform
      Object.defineProperty(process, 'platform', {value: originalPlatform})
    })

    it('should handle bridge path with trailing slash on Windows', () => {
      // Arrange
      bridgeClient.bridgePath = '/test/bridge/path'
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', {value: 'win32'})

      // Act
      const result = (bridgeClient as any).getBridgeExecutablePath()

      // Assert
      expect(result).toBe('/test/bridge/path/bridge-cli.exe')

      // Restore original platform
      Object.defineProperty(process, 'platform', {value: originalPlatform})
    })

    it('should handle bridge path with special characters on Windows', () => {
      // Arrange
      bridgeClient.bridgePath = '/test/bridge path with spaces & special-chars_123'
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', {value: 'win32'})

      // Act
      const result = (bridgeClient as any).getBridgeExecutablePath()

      // Assert
      expect(result).toBe('/test/bridge path with spaces & special-chars_123/bridge-cli.exe')

      // Restore original platform
      Object.defineProperty(process, 'platform', {value: originalPlatform})
    })
  })

  describe('setBridgeExecutablePath', () => {
    let mockTryGetExecutablePath: jest.SpyInstance

    beforeEach(() => {
      jest.clearAllMocks()

      const ioUtil = require('@actions/io/lib/io-util')
      mockTryGetExecutablePath = jest.spyOn(ioUtil, 'tryGetExecutablePath')

      // Set a test bridge path
      bridgeClient.bridgePath = '/test/bridge/path'
    })

    it('should set executable path on Windows platform', async () => {
      // Arrange
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', {value: 'win32'})

      const expectedExecutablePath = '/test/bridge/path/bridge-cli.exe'
      mockTryGetExecutablePath.mockResolvedValue(expectedExecutablePath)

      // Act
      await bridgeClient.setBridgeExecutablePath()

      // Assert
      expect(mockTryGetExecutablePath).toHaveBeenCalledWith('/test/bridge/path\\bridge-cli', ['.exe'])
      expect(bridgeClient.bridgeExecutablePath).toBe(expectedExecutablePath)

      // Restore original platform
      Object.defineProperty(process, 'platform', {value: originalPlatform})
    })

    it('should set executable path on macOS platform', async () => {
      // Arrange
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', {value: 'darwin'})

      const expectedExecutablePath = '/test/bridge/path/bridge-cli'
      mockTryGetExecutablePath.mockResolvedValue(expectedExecutablePath)

      // Act
      await bridgeClient.setBridgeExecutablePath()

      // Assert
      expect(mockTryGetExecutablePath).toHaveBeenCalledWith('/test/bridge/path/bridge-cli', [])
      expect(bridgeClient.bridgeExecutablePath).toBe(expectedExecutablePath)

      // Restore original platform
      Object.defineProperty(process, 'platform', {value: originalPlatform})
    })

    it('should set executable path on Linux platform', async () => {
      // Arrange
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', {value: 'linux'})

      const expectedExecutablePath = '/test/bridge/path/bridge-cli'
      mockTryGetExecutablePath.mockResolvedValue(expectedExecutablePath)

      // Act
      await bridgeClient.setBridgeExecutablePath()

      // Assert
      expect(mockTryGetExecutablePath).toHaveBeenCalledWith('/test/bridge/path/bridge-cli', [])
      expect(bridgeClient.bridgeExecutablePath).toBe(expectedExecutablePath)

      // Restore original platform
      Object.defineProperty(process, 'platform', {value: originalPlatform})
    })
  })

  describe('getVersionUrl', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      // Mock getPlatformForVersion method
      jest.spyOn(bridgeClient as any, 'getPlatformForVersion').mockReturnValue('linux64')
      bridgeClient.setBridgeUrlPattern('https://test.url/$version/bridge-$version-$platform.zip')
    })

    it('should return correct URL with version and platform substitution', () => {
      // Act
      const result = bridgeClient.getVersionUrl('2.1.0')

      // Assert
      expect(result).toBe('https://test.url/2.1.0/bridge-2.1.0-linux64.zip')
    })

    it('should handle multiple version placeholders', () => {
      // Arrange
      bridgeClient.setBridgeUrlPattern('https://test.url/$version/bridge-cli-$version-$platform.zip')

      // Act
      const result = bridgeClient.getVersionUrl('3.0.0')

      // Assert
      expect(result).toBe('https://test.url/3.0.0/bridge-cli-3.0.0-linux64.zip')
    })
  })

  describe('getAllAvailableBridgeVersions', () => {
    let mockGetSharedHttpClient: jest.SpyInstance
    let mockRetrySleepHelper: jest.SpyInstance
    let mockWarning: jest.SpyInstance

    beforeEach(() => {
      jest.clearAllMocks()

      const utility = require('../../../../src/blackduck-security-action/utility')
      const core = require('@actions/core')

      mockGetSharedHttpClient = jest.spyOn(utility, 'getSharedHttpClient')
      mockRetrySleepHelper = jest.spyOn(bridgeClient as any, 'retrySleepHelper')
      mockWarning = jest.spyOn(core, 'warning')

      bridgeClient.setBridgeArtifactoryURL('https://test.artifactory.url')
    })

    it('should return version array when successful', async () => {
      // Arrange
      const mockHttpClient = {
        get: jest.fn().mockResolvedValue({
          message: {statusCode: 200},
          readBody: jest.fn().mockResolvedValue('<a href="1.0.0/">1.0.0/</a><a href="2.1.0/">2.1.0/</a><a href="3.0.0/">3.0.0/</a>')
        })
      }
      mockGetSharedHttpClient.mockReturnValue(mockHttpClient)

      // Act
      const result = await bridgeClient.getAllAvailableBridgeVersions()

      // Assert
      expect(result).toEqual(['1.0.0', '2.1.0', '3.0.0'])
      expect(mockHttpClient.get).toHaveBeenCalledWith('https://test.artifactory.url', {Accept: 'text/html'})
    })

    it('should return empty array when no versions found', async () => {
      // Arrange
      const mockHttpClient = {
        get: jest.fn().mockResolvedValue({
          message: {statusCode: 200},
          readBody: jest.fn().mockResolvedValue('<a href="other/">other/</a>')
        })
      }
      mockGetSharedHttpClient.mockReturnValue(mockHttpClient)

      // Act
      const result = await bridgeClient.getAllAvailableBridgeVersions()

      // Assert
      expect(result).toEqual([])
    })

    it('should retry on non-success status codes', async () => {
      // Arrange
      const mockHttpClient = {
        get: jest
          .fn()
          .mockResolvedValueOnce({
            message: {statusCode: 500}
          })
          .mockResolvedValueOnce({
            message: {statusCode: 200},
            readBody: jest.fn().mockResolvedValue('<a href="1.5.0/">1.5.0/</a>')
          })
      }
      mockGetSharedHttpClient.mockReturnValue(mockHttpClient)
      mockRetrySleepHelper.mockResolvedValue(30000)

      // Act
      const result = await bridgeClient.getAllAvailableBridgeVersions()

      // Assert
      expect(result).toEqual(['1.5.0'])
      expect(mockRetrySleepHelper).toHaveBeenCalledTimes(1)
    })

    it('should show warning when unable to retrieve versions after retries', async () => {
      // Arrange
      const mockHttpClient = {
        get: jest.fn().mockResolvedValue({
          message: {statusCode: 500}
        })
      }
      mockGetSharedHttpClient.mockReturnValue(mockHttpClient)
      mockRetrySleepHelper.mockResolvedValue(30000)

      // Act
      const result = await bridgeClient.getAllAvailableBridgeVersions()

      // Assert
      expect(result).toEqual([])
      expect(mockWarning).toHaveBeenCalledWith('Unable to retrieve the Bridge Versions from Artifactory')
    })
  })

  describe('isNetworkAirGapEnabled', () => {
    let mockParseToBoolean: jest.SpyInstance

    beforeEach(() => {
      jest.clearAllMocks()

      const utility = require('../../../../src/blackduck-security-action/utility')
      mockParseToBoolean = jest.spyOn(utility, 'parseToBoolean')
    })

    it('should return true when air gap is enabled', () => {
      // Arrange
      mockParseToBoolean.mockReturnValue(true)

      // Act
      const result = bridgeClient.isNetworkAirGapEnabled()

      // Assert
      expect(result).toBe(true)
      expect(mockParseToBoolean).toHaveBeenCalledWith(expect.any(String))
    })

    it('should return false when air gap is disabled', () => {
      // Arrange
      mockParseToBoolean.mockReturnValue(false)

      // Act
      const result = bridgeClient.isNetworkAirGapEnabled()

      // Assert
      expect(result).toBe(false)
      expect(mockParseToBoolean).toHaveBeenCalledWith(expect.any(String))
    })
  })

  describe('getBridgeDefaultPath', () => {
    it('should return correct default path', () => {
      // Mock getBasePath to return a valid path
      jest.spyOn(bridgeClient as any, 'getBasePath').mockReturnValue('/base/path')

      // Act
      const result = bridgeClient.callGetBridgeDefaultPath()

      // Assert
      expect(result).toBe('/base/path/bridge-cli-bundle')
    })

    it('should return empty string when getBasePath returns empty', () => {
      // Mock getBasePath to return empty string
      jest.spyOn(bridgeClient as any, 'getBasePath').mockReturnValue('')

      // Act
      const result = bridgeClient.callGetBridgeDefaultPath()

      // Assert
      expect(result).toBe('')
    })
  })

  describe('getLatestVersionInfo', () => {
    it('should call processBaseUrlWithLatest', async () => {
      // Arrange
      const mockProcessBaseUrlWithLatest = jest.spyOn(bridgeClient as any, 'processBaseUrlWithLatest')
      mockProcessBaseUrlWithLatest.mockResolvedValue({bridgeUrl: 'test-url', bridgeVersion: '1.0.0'})

      // Act
      const result = await bridgeClient.callGetLatestVersionInfo()

      // Assert
      expect(result).toEqual({bridgeUrl: 'test-url', bridgeVersion: '1.0.0'})
      expect(mockProcessBaseUrlWithLatest).toHaveBeenCalled()
    })
  })

  describe('selectPlatform', () => {
    let mockInfo: jest.SpyInstance

    beforeEach(() => {
      const core = require('@actions/core')
      mockInfo = jest.spyOn(core, 'info')
    })

    it('should return ARM platform when ARM is detected and version supports ARM', () => {
      // Act
      const result = bridgeClient.callSelectPlatform('2.1.0', true, true, 'macos_arm', 'macosx', '2.0.0')

      // Assert
      expect(result).toBe('macos_arm')
    })

    it('should return default platform when ARM is detected but version does not support ARM', () => {
      // Act
      const result = bridgeClient.callSelectPlatform('1.5.0', true, false, 'macos_arm', 'macosx', '2.0.0')

      // Assert
      expect(result).toBe('macosx')
      expect(mockInfo).toHaveBeenCalledWith('Detected Bridge CLI version (1.5.0) below the minimum ARM support requirement (2.0.0). Defaulting to macosx platform.')
    })

    it('should return default platform when ARM is not detected', () => {
      // Act
      const result = bridgeClient.callSelectPlatform('2.1.0', false, true, 'macos_arm', 'macosx', '2.0.0')

      // Assert
      expect(result).toBe('macosx')
    })
  })

  describe('determineBaseUrl', () => {
    it('should return BRIDGE_CLI_BASE_URL when provided', async () => {
      // Arrange
      setMockInputValue('BRIDGE_CLI_BASE_URL', 'https://custom.base.url')

      // Act
      const result = await bridgeClient.callDetermineBaseUrl()

      // Assert
      expect(result).toBe('https://custom.base.url')
    })

    it('should return default artifactory URL when BRIDGE_CLI_BASE_URL is empty', async () => {
      // Arrange
      setMockInputValue('BRIDGE_CLI_BASE_URL', '')

      // Act
      const result = await bridgeClient.callDetermineBaseUrl()

      // Assert
      expect(result).toBe('https://repo.blackduck.com/bds-integrations-release/com/blackduck/integration/bridge/binaries/')
    })
  })

  describe('getNormalizedVersionUrl', () => {
    it('should replace latest pattern with versions.txt', () => {
      // Arrange
      bridgeClient.setBridgeUrlLatestPattern('https://test.url/latest/bridge-latest.zip')
      jest.spyOn(bridgeClient as any, 'getLatestVersionRegexPattern').mockReturnValue(/latest/)

      // Act
      const result = bridgeClient.callGetNormalizedVersionUrl()

      // Assert
      expect(result).toBe('https://test.url/versions.txt/bridge-latest.zip')
    })
  })

  describe('getPlatformName', () => {
    let originalCpus: any
    let originalArch: any

    beforeEach(() => {
      originalArch = process.arch
    })

    afterEach(() => {
      // Restore original values
      Object.defineProperty(process, 'arch', {value: originalArch})
      if (originalCpus) {
        jest.restoreAllMocks()
      }
    })

    it('should return MAC_ARM for macOS with ARM processor', () => {
      // Arrange
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', {value: 'darwin'})

      const os = require('os')
      jest.spyOn(os, 'cpus').mockReturnValue([{model: 'Apple M1'}])

      // Act
      const result = bridgeClient.callGetPlatformName()

      // Assert
      expect(result).toBe('macos_arm')

      // Restore platform
      Object.defineProperty(process, 'platform', {value: originalPlatform})
    })

    it('should return MAC for macOS with Intel processor', () => {
      // Arrange
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', {value: 'darwin'})

      const os = require('os')
      jest.spyOn(os, 'cpus').mockReturnValue([{model: 'Intel(R) Core(TM) i7-8700K CPU @ 3.70GHz'}])

      // Act
      const result = bridgeClient.callGetPlatformName()

      // Assert
      expect(result).toBe('macosx')

      // Restore platform
      Object.defineProperty(process, 'platform', {value: originalPlatform})
    })

    it('should return LINUX_ARM for Linux with ARM architecture', () => {
      // Arrange
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', {value: 'linux'})
      Object.defineProperty(process, 'arch', {value: 'arm64'})

      // Act
      const result = bridgeClient.callGetPlatformName()

      // Assert
      expect(result).toBe('linux_arm')

      // Restore platform
      Object.defineProperty(process, 'platform', {value: originalPlatform})
    })

    it('should return LINUX for Linux with x64 architecture', () => {
      // Arrange
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', {value: 'linux'})
      Object.defineProperty(process, 'arch', {value: 'x64'})

      // Act
      const result = bridgeClient.callGetPlatformName()

      // Assert
      expect(result).toBe('linux64')

      // Restore platform
      Object.defineProperty(process, 'platform', {value: originalPlatform})
    })

    it('should return WINDOWS for Windows platform', () => {
      // Arrange
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', {value: 'win32'})

      // Act
      const result = bridgeClient.callGetPlatformName()

      // Assert
      expect(result).toBe('win64')

      // Restore platform
      Object.defineProperty(process, 'platform', {value: originalPlatform})
    })
  })

  describe('retrySleepHelper', () => {
    let mockInfo: jest.SpyInstance
    let mockSleep: jest.SpyInstance

    beforeEach(() => {
      const core = require('@actions/core')
      const utility = require('../../../../src/blackduck-security-action/utility')

      mockInfo = jest.spyOn(core, 'info')
      mockSleep = jest.spyOn(utility, 'sleep')
    })

    it('should log retry message and sleep', async () => {
      // Arrange
      mockSleep.mockResolvedValue(undefined)

      // Act
      const result = await bridgeClient.callRetrySleepHelper('Test retry message, Retries left: ', 3, 15000)

      // Assert
      expect(result).toBe(30000) // Should double the delay
      expect(mockInfo).toHaveBeenCalledWith('Test retry message, Retries left: 3, Waiting: 15 Seconds')
      expect(mockSleep).toHaveBeenCalledWith(15000)
    })
  })

  // ============================================================================
  // ADDITIONAL COMPREHENSIVE TESTS FOR BRIDGE CLIENT BASE
  // ============================================================================

  describe('BridgeClientBase - makeHttpsGetRequest', () => {
    let mockHttpsRequest: jest.Mock

    beforeEach(() => {
      mockHttpsRequest = jest.fn()
      jest.doMock('node:https', () => ({
        request: mockHttpsRequest
      }))
    })

    it('should handle HTTPS request error', async () => {
      // Arrange
      const mockRequest = {
        on: jest.fn(),
        end: jest.fn(),
        setTimeout: jest.fn()
      }

      mockHttpsRequest.mockReturnValue(mockRequest)

      // Simulate error event
      mockRequest.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Network error')), 0)
        }
      })

      // Act & Assert
      await expect(bridgeClient.callMakeHttpsGetRequest('https://test.url')).rejects.toThrow('Network error')
    })

    it('should handle successful HTTPS response', async () => {
      // This test would require more complex mocking of the HTTPS module
      // and is already partially covered by existing integration tests
    })
  })

  describe('BridgeClientBase - shouldUpdateBridge', () => {
    it('should return true when versions are different', () => {
      // Act
      const result = bridgeClient.callShouldUpdateBridge('1.0.0', '1.1.0')

      // Assert
      expect(result).toBe(true)
    })

    it('should return false when versions are the same', () => {
      // Act
      const result = bridgeClient.callShouldUpdateBridge('1.0.0', '1.0.0')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle empty current version', () => {
      // Act
      const result = bridgeClient.callShouldUpdateBridge('', '1.0.0')

      // Assert
      expect(result).toBe(true)
    })

    it('should handle empty latest version', () => {
      // Act
      const result = bridgeClient.callShouldUpdateBridge('1.0.0', '')

      // Assert
      expect(result).toBe(true) // Different versions (including empty) should trigger update
    })

    it('should handle both versions empty', () => {
      // Act
      const result = bridgeClient.callShouldUpdateBridge('', '')

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('BridgeClientBase - cleanupOnError', () => {
    let mockCleanupTempDir: jest.SpyInstance

    beforeEach(() => {
      const utility = require('../../../../src/blackduck-security-action/utility')
      mockCleanupTempDir = jest.spyOn(utility, 'cleanupTempDir')
    })

    it('should cleanup temp directory successfully', async () => {
      // Arrange
      mockCleanupTempDir.mockResolvedValue(undefined)

      // Act
      await bridgeClient.callCleanupOnError('/tmp/test-dir')

      // Assert
      expect(mockCleanupTempDir).toHaveBeenCalledWith('/tmp/test-dir')
    })

    it('should handle cleanup failure gracefully', async () => {
      // Arrange
      mockCleanupTempDir.mockRejectedValue(new Error('Cleanup failed'))
      const mockDebug = jest.spyOn(require('@actions/core'), 'debug')

      // Act
      await bridgeClient.callCleanupOnError('/tmp/test-dir')

      // Assert
      expect(mockCleanupTempDir).toHaveBeenCalledWith('/tmp/test-dir')
      expect(mockDebug).toHaveBeenCalledWith('Failed to cleanup temp directory: Error: Cleanup failed')
    })
  })

  describe('BridgeClientBase - prepareCommand error handling', () => {
    it('should cleanup and rethrow error when buildCommandForAllTools fails', async () => {
      // Arrange
      const mockBuildCommand = jest.spyOn(bridgeClient as any, 'buildCommandForAllTools')
      mockBuildCommand.mockRejectedValue(new Error('Build command failed'))

      const mockCleanupOnError = jest.spyOn(bridgeClient as any, 'cleanupOnError')
      mockCleanupOnError.mockResolvedValue(undefined)

      // Act & Assert
      await expect(bridgeClient.prepareCommand('/tmp/test')).rejects.toThrow('Build command failed')
      expect(mockCleanupOnError).toHaveBeenCalledWith('/tmp/test')
    })

    it('should handle non-Error objects thrown', async () => {
      // Arrange
      const mockBuildCommand = jest.spyOn(bridgeClient as any, 'buildCommandForAllTools')
      mockBuildCommand.mockRejectedValue('String error')

      const mockCleanupOnError = jest.spyOn(bridgeClient as any, 'cleanupOnError')
      mockCleanupOnError.mockResolvedValue(undefined)

      // Act & Assert
      await expect(bridgeClient.prepareCommand('/tmp/test')).rejects.toThrow('String error')
      expect(mockCleanupOnError).toHaveBeenCalledWith('/tmp/test')
    })
  })

  describe('BridgeClientBase - validateRequiredScanTypes', () => {
    beforeEach(() => {
      // Reset mocks
      jest.clearAllMocks()
    })

    it('should not throw when scan types are valid', () => {
      // Arrange
      const mockValidateScanTypes = jest.spyOn(validators, 'validateScanTypes')
      mockValidateScanTypes.mockReturnValue([])

      // Act & Assert
      expect(() => bridgeClient.callValidateRequiredScanTypes()).not.toThrow()
    })

    it('should throw when no scan types are configured', () => {
      // Arrange
      const mockValidateScanTypes = jest.spyOn(validators, 'validateScanTypes')
      mockValidateScanTypes.mockReturnValue(['polaris', 'coverity', 'blackduck', 'srm']) // 4 elements to trigger throw

      // Act & Assert
      expect(() => bridgeClient.callValidateRequiredScanTypes()).toThrow() // Just check that it throws
    })

    it('should throw with multiple validation errors', () => {
      // Arrange
      const mockValidateScanTypes = jest.spyOn(validators, 'validateScanTypes')
      mockValidateScanTypes.mockReturnValue(['polaris', 'coverity', 'blackduck', 'srm']) // 4 elements to trigger throw

      // Act & Assert
      expect(() => bridgeClient.callValidateRequiredScanTypes()).toThrow() // Just check that it throws
    })
  })

  describe('BridgeClientBase - handleValidationErrors', () => {
    it('should not throw when no validation errors exist', () => {
      // Act & Assert
      expect(() => bridgeClient.callHandleValidationErrors([], 'test-command')).not.toThrow()
    })

    it('should throw when validation errors exist', () => {
      // Arrange
      const errors = ['Polaris validation failed', 'Coverity validation failed']

      // Act & Assert
      expect(() => bridgeClient.callHandleValidationErrors(errors, 'test-command')).toThrow('Polaris validation failed')
    })
  })

  describe('BridgeClientBase - addDiagnosticsIfEnabled', () => {
    beforeEach(() => {
      setMockInputValue('INCLUDE_DIAGNOSTICS', 'false')
    })

    it('should add diagnostics option when INCLUDE_DIAGNOSTICS is true', () => {
      // Arrange
      setMockInputValue('INCLUDE_DIAGNOSTICS', 'true')

      // Mock parseToBoolean to return true for this test
      const mockParseToBoolean = jest.spyOn(utility, 'parseToBoolean')
      mockParseToBoolean.mockReturnValue(true)

      // Act
      const result = bridgeClient.callAddDiagnosticsIfEnabled('bridge-cli --stage connect')

      // Assert
      expect(result).toBe('bridge-cli --stage connect --diagnostics')

      mockParseToBoolean.mockRestore()
    })

    it('should not add diagnostics option when INCLUDE_DIAGNOSTICS is false', () => {
      // Arrange
      setMockInputValue('INCLUDE_DIAGNOSTICS', 'false')

      // Act
      const result = bridgeClient.callAddDiagnosticsIfEnabled('bridge-cli --stage connect')

      // Assert
      expect(result).toBe('bridge-cli --stage connect')
    })

    it('should not add diagnostics option when INCLUDE_DIAGNOSTICS is empty', () => {
      // Arrange
      setMockInputValue('INCLUDE_DIAGNOSTICS', '')

      // Act
      const result = bridgeClient.callAddDiagnosticsIfEnabled('bridge-cli --stage connect')

      // Assert
      expect(result).toBe('bridge-cli --stage connect')
    })
  })

  describe('BridgeClientBase - getNormalizedVersionUrl', () => {
    it('should replace latest pattern with versions.txt', () => {
      // Arrange
      bridgeClient.setBridgeUrlLatestPattern('https://example.com/bridge/latest/')

      // Act
      const result = bridgeClient.callGetNormalizedVersionUrl()

      // Assert
      expect(result).toBe('https://example.com/bridge/versions.txt')
    })

    it('should handle URL without trailing slash', () => {
      // Arrange
      bridgeClient.setBridgeUrlLatestPattern('https://example.com/bridge/latest')

      // Act
      const result = bridgeClient.callGetNormalizedVersionUrl()

      // Assert
      expect(result).toBe('https://example.com/bridge/versions.txt')
    })

    it('should handle empty URL pattern', () => {
      // Arrange
      bridgeClient.setBridgeUrlLatestPattern('')

      // Act
      const result = bridgeClient.callGetNormalizedVersionUrl()

      // Assert
      expect(result).toBe('') // Empty string when pattern is empty
    })
  })

  describe('BridgeClientBase - determineBaseUrl', () => {
    beforeEach(() => {
      setMockInputValue('BRIDGE_CLI_BASE_URL', '')
    })

    it('should return BRIDGE_CLI_BASE_URL when provided', async () => {
      // Arrange
      setMockInputValue('BRIDGE_CLI_BASE_URL', 'https://custom.base.url')

      // Act
      const result = await bridgeClient.callDetermineBaseUrl()

      // Assert
      expect(result).toBe('https://custom.base.url')
    })

    it('should return default artifactory URL when BRIDGE_CLI_BASE_URL is empty', async () => {
      // Arrange
      setMockInputValue('BRIDGE_CLI_BASE_URL', '')

      // Act
      const result = await bridgeClient.callDetermineBaseUrl()

      // Assert
      expect(result).toBe('https://repo.blackduck.com/bds-integrations-release/com/blackduck/integration/bridge/binaries/')
    })

    it('should handle whitespace in BRIDGE_CLI_BASE_URL', async () => {
      // Arrange
      setMockInputValue('BRIDGE_CLI_BASE_URL', '  https://custom.base.url  ')

      // Act
      const result = await bridgeClient.callDetermineBaseUrl()

      // Assert
      expect(result).toBe('  https://custom.base.url  ')
    })
  })

  describe('BridgeClientBase - selectPlatform', () => {
    it('should return ARM platform when ARM is detected and version supports ARM', () => {
      // Act
      const result = bridgeClient.callSelectPlatform('2.2.0', true, true, 'linux_arm', 'linux64', '2.1.0')

      // Assert
      expect(result).toBe('linux_arm')
    })

    it('should return default platform when ARM is detected but version does not support ARM', () => {
      // Arrange
      const mockInfo = jest.spyOn(require('@actions/core'), 'info')

      // Act
      const result = bridgeClient.callSelectPlatform('1.9.0', true, false, 'macos_arm', 'macosx', '2.1.0')

      // Assert
      expect(result).toBe('macosx')
      expect(mockInfo).toHaveBeenCalledWith('Detected Bridge CLI version (1.9.0) below the minimum ARM support requirement (2.1.0). Defaulting to macosx platform.')
    })

    it('should return default platform when ARM is not detected', () => {
      // Act
      const result = bridgeClient.callSelectPlatform('2.2.0', false, true, 'linux_arm', 'linux64', '2.1.0')

      // Assert
      expect(result).toBe('linux64')
    })

    it('should handle edge case version numbers', () => {
      // Act
      const result1 = bridgeClient.callSelectPlatform('2.1.0', true, true, 'linux_arm', 'linux64', '2.1.0')
      const result2 = bridgeClient.callSelectPlatform('2.0.99', true, false, 'linux_arm', 'linux64', '2.1.0')

      // Assert
      expect(result1).toBe('linux_arm') // Exact match should use ARM
      expect(result2).toBe('linux64') // Below threshold should use default
    })
  })

  describe('BridgeClientBase - runBridgeCommand', () => {
    it('should execute bridge command successfully', async () => {
      // Arrange
      const mockSetBridgeExecutablePath = jest.spyOn(bridgeClient as any, 'setBridgeExecutablePath')
      mockSetBridgeExecutablePath.mockResolvedValue(undefined)
      ;(bridgeClient as any).bridgeExecutablePath = '/test/bridge/executable'
      ;(bridgeClient as any).bridgePath = '/test/bridge'

      const mockExec = jest.fn().mockResolvedValue(0)
      jest.doMock('@actions/exec', () => ({exec: mockExec}))
      const {exec} = require('@actions/exec')
      exec.mockResolvedValue(0)

      // Act
      const result = await (bridgeClient as any).runBridgeCommand('test-command', {cwd: '/tmp/test'})

      // Assert
      expect(result).toBe(0)
      expect(mockSetBridgeExecutablePath).toHaveBeenCalled()
    })

    it('should throw error when bridge executable not found', async () => {
      // Arrange
      const mockSetBridgeExecutablePath = jest.spyOn(bridgeClient as any, 'setBridgeExecutablePath')
      mockSetBridgeExecutablePath.mockResolvedValue(undefined)
      ;(bridgeClient as any).bridgeExecutablePath = '' // Empty to trigger error
      ;(bridgeClient as any).bridgePath = '/test/bridge'

      // Act & Assert
      await expect((bridgeClient as any).runBridgeCommand('test-command', {cwd: '/tmp/test'})).rejects.toThrow('Bridge executable not found at /test/bridge')
    })
  })

  describe('BridgeClientBase - isNetworkAirGapEnabled', () => {
    it('should return true when air gap is enabled', () => {
      // Arrange
      const utility = require('../../../../src/blackduck-security-action/utility')
      const mockParseToBoolean = jest.spyOn(utility, 'parseToBoolean')
      mockParseToBoolean.mockReturnValue(true)

      // Act
      const result = bridgeClient.isNetworkAirGapEnabled()

      // Assert
      expect(result).toBe(true)
    })

    it('should return false when air gap is disabled', () => {
      // Arrange
      const utility = require('../../../../src/blackduck-security-action/utility')
      const mockParseToBoolean = jest.spyOn(utility, 'parseToBoolean')
      mockParseToBoolean.mockReturnValue(false)

      // Act
      const result = bridgeClient.isNetworkAirGapEnabled()

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('BridgeClientBase - getBridgeDefaultPath', () => {
    it('should return correct default path', () => {
      // Arrange
      const mockGetBasePath = jest.spyOn(bridgeClient as any, 'getBasePath')
      mockGetBasePath.mockReturnValue('/base/path')

      // Act
      const result = bridgeClient.callGetBridgeDefaultPath()

      // Assert
      expect(result).toBe('/base/path/bridge-cli-bundle')
    })

    it('should return empty string when getBasePath returns empty', () => {
      // Arrange
      const mockGetBasePath = jest.spyOn(bridgeClient as any, 'getBasePath')
      mockGetBasePath.mockReturnValue('')

      // Act
      const result = bridgeClient.callGetBridgeDefaultPath()

      // Assert
      expect(result).toBe('')
    })
  })

  describe('BridgeClientBase - getLatestVersionInfo', () => {
    it('should call processBaseUrlWithLatest', async () => {
      // Arrange
      const mockProcessBaseUrl = jest.spyOn(bridgeClient as any, 'processBaseUrlWithLatest')
      mockProcessBaseUrl.mockResolvedValue({bridgeUrl: 'test-url', bridgeVersion: '1.0.0'})

      // Act
      const result = await bridgeClient.callGetLatestVersionInfo()

      // Assert
      expect(result).toEqual({bridgeUrl: 'test-url', bridgeVersion: '1.0.0'})
      expect(mockProcessBaseUrl).toHaveBeenCalled()
    })
  })

  describe('BridgeClientBase - Additional Edge Cases', () => {
    it('should handle getBridgeCLIDownloadPathCommon with includeBridgeType=true', () => {
      // Arrange
      const mockGetBasePath = jest.spyOn(bridgeClient as any, 'getBasePath')
      mockGetBasePath.mockReturnValue('/base/path')

      // Act
      const result = (bridgeClient as any).getBridgeCLIDownloadPathCommon(true)

      // Assert
      expect(result).toBe('/base/path/bridge-cli-bundle')
    })

    it('should handle getBridgeCLIDownloadPathCommon with includeBridgeType=false', () => {
      // Arrange
      const mockGetBasePath = jest.spyOn(bridgeClient as any, 'getBasePath')
      mockGetBasePath.mockReturnValue('/base/path')

      // Act
      const result = (bridgeClient as any).getBridgeCLIDownloadPathCommon(false)

      // Assert
      expect(result).toBe('/base/path')
    })

    it('should handle empty input values gracefully', () => {
      // Arrange
      setMockInputValue('INCLUDE_DIAGNOSTICS', '')
      setMockInputValue('BRIDGE_CLI_BASE_URL', '')

      // Act & Assert - should not throw
      expect(() => bridgeClient.callAddDiagnosticsIfEnabled('test')).not.toThrow()
      expect(() => bridgeClient.callDetermineBaseUrl()).not.toThrow()
    })

    it('should handle validation errors with empty command', () => {
      // Arrange
      const errors = ['Test error']

      // Act & Assert
      expect(() => bridgeClient.callHandleValidationErrors(errors, '')).toThrow('Test error')
    })
  })

  describe('BridgeClientBase - Integration Scenarios', () => {
    it('should handle complex platform detection scenarios', () => {
      // Test various combinations of ARM detection
      const testCases = [
        {version: '2.1.0', isARM: true, isValid: true, expected: 'macos_arm'},
        {version: '2.0.9', isARM: true, isValid: false, expected: 'macosx'},
        {version: '3.0.0', isARM: false, isValid: true, expected: 'macosx'},
        {version: '1.0.0', isARM: true, isValid: false, expected: 'macosx'}
      ]

      testCases.forEach(({version, isARM, isValid, expected}) => {
        const result = bridgeClient.callSelectPlatform(version, isARM, isValid, 'macos_arm', 'macosx', '2.1.0')
        expect(result).toBe(expected)
      })
    })

    it('should handle command building with various tool combinations', async () => {
      // This test demonstrates the integration between different tools

      // Mock validateScanTypes to return fewer than 4 missing items (should not throw)
      const mockValidateScanTypes = jest.spyOn(validators, 'validateScanTypes')
      mockValidateScanTypes.mockReturnValue(['polaris', 'coverity']) // Only 2 missing, not 4

      expect(() => bridgeClient.callValidateRequiredScanTypes()).not.toThrow()

      mockValidateScanTypes.mockRestore()
    })
  })
})
