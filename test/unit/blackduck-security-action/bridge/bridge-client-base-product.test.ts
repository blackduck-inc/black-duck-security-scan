import {BridgeClientBase} from '../../../../src/blackduck-security-action/bridge/bridge-client-base'
import {BridgeToolsParameter} from '../../../../src/blackduck-security-action/tools-parameter'
import * as validators from '../../../../src/blackduck-security-action/validators'
import {ExecOptions} from '@actions/exec'
import {DownloadFileResponse} from '../../../../src/blackduck-security-action/download-utility' // Mock fs module

// Mock fs module
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
    COVERITY_USER: '',
    COVERITY_PASSPHRASE: '',
    COVERITY_PROJECT_NAME: '',
    COVERITY_STREAM_NAME: '',
    COVERITY_POLICY_VIEW: '',
    COVERITY_REPOSITORY_NAME: '',
    COVERITY_BRANCH_NAME: '',
    COVERITY_PRCOMMENT_ENABLED: '',
    COVERITY_INSTALL_DIRECTORY: '',
    COVERITY_BUILD_COMMAND: '',
    COVERITY_CLEAN_COMMAND: '',
    COVERITY_CONFIG_PATH: '',
    COVERITY_ARGS: '',
    COVERITY_VERSION: '',
    BLACKDUCKSCA_TOKEN: '',
    BLACKDUCKSCA_SCAN_FULL: '',
    BLACKDUCKSCA_SCAN_FAILURE_SEVERITIES: '',
    BLACKDUCKSCA_FIXPR_ENABLED: '',
    BLACKDUCKSCA_FIXPR_MAXCOUNT: '',
    BLACKDUCKSCA_FIXPR_CREATE_SINGLE_PR: '',
    BLACKDUCKSCA_FIXPR_FILTER_SEVERITIES: '',
    BLACKDUCKSCA_PRCOMMENT_ENABLED: '',
    BLACKDUCKSCA_REPORTS_SARIF_CREATE: '',
    BLACKDUCKSCA_REPORTS_SARIF_FILE_PATH: '',
    BLACKDUCKSCA_REPORTS_SARIF_SEVERITIES: '',
    BLACKDUCKSCA_REPORTS_SARIF_GROUP_SCA_ISSUES: '',
    BLACKDUCKSCA_UPLOAD_SARIF_REPORT: '',
    BLACKDUCKSCA_WAITFORSCAN: '',
    BRIDGE_CLI_DOWNLOAD_URL: '',
    BRIDGE_CLI_DOWNLOAD_VERSION: '',
    INCLUDE_DIAGNOSTICS: ''
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

