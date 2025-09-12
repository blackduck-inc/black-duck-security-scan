import {BridgeClientBase} from '../../../../src/blackduck-security-action/bridge/bridge-client-base'
import {BridgeToolsParameter} from '../../../../src/blackduck-security-action/tools-parameter'
import * as validators from '../../../../src/blackduck-security-action/validators'
import {ExecOptions} from '@actions/exec'
import {DownloadFileResponse} from '../../../../src/blackduck-security-action/download-utility' // Mock fs module first to provide chmod

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
  POLARIS_SERVER_URL_KEY: 'POLARIS_SERVER_URL',
  COVERITY_URL_KEY: 'COVERITY_URL',
  BLACKDUCKSCA_URL_KEY: 'BLACKDUCKSCA_URL',
  SRM_URL_KEY: 'SRM_URL',
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
    BRIDGE_CLI_DOWNLOAD_VERSION: ''
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
  getBridgeFileType(): string {
    return 'bridge-cli'
  }

  async getBridgeVersion(): Promise<string> {
    return '1.0.0'
  }

  getBridgeType(): string {
    return 'test-bridge'
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
    return /test-pattern/
  }

  protected getBridgeCLIDownloadDefaultPath(): string {
    return '/test/download/path'
  }

  protected async handleBridgeDownload(downloadResponse: DownloadFileResponse, extractZippedFilePath: string): Promise<void> {
    // Mock implementation
  }

  protected initializeUrls(): void {
    this.bridgeArtifactoryURL = 'https://test.artifactory.url/'
    this.bridgeUrlPattern = 'https://test.url.pattern'
    this.bridgeUrlLatestPattern = 'https://test.latest.pattern'
  }

  protected async updateBridgeCLIVersion(requestedVersion: string): Promise<{bridgeUrl: string; bridgeVersion: string}> {
    return {bridgeUrl: 'https://test.url', bridgeVersion: requestedVersion}
  }

  protected verifyRegexCheck(url: string): RegExpMatchArray | null {
    return null
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

    it('should log debug message and not throw when executable is missing but download URL is provided', async () => {
      // Arrange
      const bridgePath = '/test/bridge/path'
      const downloadUrl = 'https://example.com/bridge-cli.zip'
      const expectedExecutablePath = '/test/bridge/path/bridge-cli'

      mockCheckIfPathExists.mockReturnValue(false)
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', downloadUrl)

      // Act
      await expect(bridgeClient.validateAirGapExecutable(bridgePath)).resolves.not.toThrow()

      // Assert
      expect(mockCheckIfPathExists).toHaveBeenCalledWith(expectedExecutablePath)
      expect(mockDebug).toHaveBeenCalledWith(`Validating air gap executable at: ${expectedExecutablePath}`)
      expect(mockDebug).toHaveBeenCalledWith(`Executable missing in air gap mode, will download from: ${downloadUrl}`)
    })

    it('should throw error when executable is missing and no download URL is provided', async () => {
      // Arrange
      const bridgePath = '/test/bridge/path'
      const expectedExecutablePath = '/test/bridge/path/bridge-cli'
      const expectedErrorMessage = 'Bridge executable not found at /test/bridge/path'

      mockCheckIfPathExists.mockReturnValue(false)
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', '')

      // Act & Assert
      await expect(bridgeClient.validateAirGapExecutable(bridgePath)).rejects.toThrow(expectedErrorMessage)

      expect(mockCheckIfPathExists).toHaveBeenCalledWith(expectedExecutablePath)
      expect(mockDebug).toHaveBeenCalledWith(`Validating air gap executable at: ${expectedExecutablePath}`)
      expect(mockDebug).toHaveBeenCalledWith(`Air gap validation failed: ${expectedErrorMessage}`)
    })

    it('should handle empty bridge path correctly', async () => {
      // Arrange
      const bridgePath = ''
      const expectedExecutablePath = 'bridge-cli'

      mockCheckIfPathExists.mockReturnValue(false)
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', '')

      // Act & Assert
      await expect(bridgeClient.validateAirGapExecutable(bridgePath)).rejects.toThrow('Bridge executable not found at ')

      expect(mockCheckIfPathExists).toHaveBeenCalledWith(expectedExecutablePath)
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

    it('should handle undefined/null BRIDGE_CLI_DOWNLOAD_URL correctly', async () => {
      // Arrange
      const bridgePath = '/test/bridge/path'
      const expectedExecutablePath = '/test/bridge/path/bridge-cli'
      const expectedErrorMessage = 'Bridge executable not found at /test/bridge/path'

      mockCheckIfPathExists.mockReturnValue(false)

      // Mock the constants module
      const constants = require('../../../../src/application-constants')
      constants.BRIDGE_EXECUTABLE_NOT_FOUND_ERROR = 'Bridge executable not found at '

      // Test with undefined (default mock state)
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', '')

      // Act & Assert
      await expect(bridgeClient.validateAirGapExecutable(bridgePath)).rejects.toThrow(expectedErrorMessage)

      expect(mockDebug).not.toHaveBeenCalledWith(expect.stringContaining('will download from:'))
    })
  })

  describe('processDownloadUrl', () => {
    let bridgeClient: TestBridgeClient
    let mockVerifyRegexCheck: jest.SpyInstance
    let mockGetBridgeVersionFromLatestURL: jest.SpyInstance
    let mockGetLatestVersionRegexPattern: jest.SpyInstance

    beforeEach(() => {
      jest.clearAllMocks()
      bridgeClient = new TestBridgeClient()

      // Mock the methods used by processDownloadUrl
      mockVerifyRegexCheck = jest.spyOn(bridgeClient as any, 'verifyRegexCheck')
      mockGetBridgeVersionFromLatestURL = jest.spyOn(bridgeClient, 'getBridgeVersionFromLatestURL')
      mockGetLatestVersionRegexPattern = jest.spyOn(bridgeClient as any, 'getLatestVersionRegexPattern')
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    test('should return bridge URL and version when regex match has version', async () => {
      // Arrange
      const testUrl = 'https://example.com/bridge-1.2.3.zip'
      const expectedVersion = '1.2.3'

      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', testUrl)
      mockVerifyRegexCheck.mockReturnValue(['full-match', expectedVersion])

      // Act
      const result = await (bridgeClient as any).processDownloadUrl()

      // Assert
      expect(result).toEqual({
        bridgeUrl: testUrl,
        bridgeVersion: expectedVersion
      })
      expect(mockVerifyRegexCheck).toHaveBeenCalledWith(testUrl)
      expect(mockGetBridgeVersionFromLatestURL).not.toHaveBeenCalled()
    })

    test('should fetch version from latest URL when regex match exists but version is empty', async () => {
      // Arrange
      const testUrl = 'https://example.com/bridge-latest.zip'
      const expectedVersion = '2.1.0'
      const versionsUrl = 'https://example.com/bridge-versions.txt.zip'
      const latestRegexPattern = /latest/g

      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', testUrl)
      mockVerifyRegexCheck.mockReturnValue(['full-match', '']) // Empty version
      mockGetLatestVersionRegexPattern.mockReturnValue(latestRegexPattern)
      mockGetBridgeVersionFromLatestURL.mockResolvedValue(expectedVersion)

      // Act
      const result = await (bridgeClient as any).processDownloadUrl()

      // Assert
      expect(result).toEqual({
        bridgeUrl: testUrl,
        bridgeVersion: expectedVersion
      })
      expect(mockVerifyRegexCheck).toHaveBeenCalledWith(testUrl)
      expect(mockGetLatestVersionRegexPattern).toHaveBeenCalled()
      expect(mockGetBridgeVersionFromLatestURL).toHaveBeenCalledWith(versionsUrl)
    })

    test('should fetch version from latest URL when regex match exists but version is undefined', async () => {
      // Arrange
      const testUrl = 'https://example.com/bridge-latest.zip'
      const expectedVersion = '2.1.0'
      const versionsUrl = 'https://example.com/bridge-versions.txt.zip'
      const latestRegexPattern = /latest/g

      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', testUrl)
      mockVerifyRegexCheck.mockReturnValue(['full-match', undefined]) // Undefined version
      mockGetLatestVersionRegexPattern.mockReturnValue(latestRegexPattern)
      mockGetBridgeVersionFromLatestURL.mockResolvedValue(expectedVersion)

      // Act
      const result = await (bridgeClient as any).processDownloadUrl()

      // Assert
      expect(result).toEqual({
        bridgeUrl: testUrl,
        bridgeVersion: expectedVersion
      })
      expect(mockVerifyRegexCheck).toHaveBeenCalledWith(testUrl)
      expect(mockGetLatestVersionRegexPattern).toHaveBeenCalled()
      expect(mockGetBridgeVersionFromLatestURL).toHaveBeenCalledWith(versionsUrl)
    })

    test('should return empty version when regex check returns null', async () => {
      // Arrange
      const testUrl = 'https://example.com/bridge.zip'

      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', testUrl)
      mockVerifyRegexCheck.mockReturnValue(null)

      // Act
      const result = await (bridgeClient as any).processDownloadUrl()

      // Assert
      expect(result).toEqual({
        bridgeUrl: testUrl,
        bridgeVersion: ''
      })
      expect(mockVerifyRegexCheck).toHaveBeenCalledWith(testUrl)
      expect(mockGetBridgeVersionFromLatestURL).not.toHaveBeenCalled()
    })

    test('should handle URL replacement correctly when fetching from latest URL', async () => {
      // Arrange
      const testUrl = 'https://example.com/bridge-latest-macosx.zip'
      const expectedVersion = '3.0.1'
      const latestRegexPattern = /latest/g
      const expectedVersionsUrl = 'https://example.com/bridge-versions.txt-macosx.zip'

      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', testUrl)
      mockVerifyRegexCheck.mockReturnValue(['full-match', ''])
      mockGetLatestVersionRegexPattern.mockReturnValue(latestRegexPattern)
      mockGetBridgeVersionFromLatestURL.mockResolvedValue(expectedVersion)

      // Act
      const result = await (bridgeClient as any).processDownloadUrl()

      // Assert
      expect(result).toEqual({
        bridgeUrl: testUrl,
        bridgeVersion: expectedVersion
      })
      expect(mockGetBridgeVersionFromLatestURL).toHaveBeenCalledWith(expectedVersionsUrl)
    })

    test('should handle getBridgeVersionFromLatestURL returning empty string', async () => {
      // Arrange
      const testUrl = 'https://example.com/bridge-latest.zip'
      const latestRegexPattern = /latest/g

      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', testUrl)
      mockVerifyRegexCheck.mockReturnValue(['full-match', ''])
      mockGetLatestVersionRegexPattern.mockReturnValue(latestRegexPattern)
      mockGetBridgeVersionFromLatestURL.mockResolvedValue('')

      // Act
      const result = await (bridgeClient as any).processDownloadUrl()

      // Assert
      expect(result).toEqual({
        bridgeUrl: testUrl,
        bridgeVersion: ''
      })
    })

    test('should handle getBridgeVersionFromLatestURL throwing an error', async () => {
      // Arrange
      const testUrl = 'https://example.com/bridge-latest.zip'
      const latestRegexPattern = /latest/g
      const expectedError = new Error('Network error')

      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', testUrl)
      mockVerifyRegexCheck.mockReturnValue(['full-match', ''])
      mockGetLatestVersionRegexPattern.mockReturnValue(latestRegexPattern)
      mockGetBridgeVersionFromLatestURL.mockRejectedValue(expectedError)

      // Act & Assert
      await expect((bridgeClient as any).processDownloadUrl()).rejects.toThrow('Network error')
    })

    test('should handle complex URL patterns with multiple replacements', async () => {
      // Arrange
      const testUrl = 'https://repo.example.com/bridge-latest-linux64-v2.zip'
      const expectedVersion = '2.5.0'
      const latestRegexPattern = /latest/g
      const expectedVersionsUrl = 'https://repo.example.com/bridge-versions.txt-linux64-v2.zip'

      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', testUrl)
      mockVerifyRegexCheck.mockReturnValue(['match', null]) // null version
      mockGetLatestVersionRegexPattern.mockReturnValue(latestRegexPattern)
      mockGetBridgeVersionFromLatestURL.mockResolvedValue(expectedVersion)

      // Act
      const result = await (bridgeClient as any).processDownloadUrl()

      // Assert
      expect(result).toEqual({
        bridgeUrl: testUrl,
        bridgeVersion: expectedVersion
      })
      expect(mockGetBridgeVersionFromLatestURL).toHaveBeenCalledWith(expectedVersionsUrl)
    })
  })

  describe('processVersion', () => {
    let bridgeClient: TestBridgeClient
    let mockIsBridgeInstalled: jest.SpyInstance
    let mockUpdateBridgeCLIVersion: jest.SpyInstance
    let mockInfo: jest.SpyInstance

    beforeEach(() => {
      jest.clearAllMocks()
      bridgeClient = new TestBridgeClient()

      // Mock the methods used by processVersion
      mockIsBridgeInstalled = jest.spyOn(bridgeClient, 'isBridgeInstalled')
      mockUpdateBridgeCLIVersion = jest.spyOn(bridgeClient as any, 'updateBridgeCLIVersion')

      // Mock the core info function
      const core = require('@actions/core')
      mockInfo = jest.spyOn(core, 'info')

      // Reset mock inputs
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', '')
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    test('should return empty bridgeUrl and requested version when bridge is already installed', async () => {
      // Arrange
      const requestedVersion = '2.1.5'
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', requestedVersion)
      mockIsBridgeInstalled.mockResolvedValue(true)

      // Act
      const result = await (bridgeClient as any).processVersion()

      // Assert
      expect(result).toEqual({
        bridgeUrl: '',
        bridgeVersion: requestedVersion
      })
      expect(mockIsBridgeInstalled).toHaveBeenCalledWith(requestedVersion)
      expect(mockInfo).toHaveBeenCalledWith('Bridge CLI already exists')
      expect(mockUpdateBridgeCLIVersion).not.toHaveBeenCalled()
    })

    test('should call updateBridgeCLIVersion when bridge is not installed', async () => {
      // Arrange
      const requestedVersion = '2.1.5'
      const expectedUpdateResult = {
        bridgeUrl: 'https://example.com/bridge-2.1.5.zip',
        bridgeVersion: requestedVersion
      }

      setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', requestedVersion)
      mockIsBridgeInstalled.mockResolvedValue(false)
      mockUpdateBridgeCLIVersion.mockResolvedValue(expectedUpdateResult)

      // Act
      const result = await (bridgeClient as any).processVersion()

      // Assert
      expect(result).toEqual(expectedUpdateResult)
      expect(mockIsBridgeInstalled).toHaveBeenCalledWith(requestedVersion)
      expect(mockUpdateBridgeCLIVersion).toHaveBeenCalledWith(requestedVersion)
      expect(mockInfo).not.toHaveBeenCalledWith('Bridge CLI already exists')
    })

    test('should handle empty BRIDGE_CLI_DOWNLOAD_VERSION', async () => {
      // Arrange
      const emptyVersion = ''
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', emptyVersion)
      mockIsBridgeInstalled.mockResolvedValue(false)
      mockUpdateBridgeCLIVersion.mockResolvedValue({
        bridgeUrl: 'https://example.com/bridge.zip',
        bridgeVersion: emptyVersion
      })

      // Act
      const result = await (bridgeClient as any).processVersion()

      // Assert
      expect(mockIsBridgeInstalled).toHaveBeenCalledWith(emptyVersion)
      expect(mockUpdateBridgeCLIVersion).toHaveBeenCalledWith(emptyVersion)
    })

    test('should handle version string with special characters', async () => {
      // Arrange
      const specialVersion = '2.1.5-beta.1+build.123'
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', specialVersion)
      mockIsBridgeInstalled.mockResolvedValue(true)

      // Act
      const result = await (bridgeClient as any).processVersion()

      // Assert
      expect(result).toEqual({
        bridgeUrl: '',
        bridgeVersion: specialVersion
      })
      expect(mockIsBridgeInstalled).toHaveBeenCalledWith(specialVersion)
      expect(mockInfo).toHaveBeenCalledWith('Bridge CLI already exists')
    })

    test('should handle isBridgeInstalled throwing an error', async () => {
      // Arrange
      const requestedVersion = '2.1.5'
      const expectedError = new Error('Bridge installation check failed')

      setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', requestedVersion)
      mockIsBridgeInstalled.mockRejectedValue(expectedError)

      // Act & Assert
      await expect((bridgeClient as any).processVersion()).rejects.toThrow('Bridge installation check failed')
      expect(mockIsBridgeInstalled).toHaveBeenCalledWith(requestedVersion)
      expect(mockUpdateBridgeCLIVersion).not.toHaveBeenCalled()
    })

    test('should handle updateBridgeCLIVersion throwing an error', async () => {
      // Arrange
      const requestedVersion = '2.1.5'
      const expectedError = new Error('Update failed')

      setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', requestedVersion)
      mockIsBridgeInstalled.mockResolvedValue(false)
      mockUpdateBridgeCLIVersion.mockRejectedValue(expectedError)

      // Act & Assert
      await expect((bridgeClient as any).processVersion()).rejects.toThrow('Update failed')
      expect(mockIsBridgeInstalled).toHaveBeenCalledWith(requestedVersion)
      expect(mockUpdateBridgeCLIVersion).toHaveBeenCalledWith(requestedVersion)
    })

    test('should handle very long version strings', async () => {
      // Arrange
      const longVersion = '2.1.5.1234567890.abcdefghijklmnopqrstuvwxyz.1234567890'
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', longVersion)
      mockIsBridgeInstalled.mockResolvedValue(true)

      // Act
      const result = await (bridgeClient as any).processVersion()

      // Assert
      expect(result).toEqual({
        bridgeUrl: '',
        bridgeVersion: longVersion
      })
      expect(mockIsBridgeInstalled).toHaveBeenCalledWith(longVersion)
    })

    test('should handle version with leading/trailing whitespace', async () => {
      // Arrange
      const versionWithWhitespace = '  2.1.5  '
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', versionWithWhitespace)
      mockIsBridgeInstalled.mockResolvedValue(false)
      mockUpdateBridgeCLIVersion.mockResolvedValue({
        bridgeUrl: 'https://example.com/bridge.zip',
        bridgeVersion: versionWithWhitespace
      })

      // Act
      const result = await (bridgeClient as any).processVersion()

      // Assert
      expect(mockIsBridgeInstalled).toHaveBeenCalledWith(versionWithWhitespace)
      expect(mockUpdateBridgeCLIVersion).toHaveBeenCalledWith(versionWithWhitespace)
    })

    test('should correctly read BRIDGE_CLI_DOWNLOAD_VERSION from inputs module', async () => {
      // Arrange
      const testVersion = '3.0.0-rc1'
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', testVersion)
      mockIsBridgeInstalled.mockResolvedValue(true)

      // Act
      const result = await (bridgeClient as any).processVersion()

      // Assert
      const inputs = require('../../../../src/blackduck-security-action/inputs')
      expect(inputs.BRIDGE_CLI_DOWNLOAD_VERSION).toBe(testVersion)
      expect(result.bridgeVersion).toBe(testVersion)
    })

    test('should handle concurrent calls to isBridgeInstalled properly', async () => {
      // Arrange
      const requestedVersion = '2.1.5'
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', requestedVersion)

      // Simulate a delay in isBridgeInstalled to test async behavior
      mockIsBridgeInstalled.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(true), 10)))

      // Act
      const promise1 = (bridgeClient as any).processVersion()
      const promise2 = (bridgeClient as any).processVersion()

      const [result1, result2] = await Promise.all([promise1, promise2])

      // Assert
      expect(result1).toEqual({
        bridgeUrl: '',
        bridgeVersion: requestedVersion
      })
      expect(result2).toEqual({
        bridgeUrl: '',
        bridgeVersion: requestedVersion
      })
      expect(mockIsBridgeInstalled).toHaveBeenCalledTimes(2)
    })

    test('should preserve the exact version string returned by updateBridgeCLIVersion', async () => {
      // Arrange
      const requestedVersion = '2.1.5'
      const actualReturnedVersion = '2.1.5-final' // Different from requested
      const updateResult = {
        bridgeUrl: 'https://example.com/bridge.zip',
        bridgeVersion: actualReturnedVersion
      }

      setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', requestedVersion)
      mockIsBridgeInstalled.mockResolvedValue(false)
      mockUpdateBridgeCLIVersion.mockResolvedValue(updateResult)

      // Act
      const result = await (bridgeClient as any).processVersion()

      // Assert
      expect(result).toEqual(updateResult)
      expect(result.bridgeVersion).toBe(actualReturnedVersion)
      expect(mockUpdateBridgeCLIVersion).toHaveBeenCalledWith(requestedVersion)
    })
  })

  describe('processLatestVersion', () => {
    let bridgeClient: TestBridgeClient
    let mockCheckIfBridgeExistsInAirGap: jest.SpyInstance
    let mockGetBridgeVersionFromLatestURL: jest.SpyInstance
    let mockInfo: jest.SpyInstance

    beforeEach(() => {
      jest.clearAllMocks()
      bridgeClient = new TestBridgeClient()

      // Mock the methods used by processLatestVersion
      mockCheckIfBridgeExistsInAirGap = jest.spyOn(bridgeClient as any, 'checkIfBridgeExistsInAirGap')
      mockGetBridgeVersionFromLatestURL = jest.spyOn(bridgeClient, 'getBridgeVersionFromLatestURL')

      // Mock the core info function
      const core = require('@actions/core')
      mockInfo = jest.spyOn(core, 'info')

      // Mock parseToBoolean utility function
      const utility = require('../../../../src/blackduck-security-action/utility')
      jest.spyOn(utility, 'parseToBoolean').mockReturnValue(false)
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    test('should return empty bridgeUrl and bridgeVersion when in air gap mode and bridge exists', async () => {
      // Arrange
      const isAirGap = true
      const utility = require('../../../../src/blackduck-security-action/utility')
      jest.spyOn(utility, 'parseToBoolean').mockReturnValue(isAirGap)
      mockCheckIfBridgeExistsInAirGap.mockResolvedValue(true)

      // Act
      const result = await (bridgeClient as any).processLatestVersion(isAirGap)

      // Assert
      expect(result).toEqual({
        bridgeUrl: '',
        bridgeVersion: ''
      })
      expect(mockCheckIfBridgeExistsInAirGap).toHaveBeenCalledTimes(1)
      expect(mockInfo).toHaveBeenCalledWith('Bridge CLI already exists')
      expect(mockGetBridgeVersionFromLatestURL).not.toHaveBeenCalled()
    })

    test('should proceed with latest version fetch when in air gap mode but bridge does not exist', async () => {
      // Arrange
      const isAirGap = true
      const expectedVersion = '2.3.4'
      const expectedUrl = 'https://test.latest.pattern'

      mockCheckIfBridgeExistsInAirGap.mockResolvedValue(false)
      mockGetBridgeVersionFromLatestURL.mockResolvedValue(expectedVersion)

      // Act
      const result = await (bridgeClient as any).processLatestVersion(isAirGap)

      // Assert
      expect(result).toEqual({
        bridgeUrl: expectedUrl,
        bridgeVersion: expectedVersion
      })
      expect(mockCheckIfBridgeExistsInAirGap).toHaveBeenCalledTimes(1)
      expect(mockInfo).toHaveBeenCalledWith('Checking for latest version of Bridge to download and configure')
      expect(mockInfo).not.toHaveBeenCalledWith('Bridge CLI already exists')
      expect(mockGetBridgeVersionFromLatestURL).toHaveBeenCalledWith('https://test.artifactory.url/latest/versions.txt')
    })

    test('should proceed with latest version fetch when not in air gap mode', async () => {
      // Arrange
      const isAirGap = false
      const expectedVersion = '1.9.8'
      const expectedUrl = 'https://test.latest.pattern'

      mockGetBridgeVersionFromLatestURL.mockResolvedValue(expectedVersion)

      // Act
      const result = await (bridgeClient as any).processLatestVersion(isAirGap)

      // Assert
      expect(result).toEqual({
        bridgeUrl: expectedUrl,
        bridgeVersion: expectedVersion
      })
      expect(mockCheckIfBridgeExistsInAirGap).not.toHaveBeenCalled()
      expect(mockInfo).toHaveBeenCalledWith('Checking for latest version of Bridge to download and configure')
      expect(mockGetBridgeVersionFromLatestURL).toHaveBeenCalledWith('https://test.artifactory.url/latest/versions.txt')
    })

    test('should handle checkIfBridgeExistsInAirGap throwing an error', async () => {
      // Arrange
      const isAirGap = true
      const expectedError = new Error('Air gap check failed')

      mockCheckIfBridgeExistsInAirGap.mockRejectedValue(expectedError)

      // Act & Assert
      await expect((bridgeClient as any).processLatestVersion(isAirGap)).rejects.toThrow('Air gap check failed')
      expect(mockCheckIfBridgeExistsInAirGap).toHaveBeenCalledTimes(1)
      expect(mockGetBridgeVersionFromLatestURL).not.toHaveBeenCalled()
    })

    test('should handle getBridgeVersionFromLatestURL throwing an error', async () => {
      // Arrange
      const isAirGap = false
      const expectedError = new Error('Failed to fetch latest version')

      mockGetBridgeVersionFromLatestURL.mockRejectedValue(expectedError)

      // Act & Assert
      await expect((bridgeClient as any).processLatestVersion(isAirGap)).rejects.toThrow('Failed to fetch latest version')
      expect(mockGetBridgeVersionFromLatestURL).toHaveBeenCalledTimes(1)
    })

    test('should handle getBridgeVersionFromLatestURL returning empty string', async () => {
      // Arrange
      const isAirGap = false
      const expectedUrl = 'https://test.latest.pattern'

      mockGetBridgeVersionFromLatestURL.mockResolvedValue('')

      // Act
      const result = await (bridgeClient as any).processLatestVersion(isAirGap)

      // Assert
      expect(result).toEqual({
        bridgeUrl: expectedUrl,
        bridgeVersion: ''
      })
    })

    test('should use correct artifactory URL pattern for latest versions', async () => {
      // Arrange
      const isAirGap = false
      const expectedVersion = '3.2.1'

      mockGetBridgeVersionFromLatestURL.mockResolvedValue(expectedVersion)

      // Act
      await (bridgeClient as any).processLatestVersion(isAirGap)

      // Assert
      expect(mockGetBridgeVersionFromLatestURL).toHaveBeenCalledWith('https://test.artifactory.url/latest/versions.txt')
    })

    test('should return bridgeUrlLatestPattern as the bridge URL', async () => {
      // Arrange
      const isAirGap = false
      const expectedVersion = '4.1.0'
      const expectedUrl = 'https://test.latest.pattern'

      mockGetBridgeVersionFromLatestURL.mockResolvedValue(expectedVersion)

      // Act
      const result = await (bridgeClient as any).processLatestVersion(isAirGap)

      // Assert
      expect(result.bridgeUrl).toBe(expectedUrl)
    })

    test('should log info message when checking for latest version', async () => {
      // Arrange
      const isAirGap = false
      const expectedVersion = '5.0.0'

      mockGetBridgeVersionFromLatestURL.mockResolvedValue(expectedVersion)

      // Act
      await (bridgeClient as any).processLatestVersion(isAirGap)

      // Assert
      expect(mockInfo).toHaveBeenCalledWith('Checking for latest version of Bridge to download and configure')
    })

    test('should handle air gap mode with bridge existing - concurrent calls', async () => {
      // Arrange
      const isAirGap = true
      mockCheckIfBridgeExistsInAirGap.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(true), 10)))

      // Act
      const promise1 = (bridgeClient as any).processLatestVersion(isAirGap)
      const promise2 = (bridgeClient as any).processLatestVersion(isAirGap)

      const [result1, result2] = await Promise.all([promise1, promise2])

      // Assert
      expect(result1).toEqual({
        bridgeUrl: '',
        bridgeVersion: ''
      })
      expect(result2).toEqual({
        bridgeUrl: '',
        bridgeVersion: ''
      })
      expect(mockCheckIfBridgeExistsInAirGap).toHaveBeenCalledTimes(2)
      expect(mockInfo).toHaveBeenCalledWith('Bridge CLI already exists')
    })
  })

  describe('BridgeClientBase - downloadBridge Error Handling', () => {
    let bridgeClient: TestBridgeClient
    let mockGetRemoteFile: jest.Mock
    let mockCleanupTempDir: jest.Mock

    beforeEach(() => {
      jest.clearAllMocks()

      bridgeClient = new TestBridgeClient()

      // Mock the download utility functions
      const downloadUtility = require('../../../../src/blackduck-security-action/download-utility')
      mockGetRemoteFile = jest.fn()
      downloadUtility.getRemoteFile = mockGetRemoteFile

      // Mock the utility functions
      const utility = require('../../../../src/blackduck-security-action/utility')
      mockCleanupTempDir = jest.fn()
      utility.cleanupTempDir = mockCleanupTempDir
      utility.parseToBoolean = jest.fn(() => false)
      utility.checkIfPathExists = jest.fn(() => true)

      // Mock fs.existsSync to return false by default
      const fs = require('fs')
      fs.existsSync.mockReturnValue(false)
    })

    afterEach(() => {
      // Clean up environment variables
      delete process.env['RUNNER_OS']
    })

    describe('Error handling in downloadBridge method', () => {
      const tempDir = '/tmp/test-temp'

      it('should handle 404 error with RUNNER_OS set', async () => {
        // Arrange
        process.env['RUNNER_OS'] = 'Linux'
        const error404 = new Error('HTTP 404 Not Found')
        mockGetRemoteFile.mockRejectedValue(error404)

        // Mock getBridgeUrlAndVersion to return a valid URL
        jest.spyOn(bridgeClient as any, 'getBridgeUrlAndVersion').mockResolvedValue({
          bridgeUrl: 'https://test.url/bridge.zip',
          bridgeVersion: '1.0.0'
        })
        jest.spyOn(bridgeClient, 'isBridgeInstalled').mockResolvedValue(false)

        // Act & Assert
        await expect(bridgeClient.downloadBridge(tempDir)).rejects.toThrow('Provided Bridge CLI url is not valid for the configured Linux runner')

        expect(mockCleanupTempDir).toHaveBeenCalledWith(tempDir)
      })

      it('should handle 404 error without RUNNER_OS set', async () => {
        // Arrange
        const error404 = new Error('HTTP 404 Not Found')
        mockGetRemoteFile.mockRejectedValue(error404)

        jest.spyOn(bridgeClient as any, 'getBridgeUrlAndVersion').mockResolvedValue({
          bridgeUrl: 'https://test.url/bridge.zip',
          bridgeVersion: '1.0.0'
        })
        jest.spyOn(bridgeClient, 'isBridgeInstalled').mockResolvedValue(false)

        // Act & Assert
        await expect(bridgeClient.downloadBridge(tempDir)).rejects.toThrow('Provided Bridge CLI url is not valid for the configured  runner')

        expect(mockCleanupTempDir).toHaveBeenCalledWith(tempDir)
      })

      it('should handle invalid url error with RUNNER_OS set to Windows', async () => {
        // Arrange
        process.env['RUNNER_OS'] = 'Windows'
        const invalidUrlError = new Error('Invalid URL provided')
        mockGetRemoteFile.mockRejectedValue(invalidUrlError)

        jest.spyOn(bridgeClient as any, 'getBridgeUrlAndVersion').mockResolvedValue({
          bridgeUrl: 'https://test.url/bridge.zip',
          bridgeVersion: '1.0.0'
        })
        jest.spyOn(bridgeClient, 'isBridgeInstalled').mockResolvedValue(false)

        // Act & Assert
        await expect(bridgeClient.downloadBridge(tempDir)).rejects.toThrow('Provided Bridge CLI url is not valid for the configured Windows runner')

        expect(mockCleanupTempDir).toHaveBeenCalledWith(tempDir)
      })

      it('should handle case-insensitive invalid url error', async () => {
        // Arrange
        process.env['RUNNER_OS'] = 'macOS'
        const invalidUrlError = new Error('INVALID URL format')
        mockGetRemoteFile.mockRejectedValue(invalidUrlError)

        jest.spyOn(bridgeClient as any, 'getBridgeUrlAndVersion').mockResolvedValue({
          bridgeUrl: 'https://test.url/bridge.zip',
          bridgeVersion: '1.0.0'
        })
        jest.spyOn(bridgeClient, 'isBridgeInstalled').mockResolvedValue(false)

        // Act & Assert
        await expect(bridgeClient.downloadBridge(tempDir)).rejects.toThrow('Provided Bridge CLI url is not valid for the configured macOS runner')

        expect(mockCleanupTempDir).toHaveBeenCalledWith(tempDir)
      })

      it('should handle empty response error', async () => {
        // Arrange
        const emptyError = new Error('Response is empty')
        mockGetRemoteFile.mockRejectedValue(emptyError)

        jest.spyOn(bridgeClient as any, 'getBridgeUrlAndVersion').mockResolvedValue({
          bridgeUrl: 'https://test.url/bridge.zip',
          bridgeVersion: '1.0.0'
        })
        jest.spyOn(bridgeClient, 'isBridgeInstalled').mockResolvedValue(false)

        // Act & Assert
        await expect(bridgeClient.downloadBridge(tempDir)).rejects.toThrow('Provided Bridge CLI URL cannot be empty ')

        expect(mockCleanupTempDir).toHaveBeenCalledWith(tempDir)
      })

      it('should handle case-insensitive empty response error', async () => {
        // Arrange
        const emptyError = new Error('EMPTY response received')
        mockGetRemoteFile.mockRejectedValue(emptyError)

        jest.spyOn(bridgeClient as any, 'getBridgeUrlAndVersion').mockResolvedValue({
          bridgeUrl: 'https://test.url/bridge.zip',
          bridgeVersion: '1.0.0'
        })
        jest.spyOn(bridgeClient, 'isBridgeInstalled').mockResolvedValue(false)

        // Act & Assert
        await expect(bridgeClient.downloadBridge(tempDir)).rejects.toThrow('Provided Bridge CLI URL cannot be empty ')

        expect(mockCleanupTempDir).toHaveBeenCalledWith(tempDir)
      })

      it('should handle generic error without special keywords', async () => {
        // Arrange
        const genericError = new Error('Network timeout occurred')
        mockGetRemoteFile.mockRejectedValue(genericError)

        jest.spyOn(bridgeClient as any, 'getBridgeUrlAndVersion').mockResolvedValue({
          bridgeUrl: 'https://test.url/bridge.zip',
          bridgeVersion: '1.0.0'
        })
        jest.spyOn(bridgeClient, 'isBridgeInstalled').mockResolvedValue(false)

        // Act & Assert
        await expect(bridgeClient.downloadBridge(tempDir)).rejects.toThrow('Network timeout occurred')

        expect(mockCleanupTempDir).toHaveBeenCalledWith(tempDir)
      })

      it('should handle error with both 404 and empty keywords (404 takes precedence)', async () => {
        // Arrange
        process.env['RUNNER_OS'] = 'Linux'
        const mixedError = new Error('HTTP 404 error - empty response')
        mockGetRemoteFile.mockRejectedValue(mixedError)

        jest.spyOn(bridgeClient as any, 'getBridgeUrlAndVersion').mockResolvedValue({
          bridgeUrl: 'https://test.url/bridge.zip',
          bridgeVersion: '1.0.0'
        })
        jest.spyOn(bridgeClient, 'isBridgeInstalled').mockResolvedValue(false)

        // Act & Assert
        await expect(bridgeClient.downloadBridge(tempDir)).rejects.toThrow('Provided Bridge CLI url is not valid for the configured Linux runner')

        expect(mockCleanupTempDir).toHaveBeenCalledWith(tempDir)
      })

      it('should verify cleanup is called for all error scenarios', async () => {
        // Arrange
        const testError = new Error('Test error')
        mockGetRemoteFile.mockRejectedValue(testError)

        jest.spyOn(bridgeClient as any, 'getBridgeUrlAndVersion').mockResolvedValue({
          bridgeUrl: 'https://test.url/bridge.zip',
          bridgeVersion: '1.0.0'
        })
        jest.spyOn(bridgeClient, 'isBridgeInstalled').mockResolvedValue(false)

        // Act & Assert
        await expect(bridgeClient.downloadBridge(tempDir)).rejects.toThrow()

        // Verify cleanup was called with correct parameters
        expect(mockCleanupTempDir).toHaveBeenCalledWith(tempDir)
        expect(mockCleanupTempDir).toHaveBeenCalledTimes(1)
      })
    })
  })
})

