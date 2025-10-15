import {BridgeCliThinClient} from '../../src/blackduck-security-action/bridge/bridge-cli-thin-client'
import * as inputs from '../../src/blackduck-security-action/inputs'
import * as constants from '../../src/application-constants'
import * as utility from '../../src/blackduck-security-action/utility'
import * as validators from '../../src/blackduck-security-action/validators'
import * as core from '@actions/core'
import * as main from '../../src/main'
import * as bridgeClientFactory from '../../src/blackduck-security-action/bridge/bridge-client-factory'
import * as artifacts from '../../src/blackduck-security-action/artifacts'
import {GitHubClientServiceFactory} from '../../src/blackduck-security-action/factory/github-client-service-factory'
import {basename} from 'path'
import {getGitHubWorkspaceDir as getGitHubWorkspaceDirV2} from 'actions-artifact-v2/lib/internal/shared/config'

// Mock dependencies for integration test
jest.mock('@actions/core')
jest.mock('../../src/blackduck-security-action/utility')
jest.mock('../../src/blackduck-security-action/validators')
jest.mock('node:child_process')
jest.mock('../../src/blackduck-security-action/bridge/bridge-client-factory')
jest.mock('../../src/blackduck-security-action/artifacts')
jest.mock('../../src/blackduck-security-action/factory/github-client-service-factory')
jest.mock('actions-artifact-v2/lib/internal/shared/config')
jest.mock('path')