describe('BridgeClientBase - Polaris Tests', () => {
  let bridgeClient: TestBridgeClient
  let mockValidatePolarisInputs: jest.SpyInstance
  let mockValidateCoverityInputs: jest.SpyInstance
  let mockValidateBlackDuckInputs: jest.SpyInstance
  let mockValidateSRMInputs: jest.SpyInstance
  let mockValidateScanTypes: jest.SpyInstance
  let mockBridgeToolsParameter: jest.MockedClass<typeof BridgeToolsParameter>

  beforeEach(() => {
    jest.clearAllMocks()
    bridgeClient = new TestBridgeClient()

    // Mock all validator functions
    mockValidatePolarisInputs = jest.spyOn(validators, 'validatePolarisInputs')
    mockValidateCoverityInputs = jest.spyOn(validators, 'validateCoverityInputs')
    mockValidateBlackDuckInputs = jest.spyOn(validators, 'validateBlackDuckInputs')
    mockValidateSRMInputs = jest.spyOn(validators, 'validateSRMInputs')
    mockValidateScanTypes = jest.spyOn(validators, 'validateScanTypes')

    mockBridgeToolsParameter = BridgeToolsParameter as jest.MockedClass<typeof BridgeToolsParameter>

    // Set up environment for GitHub repo extraction
    process.env['GITHUB_REPOSITORY'] = 'test-owner/test-repo'

    // Reset mock inputs to default values
    setMockInputValue('POLARIS_SERVER_URL', '')
    setMockInputValue('COVERITY_URL', '')
    setMockInputValue('BLACKDUCKSCA_URL', '')
    setMockInputValue('SRM_URL', '')

    // Set default mock return values
    mockValidatePolarisInputs.mockReturnValue([])
    mockValidateCoverityInputs.mockReturnValue([])
    mockValidateBlackDuckInputs.mockReturnValue([])
    mockValidateSRMInputs.mockReturnValue([])
    mockValidateScanTypes.mockReturnValue([])
  })

  afterEach(() => {
    delete process.env['GITHUB_REPOSITORY']
  })

  describe('Polaris Command Building', () => {
    const tempDir = '/tmp/test-temp'

    it('should build Polaris command when validation passes and POLARIS_SERVER_URL is set', async () => {
      // Arrange
      mockValidatePolarisInputs.mockReturnValue([])
      setMockInputValue('POLARIS_SERVER_URL', 'https://polaris.example.com')
      setMockInputValue('POLARIS_ACCESS_TOKEN', 'test-token')
      setMockInputValue('POLARIS_APPLICATION_NAME', 'test-app')
      setMockInputValue('POLARIS_PROJECT_NAME', 'test-project')

      const mockFormattedCommand = {
        stage: 'polaris',
        stateFilePath: '/path/to/state',
        workflowVersion: '1.0'
      }

      const mockInstance = {
        getFormattedCommandForPolaris: jest.fn().mockReturnValue(mockFormattedCommand)
      }
      mockBridgeToolsParameter.mockImplementation(() => mockInstance as any)

      // Act
      const result = await bridgeClient.prepareCommand(tempDir)

      // Assert
      expect(mockValidatePolarisInputs).toHaveBeenCalled()
      expect(mockBridgeToolsParameter).toHaveBeenCalledWith(tempDir)
      expect(mockInstance.getFormattedCommandForPolaris).toHaveBeenCalled()
      expect(result).toContain('--stage polaris')
      expect(result).toContain('--state /path/to/state')
      expect(result).toContain('--version 1.0')
    })

    it('should not build Polaris command when POLARIS_SERVER_URL is not set', async () => {
      // Arrange
      mockValidatePolarisInputs.mockReturnValue([])
      mockValidateSRMInputs.mockReturnValue([])
      mockValidateScanTypes.mockReturnValue([]) // Mock as valid since SRM is configured
      setMockInputValue('POLARIS_SERVER_URL', '')
      setMockInputValue('SRM_URL', 'https://srm.example.com') // Set SRM to avoid scan type error

      const mockSrmCommand = {
        stage: 'srm',
        stateFilePath: '/path/to/srm/state'
      }

      const mockInstance = {
        getFormattedCommandForPolaris: jest.fn(),
        getFormattedCommandForSRM: jest.fn().mockReturnValue(mockSrmCommand)
      }
      mockBridgeToolsParameter.mockImplementation(() => mockInstance as any)

      // Mock SRM validation to pass
      jest.spyOn(validators, 'validateSRMInputs').mockReturnValue([])

      // Act
      const result = await bridgeClient.prepareCommand(tempDir)

      // Assert
      expect(mockValidatePolarisInputs).toHaveBeenCalled()
      expect(mockInstance.getFormattedCommandForPolaris).not.toHaveBeenCalled()
      expect(result).not.toContain('polaris')
    })

    it('should handle Polaris validation errors', async () => {
      // Arrange
      const validationErrors = ['Invalid Polaris token', 'Missing application name']
      mockValidatePolarisInputs.mockReturnValue(validationErrors)
      setMockInputValue('POLARIS_SERVER_URL', 'https://polaris.example.com')

      // Act & Assert
      await expect(bridgeClient.prepareCommand(tempDir)).rejects.toThrow('Invalid Polaris token,Missing application name')
    })

    it('should include Polaris command with multiple assessment types', async () => {
      // Arrange
      mockValidatePolarisInputs.mockReturnValue([])
      setMockInputValue('POLARIS_SERVER_URL', 'https://polaris.example.com')
      setMockInputValue('POLARIS_ASSESSMENT_TYPES', 'SAST,SCA')

      const mockFormattedCommand = {
        stage: 'polaris',
        stateFilePath: '/path/to/state',
        workflowVersion: '1.0'
      }

      const mockInstance = {
        getFormattedCommandForPolaris: jest.fn().mockReturnValue(mockFormattedCommand)
      }
      mockBridgeToolsParameter.mockImplementation(() => mockInstance as any)

      // Act
      const result = await bridgeClient.prepareCommand(tempDir)

      // Assert
      expect(result).toContain('--stage polaris')
      expect(mockInstance.getFormattedCommandForPolaris).toHaveBeenCalled()
    })
  })
})