describe('BridgeClientBase - getBridgeUrlAndVersion BRIDGE_CLI_DOWNLOAD_URL conditional logic', () => {
  let bridgeClient: TestBridgeClient
  let mockDebug: jest.SpyInstance
  let mockProcessDownloadUrl: jest.SpyInstance
  let mockProcessVersion: jest.SpyInstance
  let mockProcessLatestVersion: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    bridgeClient = new TestBridgeClient()

    // Mock the core debug function
    const core = require('@actions/core')
    mockDebug = jest.spyOn(core, 'debug')

    // Mock the private methods
    mockProcessDownloadUrl = jest.spyOn(bridgeClient as any, 'processDownloadUrl')
    mockProcessVersion = jest.spyOn(bridgeClient as any, 'processVersion')
    mockProcessLatestVersion = jest.spyOn(bridgeClient as any, 'processLatestVersion')

    // Reset mock inputs to default values
    setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', '')
    setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', '')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('BRIDGE_CLI_DOWNLOAD_URL condition', () => {
    test('should call processDownloadUrl and log debug message when BRIDGE_CLI_DOWNLOAD_URL is provided', async () => {
      // Arrange
      const testUrl = 'https://example.com/bridge-cli.zip'
      const expectedResult = {
        bridgeUrl: testUrl,
        bridgeVersion: '1.2.3'
      }

      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', testUrl)
      mockProcessDownloadUrl.mockResolvedValue(expectedResult)

      // Act
      const result = await (bridgeClient as any).getBridgeUrlAndVersion(false)

      // Assert
      expect(mockDebug).toHaveBeenCalledWith(`Bridge CLI download URL: ${testUrl}`)
      expect(mockDebug).toHaveBeenCalledWith('Using provided Bridge CLI download URL')
      expect(mockProcessDownloadUrl).toHaveBeenCalledTimes(1)
      expect(mockProcessVersion).not.toHaveBeenCalled()
      expect(mockProcessLatestVersion).not.toHaveBeenCalled()
      expect(result).toEqual(expectedResult)
    })

    test('should call processDownloadUrl when BRIDGE_CLI_DOWNLOAD_URL is non-empty string', async () => {
      // Arrange
      const testUrl = 'https://custom-artifactory.com/bridge/bridge-cli-2.1.0.zip'
      const expectedResult = {
        bridgeUrl: testUrl,
        bridgeVersion: '2.1.0'
      }

      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', testUrl)
      mockProcessDownloadUrl.mockResolvedValue(expectedResult)

      // Act
      const result = await (bridgeClient as any).getBridgeUrlAndVersion(true)

      // Assert
      expect(mockDebug).toHaveBeenCalledWith(`Bridge CLI download URL: ${testUrl}`)
      expect(mockDebug).toHaveBeenCalledWith('Using provided Bridge CLI download URL')
      expect(mockProcessDownloadUrl).toHaveBeenCalledTimes(1)
      expect(result).toEqual(expectedResult)
    })

    test('should handle processDownloadUrl throwing an error', async () => {
      // Arrange
      const testUrl = 'https://invalid-url.com/bridge-cli.zip'
      const testError = new Error('Invalid download URL')

      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', testUrl)
      mockProcessDownloadUrl.mockRejectedValue(testError)

      // Act & Assert
      await expect((bridgeClient as any).getBridgeUrlAndVersion(false)).rejects.toThrow('Invalid download URL')

      expect(mockDebug).toHaveBeenCalledWith(`Bridge CLI download URL: ${testUrl}`)
      expect(mockDebug).toHaveBeenCalledWith('Using provided Bridge CLI download URL')
      expect(mockProcessDownloadUrl).toHaveBeenCalledTimes(1)
      expect(mockProcessVersion).not.toHaveBeenCalled()
      expect(mockProcessLatestVersion).not.toHaveBeenCalled()
    })

    test('should prioritize BRIDGE_CLI_DOWNLOAD_URL over BRIDGE_CLI_DOWNLOAD_VERSION', async () => {
      // Arrange
      const testUrl = 'https://example.com/bridge-cli.zip'
      const testVersion = '1.5.0'
      const expectedResult = {
        bridgeUrl: testUrl,
        bridgeVersion: '1.2.3'
      }

      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', testUrl)
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', testVersion)
      mockProcessDownloadUrl.mockResolvedValue(expectedResult)

      // Act
      const result = await (bridgeClient as any).getBridgeUrlAndVersion(false)

      // Assert
      expect(mockDebug).toHaveBeenCalledWith(`Bridge CLI download URL: ${testUrl}`)
      expect(mockDebug).toHaveBeenCalledWith('Using provided Bridge CLI download URL')
      expect(mockProcessDownloadUrl).toHaveBeenCalledTimes(1)
      expect(mockProcessVersion).not.toHaveBeenCalled()
      expect(mockProcessLatestVersion).not.toHaveBeenCalled()
      expect(result).toEqual(expectedResult)
    })

    test('should work correctly in air gap mode when BRIDGE_CLI_DOWNLOAD_URL is provided', async () => {
      // Arrange
      const testUrl = 'https://internal-repo.com/bridge-cli.zip'
      const expectedResult = {
        bridgeUrl: testUrl,
        bridgeVersion: '2.0.0'
      }

      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', testUrl)
      mockProcessDownloadUrl.mockResolvedValue(expectedResult)

      // Act
      const result = await (bridgeClient as any).getBridgeUrlAndVersion(true)

      // Assert
      expect(mockDebug).toHaveBeenCalledWith(`Bridge CLI download URL: ${testUrl}`)
      expect(mockDebug).toHaveBeenCalledWith('Using provided Bridge CLI download URL')
      expect(mockProcessDownloadUrl).toHaveBeenCalledTimes(1)
      expect(mockProcessLatestVersion).not.toHaveBeenCalled()
      expect(result).toEqual(expectedResult)
    })
  })

  describe('Fallback behavior when BRIDGE_CLI_DOWNLOAD_URL is not provided', () => {
    test('should call processVersion when BRIDGE_CLI_DOWNLOAD_VERSION is provided and BRIDGE_CLI_DOWNLOAD_URL is empty', async () => {
      // Arrange
      const testVersion = '1.5.0'
      const expectedResult = {
        bridgeUrl: 'https://example.com/bridge-1.5.0.zip',
        bridgeVersion: testVersion
      }

      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', '')
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', testVersion)
      mockProcessVersion.mockResolvedValue(expectedResult)

      // Act
      const result = await (bridgeClient as any).getBridgeUrlAndVersion(false)

      // Assert
      expect(mockDebug).toHaveBeenCalledWith('Bridge CLI download URL: ')
      expect(mockDebug).toHaveBeenCalledWith(`Using specified Bridge CLI version: ${testVersion}`)
      expect(mockProcessDownloadUrl).not.toHaveBeenCalled()
      expect(mockProcessVersion).toHaveBeenCalledTimes(1)
      expect(mockProcessLatestVersion).not.toHaveBeenCalled()
      expect(result).toEqual(expectedResult)
    })

    test('should call processLatestVersion when neither URL nor version is provided', async () => {
      // Arrange
      const expectedResult = {
        bridgeUrl: 'https://example.com/bridge-latest.zip',
        bridgeVersion: '2.0.0'
      }

      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', '')
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', '')
      mockProcessLatestVersion.mockResolvedValue(expectedResult)

      // Act
      const result = await (bridgeClient as any).getBridgeUrlAndVersion(false)

      // Assert
      expect(mockDebug).toHaveBeenCalledWith('Bridge CLI download URL: ')
      expect(mockDebug).toHaveBeenCalledWith('No specific URL or version provided, using latest version')
      expect(mockProcessDownloadUrl).not.toHaveBeenCalled()
      expect(mockProcessVersion).not.toHaveBeenCalled()
      expect(mockProcessLatestVersion).toHaveBeenCalledWith(false)
      expect(result).toEqual(expectedResult)
    })

    test('should handle null BRIDGE_CLI_DOWNLOAD_URL correctly', async () => {
      // Arrange
      const testVersion = '1.5.0'
      const expectedResult = {
        bridgeUrl: 'https://example.com/bridge-1.5.0.zip',
        bridgeVersion: testVersion
      }

      // Simulate null value (which would be converted to empty string)
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', '')
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', testVersion)
      mockProcessVersion.mockResolvedValue(expectedResult)

      // Act
      const result = await (bridgeClient as any).getBridgeUrlAndVersion(false)

      // Assert
      expect(mockProcessDownloadUrl).not.toHaveBeenCalled()
      expect(mockProcessVersion).toHaveBeenCalledTimes(1)
      expect(result).toEqual(expectedResult)
    })
  })

  describe('Input validation and edge cases', () => {
    test('should handle whitespace-only BRIDGE_CLI_DOWNLOAD_URL as non-empty', async () => {
      // Arrange
      const testUrl = '   '
      const expectedResult = {
        bridgeUrl: testUrl,
        bridgeVersion: '1.0.0'
      }

      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', testUrl)
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', '1.5.0')
      mockProcessDownloadUrl.mockResolvedValue(expectedResult)

      // Act
      const result = await (bridgeClient as any).getBridgeUrlAndVersion(false)

      // Assert
      expect(mockDebug).toHaveBeenCalledWith('Bridge CLI download URL:    ')
      expect(mockDebug).toHaveBeenCalledWith('Using provided Bridge CLI download URL')
      // Since whitespace is truthy in JavaScript, it should call processDownloadUrl
      expect(mockProcessDownloadUrl).toHaveBeenCalledTimes(1)
      expect(mockProcessVersion).not.toHaveBeenCalled()
      expect(result).toEqual(expectedResult)
    })

    test('should log correct debug messages for each path', async () => {
      // Test URL path
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', 'https://test.com/bridge.zip')
      mockProcessDownloadUrl.mockResolvedValue({bridgeUrl: 'test', bridgeVersion: '1.0.0'})

      await (bridgeClient as any).getBridgeUrlAndVersion(false)

      expect(mockDebug).toHaveBeenCalledWith('Bridge CLI download URL: https://test.com/bridge.zip')
      expect(mockDebug).toHaveBeenCalledWith('Using provided Bridge CLI download URL')

      // Reset mocks for next test
      jest.clearAllMocks()

      // Test version path
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', '')
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', '2.0.0')
      mockProcessVersion.mockResolvedValue({bridgeUrl: 'test', bridgeVersion: '2.0.0'})

      await (bridgeClient as any).getBridgeUrlAndVersion(false)

      expect(mockDebug).toHaveBeenCalledWith('Bridge CLI download URL: ')
      expect(mockDebug).toHaveBeenCalledWith('Using specified Bridge CLI version: 2.0.0')

      // Reset mocks for next test
      jest.clearAllMocks()

      // Test latest version path
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', '')
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', '')
      mockProcessLatestVersion.mockResolvedValue({bridgeUrl: 'test', bridgeVersion: '3.0.0'})

      await (bridgeClient as any).getBridgeUrlAndVersion(false)

      expect(mockDebug).toHaveBeenCalledWith('Bridge CLI download URL: ')
      expect(mockDebug).toHaveBeenCalledWith('No specific URL or version provided, using latest version')
    })
  })
})