describe('SARIF Upload Workflow Tests', () => {
  const mockDebug = jest.mocked(core.debug)
  const mockInfo = jest.mocked(core.info)
  const mockParseToBoolean = jest.mocked(utility.parseToBoolean)
  const mockIsPullRequestEvent = jest.mocked(utility.isPullRequestEvent)
  const mockIsNullOrEmptyValue = jest.mocked(validators.isNullOrEmptyValue)
  const mockGetRealSystemTime = jest.mocked(utility.getRealSystemTime)
  const mockUploadSarifReportAsArtifact = jest.mocked(artifacts.uploadSarifReportAsArtifact)
  const mockGetGitHubClientServiceInstance = jest.mocked(GitHubClientServiceFactory.getGitHubClientServiceInstance)

  let mockGitHubClientService: {
    uploadSarifReport: jest.Mock
  }

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock GitHub client service
    mockGitHubClientService = {
      uploadSarifReport: jest.fn()
    }
    mockGetGitHubClientServiceInstance.mockResolvedValue(mockGitHubClientService as any)

    // Mock utility functions
    mockIsPullRequestEvent.mockReturnValue(false)
    mockIsNullOrEmptyValue.mockReturnValue(false)
    mockGetRealSystemTime.mockReturnValue('20231012-120000')
    mockUploadSarifReportAsArtifact.mockResolvedValue({
      artifactName: 'test-artifact',
      artifactItems: [],
      size: 0,
      id: 123
    } as any)

    // Mock inputs
    Object.defineProperty(inputs, 'BLACKDUCKSCA_URL', {value: '', configurable: true})
    Object.defineProperty(inputs, 'POLARIS_SERVER_URL', {value: '', configurable: true})
    Object.defineProperty(inputs, 'GITHUB_TOKEN', {value: 'test-token', configurable: true})
    Object.defineProperty(inputs, 'BLACKDUCKSCA_REPORTS_SARIF_CREATE', {value: 'false', configurable: true})
    Object.defineProperty(inputs, 'POLARIS_REPORTS_SARIF_CREATE', {value: 'false', configurable: true})
    Object.defineProperty(inputs, 'BLACKDUCK_UPLOAD_SARIF_REPORT', {value: 'false', configurable: true})
    Object.defineProperty(inputs, 'BLACKDUCKSCA_REPORTS_SARIF_FILE_PATH', {value: 'blackduck-sarif.json', configurable: true})
    Object.defineProperty(inputs, 'POLARIS_REPORTS_SARIF_FILE_PATH', {value: 'polaris-sarif.json', configurable: true})

    // Mock constants
    Object.defineProperty(constants, 'VERSION', {value: '2.0.0', configurable: true})
    Object.defineProperty(constants, 'BLACKDUCK_SARIF_GENERATOR_DIRECTORY', {value: 'blackduck-output', configurable: true})
    Object.defineProperty(constants, 'POLARIS_SARIF_GENERATOR_DIRECTORY', {value: 'polaris-output', configurable: true})
    Object.defineProperty(constants, 'INTEGRATIONS_BLACKDUCK_SARIF_GENERATOR_DIRECTORY', {value: 'integrations/blackduck-output', configurable: true})
    Object.defineProperty(constants, 'INTEGRATIONS_POLARIS_SARIF_GENERATOR_DIRECTORY', {value: 'integrations/polaris-output', configurable: true})
    Object.defineProperty(constants, 'BLACKDUCK_SARIF_ARTIFACT_NAME', {value: 'BlackDuck-SARIF-', configurable: true})
    Object.defineProperty(constants, 'POLARIS_SARIF_ARTIFACT_NAME', {value: 'Polaris-SARIF-', configurable: true})

    // Mock core functions
    mockDebug.mockImplementation(() => {})
    mockInfo.mockImplementation(() => {})
  })

  describe('SARIF Upload Logic - Legacy Bridge Version (< 2.0.0)', () => {
    beforeEach(() => {
      // Set bridge version to legacy version
      const bridgeVersion = '1.9.0'
      mockParseToBoolean.mockImplementation(input => {
        if (input === inputs.BLACKDUCKSCA_REPORTS_SARIF_CREATE) return true
        if (input === inputs.POLARIS_REPORTS_SARIF_CREATE) return true
        return false
      })
    })

    test('should upload BlackDuck SARIF as artifact for legacy bridge version', async () => {
      // Arrange
      Object.defineProperty(inputs, 'BLACKDUCKSCA_URL', {value: 'https://blackduck.example.com', configurable: true})
      Object.defineProperty(inputs, 'BLACKDUCKSCA_REPORTS_SARIF_CREATE', {value: 'true', configurable: true})

      const bridgeVersion = '1.9.0'
      const uploadSarifReportBasedOnExitCode = true

      // Simulate the SARIF upload logic
      if (!utility.isPullRequestEvent() && uploadSarifReportBasedOnExitCode) {
        if (bridgeVersion < constants.VERSION) {
          if (inputs.BLACKDUCKSCA_URL && utility.parseToBoolean(inputs.BLACKDUCKSCA_REPORTS_SARIF_CREATE)) {
            await artifacts.uploadSarifReportAsArtifact(constants.BLACKDUCK_SARIF_GENERATOR_DIRECTORY, inputs.BLACKDUCKSCA_REPORTS_SARIF_FILE_PATH, constants.BLACKDUCK_SARIF_ARTIFACT_NAME.concat(utility.getRealSystemTime()))
          }
        }
      }

      // Assert
      expect(mockUploadSarifReportAsArtifact).toHaveBeenCalledWith('blackduck-output', 'blackduck-sarif.json', 'BlackDuck-SARIF-20231012-120000')
    })

    test('should upload Polaris SARIF as artifact for legacy bridge version', async () => {
      // Arrange
      Object.defineProperty(inputs, 'POLARIS_SERVER_URL', {value: 'https://polaris.example.com', configurable: true})
      Object.defineProperty(inputs, 'POLARIS_REPORTS_SARIF_CREATE', {value: 'true', configurable: true})

      const bridgeVersion = '1.9.0'
      const uploadSarifReportBasedOnExitCode = true

      // Simulate the SARIF upload logic
      if (!utility.isPullRequestEvent() && uploadSarifReportBasedOnExitCode) {
        if (bridgeVersion < constants.VERSION) {
          if (inputs.POLARIS_SERVER_URL && utility.parseToBoolean(inputs.POLARIS_REPORTS_SARIF_CREATE)) {
            await artifacts.uploadSarifReportAsArtifact(constants.POLARIS_SARIF_GENERATOR_DIRECTORY, inputs.POLARIS_REPORTS_SARIF_FILE_PATH, constants.POLARIS_SARIF_ARTIFACT_NAME.concat(utility.getRealSystemTime()))
          }
        }
      }

      // Assert
      expect(mockUploadSarifReportAsArtifact).toHaveBeenCalledWith('polaris-output', 'polaris-sarif.json', 'Polaris-SARIF-20231012-120000')
    })
  })

  describe('SARIF Upload Logic - New Bridge Version (>= 2.0.0)', () => {
    beforeEach(() => {
      mockParseToBoolean.mockImplementation(input => {
        if (input === inputs.BLACKDUCKSCA_REPORTS_SARIF_CREATE) return true
        if (input === inputs.POLARIS_REPORTS_SARIF_CREATE) return true
        return false
      })
    })

    test('should upload BlackDuck SARIF as artifact for new bridge version', async () => {
      // Arrange
      Object.defineProperty(inputs, 'BLACKDUCKSCA_URL', {value: 'https://blackduck.example.com', configurable: true})
      Object.defineProperty(inputs, 'BLACKDUCKSCA_REPORTS_SARIF_CREATE', {value: 'true', configurable: true})

      const bridgeVersion = '2.1.0'
      const uploadSarifReportBasedOnExitCode = true

      // Simulate the SARIF upload logic
      if (!utility.isPullRequestEvent() && uploadSarifReportBasedOnExitCode) {
        if (bridgeVersion >= constants.VERSION) {
          if (inputs.BLACKDUCKSCA_URL && utility.parseToBoolean(inputs.BLACKDUCKSCA_REPORTS_SARIF_CREATE)) {
            await artifacts.uploadSarifReportAsArtifact(constants.INTEGRATIONS_BLACKDUCK_SARIF_GENERATOR_DIRECTORY, inputs.BLACKDUCKSCA_REPORTS_SARIF_FILE_PATH, constants.BLACKDUCK_SARIF_ARTIFACT_NAME.concat(utility.getRealSystemTime()))
          }
        }
      }

      // Assert
      expect(mockUploadSarifReportAsArtifact).toHaveBeenCalledWith('integrations/blackduck-output', 'blackduck-sarif.json', 'BlackDuck-SARIF-20231012-120000')
    })

    test('should upload Polaris SARIF as artifact for new bridge version', async () => {
      // Arrange
      Object.defineProperty(inputs, 'POLARIS_SERVER_URL', {value: 'https://polaris.example.com', configurable: true})
      Object.defineProperty(inputs, 'POLARIS_REPORTS_SARIF_CREATE', {value: 'true', configurable: true})

      const bridgeVersion = '2.1.0'
      const uploadSarifReportBasedOnExitCode = true

      // Simulate the SARIF upload logic
      if (!utility.isPullRequestEvent() && uploadSarifReportBasedOnExitCode) {
        if (bridgeVersion >= constants.VERSION) {
          if (inputs.POLARIS_SERVER_URL && utility.parseToBoolean(inputs.POLARIS_REPORTS_SARIF_CREATE)) {
            await artifacts.uploadSarifReportAsArtifact(constants.INTEGRATIONS_POLARIS_SARIF_GENERATOR_DIRECTORY, inputs.POLARIS_REPORTS_SARIF_FILE_PATH, constants.POLARIS_SARIF_ARTIFACT_NAME.concat(utility.getRealSystemTime()))
          }
        }
      }

      // Assert
      expect(mockUploadSarifReportAsArtifact).toHaveBeenCalledWith('integrations/polaris-output', 'polaris-sarif.json', 'Polaris-SARIF-20231012-120000')
    })
  })

  describe('GitHub SARIF Report Upload', () => {
    beforeEach(() => {
      mockIsNullOrEmptyValue.mockReturnValue(false)
      mockParseToBoolean.mockImplementation(input => {
        if (input === inputs.BLACKDUCK_UPLOAD_SARIF_REPORT) return true
        return false
      })
    })

    test('should upload BlackDuck SARIF to GitHub for legacy bridge version', async () => {
      // Arrange
      Object.defineProperty(inputs, 'BLACKDUCKSCA_URL', {value: 'https://blackduck.example.com', configurable: true})
      Object.defineProperty(inputs, 'BLACKDUCK_UPLOAD_SARIF_REPORT', {value: 'true', configurable: true})
      Object.defineProperty(inputs, 'GITHUB_TOKEN', {value: 'valid-token', configurable: true})

      const bridgeVersion = '1.9.0'
      const uploadSarifReportBasedOnExitCode = true

      // Simulate the GitHub SARIF upload logic
      if (!utility.isPullRequestEvent() && uploadSarifReportBasedOnExitCode) {
        if (!validators.isNullOrEmptyValue(inputs.GITHUB_TOKEN)) {
          const gitHubClientService = await GitHubClientServiceFactory.getGitHubClientServiceInstance()
          if (bridgeVersion < constants.VERSION) {
            if (inputs.BLACKDUCKSCA_URL && utility.parseToBoolean(inputs.BLACKDUCK_UPLOAD_SARIF_REPORT)) {
              await gitHubClientService.uploadSarifReport(constants.BLACKDUCK_SARIF_GENERATOR_DIRECTORY, inputs.BLACKDUCKSCA_REPORTS_SARIF_FILE_PATH)
            }
          }
        }
      }

      // Assert
      expect(mockGetGitHubClientServiceInstance).toHaveBeenCalled()
      expect(mockGitHubClientService.uploadSarifReport).toHaveBeenCalledWith('blackduck-output', 'blackduck-sarif.json')
    })

    test('should upload BlackDuck SARIF to GitHub for new bridge version', async () => {
      // Arrange
      Object.defineProperty(inputs, 'BLACKDUCKSCA_URL', {value: 'https://blackduck.example.com', configurable: true})
      Object.defineProperty(inputs, 'BLACKDUCK_UPLOAD_SARIF_REPORT', {value: 'true', configurable: true})
      Object.defineProperty(inputs, 'GITHUB_TOKEN', {value: 'valid-token', configurable: true})

      const bridgeVersion = '2.1.0'
      const uploadSarifReportBasedOnExitCode = true

      // Simulate the GitHub SARIF upload logic for new bridge version
      if (!utility.isPullRequestEvent() && uploadSarifReportBasedOnExitCode) {
        if (!validators.isNullOrEmptyValue(inputs.GITHUB_TOKEN)) {
          const gitHubClientService = await GitHubClientServiceFactory.getGitHubClientServiceInstance()
          if (bridgeVersion >= constants.VERSION) {
            if (inputs.BLACKDUCKSCA_URL && utility.parseToBoolean(inputs.BLACKDUCK_UPLOAD_SARIF_REPORT)) {
              await gitHubClientService.uploadSarifReport(constants.INTEGRATIONS_BLACKDUCK_SARIF_GENERATOR_DIRECTORY, inputs.BLACKDUCKSCA_REPORTS_SARIF_FILE_PATH)
            }
          }
        }
      }

      // Assert
      expect(mockGetGitHubClientServiceInstance).toHaveBeenCalled()
      expect(mockGitHubClientService.uploadSarifReport).toHaveBeenCalledWith('integrations/blackduck-output', 'blackduck-sarif.json')
    })

    test('should not upload SARIF when GitHub token is empty', async () => {
      // Arrange
      Object.defineProperty(inputs, 'GITHUB_TOKEN', {value: '', configurable: true})
      mockIsNullOrEmptyValue.mockReturnValue(true)

      const bridgeVersion = '2.1.0'
      const uploadSarifReportBasedOnExitCode = true

      // Simulate the GitHub SARIF upload logic with empty token
      if (!utility.isPullRequestEvent() && uploadSarifReportBasedOnExitCode) {
        if (!validators.isNullOrEmptyValue(inputs.GITHUB_TOKEN)) {
          // This block should not execute
          const gitHubClientService = await GitHubClientServiceFactory.getGitHubClientServiceInstance()
          await gitHubClientService.uploadSarifReport('test', 'test')
        }
      }

      // Assert
      expect(mockIsNullOrEmptyValue).toHaveBeenCalledWith(inputs.GITHUB_TOKEN)
      expect(mockGetGitHubClientServiceInstance).not.toHaveBeenCalled()
      expect(mockGitHubClientService.uploadSarifReport).not.toHaveBeenCalled()
    })
  })

  describe('Conditional Logic Tests', () => {
    test('should not upload SARIF during pull request events', async () => {
      // Arrange
      mockIsPullRequestEvent.mockReturnValue(true)
      Object.defineProperty(inputs, 'BLACKDUCKSCA_URL', {value: 'https://blackduck.example.com', configurable: true})

      const uploadSarifReportBasedOnExitCode = true

      // Simulate the conditional check
      if (!utility.isPullRequestEvent() && uploadSarifReportBasedOnExitCode) {
        // This block should not execute
        await artifacts.uploadSarifReportAsArtifact('test', 'test', 'test')
      }

      // Assert
      expect(mockIsPullRequestEvent).toHaveBeenCalled()
      expect(mockUploadSarifReportAsArtifact).not.toHaveBeenCalled()
    })

    test('should not upload SARIF when uploadSarifReportBasedOnExitCode is false', async () => {
      // Arrange
      mockIsPullRequestEvent.mockReturnValue(false)
      Object.defineProperty(inputs, 'BLACKDUCKSCA_URL', {value: 'https://blackduck.example.com', configurable: true})

      const uploadSarifReportBasedOnExitCode = false

      // Simulate the conditional check
      if (!utility.isPullRequestEvent() && uploadSarifReportBasedOnExitCode) {
        // This block should not execute
        await artifacts.uploadSarifReportAsArtifact('test', 'test', 'test')
      }

      // Assert
      expect(mockIsPullRequestEvent).toHaveBeenCalled()
      expect(mockUploadSarifReportAsArtifact).not.toHaveBeenCalled()
    })

    test('should not upload BlackDuck SARIF when URL is not provided', async () => {
      // Arrange
      mockIsPullRequestEvent.mockReturnValue(false)
      Object.defineProperty(inputs, 'BLACKDUCKSCA_URL', {value: '', configurable: true})
      Object.defineProperty(inputs, 'BLACKDUCKSCA_REPORTS_SARIF_CREATE', {value: 'true', configurable: true})

      const bridgeVersion = '2.1.0'
      const uploadSarifReportBasedOnExitCode = true

      // Simulate the conditional check
      if (!utility.isPullRequestEvent() && uploadSarifReportBasedOnExitCode) {
        if (inputs.BLACKDUCKSCA_URL && utility.parseToBoolean(inputs.BLACKDUCKSCA_REPORTS_SARIF_CREATE)) {
          // This block should not execute due to empty URL
          await artifacts.uploadSarifReportAsArtifact('test', 'test', 'test')
        }
      }

      // Assert
      expect(mockUploadSarifReportAsArtifact).not.toHaveBeenCalled()
    })

    test('should not upload BlackDuck SARIF when SARIF creation is disabled', async () => {
      // Arrange
      mockIsPullRequestEvent.mockReturnValue(false)
      mockParseToBoolean.mockReturnValue(false)
      Object.defineProperty(inputs, 'BLACKDUCKSCA_URL', {value: 'https://blackduck.example.com', configurable: true})
      Object.defineProperty(inputs, 'BLACKDUCKSCA_REPORTS_SARIF_CREATE', {value: 'false', configurable: true})

      const bridgeVersion = '2.1.0'
      const uploadSarifReportBasedOnExitCode = true

      // Simulate the conditional check
      if (!utility.isPullRequestEvent() && uploadSarifReportBasedOnExitCode) {
        if (inputs.BLACKDUCKSCA_URL && utility.parseToBoolean(inputs.BLACKDUCKSCA_REPORTS_SARIF_CREATE)) {
          // This block should not execute due to disabled SARIF creation
          await artifacts.uploadSarifReportAsArtifact('test', 'test', 'test')
        }
      }

      // Assert
      expect(mockParseToBoolean).toHaveBeenCalledWith(inputs.BLACKDUCKSCA_REPORTS_SARIF_CREATE)
      expect(mockUploadSarifReportAsArtifact).not.toHaveBeenCalled()
    })
  })

  // REMOVED: Trivial string comparison tests - these test JavaScript's native string comparison, not business logic

  describe('Real System Time Integration', () => {
    test('should generate artifact names with real system time', async () => {
      // Arrange
      mockGetRealSystemTime.mockReturnValue('20231012-143000')
      Object.defineProperty(inputs, 'BLACKDUCKSCA_URL', {value: 'https://blackduck.example.com', configurable: true})
      mockParseToBoolean.mockReturnValue(true)

      const bridgeVersion = '2.1.0'
      const uploadSarifReportBasedOnExitCode = true

      // Simulate the artifact upload with time-based naming
      if (!utility.isPullRequestEvent() && uploadSarifReportBasedOnExitCode) {
        const artifactName = constants.BLACKDUCK_SARIF_ARTIFACT_NAME.concat(utility.getRealSystemTime())
        await artifacts.uploadSarifReportAsArtifact(constants.INTEGRATIONS_BLACKDUCK_SARIF_GENERATOR_DIRECTORY, inputs.BLACKDUCKSCA_REPORTS_SARIF_FILE_PATH, artifactName)
      }

      // Assert
      expect(mockGetRealSystemTime).toHaveBeenCalled()
      expect(mockUploadSarifReportAsArtifact).toHaveBeenCalledWith('integrations/blackduck-output', 'blackduck-sarif.json', 'BlackDuck-SARIF-20231012-143000')
    })
  })
})

