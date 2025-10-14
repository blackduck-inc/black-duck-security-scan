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
  BRIDGE_CLI_ARTIFACTORY_URL: 'https://repo.blackduck.com/bds-integrations-release/com/blackduck/integration/bridge/binaries/',
  POLARIS_SERVER_URL_KEY: 'POLARIS_SERVER_URL',
  COVERITY_URL_KEY: 'COVERITY_URL',
  BLACKDUCKSCA_URL_KEY: 'BLACKDUCKSCA_URL',
  SRM_URL_KEY: 'SRM_URL',
  // Add platform name constants
  MAC_PLATFORM_NAME: 'darwin',
  LINUX_PLATFORM_NAME: 'linux',
  WINDOWS_PLATFORM_NAME: 'win32',
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
  public callGetBridgeCLIDownloadPathCommon(includeBridgeType = false): string {
    return this.getBridgeCLIDownloadPathCommon(includeBridgeType)
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
    return /test-pattern/
  }

  protected getBridgeCLIDownloadDefaultPath(): string {
    return '/test/download/path'
  }

  protected initializeUrls(): void {
    this.bridgeArtifactoryURL = 'https://test.artifactory.url/'
    this.bridgeUrlPattern = 'https://test.url.pattern'
    this.bridgeUrlLatestPattern = 'https://test.latest.pattern'
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

    it('should download bridge successfully when air gap mode is true', async () => {
      // Arrange
      const tempDir = '/tmp/test'
      const mockDownloadResponse: DownloadFileResponse = {
        filePath: '/tmp/bridge.zip',
        fileName: 'https://test.url/bridge.zip'
      }
      setMockInputValue('ENABLE_NETWORK_AIR_GAP', 'true')
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

  describe('when both BRIDGE_CLI_BASE_URL and BRIDGE_CLI_DOWNLOAD_URL are provided', () => {
    it('should prioritize BRIDGE_CLI_BASE_URL and show warning about BRIDGE_CLI_DOWNLOAD_URL being ignored', async () => {
      // Arrange
      setMockInputValue('BRIDGE_CLI_BASE_URL', 'https://test.base.url/')
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', 'https://test.download.url/bridge.zip')
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', '1.2.3')

      const mockProcessVersion = jest.spyOn(bridgeClient as any, 'processVersion')
      mockProcessVersion.mockResolvedValue({
        bridgeUrl: 'https://test.base.url/bridge-1.2.3.zip',
        bridgeVersion: '1.2.3'
      })

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
      mockProcessVersion.mockResolvedValue({
        bridgeUrl: 'https://test.base.url/bridge-2.1.0.zip',
        bridgeVersion: '2.1.0'
      })

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
      mockProcessLatestVersion.mockResolvedValue({
        bridgeUrl: 'https://test.base.url/bridge-latest.zip',
        bridgeVersion: '3.0.0'
      })

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
      mockProcessLatestVersion.mockResolvedValue({
        bridgeUrl: 'https://test.base.url/bridge-latest.zip',
        bridgeVersion: '3.0.0'
      })

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
      mockProcessDownloadUrl.mockResolvedValue({
        bridgeUrl: 'https://test.download.url/bridge-1.5.0.zip',
        bridgeVersion: '1.5.0'
      })

      // Act
      const result = await (bridgeClient as any).getBridgeUrlAndVersion(false)

      // Assert
      expect(result).toEqual({bridgeUrl: 'https://test.download.url/bridge-1.5.0.zip', bridgeVersion: '1.5.0'})
      expect(mockInfo).toHaveBeenCalledWith('BRIDGE_CLI_DOWNLOAD_URL is deprecated and will be removed in a future version. Please use BRIDGE_CLI_DOWNLOAD_VERSION instead along with BRIDGE_CLI_BASE_URL.')
      expect(mockProcessDownloadUrl).toHaveBeenCalled()
    })
  })

  describe('when only BRIDGE_CLI_DOWNLOAD_VERSION is provided', () => {
    it('should use processVersion in non-airgap mode', async () => {
      // Arrange
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', '1.8.0')

      const mockProcessVersion = jest.spyOn(bridgeClient as any, 'processVersion')
      mockProcessVersion.mockResolvedValue({
        bridgeUrl: 'https://default.url/bridge-1.8.0.zip',
        bridgeVersion: '1.8.0'
      })

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
      mockProcessVersion.mockResolvedValue({
        bridgeUrl: 'https://test.base.url/bridge-1.8.0.zip',
        bridgeVersion: '1.8.0'
      })

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
      mockProcessLatestVersion.mockResolvedValue({
        bridgeUrl: 'https://default.url/bridge-latest.zip',
        bridgeVersion: '2.5.0'
      })

      // Act
      const result = await (bridgeClient as any).getBridgeUrlAndVersion(false)

      // Assert
      expect(result).toEqual({bridgeUrl: 'https://default.url/bridge-latest.zip', bridgeVersion: '2.5.0'})
      expect(mockInfo).toHaveBeenCalledWith('No specific Bridge CLI version provided, fetching the latest version.')
      expect(mockProcessLatestVersion).toHaveBeenCalledWith(false)
    })

    it('should fetch latest version in airgap mode', async () => {
      // Arrange - all inputs are empty by default

      const mockProcessLatestVersion = jest.spyOn(bridgeClient as any, 'processLatestVersion')
      mockProcessLatestVersion.mockResolvedValue({
        bridgeUrl: 'https://default.url/bridge-latest.zip',
        bridgeVersion: '2.5.0'
      })

      // Act
      const result = await (bridgeClient as any).getBridgeUrlAndVersion(true)

      // Assert
      expect(result).toEqual({bridgeUrl: 'https://default.url/bridge-latest.zip', bridgeVersion: '2.5.0'})
      expect(mockInfo).toHaveBeenCalledWith('No specific Bridge CLI version provided, fetching the latest version.')
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
      mockUpdateBridgeCLIVersion.mockResolvedValue({
        bridgeUrl: 'https://test.url/bridge-1.5.0.zip',
        bridgeVersion: '1.5.0'
      })

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
      mockProcessLatestVersion.mockResolvedValue({
        bridgeUrl: 'https://default.url/bridge-latest.zip',
        bridgeVersion: '2.0.0'
      })

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
})
