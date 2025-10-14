import {BridgeClientBase} from '../../../../src/blackduck-security-action/bridge/bridge-client-base'
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
  MAC_PLATFORM_NAME: 'darwin',
  LINUX_PLATFORM_NAME: 'linux',
  WINDOWS_PLATFORM_NAME: 'win32',
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
    BRIDGE_CLI_INSTALL_DIRECTORY_KEY: '',
    INCLUDE_DIAGNOSTICS: ''
  }

  const mockInputs: any = {}
  Object.keys(mockState).forEach(key => {
    Object.defineProperty(mockInputs, key, {
      get: () => mockState[key],
      enumerable: true,
      configurable: true
    })
  })

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

describe('BridgeClientBase - Air Gap Mode Tests', () => {
  let bridgeClient: TestBridgeClient
  let mockParseToBoolean: jest.SpyInstance
  let mockInfo: jest.SpyInstance
  let mockCheckIfBridgeExistsInAirGap: jest.SpyInstance
  let mockGetBridgeUrlAndVersion: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()

    bridgeClient = new TestBridgeClient()

    const utility = require('../../../../src/blackduck-security-action/utility')
    const core = require('@actions/core')

    mockParseToBoolean = jest.spyOn(utility, 'parseToBoolean')
    mockInfo = jest.spyOn(core, 'info')
    mockCheckIfBridgeExistsInAirGap = jest.spyOn(bridgeClient as any, 'checkIfBridgeExistsInAirGap')
    mockGetBridgeUrlAndVersion = jest.spyOn(bridgeClient as any, 'getBridgeUrlAndVersion')

    // Reset mock inputs to default values
    setMockInputValue('POLARIS_SERVER_URL', '')
    setMockInputValue('COVERITY_URL', '')
    setMockInputValue('BLACKDUCKSCA_URL', '')
    setMockInputValue('SRM_URL', '')
    setMockInputValue('BRIDGE_CLI_BASE_URL', '')
    setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', '')
    setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', '')
    setMockInputValue('ENABLE_NETWORK_AIR_GAP', '')
  })

  describe('downloadBridge in Air Gap Mode', () => {
    it('should handle air gap mode when bridge exists and no base URL provided', async () => {
      // Arrange
      const tempDir = '/tmp/test'
      mockParseToBoolean.mockReturnValue(true) // Air gap enabled
      mockCheckIfBridgeExistsInAirGap.mockResolvedValue(true)
      setMockInputValue('BRIDGE_CLI_BASE_URL', '') // No base URL

      // Act
      await bridgeClient.downloadBridge(tempDir)

      // Assert
      expect(mockInfo).toHaveBeenCalledWith('Network air gap is enabled.')
      expect(mockInfo).toHaveBeenCalledWith('Bridge CLI already exists')
      expect(mockCheckIfBridgeExistsInAirGap).toHaveBeenCalled()
      expect(mockGetBridgeUrlAndVersion).not.toHaveBeenCalled()
    })

    it('should proceed with download when air gap mode is enabled but bridge does not exist', async () => {
      // Arrange
      const tempDir = '/tmp/test'
      const mockDownloadResponse: DownloadFileResponse = {
        filePath: '/tmp/bridge.zip',
        fileName: 'https://test.url/bridge.zip'
      }

      mockParseToBoolean.mockReturnValue(true) // Air gap enabled
      mockCheckIfBridgeExistsInAirGap.mockResolvedValue(false)
      setMockInputValue('BRIDGE_CLI_BASE_URL', 'https://airgap.example.com')

      mockGetBridgeUrlAndVersion.mockResolvedValue({
        bridgeUrl: 'https://airgap.example.com/bridge.zip',
        bridgeVersion: '1.2.3'
      })

      jest.spyOn(bridgeClient, 'isBridgeInstalled').mockResolvedValue(false)
      jest.spyOn(bridgeClient as any, 'handleBridgeDownload').mockResolvedValue(undefined)

      const mockGetRemoteFile = jest.spyOn(require('../../../../src/blackduck-security-action/download-utility'), 'getRemoteFile')
      mockGetRemoteFile.mockResolvedValue(mockDownloadResponse)

      const mockExistsSync = jest.spyOn(require('fs'), 'existsSync')
      mockExistsSync.mockReturnValue(false)

      // Act
      await bridgeClient.downloadBridge(tempDir)

      // Assert
      expect(mockInfo).toHaveBeenCalledWith('Network air gap is enabled.')
      expect(mockCheckIfBridgeExistsInAirGap).toHaveBeenCalled()
      expect(mockGetBridgeUrlAndVersion).toHaveBeenCalledWith(true) // Air gap flag passed as true
      expect(mockInfo).toHaveBeenCalledWith('Bridge CLI version is - 1.2.3')
      expect(mockInfo).toHaveBeenCalledWith('Downloading and configuring Bridge from URL - https://airgap.example.com/bridge.zip')
      expect(mockInfo).toHaveBeenCalledWith('Download and configuration of Bridge CLI completed')
    })

    it('should proceed with download when air gap mode is enabled with base URL provided', async () => {
      // Arrange
      const tempDir = '/tmp/test'
      const mockDownloadResponse: DownloadFileResponse = {
        filePath: '/tmp/bridge.zip',
        fileName: 'https://airgap.example.com/bridge.zip'
      }

      mockParseToBoolean.mockReturnValue(true) // Air gap enabled
      mockCheckIfBridgeExistsInAirGap.mockResolvedValue(false)
      setMockInputValue('BRIDGE_CLI_BASE_URL', 'https://airgap.example.com') // Base URL provided

      mockGetBridgeUrlAndVersion.mockResolvedValue({
        bridgeUrl: 'https://airgap.example.com/bridge.zip',
        bridgeVersion: '2.1.0'
      })

      jest.spyOn(bridgeClient, 'isBridgeInstalled').mockResolvedValue(false)
      jest.spyOn(bridgeClient as any, 'handleBridgeDownload').mockResolvedValue(undefined)

      const mockGetRemoteFile = jest.spyOn(require('../../../../src/blackduck-security-action/download-utility'), 'getRemoteFile')
      mockGetRemoteFile.mockResolvedValue(mockDownloadResponse)

      const mockExistsSync = jest.spyOn(require('fs'), 'existsSync')
      mockExistsSync.mockReturnValue(false)

      // Act
      await bridgeClient.downloadBridge(tempDir)

      // Assert
      expect(mockInfo).toHaveBeenCalledWith('Network air gap is enabled.')
      expect(mockCheckIfBridgeExistsInAirGap).toHaveBeenCalled()
      expect(mockGetBridgeUrlAndVersion).toHaveBeenCalledWith(true) // Air gap flag passed as true
      expect(mockInfo).toHaveBeenCalledWith('Bridge CLI version is - 2.1.0')
      expect(mockGetRemoteFile).toHaveBeenCalledWith(tempDir, 'https://airgap.example.com/bridge.zip')
    })

    it('should skip download when air gap mode and bridge already installed', async () => {
      // Arrange
      const tempDir = '/tmp/test'
      mockParseToBoolean.mockReturnValue(true) // Air gap enabled
      mockCheckIfBridgeExistsInAirGap.mockResolvedValue(false)
      setMockInputValue('BRIDGE_CLI_BASE_URL', 'https://airgap.example.com')

      mockGetBridgeUrlAndVersion.mockResolvedValue({
        bridgeUrl: 'https://airgap.example.com/bridge.zip',
        bridgeVersion: '1.5.0'
      })

      jest.spyOn(bridgeClient, 'isBridgeInstalled').mockResolvedValue(true) // Already installed

      // Act
      await bridgeClient.downloadBridge(tempDir)

      // Assert
      expect(mockInfo).toHaveBeenCalledWith('Network air gap is enabled.')
      expect(mockInfo).toHaveBeenCalledWith('Bridge CLI version is - 1.5.0')
      expect(mockInfo).toHaveBeenCalledWith('Bridge CLI already exists')
      expect(mockCheckIfBridgeExistsInAirGap).toHaveBeenCalled()
    })

    it('should handle empty bridge URL in air gap mode', async () => {
      // Arrange
      const tempDir = '/tmp/test'
      mockParseToBoolean.mockReturnValue(true) // Air gap enabled
      mockCheckIfBridgeExistsInAirGap.mockResolvedValue(false)
      setMockInputValue('BRIDGE_CLI_BASE_URL', 'https://airgap.example.com')

      mockGetBridgeUrlAndVersion.mockResolvedValue({
        bridgeUrl: '', // Empty URL
        bridgeVersion: '1.0.0'
      })

      // Act
      await bridgeClient.downloadBridge(tempDir)

      // Assert
      expect(mockInfo).toHaveBeenCalledWith('Network air gap is enabled.')
      expect(mockInfo).toHaveBeenCalledWith('Bridge CLI version is - 1.0.0')
      expect(mockCheckIfBridgeExistsInAirGap).toHaveBeenCalled()
      // Should return early without attempting download
    })
  })

  describe('getBridgeUrlAndVersion in Air Gap Mode', () => {
    it('should call processLatestVersion with air gap flag when no version specified', async () => {
      // Arrange
      setMockInputValue('BRIDGE_CLI_BASE_URL', 'https://airgap.example.com')
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', '')

      const mockProcessLatestVersion = jest.spyOn(bridgeClient as any, 'processLatestVersion')
      mockProcessLatestVersion.mockResolvedValue({
        bridgeUrl: 'https://airgap.example.com/bridge-latest.zip',
        bridgeVersion: '2.0.0'
      })

      // Act
      const result = await (bridgeClient as any).getBridgeUrlAndVersion(true)

      // Assert
      expect(result).toEqual({
        bridgeUrl: 'https://airgap.example.com/bridge-latest.zip',
        bridgeVersion: '2.0.0'
      })
      expect(mockProcessLatestVersion).toHaveBeenCalledWith(true) // Air gap flag should be true
    })

    it('should call processVersion in air gap mode with specific version', async () => {
      // Arrange
      setMockInputValue('BRIDGE_CLI_BASE_URL', 'https://airgap.example.com')
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', '1.8.0')

      const mockProcessVersion = jest.spyOn(bridgeClient as any, 'processVersion')
      mockProcessVersion.mockResolvedValue({
        bridgeUrl: 'https://airgap.example.com/bridge-1.8.0.zip',
        bridgeVersion: '1.8.0'
      })

      // Act
      const result = await (bridgeClient as any).getBridgeUrlAndVersion(true)

      // Assert
      expect(result).toEqual({
        bridgeUrl: 'https://airgap.example.com/bridge-1.8.0.zip',
        bridgeVersion: '1.8.0'
      })
      expect(mockProcessVersion).toHaveBeenCalled()
    })

    it('should fall back to processLatestVersion when no inputs provided in air gap mode', async () => {
      // Arrange - all inputs empty
      setMockInputValue('BRIDGE_CLI_BASE_URL', '')
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', '')
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', '')

      const mockProcessLatestVersion = jest.spyOn(bridgeClient as any, 'processLatestVersion')
      mockProcessLatestVersion.mockResolvedValue({
        bridgeUrl: 'https://default.url/bridge-latest.zip',
        bridgeVersion: '1.9.0'
      })

      const mockInfo = jest.spyOn(require('@actions/core'), 'info')

      // Act
      const result = await (bridgeClient as any).getBridgeUrlAndVersion(true)

      // Assert
      expect(result).toEqual({
        bridgeUrl: 'https://default.url/bridge-latest.zip',
        bridgeVersion: '1.9.0'
      })
      expect(mockProcessLatestVersion).toHaveBeenCalledWith(true) // Air gap flag should be true
      expect(mockInfo).toHaveBeenCalledWith('No specific Bridge CLI version provided, fetching the latest version.')
    })
  })

  describe('Air Gap Validation Tests', () => {
    it('should validate air gap executable exists', async () => {
      // Arrange
      const bridgePath = '/airgap/bridge/path'
      const mockCheckIfPathExists = jest.spyOn(require('../../../../src/blackduck-security-action/utility'), 'checkIfPathExists')
      mockCheckIfPathExists.mockReturnValue(true)

      setMockInputValue('BRIDGE_CLI_BASE_URL', 'https://airgap.example.com')

      // Act
      await expect(bridgeClient.validateAirGapExecutable(bridgePath)).resolves.not.toThrow()

      // Assert
      expect(mockCheckIfPathExists).toHaveBeenCalledWith('/airgap/bridge/path/bridge-cli')
    })

    it('should throw error when air gap executable does not exist and no base URL provided', async () => {
      // Arrange
      const bridgePath = '/airgap/bridge/path'
      const mockCheckIfPathExists = jest.spyOn(require('../../../../src/blackduck-security-action/utility'), 'checkIfPathExists')
      mockCheckIfPathExists.mockReturnValue(false)

      setMockInputValue('BRIDGE_CLI_BASE_URL', '') // No base URL

      // Act & Assert
      await expect(bridgeClient.validateAirGapExecutable(bridgePath)).rejects.toThrow('No BRIDGE_CLI_BASE_URL provided')
      expect(mockCheckIfPathExists).toHaveBeenCalledWith('/airgap/bridge/path/bridge-cli')
    })

    it('should not throw error when air gap executable does not exist but base URL is provided', async () => {
      // Arrange
      const bridgePath = '/airgap/bridge/path'
      const mockCheckIfPathExists = jest.spyOn(require('../../../../src/blackduck-security-action/utility'), 'checkIfPathExists')
      mockCheckIfPathExists.mockReturnValue(false)

      setMockInputValue('BRIDGE_CLI_BASE_URL', 'https://airgap.example.com') // Base URL provided

      // Act & Assert
      await expect(bridgeClient.validateAirGapExecutable(bridgePath)).resolves.not.toThrow()
      expect(mockCheckIfPathExists).toHaveBeenCalledWith('/airgap/bridge/path/bridge-cli')
    })
  })

  describe('Air Gap Error Handling', () => {
    it('should handle checkIfBridgeExistsInAirGap throwing an error', async () => {
      // Arrange
      const tempDir = '/tmp/test'
      mockParseToBoolean.mockReturnValue(true) // Air gap enabled
      mockCheckIfBridgeExistsInAirGap.mockRejectedValue(new Error('Air gap check failed'))
      setMockInputValue('BRIDGE_CLI_BASE_URL', '')

      const mockCleanupTempDir = jest.spyOn(require('../../../../src/blackduck-security-action/utility'), 'cleanupTempDir')
      mockCleanupTempDir.mockResolvedValue(undefined)

      // Act & Assert
      await expect(bridgeClient.downloadBridge(tempDir)).rejects.toThrow('Air gap check failed')
      expect(mockCleanupTempDir).toHaveBeenCalledWith(tempDir)
    })

    it('should handle air gap mode with network error', async () => {
      // Arrange
      const tempDir = '/tmp/test'
      mockParseToBoolean.mockReturnValue(true) // Air gap enabled
      mockCheckIfBridgeExistsInAirGap.mockResolvedValue(false)
      setMockInputValue('BRIDGE_CLI_BASE_URL', 'https://airgap.example.com')

      mockGetBridgeUrlAndVersion.mockResolvedValue({
        bridgeUrl: 'https://airgap.example.com/bridge.zip',
        bridgeVersion: '1.2.3'
      })

      jest.spyOn(bridgeClient, 'isBridgeInstalled').mockResolvedValue(false)

      const mockGetRemoteFile = jest.spyOn(require('../../../../src/blackduck-security-action/download-utility'), 'getRemoteFile')
      mockGetRemoteFile.mockRejectedValue(new Error('Network timeout in air gap'))

      const mockCleanupTempDir = jest.spyOn(require('../../../../src/blackduck-security-action/utility'), 'cleanupTempDir')
      mockCleanupTempDir.mockResolvedValue(undefined)

      // Act & Assert
      await expect(bridgeClient.downloadBridge(tempDir)).rejects.toThrow('Network timeout in air gap')
      expect(mockCleanupTempDir).toHaveBeenCalledWith(tempDir)
    })

    it('should handle air gap mode with invalid URL', async () => {
      // Arrange
      const tempDir = '/tmp/test'
      mockParseToBoolean.mockReturnValue(true) // Air gap enabled
      mockCheckIfBridgeExistsInAirGap.mockResolvedValue(false)
      setMockInputValue('BRIDGE_CLI_BASE_URL', 'https://invalid-airgap.example.com')

      mockGetBridgeUrlAndVersion.mockResolvedValue({
        bridgeUrl: 'https://invalid-airgap.example.com/bridge.zip',
        bridgeVersion: '1.2.3'
      })

      jest.spyOn(bridgeClient, 'isBridgeInstalled').mockResolvedValue(false)

      const mockGetRemoteFile = jest.spyOn(require('../../../../src/blackduck-security-action/download-utility'), 'getRemoteFile')
      mockGetRemoteFile.mockRejectedValue(new Error('Request failed with status code 404'))

      const mockCleanupTempDir = jest.spyOn(require('../../../../src/blackduck-security-action/utility'), 'cleanupTempDir')
      mockCleanupTempDir.mockResolvedValue(undefined)

      process.env['RUNNER_OS'] = 'Linux'

      // Act & Assert
      await expect(bridgeClient.downloadBridge(tempDir)).rejects.toThrow('Provided Bridge CLI url is not valid for the configured Linux runner')
      expect(mockCleanupTempDir).toHaveBeenCalledWith(tempDir)

      // Cleanup
      delete process.env['RUNNER_OS']
    })
  })

  describe('Air Gap Mode Utility Methods', () => {
    it('should correctly identify air gap mode when enabled', () => {
      // Arrange
      mockParseToBoolean.mockReturnValue(true)
      setMockInputValue('ENABLE_NETWORK_AIR_GAP', 'true')

      // Act
      const result = bridgeClient.isAirGapMode()

      // Assert
      expect(result).toBe(true)
      expect(mockParseToBoolean).toHaveBeenCalled()
    })

    it('should correctly identify non-air gap mode when disabled', () => {
      // Arrange
      mockParseToBoolean.mockReturnValue(false)
      setMockInputValue('ENABLE_NETWORK_AIR_GAP', 'false')

      // Act
      const result = bridgeClient.isAirGapMode()

      // Assert
      expect(result).toBe(false)
      expect(mockParseToBoolean).toHaveBeenCalled()
    })
  })

  describe('Air Gap Bridge Installation Checks', () => {
    it('should check if bridge exists locally in air gap mode', async () => {
      // Arrange
      const mockValidateAndSetBridgePath = jest.spyOn(bridgeClient as any, 'validateAndSetBridgePath')
      mockValidateAndSetBridgePath.mockResolvedValue(undefined)

      const mockGetBridgeExecutablePath = jest.spyOn(bridgeClient as any, 'getBridgeExecutablePath')
      mockGetBridgeExecutablePath.mockReturnValue('/airgap/bridge/bridge-cli')

      const mockCheckIfPathExists = jest.spyOn(require('../../../../src/blackduck-security-action/utility'), 'checkIfPathExists')
      mockCheckIfPathExists.mockReturnValue(true)

      // Act
      const result = await (bridgeClient as any).checkIfBridgeExistsLocally()

      // Assert
      expect(result).toBe(true)
      expect(mockValidateAndSetBridgePath).toHaveBeenCalled()
      expect(mockGetBridgeExecutablePath).toHaveBeenCalled()
      expect(mockCheckIfPathExists).toHaveBeenCalledWith('/airgap/bridge/bridge-cli')
    })

    it('should return false when bridge does not exist locally in air gap mode', async () => {
      // Arrange
      const mockValidateAndSetBridgePath = jest.spyOn(bridgeClient as any, 'validateAndSetBridgePath')
      mockValidateAndSetBridgePath.mockResolvedValue(undefined)

      const mockGetBridgeExecutablePath = jest.spyOn(bridgeClient as any, 'getBridgeExecutablePath')
      mockGetBridgeExecutablePath.mockReturnValue('/airgap/bridge/bridge-cli')

      const mockCheckIfPathExists = jest.spyOn(require('../../../../src/blackduck-security-action/utility'), 'checkIfPathExists')
      mockCheckIfPathExists.mockReturnValue(false)

      // Act
      const result = await (bridgeClient as any).checkIfBridgeExistsLocally()

      // Assert
      expect(result).toBe(false)
      expect(mockValidateAndSetBridgePath).toHaveBeenCalled()
      expect(mockGetBridgeExecutablePath).toHaveBeenCalled()
      expect(mockCheckIfPathExists).toHaveBeenCalledWith('/airgap/bridge/bridge-cli')
    })
  })

  describe('Air Gap Configuration Precedence', () => {
    it('should prioritize BRIDGE_CLI_BASE_URL in air gap mode over other inputs', async () => {
      // Arrange
      setMockInputValue('BRIDGE_CLI_BASE_URL', 'https://airgap.example.com')
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', 'https://public.example.com/bridge.zip')
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_VERSION', '1.0.0')

      const mockProcessVersion = jest.spyOn(bridgeClient as any, 'processVersion')
      mockProcessVersion.mockResolvedValue({
        bridgeUrl: 'https://airgap.example.com/bridge-1.0.0.zip',
        bridgeVersion: '1.0.0'
      })

      const mockInfo = jest.spyOn(require('@actions/core'), 'info')

      // Act
      const result = await (bridgeClient as any).getBridgeUrlAndVersion(true)

      // Assert
      expect(result.bridgeUrl).toContain('airgap.example.com')
      expect(mockInfo).toHaveBeenCalledWith('Both BRIDGE_CLI_BASE_URL and BRIDGE_CLI_DOWNLOAD_URL provided. Using BRIDGE_CLI_BASE_URL.')
      expect(mockInfo).toHaveBeenCalledWith('Using BRIDGE_CLI_BASE_URL with specified version: 1.0.0')
      expect(mockProcessVersion).toHaveBeenCalled()
    })

    it('should ignore deprecated BRIDGE_CLI_DOWNLOAD_URL in air gap mode when base URL provided', async () => {
      // Arrange
      setMockInputValue('BRIDGE_CLI_BASE_URL', 'https://airgap.example.com')
      setMockInputValue('BRIDGE_CLI_DOWNLOAD_URL', 'https://public.example.com/bridge.zip')

      const mockProcessLatestVersion = jest.spyOn(bridgeClient as any, 'processLatestVersion')
      mockProcessLatestVersion.mockResolvedValue({
        bridgeUrl: 'https://airgap.example.com/bridge-latest.zip',
        bridgeVersion: '2.0.0'
      })

      const mockDebug = jest.spyOn(require('@actions/core'), 'debug')

      // Act
      const result = await (bridgeClient as any).getBridgeUrlAndVersion(true)

      // Assert
      expect(result.bridgeUrl).toContain('airgap.example.com')
      expect(mockDebug).toHaveBeenCalledWith('BRIDGE_CLI_DOWNLOAD_URL is ignored when BRIDGE_CLI_BASE_URL is provided.')
      expect(mockProcessLatestVersion).toHaveBeenCalledWith(true)
    })
  })

  describe('Air Gap vs Normal Mode Comparison', () => {
    it('should behave differently in air gap vs normal mode for bridge existence check', async () => {
      // Test Air Gap Mode
      const tempDir1 = '/tmp/test-airgap'
      mockParseToBoolean.mockReturnValue(true) // Air gap enabled
      mockCheckIfBridgeExistsInAirGap.mockResolvedValue(true)
      setMockInputValue('BRIDGE_CLI_BASE_URL', '')

      await bridgeClient.downloadBridge(tempDir1)

      expect(mockInfo).toHaveBeenCalledWith('Network air gap is enabled.')
      expect(mockCheckIfBridgeExistsInAirGap).toHaveBeenCalled()

      // Reset mocks for normal mode test
      jest.clearAllMocks()
      mockInfo = jest.spyOn(require('@actions/core'), 'info')

      // Test Normal Mode
      const tempDir2 = '/tmp/test-normal'
      mockParseToBoolean.mockReturnValue(false) // Air gap disabled

      mockGetBridgeUrlAndVersion.mockResolvedValue({
        bridgeUrl: 'https://public.example.com/bridge.zip',
        bridgeVersion: '1.0.0'
      })

      jest.spyOn(bridgeClient, 'isBridgeInstalled').mockResolvedValue(true)

      await bridgeClient.downloadBridge(tempDir2)

      expect(mockInfo).not.toHaveBeenCalledWith('Network air gap is enabled.')
      expect(mockInfo).toHaveBeenCalledWith('Bridge CLI already exists')
    })

    it('should pass correct air gap flag to getBridgeUrlAndVersion', async () => {
      // Test air gap mode
      const tempDir = '/tmp/test'
      mockParseToBoolean.mockReturnValue(true)
      mockCheckIfBridgeExistsInAirGap.mockResolvedValue(false)
      setMockInputValue('BRIDGE_CLI_BASE_URL', 'https://airgap.example.com')

      mockGetBridgeUrlAndVersion.mockResolvedValue({
        bridgeUrl: 'https://airgap.example.com/bridge.zip',
        bridgeVersion: '1.0.0'
      })

      jest.spyOn(bridgeClient, 'isBridgeInstalled').mockResolvedValue(true)

      await bridgeClient.downloadBridge(tempDir)

      expect(mockGetBridgeUrlAndVersion).toHaveBeenCalledWith(true) // Air gap flag should be true

      // Reset and test normal mode
      jest.clearAllMocks()
      mockGetBridgeUrlAndVersion = jest.spyOn(bridgeClient as any, 'getBridgeUrlAndVersion')

      mockParseToBoolean.mockReturnValue(false)
      mockGetBridgeUrlAndVersion.mockResolvedValue({
        bridgeUrl: 'https://public.example.com/bridge.zip',
        bridgeVersion: '1.0.0'
      })

      jest.spyOn(bridgeClient, 'isBridgeInstalled').mockResolvedValue(true)

      await bridgeClient.downloadBridge(tempDir)

      expect(mockGetBridgeUrlAndVersion).toHaveBeenCalledWith(false) // Air gap flag should be false
    })
  })

  describe('Air Gap Installation Directory Handling', () => {
    it('should handle custom install directory in air gap mode', async () => {
      // Arrange
      const tempDir = '/tmp/test'
      const customInstallDir = '/airgap/custom/install'
      const mockDownloadResponse: DownloadFileResponse = {
        filePath: '/tmp/bridge.zip',
        fileName: 'https://airgap.example.com/bridge.zip'
      }

      mockParseToBoolean.mockReturnValue(true) // Air gap enabled
      mockCheckIfBridgeExistsInAirGap.mockResolvedValue(false)
      setMockInputValue('BRIDGE_CLI_BASE_URL', 'https://airgap.example.com')
      setMockInputValue('BRIDGE_CLI_INSTALL_DIRECTORY_KEY', customInstallDir)

      mockGetBridgeUrlAndVersion.mockResolvedValue({
        bridgeUrl: 'https://airgap.example.com/bridge.zip',
        bridgeVersion: '1.2.3'
      })

      jest.spyOn(bridgeClient, 'isBridgeInstalled').mockResolvedValue(false)

      const mockHandleBridgeDownload = jest.spyOn(bridgeClient as any, 'handleBridgeDownload')
      mockHandleBridgeDownload.mockResolvedValue(undefined)

      const mockGetRemoteFile = jest.spyOn(require('../../../../src/blackduck-security-action/download-utility'), 'getRemoteFile')
      mockGetRemoteFile.mockResolvedValue(mockDownloadResponse)

      const mockExistsSync = jest.spyOn(require('fs'), 'existsSync')
      mockExistsSync.mockReturnValue(false)

      // Act
      await bridgeClient.downloadBridge(tempDir)

      // Assert
      expect(mockHandleBridgeDownload).toHaveBeenCalledWith(mockDownloadResponse, '/airgap/custom/install/bridge-cli-bundle')
    })
  })
})