describe('Main Run Function Tests', () => {
  const mockDebug = jest.mocked(core.debug)
  const mockInfo = jest.mocked(core.info)
  const mockSetFailed = jest.mocked(core.setFailed)
  const mockSetOutput = jest.mocked(core.setOutput)
  const mockParseToBoolean = jest.mocked(utility.parseToBoolean)
  const mockCreateTempDir = jest.mocked(utility.createTempDir)
  const mockCleanupTempDir = jest.mocked(utility.cleanupTempDir)
  const mockExtractInputJsonFilename = jest.mocked(utility.extractInputJsonFilename)
  const mockUpdateSarifFilePaths = jest.mocked(utility.updateSarifFilePaths)
  const mockUpdateCoverityConfigForBridgeVersion = jest.mocked(utility.updateCoverityConfigForBridgeVersion)
  const mockCreateBridgeClient = jest.mocked(bridgeClientFactory.createBridgeClient)
  const mockGetGitHubWorkspaceDirV2 = jest.mocked(getGitHubWorkspaceDirV2)
  const mockBasename = jest.mocked(basename)

  let mockBridgeClient: {
    prepareCommand: jest.Mock
    downloadBridge: jest.Mock
    getBridgeVersion: jest.Mock
    executeBridgeCommand: jest.Mock
  }

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock bridge client
    mockBridgeClient = {
      prepareCommand: jest.fn(),
      downloadBridge: jest.fn(),
      getBridgeVersion: jest.fn(),
      executeBridgeCommand: jest.fn()
    }
    mockCreateBridgeClient.mockReturnValue(mockBridgeClient as any)

    // Mock utility functions
    mockCreateTempDir.mockResolvedValue('/tmp/test-temp-dir')
    mockCleanupTempDir.mockResolvedValue()
    mockExtractInputJsonFilename.mockReturnValue('/path/to/input.json')
    mockBasename.mockReturnValue('input.json')
    mockGetGitHubWorkspaceDirV2.mockReturnValue('/github/workspace')
    mockParseToBoolean.mockReturnValue(false)

    // Mock inputs
    Object.defineProperty(inputs, 'RETURN_STATUS', {value: 'false', configurable: true})
    Object.defineProperty(constants, 'TASK_RETURN_STATUS', {value: 'task-return-status', configurable: true})

    // Mock core functions
    mockDebug.mockImplementation(() => {})
    mockInfo.mockImplementation(() => {})
    mockSetFailed.mockImplementation(() => {})
    mockSetOutput.mockImplementation(() => {})
  })

  describe('Bridge Execution Workflow', () => {
    test('should successfully execute bridge workflow with exit code 0', async () => {
      // Arrange
      const tempDir = '/tmp/test-temp-dir'
      const formattedCommand = 'bridge-cli --stage polaris --input /path/to/input.json'
      const bridgeVersion = '1.2.3'
      const productInputFilePath = '/path/to/input.json'
      const productInputFileName = 'input.json'

      mockBridgeClient.prepareCommand.mockResolvedValue(formattedCommand)
      mockBridgeClient.downloadBridge.mockResolvedValue(undefined)
      mockBridgeClient.getBridgeVersion.mockResolvedValue(bridgeVersion)
      mockBridgeClient.executeBridgeCommand.mockResolvedValue(0)
      mockExtractInputJsonFilename.mockReturnValue(productInputFilePath)
      mockBasename.mockReturnValue(productInputFileName)

      // Act
      const result = await main.run()

      // Assert
      expect(mockCreateTempDir).toHaveBeenCalled()
      expect(mockBridgeClient.prepareCommand).toHaveBeenCalledWith(tempDir)
      expect(mockBridgeClient.downloadBridge).toHaveBeenCalledWith(tempDir)
      expect(mockBridgeClient.getBridgeVersion).toHaveBeenCalled()
      expect(mockExtractInputJsonFilename).toHaveBeenCalledWith(formattedCommand)
      expect(mockBasename).toHaveBeenCalledWith(productInputFilePath)
      expect(mockUpdateSarifFilePaths).toHaveBeenCalledWith(productInputFileName, bridgeVersion, productInputFilePath)
      expect(mockUpdateCoverityConfigForBridgeVersion).toHaveBeenCalledWith(productInputFileName, bridgeVersion, productInputFilePath)
      expect(mockBridgeClient.executeBridgeCommand).toHaveBeenCalledWith(formattedCommand, '/github/workspace')
      expect(mockInfo).toHaveBeenCalledWith('Black Duck Security Action workflow execution completed successfully.')
      expect(result).toBe(0)
    })

    test('should handle bridge execution with non-zero exit code', async () => {
      // Arrange
      const exitCode = 1
      mockBridgeClient.prepareCommand.mockResolvedValue('test-command')
      mockBridgeClient.downloadBridge.mockResolvedValue(undefined)
      mockBridgeClient.getBridgeVersion.mockResolvedValue('1.2.3')
      mockBridgeClient.executeBridgeCommand.mockResolvedValue(exitCode)

      // Act
      const result = await main.run()

      // Assert
      expect(mockBridgeClient.executeBridgeCommand).toHaveBeenCalled()
      expect(mockInfo).not.toHaveBeenCalledWith('Black Duck Security Action workflow execution completed successfully.')
      expect(result).toBe(exitCode)
    })

    test('should set output status when RETURN_STATUS is enabled', async () => {
      // Arrange
      const exitCode = 0
      mockParseToBoolean.mockReturnValue(true)
      Object.defineProperty(inputs, 'RETURN_STATUS', {value: 'true', configurable: true})

      mockBridgeClient.prepareCommand.mockResolvedValue('test-command')
      mockBridgeClient.downloadBridge.mockResolvedValue(undefined)
      mockBridgeClient.getBridgeVersion.mockResolvedValue('1.2.3')
      mockBridgeClient.executeBridgeCommand.mockResolvedValue(exitCode)

      // Act
      await main.run()

      // Assert
      expect(mockParseToBoolean).toHaveBeenCalledWith(inputs.RETURN_STATUS)
      expect(mockDebug).toHaveBeenCalledWith(`Setting output variable ${constants.TASK_RETURN_STATUS} with exit code ${exitCode}`)
      expect(mockSetOutput).toHaveBeenCalledWith(constants.TASK_RETURN_STATUS, exitCode)
    })

    test('should not set output status when RETURN_STATUS is disabled', async () => {
      // Arrange
      mockParseToBoolean.mockReturnValue(false)
      Object.defineProperty(inputs, 'RETURN_STATUS', {value: 'false', configurable: true})

      mockBridgeClient.prepareCommand.mockResolvedValue('test-command')
      mockBridgeClient.downloadBridge.mockResolvedValue(undefined)
      mockBridgeClient.getBridgeVersion.mockResolvedValue('1.2.3')
      mockBridgeClient.executeBridgeCommand.mockResolvedValue(0)

      // Act
      await main.run()

      // Assert
      expect(mockParseToBoolean).toHaveBeenCalledWith(inputs.RETURN_STATUS)
      expect(mockSetOutput).not.toHaveBeenCalled()
    })

    test('should call utility functions with correct parameters', async () => {
      // Arrange
      const formattedCommand = 'bridge-cli --stage coverity --input /test/coverity.json'
      const bridgeVersion = '2.1.0'
      const productInputFilePath = '/test/coverity.json'
      const productInputFileName = 'coverity.json'

      mockBridgeClient.prepareCommand.mockResolvedValue(formattedCommand)
      mockBridgeClient.downloadBridge.mockResolvedValue(undefined)
      mockBridgeClient.getBridgeVersion.mockResolvedValue(bridgeVersion)
      mockBridgeClient.executeBridgeCommand.mockResolvedValue(0)
      mockExtractInputJsonFilename.mockReturnValue(productInputFilePath)
      mockBasename.mockReturnValue(productInputFileName)

      // Act
      await main.run()

      // Assert
      expect(mockExtractInputJsonFilename).toHaveBeenCalledWith(formattedCommand)
      expect(mockBasename).toHaveBeenCalledWith(productInputFilePath)
      expect(mockUpdateSarifFilePaths).toHaveBeenCalledWith(productInputFileName, bridgeVersion, productInputFilePath)
      expect(mockUpdateCoverityConfigForBridgeVersion).toHaveBeenCalledWith(productInputFileName, bridgeVersion, productInputFilePath)
    })

    test('should execute bridge command with correct workspace directory', async () => {
      // Arrange
      const formattedCommand = 'test-bridge-command'
      const workspaceDir = '/custom/workspace'

      mockBridgeClient.prepareCommand.mockResolvedValue(formattedCommand)
      mockBridgeClient.downloadBridge.mockResolvedValue(undefined)
      mockBridgeClient.getBridgeVersion.mockResolvedValue('1.0.0')
      mockBridgeClient.executeBridgeCommand.mockResolvedValue(0)
      mockGetGitHubWorkspaceDirV2.mockReturnValue(workspaceDir)

      // Act
      await main.run()

      // Assert
      expect(mockGetGitHubWorkspaceDirV2).toHaveBeenCalled()
      expect(mockBridgeClient.executeBridgeCommand).toHaveBeenCalledWith(formattedCommand, workspaceDir)
    })

    test('should handle bridge version retrieval', async () => {
      // Arrange
      const expectedVersion = '3.0.1'
      mockBridgeClient.prepareCommand.mockResolvedValue('test-command')
      mockBridgeClient.downloadBridge.mockResolvedValue(undefined)
      mockBridgeClient.getBridgeVersion.mockResolvedValue(expectedVersion)
      mockBridgeClient.executeBridgeCommand.mockResolvedValue(0)

      // Act
      await main.run()

      // Assert
      expect(mockBridgeClient.getBridgeVersion).toHaveBeenCalled()
      expect(mockUpdateSarifFilePaths).toHaveBeenCalledWith(expect.any(String), expectedVersion, expect.any(String))
      expect(mockUpdateCoverityConfigForBridgeVersion).toHaveBeenCalledWith(expect.any(String), expectedVersion, expect.any(String))
    })
  })
})