describe('BridgeClientBase - Coverity Tests', () => {
  let bridgeClient: TestBridgeClient
  let mockValidatePolarisInputs: jest.SpyInstance
  let mockValidateCoverityInputs: jest.SpyInstance
  let mockValidateBlackDuckInputs: jest.SpyInstance
  let mockValidateSRMInputs: jest.SpyInstance
  let mockValidateScanTypes: jest.SpyInstance
  let mockBridgeToolsParameter: jest.MockedClass<typeof BridgeToolsParameter>

  beforeEach(() => {
    jest.clearAllMocks()
    bridgeClient = new TestBridgeClient()

    // Mock all validator functions
    mockValidatePolarisInputs = jest.spyOn(validators, 'validatePolarisInputs')
    mockValidateCoverityInputs = jest.spyOn(validators, 'validateCoverityInputs')
    mockValidateBlackDuckInputs = jest.spyOn(validators, 'validateBlackDuckInputs')
    mockValidateSRMInputs = jest.spyOn(validators, 'validateSRMInputs')
    mockValidateScanTypes = jest.spyOn(validators, 'validateScanTypes')

    mockBridgeToolsParameter = BridgeToolsParameter as jest.MockedClass<typeof BridgeToolsParameter>

    process.env['GITHUB_REPOSITORY'] = 'test-owner/test-repo'

    // Reset mock inputs to default values
    setMockInputValue('POLARIS_SERVER_URL', '')
    setMockInputValue('COVERITY_URL', '')
    setMockInputValue('BLACKDUCKSCA_URL', '')
    setMockInputValue('SRM_URL', '')

    // Set default mock return values
    mockValidatePolarisInputs.mockReturnValue([])
    mockValidateCoverityInputs.mockReturnValue([])
    mockValidateBlackDuckInputs.mockReturnValue([])
    mockValidateSRMInputs.mockReturnValue([])
    mockValidateScanTypes.mockReturnValue([])
  })

  afterEach(() => {
    delete process.env['GITHUB_REPOSITORY']
  })

  describe('Coverity Command Building', () => {
    const tempDir = '/tmp/test-temp'

    it('should build Coverity command when validation passes and COVERITY_URL is set', async () => {
      // Arrange
      mockValidateCoverityInputs.mockReturnValue([])
      setMockInputValue('COVERITY_URL', 'https://coverity.example.com')
      setMockInputValue('COVERITY_USER', 'test-user')
      setMockInputValue('COVERITY_PASSPHRASE', 'test-pass')
      setMockInputValue('COVERITY_PROJECT_NAME', 'test-project')

      const mockFormattedCommand = {
        stage: 'coverity',
        stateFilePath: '/path/to/coverity/state',
        workflowVersion: '2.0'
      }

      const mockInstance = {
        getFormattedCommandForCoverity: jest.fn().mockReturnValue(mockFormattedCommand)
      }
      mockBridgeToolsParameter.mockImplementation(() => mockInstance as any)

      // Act
      const result = await bridgeClient.prepareCommand(tempDir)

      // Assert
      expect(mockValidateCoverityInputs).toHaveBeenCalled()
      expect(mockBridgeToolsParameter).toHaveBeenCalledWith(tempDir)
      expect(mockInstance.getFormattedCommandForCoverity).toHaveBeenCalled()
      expect(result).toContain('--stage coverity')
      expect(result).toContain('--state /path/to/coverity/state')
      expect(result).toContain('--version 2.0')
    })

    it('should not build Coverity command when COVERITY_URL is not set', async () => {
      // Arrange
      mockValidateCoverityInputs.mockReturnValue([])
      mockValidateSRMInputs.mockReturnValue([])
      mockValidateScanTypes.mockReturnValue([]) // Mock as valid since SRM is configured
      setMockInputValue('COVERITY_URL', '')
      setMockInputValue('SRM_URL', 'https://srm.example.com') // Set SRM to avoid scan type error

      const mockSrmCommand = {
        stage: 'srm',
        stateFilePath: '/path/to/srm/state'
      }

      const mockInstance = {
        getFormattedCommandForCoverity: jest.fn(),
        getFormattedCommandForSRM: jest.fn().mockReturnValue(mockSrmCommand)
      }
      mockBridgeToolsParameter.mockImplementation(() => mockInstance as any)

      // Mock SRM validation to pass
      jest.spyOn(validators, 'validateSRMInputs').mockReturnValue([])

      // Act
      const result = await bridgeClient.prepareCommand(tempDir)

      // Assert
      expect(mockValidateCoverityInputs).toHaveBeenCalled()
      expect(mockInstance.getFormattedCommandForCoverity).not.toHaveBeenCalled()
      expect(result).not.toContain('coverity')
    })

    it('should handle Coverity validation errors', async () => {
      // Arrange
      const validationErrors = ['Invalid Coverity credentials', 'Missing project name']
      mockValidateCoverityInputs.mockReturnValue(validationErrors)
      setMockInputValue('COVERITY_URL', 'https://coverity.example.com')

      // Act & Assert
      await expect(bridgeClient.prepareCommand(tempDir)).rejects.toThrow('Invalid Coverity credentials,Missing project name')
    })

    it('should include Coverity command with build command', async () => {
      // Arrange
      mockValidateCoverityInputs.mockReturnValue([])
      setMockInputValue('COVERITY_URL', 'https://coverity.example.com')
      setMockInputValue('COVERITY_BUILD_COMMAND', 'mvn clean compile')

      const mockFormattedCommand = {
        stage: 'coverity',
        stateFilePath: '/path/to/state'
      }

      const mockInstance = {
        getFormattedCommandForCoverity: jest.fn().mockReturnValue(mockFormattedCommand)
      }
      mockBridgeToolsParameter.mockImplementation(() => mockInstance as any)

      // Act
      const result = await bridgeClient.prepareCommand(tempDir)

      // Assert
      expect(result).toContain('--stage coverity')
      expect(mockInstance.getFormattedCommandForCoverity).toHaveBeenCalled()
    })

    it('should handle Coverity with policy view configuration', async () => {
      // Arrange
      mockValidateCoverityInputs.mockReturnValue([])
      setMockInputValue('COVERITY_URL', 'https://coverity.example.com')
      setMockInputValue('COVERITY_POLICY_VIEW', 'Outstanding Issues')

      const mockFormattedCommand = {
        stage: 'coverity',
        stateFilePath: '/path/to/state'
      }

      const mockInstance = {
        getFormattedCommandForCoverity: jest.fn().mockReturnValue(mockFormattedCommand)
      }
      mockBridgeToolsParameter.mockImplementation(() => mockInstance as any)

      // Act
      const result = await bridgeClient.prepareCommand(tempDir)

      // Assert
      expect(result).toContain('--stage coverity')
      expect(mockInstance.getFormattedCommandForCoverity).toHaveBeenCalled()
    })
  })
})