describe('BridgeClientBase - getBridgeVersionFromLatestURL HTTP 200 Response Handling', () => {
  let bridgeClient: TestBridgeClient
  let mockMakeHttpsGetRequest: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    bridgeClient = new TestBridgeClient()

    // Mock the private makeHttpsGetRequest method
    mockMakeHttpsGetRequest = jest.spyOn(bridgeClient as any, 'makeHttpsGetRequest')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('should parse bridge version from response body when status code is 200', async () => {
    // Arrange
    const latestVersionsUrl = 'https://example.com/versions.txt'
    const mockResponseBody = `bridge-cli-bundle: 2.3.1`

    mockMakeHttpsGetRequest.mockResolvedValue({
      statusCode: 200,
      body: mockResponseBody
    })

    // Act
    const result = await bridgeClient.getBridgeVersionFromLatestURL(latestVersionsUrl)

    // Assert
    expect(result).toBe('2.3.1')
    expect(mockMakeHttpsGetRequest).toHaveBeenCalledWith(latestVersionsUrl)
  })

  test('should handle bridge version with whitespace in response body', async () => {
    // Arrange
    const latestVersionsUrl = 'https://example.com/versions.txt'
    const mockResponseBody = `
      some-tool: 1.0.0
      bridge-cli-bundle:   3.4.5
      other-tool: 2.0.0
    `

    mockMakeHttpsGetRequest.mockResolvedValue({
      statusCode: 200,
      body: mockResponseBody
    })

    // Act
    const result = await bridgeClient.getBridgeVersionFromLatestURL(latestVersionsUrl)

    // Assert
    expect(result).toBe('3.4.5')
  })

  test('should return first matching bridge-cli-bundle version when multiple entries exist', async () => {
    // Arrange
    const latestVersionsUrl = 'https://example.com/versions.txt'
    const mockResponseBody = `
      bridge-cli-bundle: 1.0.0
      some-tool: 2.0.0
      bridge-cli-bundle: 3.0.0
    `

    mockMakeHttpsGetRequest.mockResolvedValue({
      statusCode: 200,
      body: mockResponseBody
    })

    // Act
    const result = await bridgeClient.getBridgeVersionFromLatestURL(latestVersionsUrl)

    // Assert
    expect(result).toBe('1.0.0')
  })

  test('should return empty string when bridge-cli-bundle not found in response', async () => {
    // Arrange
    const latestVersionsUrl = 'https://example.com/versions.txt'
    const mockResponseBody = `
      some-tool: 1.0.0
      other-tool: 2.0.0
      different-bridge: 3.0.0
    `

    mockMakeHttpsGetRequest.mockResolvedValue({
      statusCode: 200,
      body: mockResponseBody
    })

    // Act
    const result = await bridgeClient.getBridgeVersionFromLatestURL(latestVersionsUrl)

    // Assert
    expect(result).toBe('')
  })

  test('should handle response body with only bridge-cli-bundle entry', async () => {
    // Arrange
    const latestVersionsUrl = 'https://example.com/versions.txt'
    const mockResponseBody = 'bridge-cli-bundle: 4.2.1'

    mockMakeHttpsGetRequest.mockResolvedValue({
      statusCode: 200,
      body: mockResponseBody
    })

    // Act
    const result = await bridgeClient.getBridgeVersionFromLatestURL(latestVersionsUrl)

    // Assert
    expect(result).toBe('4.2.1')
  })

  test('should handle empty response body', async () => {
    // Arrange
    const latestVersionsUrl = 'https://example.com/versions.txt'
    const mockResponseBody = ''

    mockMakeHttpsGetRequest.mockResolvedValue({
      statusCode: 200,
      body: mockResponseBody
    })

    // Act
    const result = await bridgeClient.getBridgeVersionFromLatestURL(latestVersionsUrl)

    // Assert
    expect(result).toBe('')
  })

  test('should handle malformed bridge-cli-bundle line without colon', async () => {
    // Arrange
    const latestVersionsUrl = 'https://example.com/versions.txt'
    const mockResponseBody = `
      bridge-cli-bundle-invalid-format
    `

    mockMakeHttpsGetRequest.mockResolvedValue({
      statusCode: 200,
      body: mockResponseBody
    })

    // Act
    const result = await bridgeClient.getBridgeVersionFromLatestURL(latestVersionsUrl)

    // Assert
    expect(result).toBe('')
  })

  test('should trim response body before processing', async () => {
    // Arrange
    const latestVersionsUrl = 'https://example.com/versions.txt'
    const mockResponseBody = `
      bridge-cli-bundle: 5.1.0
    ` // Response with leading/trailing whitespace

    mockMakeHttpsGetRequest.mockResolvedValue({
      statusCode: 200,
      body: mockResponseBody
    })

    // Act
    const result = await bridgeClient.getBridgeVersionFromLatestURL(latestVersionsUrl)

    // Assert
    expect(result).toBe('5.1.0')
  })

  test('should reset retry count to 0 when status code is 200', async () => {
    // Arrange
    const latestVersionsUrl = 'https://example.com/versions.txt'
    const mockResponseBody = 'bridge-cli-bundle: 1.5.0'

    // Mock multiple calls to simulate retry scenario followed by success
    mockMakeHttpsGetRequest
      .mockResolvedValueOnce({statusCode: 500, body: ''}) // First call fails
      .mockResolvedValueOnce({statusCode: 200, body: mockResponseBody}) // Second call succeeds

    // Act
    const result = await bridgeClient.getBridgeVersionFromLatestURL(latestVersionsUrl)

    // Assert
    expect(result).toBe('1.5.0')
    expect(mockMakeHttpsGetRequest).toHaveBeenCalledTimes(2)
  })
})