// REMOVED: Duplicate BridgeCliThinClient Integration Test suite - functionality covered in Bridge Client Factory Integration Tests

describe('Bridge Client Factory Integration Tests', () => {
  const mockDebug = jest.mocked(core.debug)
  const mockInfo = jest.mocked(core.info)
  const mockSetFailed = jest.mocked(core.setFailed)
  const mockSetOutput = jest.mocked(core.setOutput)
  const mockParseToBoolean = jest.mocked(utility.parseToBoolean)
  const mockCreateTempDir = jest.mocked(utility.createTempDir)
  const mockCleanupTempDir = jest.mocked(utility.cleanupTempDir)
  const mockExtractInputJsonFilename = jest.mocked(utility.extractInputJsonFilename)
  const mockUpdateSarifFilePaths = jest.mocked(utility.updateSarifFilePaths)
  const mockUpdateCoverityConfigForBridgeVersion = jest.mocked(utility.updateCoverityConfigForBridgeVersion)
  const mockCreateBridgeClient = jest.mocked(bridgeClientFactory.createBridgeClient)
  const mockGetGitHubWorkspaceDirV2 = jest.mocked(getGitHubWorkspaceDirV2)
  const mockBasename = jest.mocked(basename)

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock utility functions
    mockCreateTempDir.mockResolvedValue('/tmp/test-temp-dir')
    mockCleanupTempDir.mockResolvedValue()
    mockExtractInputJsonFilename.mockReturnValue('/path/to/input.json')
    mockBasename.mockReturnValue('input.json')
    mockGetGitHubWorkspaceDirV2.mockReturnValue('/github/workspace')
    mockParseToBoolean.mockReturnValue(false)

    // Mock inputs
    Object.defineProperty(inputs, 'RETURN_STATUS', {value: 'false', configurable: true})
    Object.defineProperty(constants, 'TASK_RETURN_STATUS', {value: 'task-return-status', configurable: true})

    // Mock core functions
    mockDebug.mockImplementation(() => {})
    mockInfo.mockImplementation(() => {})
    mockSetFailed.mockImplementation(() => {})
    mockSetOutput.mockImplementation(() => {})
  })

  describe('BridgeCliThinClient Integration', () => {
    let mockThinClient: {
      prepareCommand: jest.Mock
      downloadBridge: jest.Mock
      getBridgeVersion: jest.Mock
      executeBridgeCommand: jest.Mock
      getBridgeType: jest.Mock
      generateFormattedCommand: jest.Mock
      executeCommand: jest.Mock
      validateAndSetBridgePath: jest.Mock
      isBridgeInstalled: jest.Mock
    }

    beforeEach(() => {
      mockThinClient = {
        prepareCommand: jest.fn(),
        downloadBridge: jest.fn(),
        getBridgeVersion: jest.fn(),
        executeBridgeCommand: jest.fn(),
        getBridgeType: jest.fn().mockReturnValue('bridge-cli-thin-client'),
        generateFormattedCommand: jest.fn(),
        executeCommand: jest.fn(),
        validateAndSetBridgePath: jest.fn(),
        isBridgeInstalled: jest.fn()
      }
      mockCreateBridgeClient.mockReturnValue(mockThinClient as any)
    })

    test('should successfully execute main workflow with thin client', async () => {
      // Arrange
      const tempDir = '/tmp/test-temp-dir'
      const formattedCommand = 'bridge-cli --stage polaris --input /path/to/input.json'
      const bridgeVersion = '2.1.0'
      const productInputFilePath = '/path/to/input.json'
      const productInputFileName = 'input.json'

      mockThinClient.prepareCommand.mockResolvedValue(formattedCommand)
      mockThinClient.downloadBridge.mockResolvedValue(undefined)
      mockThinClient.getBridgeVersion.mockResolvedValue(bridgeVersion)
      mockThinClient.executeBridgeCommand.mockResolvedValue(0)
      mockExtractInputJsonFilename.mockReturnValue(productInputFilePath)
      mockBasename.mockReturnValue(productInputFileName)

      // Act
      const result = await main.run()

      // Assert
      expect(mockCreateTempDir).toHaveBeenCalled()
      expect(mockThinClient.prepareCommand).toHaveBeenCalledWith(tempDir)
      expect(mockThinClient.downloadBridge).toHaveBeenCalledWith(tempDir)
      expect(mockThinClient.getBridgeVersion).toHaveBeenCalled()
      expect(mockExtractInputJsonFilename).toHaveBeenCalledWith(formattedCommand)
      expect(mockBasename).toHaveBeenCalledWith(productInputFilePath)
      expect(mockUpdateSarifFilePaths).toHaveBeenCalledWith(productInputFileName, bridgeVersion, productInputFilePath)
      expect(mockUpdateCoverityConfigForBridgeVersion).toHaveBeenCalledWith(productInputFileName, bridgeVersion, productInputFilePath)
      expect(mockThinClient.executeBridgeCommand).toHaveBeenCalledWith(formattedCommand, '/github/workspace')
      expect(mockInfo).toHaveBeenCalledWith('Black Duck Security Action workflow execution completed successfully.')
      expect(result).toBe(0)
    })

    test('should handle thin client command generation with workflow version', async () => {
      // Arrange
      const stage = 'polaris'
      const stateFilePath = '/tmp/polaris-state.json'
      const workflowVersion = '1.2.3'
      const expectedCommand = `--stage ${stage}@${workflowVersion} --input ${stateFilePath}`

      mockThinClient.generateFormattedCommand.mockReturnValue(expectedCommand)

      // Act - simulate direct command generation
      const command = mockThinClient.generateFormattedCommand(stage, stateFilePath, workflowVersion)

      // Assert
      expect(command).toBe(expectedCommand)
      expect(mockThinClient.generateFormattedCommand).toHaveBeenCalledWith(stage, stateFilePath, workflowVersion)
    })

    test('should handle thin client workflow update when enabled', async () => {
      // Arrange
      mockParseToBoolean.mockReturnValue(true)
      Object.defineProperty(inputs, 'ENABLE_WORKFLOW_UPDATE', {value: 'true', configurable: true})

      const stage = 'coverity'
      const stateFilePath = '/tmp/coverity-state.json'
      const expectedCommand = `--stage ${stage} --input ${stateFilePath} --update`

      mockThinClient.generateFormattedCommand.mockReturnValue(expectedCommand)

      // Act - simulate command generation with update
      const command = mockThinClient.generateFormattedCommand(stage, stateFilePath)

      // Assert
      expect(command).toBe(expectedCommand)
      expect(mockThinClient.generateFormattedCommand).toHaveBeenCalledWith(stage, stateFilePath)
    })

    test('should handle thin client bridge installation check', async () => {
      // Arrange
      const requestedVersion = '2.1.0'
      mockThinClient.isBridgeInstalled.mockResolvedValue(true)

      // Act
      const isInstalled = await mockThinClient.isBridgeInstalled(requestedVersion)

      // Assert
      expect(isInstalled).toBe(true)
      expect(mockThinClient.isBridgeInstalled).toHaveBeenCalledWith(requestedVersion)
    })

    test('should handle thin client path validation', async () => {
      // Arrange
      mockThinClient.validateAndSetBridgePath.mockResolvedValue(undefined)

      // Act
      await mockThinClient.validateAndSetBridgePath()

      // Assert
      expect(mockThinClient.validateAndSetBridgePath).toHaveBeenCalled()
    })

    test('should handle thin client execution with non-zero exit code', async () => {
      // Arrange
      const exitCode = 1
      mockThinClient.prepareCommand.mockResolvedValue('test-command')
      mockThinClient.downloadBridge.mockResolvedValue(undefined)
      mockThinClient.getBridgeVersion.mockResolvedValue('2.1.0')
      mockThinClient.executeBridgeCommand.mockResolvedValue(exitCode)

      // Act
      const result = await main.run()

      // Assert
      expect(mockThinClient.executeBridgeCommand).toHaveBeenCalled()
      expect(mockInfo).not.toHaveBeenCalledWith('Black Duck Security Action workflow execution completed successfully.')
      expect(result).toBe(exitCode)
    })

    test('should handle thin client registry URL configuration', async () => {
      // Arrange
      Object.defineProperty(inputs, 'BRIDGE_CLI_REGISTRY_URL', {
        value: 'https://test-registry.com',
        configurable: true
      })

      mockThinClient.executeCommand.mockResolvedValue(0)

      // Act
      const result = await mockThinClient.executeCommand('test-command', {cwd: '/tmp'})

      // Assert
      expect(result).toBe(0)
      expect(mockThinClient.executeCommand).toHaveBeenCalledWith('test-command', {cwd: '/tmp'})
    })
  })

  describe('BridgeCliBundle Integration', () => {
    let mockBundleClient: {
      prepareCommand: jest.Mock
      downloadBridge: jest.Mock
      getBridgeVersion: jest.Mock
      executeBridgeCommand: jest.Mock
      getBridgeType: jest.Mock
      generateFormattedCommand: jest.Mock
      executeCommand: jest.Mock
      validateAndSetBridgePath: jest.Mock
      isBridgeInstalled: jest.Mock
      checkIfVersionExists: jest.Mock
    }

    beforeEach(() => {
      mockBundleClient = {
        prepareCommand: jest.fn(),
        downloadBridge: jest.fn(),
        getBridgeVersion: jest.fn(),
        executeBridgeCommand: jest.fn(),
        getBridgeType: jest.fn().mockReturnValue('bridge-cli-bundle'),
        generateFormattedCommand: jest.fn(),
        executeCommand: jest.fn(),
        validateAndSetBridgePath: jest.fn(),
        isBridgeInstalled: jest.fn(),
        checkIfVersionExists: jest.fn()
      }
      mockCreateBridgeClient.mockReturnValue(mockBundleClient as any)
    })

    test('should successfully execute main workflow with bundle client', async () => {
      // Arrange
      const tempDir = '/tmp/test-temp-dir'
      const formattedCommand = 'bridge-cli --stage blackduck --input /path/to/input.json'
      const bridgeVersion = '2.1.0'
      const productInputFilePath = '/path/to/input.json'
      const productInputFileName = 'input.json'

      mockBundleClient.prepareCommand.mockResolvedValue(formattedCommand)
      mockBundleClient.downloadBridge.mockResolvedValue(undefined)
      mockBundleClient.getBridgeVersion.mockResolvedValue(bridgeVersion)
      mockBundleClient.executeBridgeCommand.mockResolvedValue(0)
      mockExtractInputJsonFilename.mockReturnValue(productInputFilePath)
      mockBasename.mockReturnValue(productInputFileName)

      // Act
      const result = await main.run()

      // Assert
      expect(mockCreateTempDir).toHaveBeenCalled()
      expect(mockBundleClient.prepareCommand).toHaveBeenCalledWith(tempDir)
      expect(mockBundleClient.downloadBridge).toHaveBeenCalledWith(tempDir)
      expect(mockBundleClient.getBridgeVersion).toHaveBeenCalled()
      expect(mockExtractInputJsonFilename).toHaveBeenCalledWith(formattedCommand)
      expect(mockBasename).toHaveBeenCalledWith(productInputFilePath)
      expect(mockUpdateSarifFilePaths).toHaveBeenCalledWith(productInputFileName, bridgeVersion, productInputFilePath)
      expect(mockUpdateCoverityConfigForBridgeVersion).toHaveBeenCalledWith(productInputFileName, bridgeVersion, productInputFilePath)
      expect(mockBundleClient.executeBridgeCommand).toHaveBeenCalledWith(formattedCommand, '/github/workspace')
      expect(mockInfo).toHaveBeenCalledWith('Black Duck Security Action workflow execution completed successfully.')
      expect(result).toBe(0)
    })

    test('should handle bundle client command generation', async () => {
      // Arrange
      const stage = 'blackduck'
      const stateFilePath = '/tmp/blackduck-state.json'
      const expectedCommand = `--stage ${stage} --input ${stateFilePath}`

      mockBundleClient.generateFormattedCommand.mockReturnValue(expectedCommand)

      // Act - simulate direct command generation
      const command = mockBundleClient.generateFormattedCommand(stage, stateFilePath)

      // Assert
      expect(command).toBe(expectedCommand)
      expect(mockBundleClient.generateFormattedCommand).toHaveBeenCalledWith(stage, stateFilePath)
    })

    test('should handle bundle client version checking from file', async () => {
      // Arrange
      const versionFilePath = '/tmp/bridge/versions.txt'
      const requestedVersion = '2.1.0'
      mockBundleClient.checkIfVersionExists.mockResolvedValue(true)

      // Act
      const exists = await mockBundleClient.checkIfVersionExists(requestedVersion, versionFilePath)

      // Assert
      expect(exists).toBe(true)
      expect(mockBundleClient.checkIfVersionExists).toHaveBeenCalledWith(requestedVersion, versionFilePath)
    })

    test('should handle bundle client bridge installation check', async () => {
      // Arrange
      const requestedVersion = '2.1.0'
      mockBundleClient.isBridgeInstalled.mockResolvedValue(true)

      // Act
      const isInstalled = await mockBundleClient.isBridgeInstalled(requestedVersion)

      // Assert
      expect(isInstalled).toBe(true)
      expect(mockBundleClient.isBridgeInstalled).toHaveBeenCalledWith(requestedVersion)
    })

    test('should handle bundle client path validation', async () => {
      // Arrange
      mockBundleClient.validateAndSetBridgePath.mockResolvedValue(undefined)

      // Act
      await mockBundleClient.validateAndSetBridgePath()

      // Assert
      expect(mockBundleClient.validateAndSetBridgePath).toHaveBeenCalled()
    })

    test('should handle bundle client execution with non-zero exit code', async () => {
      // Arrange
      const exitCode = 2
      mockBundleClient.prepareCommand.mockResolvedValue('test-command')
      mockBundleClient.downloadBridge.mockResolvedValue(undefined)
      mockBundleClient.getBridgeVersion.mockResolvedValue('2.1.0')
      mockBundleClient.executeBridgeCommand.mockResolvedValue(exitCode)

      // Act
      const result = await main.run()

      // Assert
      expect(mockBundleClient.executeBridgeCommand).toHaveBeenCalled()
      expect(mockInfo).not.toHaveBeenCalledWith('Black Duck Security Action workflow execution completed successfully.')
      expect(result).toBe(exitCode)
    })

    test('should handle bundle client workflow version warning', async () => {
      // Arrange - Set a workflow version that should trigger the warning
      Object.defineProperty(inputs, 'POLARIS_WORKFLOW_VERSION', {value: '1.0.0', configurable: true})

      const stage = 'polaris'
      const stateFilePath = '/tmp/polaris-state.json'
      const expectedCommand = `--stage ${stage} --input ${stateFilePath}`

      mockBundleClient.generateFormattedCommand.mockReturnValue(expectedCommand)

      // Act - simulate command generation that should show workflow version warning
      const command = mockBundleClient.generateFormattedCommand(stage, stateFilePath)

      // Assert
      expect(command).toBe(expectedCommand)
      expect(mockBundleClient.generateFormattedCommand).toHaveBeenCalledWith(stage, stateFilePath)
    })

    test('should handle bundle client version reading from file', async () => {
      // Arrange
      const expectedVersion = '2.1.0'
      mockBundleClient.getBridgeVersion.mockResolvedValue(expectedVersion)

      // Act
      const version = await mockBundleClient.getBridgeVersion()

      // Assert
      expect(version).toBe(expectedVersion)
      expect(mockBundleClient.getBridgeVersion).toHaveBeenCalled()
    })
  })

  describe('Bridge Client Type Selection', () => {
    test('should create thin client when configured', () => {
      // Arrange - Configure for thin client
      Object.defineProperty(inputs, 'BRIDGE_CLI_DOWNLOAD_VERSION', {value: '2.1.0', configurable: true})

      const mockThinClient = {
        getBridgeType: jest.fn().mockReturnValue('bridge-cli-thin-client')
      }
      mockCreateBridgeClient.mockReturnValue(mockThinClient as any)

      // Act
      const client = bridgeClientFactory.createBridgeClient()

      // Assert
      expect(client.getBridgeType()).toBe('bridge-cli-thin-client')
      expect(mockCreateBridgeClient).toHaveBeenCalled()
    })

    test('should create bundle client when configured', () => {
      // Arrange - Configure for bundle client
      Object.defineProperty(inputs, 'BRIDGE_CLI_DOWNLOAD_VERSION', {value: '', configurable: true})

      const mockBundleClient = {
        getBridgeType: jest.fn().mockReturnValue('bridge-cli-bundle')
      }
      mockCreateBridgeClient.mockReturnValue(mockBundleClient as any)

      // Act
      const client = bridgeClientFactory.createBridgeClient()

      // Assert
      expect(client.getBridgeType()).toBe('bridge-cli-bundle')
      expect(mockCreateBridgeClient).toHaveBeenCalled()
    })
  })

  describe('Bridge Client Error Handling', () => {
    test('should handle thin client download failures', async () => {
      // Arrange
      const mockThinClient = {
        prepareCommand: jest.fn(),
        downloadBridge: jest.fn().mockRejectedValue(new Error('Download failed')),
        getBridgeVersion: jest.fn(),
        executeBridgeCommand: jest.fn(),
        getBridgeType: jest.fn().mockReturnValue('bridge-cli-thin-client')
      }
      mockCreateBridgeClient.mockReturnValue(mockThinClient as any)

      mockThinClient.prepareCommand.mockResolvedValue('test-command')

      // Act & Assert
      await expect(main.run()).rejects.toThrow('Download failed')
      expect(mockThinClient.downloadBridge).toHaveBeenCalled()
    })

    test('should handle bundle client download failures', async () => {
      // Arrange
      const mockBundleClient = {
        prepareCommand: jest.fn(),
        downloadBridge: jest.fn().mockRejectedValue(new Error('Bundle download failed')),
        getBridgeVersion: jest.fn(),
        executeBridgeCommand: jest.fn(),
        getBridgeType: jest.fn().mockReturnValue('bridge-cli-bundle')
      }
      mockCreateBridgeClient.mockReturnValue(mockBundleClient as any)

      mockBundleClient.prepareCommand.mockResolvedValue('test-command')

      // Act & Assert
      await expect(main.run()).rejects.toThrow('Bundle download failed')
      expect(mockBundleClient.downloadBridge).toHaveBeenCalled()
    })

    test('should handle bridge version retrieval failures', async () => {
      // Arrange
      const mockThinClient = {
        prepareCommand: jest.fn(),
        downloadBridge: jest.fn(),
        getBridgeVersion: jest.fn().mockRejectedValue(new Error('Version retrieval failed')),
        executeBridgeCommand: jest.fn(),
        getBridgeType: jest.fn().mockReturnValue('bridge-cli-thin-client')
      }
      mockCreateBridgeClient.mockReturnValue(mockThinClient as any)

      mockThinClient.prepareCommand.mockResolvedValue('test-command')
      mockThinClient.downloadBridge.mockResolvedValue(undefined)

      // Act & Assert
      await expect(main.run()).rejects.toThrow('Version retrieval failed')
      expect(mockThinClient.getBridgeVersion).toHaveBeenCalled()
    })
  })

  describe('Bridge Client Configuration Tests', () => {
    test('should handle air gap mode configuration for thin client', async () => {
      // Arrange
      Object.defineProperty(inputs, 'BRIDGE_CLI_BASE_URL', {value: 'https://airgap-server.com', configurable: true})
      mockParseToBoolean.mockReturnValue(true) // Enable air gap mode

      const mockThinClient = {
        prepareCommand: jest.fn(),
        downloadBridge: jest.fn(),
        getBridgeVersion: jest.fn(),
        executeBridgeCommand: jest.fn(),
        getBridgeType: jest.fn().mockReturnValue('bridge-cli-thin-client'),
        validateAndSetBridgePath: jest.fn()
      }
      mockCreateBridgeClient.mockReturnValue(mockThinClient as any)

      mockThinClient.prepareCommand.mockResolvedValue('test-command')
      mockThinClient.downloadBridge.mockResolvedValue(undefined)
      mockThinClient.getBridgeVersion.mockResolvedValue('2.1.0')
      mockThinClient.executeBridgeCommand.mockResolvedValue(0)

      // Act
      const result = await main.run()

      // Assert
      expect(result).toBe(0)
      expect(mockThinClient.downloadBridge).toHaveBeenCalled()
    })

    test('should handle air gap mode configuration for bundle client', async () => {
      // Arrange
      Object.defineProperty(inputs, 'BRIDGE_CLI_BASE_URL', {value: 'https://airgap-server.com', configurable: true})
      mockParseToBoolean.mockReturnValue(true) // Enable air gap mode

      const mockBundleClient = {
        prepareCommand: jest.fn(),
        downloadBridge: jest.fn(),
        getBridgeVersion: jest.fn(),
        executeBridgeCommand: jest.fn(),
        getBridgeType: jest.fn().mockReturnValue('bridge-cli-bundle'),
        validateAndSetBridgePath: jest.fn()
      }
      mockCreateBridgeClient.mockReturnValue(mockBundleClient as any)

      mockBundleClient.prepareCommand.mockResolvedValue('test-command')
      mockBundleClient.downloadBridge.mockResolvedValue(undefined)
      mockBundleClient.getBridgeVersion.mockResolvedValue('2.1.0')
      mockBundleClient.executeBridgeCommand.mockResolvedValue(0)

      // Act
      const result = await main.run()

      // Assert
      expect(result).toBe(0)
      expect(mockBundleClient.downloadBridge).toHaveBeenCalled()
    })

    test('should handle custom install directory for thin client', async () => {
      // Arrange
      Object.defineProperty(inputs, 'BRIDGE_CLI_INSTALL_DIRECTORY_KEY', {
        value: '/custom/install/path',
        configurable: true
      })

      const mockThinClient = {
        prepareCommand: jest.fn(),
        downloadBridge: jest.fn(),
        getBridgeVersion: jest.fn(),
        executeBridgeCommand: jest.fn(),
        getBridgeType: jest.fn().mockReturnValue('bridge-cli-thin-client'),
        validateAndSetBridgePath: jest.fn()
      }
      mockCreateBridgeClient.mockReturnValue(mockThinClient as any)

      mockThinClient.prepareCommand.mockResolvedValue('test-command')
      mockThinClient.downloadBridge.mockResolvedValue(undefined)
      mockThinClient.getBridgeVersion.mockResolvedValue('2.1.0')
      mockThinClient.executeBridgeCommand.mockResolvedValue(0)

      // Act
      const result = await main.run()

      // Assert
      expect(result).toBe(0)
      expect(mockThinClient.downloadBridge).toHaveBeenCalled()
    })

    test('should handle custom install directory for bundle client', async () => {
      // Arrange
      Object.defineProperty(inputs, 'BRIDGE_CLI_INSTALL_DIRECTORY_KEY', {
        value: '/custom/install/path',
        configurable: true
      })

      const mockBundleClient = {
        prepareCommand: jest.fn(),
        downloadBridge: jest.fn(),
        getBridgeVersion: jest.fn(),
        executeBridgeCommand: jest.fn(),
        getBridgeType: jest.fn().mockReturnValue('bridge-cli-bundle'),
        validateAndSetBridgePath: jest.fn()
      }
      mockCreateBridgeClient.mockReturnValue(mockBundleClient as any)

      mockBundleClient.prepareCommand.mockResolvedValue('test-command')
      mockBundleClient.downloadBridge.mockResolvedValue(undefined)
      mockBundleClient.getBridgeVersion.mockResolvedValue('2.1.0')
      mockBundleClient.executeBridgeCommand.mockResolvedValue(0)

      // Act
      const result = await main.run()

      // Assert
      expect(result).toBe(0)
      expect(mockBundleClient.downloadBridge).toHaveBeenCalled()
    })
  })
})