describe('BridgeClientBase - BlackDuck Tests', () => {
  let bridgeClient: TestBridgeClient
  let mockValidatePolarisInputs: jest.SpyInstance
  let mockValidateCoverityInputs: jest.SpyInstance
  let mockValidateBlackDuckInputs: jest.SpyInstance
  let mockValidateSRMInputs: jest.SpyInstance
  let mockValidateScanTypes: jest.SpyInstance
  let mockBridgeToolsParameter: jest.MockedClass<typeof BridgeToolsParameter>

  beforeEach(() => {
    jest.clearAllMocks()
    bridgeClient = new TestBridgeClient()

    // Mock all validator functions
    mockValidatePolarisInputs = jest.spyOn(validators, 'validatePolarisInputs')
    mockValidateCoverityInputs = jest.spyOn(validators, 'validateCoverityInputs')
    mockValidateBlackDuckInputs = jest.spyOn(validators, 'validateBlackDuckInputs')
    mockValidateSRMInputs = jest.spyOn(validators, 'validateSRMInputs')
    mockValidateScanTypes = jest.spyOn(validators, 'validateScanTypes')

    mockBridgeToolsParameter = BridgeToolsParameter as jest.MockedClass<typeof BridgeToolsParameter>

    process.env['GITHUB_REPOSITORY'] = 'test-owner/test-repo'

    // Reset mock inputs to default values
    setMockInputValue('POLARIS_SERVER_URL', '')
    setMockInputValue('COVERITY_URL', '')
    setMockInputValue('BLACKDUCKSCA_URL', '')
    setMockInputValue('SRM_URL', '')

    // Set default mock return values
    mockValidatePolarisInputs.mockReturnValue([])
    mockValidateCoverityInputs.mockReturnValue([])
    mockValidateBlackDuckInputs.mockReturnValue([])
    mockValidateSRMInputs.mockReturnValue([])
    mockValidateScanTypes.mockReturnValue([])
  })

  afterEach(() => {
    delete process.env['GITHUB_REPOSITORY']
  })

  describe('BlackDuck Command Building', () => {
    const tempDir = '/tmp/test-temp'

    it('should build BlackDuck command when validation passes and BLACKDUCKSCA_URL is set', async () => {
      // Arrange
      mockValidateBlackDuckInputs.mockReturnValue([])
      setMockInputValue('BLACKDUCKSCA_URL', 'https://blackduck.example.com')
      setMockInputValue('BLACKDUCKSCA_TOKEN', 'test-token')

      const mockFormattedCommand = {
        stage: 'blackduck',
        stateFilePath: '/path/to/blackduck/state',
        workflowVersion: '3.0'
      }

      const mockInstance = {
        getFormattedCommandForBlackduck: jest.fn().mockReturnValue(mockFormattedCommand)
      }
      mockBridgeToolsParameter.mockImplementation(() => mockInstance as any)

      // Act
      const result = await bridgeClient.prepareCommand(tempDir)

      // Assert
      expect(mockValidateBlackDuckInputs).toHaveBeenCalled()
      expect(mockBridgeToolsParameter).toHaveBeenCalledWith(tempDir)
      expect(mockInstance.getFormattedCommandForBlackduck).toHaveBeenCalled()
      expect(result).toContain('--stage blackduck')
      expect(result).toContain('--state /path/to/blackduck/state')
      expect(result).toContain('--version 3.0')
    })

    it('should not build BlackDuck command when BLACKDUCKSCA_URL is not set', async () => {
      // Arrange
      mockValidateBlackDuckInputs.mockReturnValue([])
      mockValidateSRMInputs.mockReturnValue([])
      mockValidateScanTypes.mockReturnValue([]) // Mock as valid since SRM is configured
      setMockInputValue('BLACKDUCKSCA_URL', '')
      setMockInputValue('SRM_URL', 'https://srm.example.com') // Set SRM to avoid scan type error

      const mockSrmCommand = {
        stage: 'srm',
        stateFilePath: '/path/to/srm/state'
      }

      const mockInstance = {
        getFormattedCommandForBlackduck: jest.fn(),
        getFormattedCommandForSRM: jest.fn().mockReturnValue(mockSrmCommand)
      }
      mockBridgeToolsParameter.mockImplementation(() => mockInstance as any)

      // Mock SRM validation to pass
      jest.spyOn(validators, 'validateSRMInputs').mockReturnValue([])

      // Act
      const result = await bridgeClient.prepareCommand(tempDir)

      // Assert
      expect(mockValidateBlackDuckInputs).toHaveBeenCalled()
      expect(mockInstance.getFormattedCommandForBlackduck).not.toHaveBeenCalled()
      expect(result).not.toContain('blackduck')
    })

    it('should handle BlackDuck validation errors', async () => {
      // Arrange
      const validationErrors = ['Invalid BlackDuck token', 'Missing server URL']
      mockValidateBlackDuckInputs.mockReturnValue(validationErrors)
      setMockInputValue('BLACKDUCKSCA_URL', 'https://blackduck.example.com')

      // Act & Assert
      await expect(bridgeClient.prepareCommand(tempDir)).rejects.toThrow('Invalid BlackDuck token,Missing server URL')
    })

    it('should include BlackDuck command with scan failure severities', async () => {
      // Arrange
      mockValidateBlackDuckInputs.mockReturnValue([])
      setMockInputValue('BLACKDUCKSCA_URL', 'https://blackduck.example.com')
      setMockInputValue('BLACKDUCKSCA_SCAN_FAILURE_SEVERITIES', 'CRITICAL,HIGH')

      const mockFormattedCommand = {
        stage: 'blackduck',
        stateFilePath: '/path/to/state'
      }

      const mockInstance = {
        getFormattedCommandForBlackduck: jest.fn().mockReturnValue(mockFormattedCommand)
      }
      mockBridgeToolsParameter.mockImplementation(() => mockInstance as any)

      // Act
      const result = await bridgeClient.prepareCommand(tempDir)

      // Assert
      expect(result).toContain('--stage blackduck')
      expect(mockInstance.getFormattedCommandForBlackduck).toHaveBeenCalled()
    })

    it('should handle BlackDuck with full scan enabled', async () => {
      // Arrange
      mockValidateBlackDuckInputs.mockReturnValue([])
      setMockInputValue('BLACKDUCKSCA_URL', 'https://blackduck.example.com')
      setMockInputValue('BLACKDUCKSCA_SCAN_FULL', 'true')

      const mockFormattedCommand = {
        stage: 'blackduck',
        stateFilePath: '/path/to/state'
      }

      const mockInstance = {
        getFormattedCommandForBlackduck: jest.fn().mockReturnValue(mockFormattedCommand)
      }
      mockBridgeToolsParameter.mockImplementation(() => mockInstance as any)

      // Act
      const result = await bridgeClient.prepareCommand(tempDir)

      // Assert
      expect(result).toContain('--stage blackduck')
      expect(mockInstance.getFormattedCommandForBlackduck).toHaveBeenCalled()
    })

    it('should handle BlackDuck with SARIF report generation', async () => {
      // Arrange
      mockValidateBlackDuckInputs.mockReturnValue([])
      setMockInputValue('BLACKDUCKSCA_URL', 'https://blackduck.example.com')
      setMockInputValue('BLACKDUCKSCA_REPORTS_SARIF_CREATE', 'true')
      setMockInputValue('BLACKDUCKSCA_REPORTS_SARIF_FILE_PATH', '/path/to/sarif/report.sarif')

      const mockFormattedCommand = {
        stage: 'blackduck',
        stateFilePath: '/path/to/state'
      }

      const mockInstance = {
        getFormattedCommandForBlackduck: jest.fn().mockReturnValue(mockFormattedCommand)
      }
      mockBridgeToolsParameter.mockImplementation(() => mockInstance as any)

      // Act
      const result = await bridgeClient.prepareCommand(tempDir)

      // Assert
      expect(result).toContain('--stage blackduck')
      expect(mockInstance.getFormattedCommandForBlackduck).toHaveBeenCalled()
    })
  })
})