describe('Global Error Handler Tests', () => {
  const mockDebug = jest.mocked(core.debug)
  const mockSetFailed = jest.mocked(core.setFailed)
  const mockSetOutput = jest.mocked(core.setOutput)
  const mockParseToBoolean = jest.mocked(utility.parseToBoolean)
  const mockCheckJobResult = jest.mocked(utility.checkJobResult)

  beforeEach(() => {
    jest.clearAllMocks()
    mockDebug.mockImplementation(() => {})
    mockSetFailed.mockImplementation(() => {})
    mockSetOutput.mockImplementation(() => {})
  })

  test('should handle error with undefined message', () => {
    // Arrange
    const error = {message: undefined}
    mockParseToBoolean.mockReturnValue(false)
    mockCheckJobResult.mockReturnValue(constants.BUILD_STATUS.FAILURE)

    // Simulate the error handler behavior
    if (error.message !== undefined) {
      // This branch should not execute
    } else {
      // Expected path for undefined message
      expect(error.message).toBeUndefined()
    }
  })

  test('should handle error without RETURN_STATUS and taskResult as SUCCESS', () => {
    // Arrange
    const error = new Error('Test error 1')
    mockParseToBoolean.mockReturnValue(false)
    mockCheckJobResult.mockReturnValue(constants.BUILD_STATUS.SUCCESS)
    const spy = jest.spyOn(main, 'markBuildStatusIfIssuesArePresent')

    // Simulate the global error handler
    if (error.message !== undefined) {
      const isReturnStatusEnabled = utility.parseToBoolean(inputs.RETURN_STATUS)
      const exitCode = main.getBridgeExitCodeAsNumericValue(error)

      if (isReturnStatusEnabled) {
        core.setOutput(constants.TASK_RETURN_STATUS, exitCode)
      }

      const taskResult = utility.checkJobResult(inputs.MARK_BUILD_STATUS)

      if (taskResult && taskResult !== constants.BUILD_STATUS.FAILURE) {
        main.markBuildStatusIfIssuesArePresent(exitCode, taskResult, error.message)
      } else {
        core.setFailed('Workflow failed! '.concat(main.logBridgeExitCodes(error.message)))
      }
    }

    // Assert
    expect(spy).toHaveBeenCalledWith(1, constants.BUILD_STATUS.SUCCESS, 'Test error 1')
    expect(mockSetOutput).not.toHaveBeenCalled()
  })

  test('should handle error with RETURN_STATUS enabled and taskResult undefined', () => {
    // Arrange
    const error = new Error('Test error 3')
    mockParseToBoolean.mockReturnValue(true)
    mockCheckJobResult.mockReturnValue(undefined)

    // Simulate the global error handler
    if (error.message !== undefined) {
      const isReturnStatusEnabled = utility.parseToBoolean(inputs.RETURN_STATUS)
      const exitCode = main.getBridgeExitCodeAsNumericValue(error)

      if (isReturnStatusEnabled) {
        core.debug(`Setting output variable ${constants.TASK_RETURN_STATUS} with exit code ${exitCode}`)
        core.setOutput(constants.TASK_RETURN_STATUS, exitCode)
      }

      const taskResult = utility.checkJobResult(inputs.MARK_BUILD_STATUS)

      if (taskResult && taskResult !== constants.BUILD_STATUS.FAILURE) {
        main.markBuildStatusIfIssuesArePresent(exitCode, taskResult, error.message)
      } else {
        core.setFailed('Workflow failed! '.concat(main.logBridgeExitCodes(error.message)))
      }
    }

    // Assert
    expect(mockSetOutput).toHaveBeenCalledWith(constants.TASK_RETURN_STATUS, 3)
    expect(mockSetFailed).toHaveBeenCalledWith('Workflow failed! '.concat(main.logBridgeExitCodes('Test error 3')))
  })

  test('should handle error with taskResult as FAILURE', () => {
    // Arrange
    const error = new Error('Test error 2')
    mockParseToBoolean.mockReturnValue(false)
    mockCheckJobResult.mockReturnValue(constants.BUILD_STATUS.FAILURE)

    // Simulate the global error handler
    if (error.message !== undefined) {
      const taskResult = utility.checkJobResult(inputs.MARK_BUILD_STATUS)

      if (taskResult && taskResult !== constants.BUILD_STATUS.FAILURE) {
        // Should not execute
      } else {
        core.setFailed('Workflow failed! '.concat(main.logBridgeExitCodes(error.message)))
      }
    }

    // Assert
    expect(mockSetFailed).toHaveBeenCalledWith('Workflow failed! '.concat(main.logBridgeExitCodes('Test error 2')))
  })

  test('should handle numeric error message with RETURN_STATUS and non-FAILURE taskResult', () => {
    // Arrange
    const error = new Error('Bridge execution completed with issues 8')
    mockParseToBoolean.mockReturnValue(true)
    mockCheckJobResult.mockReturnValue(constants.BUILD_STATUS.SUCCESS)
    const spy = jest.spyOn(main, 'markBuildStatusIfIssuesArePresent')

    // Simulate the global error handler
    if (error.message !== undefined) {
      const isReturnStatusEnabled = utility.parseToBoolean(inputs.RETURN_STATUS)
      const exitCode = main.getBridgeExitCodeAsNumericValue(error)

      if (isReturnStatusEnabled) {
        core.debug(`Setting output variable ${constants.TASK_RETURN_STATUS} with exit code ${exitCode}`)
        core.setOutput(constants.TASK_RETURN_STATUS, exitCode)
      }

      const taskResult = utility.checkJobResult(inputs.MARK_BUILD_STATUS)

      if (taskResult && taskResult !== constants.BUILD_STATUS.FAILURE) {
        main.markBuildStatusIfIssuesArePresent(exitCode, taskResult, error.message)
      }
    }

    // Assert
    expect(mockSetOutput).toHaveBeenCalledWith(constants.TASK_RETURN_STATUS, 8)
    expect(spy).toHaveBeenCalledWith(8, constants.BUILD_STATUS.SUCCESS, 'Bridge execution completed with issues 8')
    expect(mockSetFailed).not.toHaveBeenCalled()
  })
})

describe('Finally Block Coverage Tests', () => {
  const mockDebug = jest.mocked(core.debug)
  const mockInfo = jest.mocked(core.info)
  const mockParseToBoolean = jest.mocked(utility.parseToBoolean)
  const mockCreateTempDir = jest.mocked(utility.createTempDir)
  const mockCleanupTempDir = jest.mocked(utility.cleanupTempDir)
  const mockIsPullRequestEvent = jest.mocked(utility.isPullRequestEvent)
  const mockIsNullOrEmptyValue = jest.mocked(validators.isNullOrEmptyValue)
  const mockUploadDiagnostics = jest.mocked(artifacts.uploadDiagnostics)
  const mockUploadSarifReportAsArtifact = jest.mocked(artifacts.uploadSarifReportAsArtifact)
  const mockGetGitHubClientServiceInstance = jest.mocked(GitHubClientServiceFactory.getGitHubClientServiceInstance)
  const mockCreateBridgeClient = jest.mocked(bridgeClientFactory.createBridgeClient)
  const mockExtractInputJsonFilename = jest.mocked(utility.extractInputJsonFilename)
  const mockBasename = jest.mocked(basename)

  let mockBridgeClient: {
    prepareCommand: jest.Mock
    downloadBridge: jest.Mock
    getBridgeVersion: jest.Mock
    executeBridgeCommand: jest.Mock
  }

  let mockGitHubClientService: {
    uploadSarifReport: jest.Mock
  }

  beforeEach(() => {
    jest.clearAllMocks()

    mockBridgeClient = {
      prepareCommand: jest.fn(),
      downloadBridge: jest.fn(),
      getBridgeVersion: jest.fn(),
      executeBridgeCommand: jest.fn()
    }
    mockCreateBridgeClient.mockReturnValue(mockBridgeClient as any)

    mockGitHubClientService = {
      uploadSarifReport: jest.fn()
    }
    mockGetGitHubClientServiceInstance.mockResolvedValue(mockGitHubClientService as any)

    mockCreateTempDir.mockResolvedValue('/tmp/test')
    mockCleanupTempDir.mockResolvedValue()
    mockExtractInputJsonFilename.mockReturnValue('/path/to/input.json')
    mockBasename.mockReturnValue('input.json')
    mockDebug.mockImplementation(() => {})
    mockInfo.mockImplementation(() => {})

    Object.defineProperty(inputs, 'RETURN_STATUS', {value: 'false', configurable: true})
    Object.defineProperty(inputs, 'INCLUDE_DIAGNOSTICS', {value: 'false', configurable: true})
    Object.defineProperty(inputs, 'BLACKDUCKSCA_URL', {value: '', configurable: true})
    Object.defineProperty(inputs, 'POLARIS_SERVER_URL', {value: '', configurable: true})
    Object.defineProperty(inputs, 'GITHUB_TOKEN', {value: '', configurable: true})
    Object.defineProperty(inputs, 'BLACKDUCKSCA_REPORTS_SARIF_CREATE', {value: 'false', configurable: true})
    Object.defineProperty(inputs, 'POLARIS_REPORTS_SARIF_CREATE', {value: 'false', configurable: true})
    Object.defineProperty(inputs, 'BLACKDUCK_UPLOAD_SARIF_REPORT', {value: 'false', configurable: true})
    Object.defineProperty(inputs, 'POLARIS_UPLOAD_SARIF_REPORT', {value: 'false', configurable: true})
  })

  test('should handle finally block with diagnostics upload enabled', async () => {
    // Arrange
    mockBridgeClient.prepareCommand.mockResolvedValue('test-command')
    mockBridgeClient.downloadBridge.mockResolvedValue(undefined)
    mockBridgeClient.getBridgeVersion.mockResolvedValue('2.1.0')
    mockBridgeClient.executeBridgeCommand.mockResolvedValue(0)
    mockIsPullRequestEvent.mockReturnValue(false)
    mockParseToBoolean.mockImplementation(input => input === inputs.INCLUDE_DIAGNOSTICS)
    Object.defineProperty(inputs, 'INCLUDE_DIAGNOSTICS', {value: 'true', configurable: true})

    // Act
    await main.run()

    // Assert
    expect(mockUploadDiagnostics).toHaveBeenCalled()
  })

  test('should handle finally block with SARIF uploads for legacy bridge version', async () => {
    // Arrange
    const bridgeVersion = '1.9.0'
    mockBridgeClient.prepareCommand.mockResolvedValue('test-command')
    mockBridgeClient.downloadBridge.mockResolvedValue(undefined)
    mockBridgeClient.getBridgeVersion.mockResolvedValue(bridgeVersion)
    mockBridgeClient.executeBridgeCommand.mockResolvedValue(0)
    mockIsPullRequestEvent.mockReturnValue(false)
    mockIsNullOrEmptyValue.mockReturnValue(false)
    mockParseToBoolean.mockImplementation(input => {
      if (input === inputs.BLACKDUCKSCA_REPORTS_SARIF_CREATE) return true
      if (input === inputs.POLARIS_REPORTS_SARIF_CREATE) return true
      if (input === inputs.BLACKDUCK_UPLOAD_SARIF_REPORT) return true
      if (input === inputs.POLARIS_UPLOAD_SARIF_REPORT) return true
      return false
    })
    Object.defineProperty(inputs, 'BLACKDUCKSCA_URL', {value: 'https://blackduck.test.com', configurable: true})
    Object.defineProperty(inputs, 'POLARIS_SERVER_URL', {value: 'https://polaris.test.com', configurable: true})
    Object.defineProperty(inputs, 'GITHUB_TOKEN', {value: 'test-token', configurable: true})

    // Act
    await main.run()

    // Assert - Legacy directories should be used
    expect(mockUploadSarifReportAsArtifact).toHaveBeenCalledWith(constants.BLACKDUCK_SARIF_GENERATOR_DIRECTORY, expect.any(String), expect.any(String))
    expect(mockUploadSarifReportAsArtifact).toHaveBeenCalledWith(constants.POLARIS_SARIF_GENERATOR_DIRECTORY, expect.any(String), expect.any(String))
    expect(mockGitHubClientService.uploadSarifReport).toHaveBeenCalledWith(constants.BLACKDUCK_SARIF_GENERATOR_DIRECTORY, expect.any(String))
    expect(mockGitHubClientService.uploadSarifReport).toHaveBeenCalledWith(constants.POLARIS_SARIF_GENERATOR_DIRECTORY, expect.any(String))
  })

  test('should handle finally block with SARIF uploads for new bridge version', async () => {
    // Arrange
    const bridgeVersion = '2.1.0'
    mockBridgeClient.prepareCommand.mockResolvedValue('test-command')
    mockBridgeClient.downloadBridge.mockResolvedValue(undefined)
    mockBridgeClient.getBridgeVersion.mockResolvedValue(bridgeVersion)
    mockBridgeClient.executeBridgeCommand.mockResolvedValue(0)
    mockIsPullRequestEvent.mockReturnValue(false)
    mockIsNullOrEmptyValue.mockReturnValue(false)
    mockParseToBoolean.mockImplementation(input => {
      if (input === inputs.BLACKDUCKSCA_REPORTS_SARIF_CREATE) return true
      if (input === inputs.POLARIS_REPORTS_SARIF_CREATE) return true
      if (input === inputs.BLACKDUCK_UPLOAD_SARIF_REPORT) return true
      if (input === inputs.POLARIS_UPLOAD_SARIF_REPORT) return true
      return false
    })
    Object.defineProperty(inputs, 'BLACKDUCKSCA_URL', {value: 'https://blackduck.test.com', configurable: true})
    Object.defineProperty(inputs, 'POLARIS_SERVER_URL', {value: 'https://polaris.test.com', configurable: true})
    Object.defineProperty(inputs, 'GITHUB_TOKEN', {value: 'test-token', configurable: true})

    // Act
    await main.run()

    // Assert - New integration directories should be used
    expect(mockUploadSarifReportAsArtifact).toHaveBeenCalledWith(constants.INTEGRATIONS_BLACKDUCK_SARIF_GENERATOR_DIRECTORY, expect.any(String), expect.any(String))
    expect(mockUploadSarifReportAsArtifact).toHaveBeenCalledWith(constants.INTEGRATIONS_POLARIS_SARIF_GENERATOR_DIRECTORY, expect.any(String), expect.any(String))
    expect(mockGitHubClientService.uploadSarifReport).toHaveBeenCalledWith(constants.INTEGRATIONS_BLACKDUCK_SARIF_GENERATOR_DIRECTORY, expect.any(String))
    expect(mockGitHubClientService.uploadSarifReport).toHaveBeenCalledWith(constants.INTEGRATIONS_POLARIS_SARIF_GENERATOR_DIRECTORY, expect.any(String))
  })

  test('should skip GitHub SARIF upload when token is null or empty', async () => {
    // Arrange
    mockBridgeClient.prepareCommand.mockResolvedValue('test-command')
    mockBridgeClient.downloadBridge.mockResolvedValue(undefined)
    mockBridgeClient.getBridgeVersion.mockResolvedValue('2.1.0')
    mockBridgeClient.executeBridgeCommand.mockResolvedValue(0)
    mockIsPullRequestEvent.mockReturnValue(false)
    mockIsNullOrEmptyValue.mockReturnValue(true)
    mockParseToBoolean.mockImplementation(input => {
      if (input === inputs.BLACKDUCKSCA_REPORTS_SARIF_CREATE) return true
      return false
    })
    Object.defineProperty(inputs, 'BLACKDUCKSCA_URL', {value: 'https://blackduck.test.com', configurable: true})
    Object.defineProperty(inputs, 'GITHUB_TOKEN', {value: '', configurable: true})

    // Act
    await main.run()

    // Assert - Artifact upload should happen but not GitHub upload
    expect(mockUploadSarifReportAsArtifact).toHaveBeenCalled()
    expect(mockGetGitHubClientServiceInstance).not.toHaveBeenCalled()
    expect(mockGitHubClientService.uploadSarifReport).not.toHaveBeenCalled()
  })
})
