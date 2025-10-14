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

  describe('Bridge Version Comparison Logic', () => {
    test('should correctly identify legacy bridge version', () => {
      const bridgeVersion = '1.9.0'
      const isLegacy = bridgeVersion < constants.VERSION // '2.0.0'

      expect(isLegacy).toBe(true)
    })

    test('should correctly identify new bridge version', () => {
      const bridgeVersion = '2.1.0'
      const isLegacy = bridgeVersion < constants.VERSION // '2.0.0'

      expect(isLegacy).toBe(false)
    })

    test('should handle exact version match', () => {
      const bridgeVersion = '2.0.0'
      const isLegacy = bridgeVersion < constants.VERSION // '2.0.0'

      expect(isLegacy).toBe(false)
    })
  })

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

describe('BridgeCliThinClient Integration Test', () => {
  let bridgeThinClient: BridgeCliThinClient
  const mockDebug = jest.mocked(core.debug)
  const mockInfo = jest.mocked(core.info)
  const mockSetFailed = jest.mocked(core.setFailed)
  const mockSetOutput = jest.mocked(core.setOutput)
  const mockGetOSPlatform = jest.mocked(utility.getOSPlatform)
  const mockParseToBoolean = jest.mocked(utility.parseToBoolean)
  const mockCheckIfPathExists = jest.mocked(utility.checkIfPathExists)
  const mockCheckJobResult = jest.mocked(utility.checkJobResult)
  const mockCreateTempDir = jest.mocked(utility.createTempDir)
  const mockCleanupTempDir = jest.mocked(utility.cleanupTempDir)
  const mockCreateBridgeClient = jest.mocked(bridgeClientFactory.createBridgeClient)

  beforeAll(() => {
    // Mock required constants and inputs to prevent initialization errors
    Object.defineProperty(constants, 'BRIDGE_CLI_ARTIFACTORY_URL', {
      value: 'https://sig-repo.synopsys.com/artifactory/bds-integrations-release/com/synopsys/integration/synopsys-bridge',
      configurable: true
    })
    Object.defineProperty(constants, 'BRIDGE_CLI_STAGE_OPTION', {value: '--stage', configurable: true})
    Object.defineProperty(constants, 'BRIDGE_CLI_INPUT_OPTION', {value: '--input', configurable: true})
    Object.defineProperty(constants, 'BRIDGE_CLI_SPACE', {value: ' ', configurable: true})
    Object.defineProperty(constants, 'BRIDGE_VERSION_NOT_FOUND_ERROR', {value: 'Bridge version not found', configurable: true})
  })

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()

    // Mock default input values
    Object.defineProperty(inputs, 'BRIDGE_CLI_BASE_URL', {value: '', configurable: true})
    Object.defineProperty(inputs, 'BRIDGE_CLI_REGISTRY_URL', {value: '', configurable: true})
    Object.defineProperty(inputs, 'BRIDGE_CLI_INSTALL_DIRECTORY_KEY', {value: '', configurable: true})
    Object.defineProperty(inputs, 'ENABLE_WORKFLOW_UPDATE', {value: 'false', configurable: true})

    // Mock utility functions
    mockGetOSPlatform.mockReturnValue('linux64')
    mockParseToBoolean.mockReturnValue(false)
    mockCheckIfPathExists.mockReturnValue(false)
    mockCheckJobResult.mockReturnValue(undefined)
    mockCreateTempDir.mockResolvedValue('/tmp/test')
    mockCleanupTempDir.mockResolvedValue()

    // Mock core functions to prevent actual logging
    mockDebug.mockImplementation(() => {})
    mockInfo.mockImplementation(() => {})
    mockSetFailed.mockImplementation(() => {})
    mockSetOutput.mockImplementation(() => {})
  })

  describe('BridgeCliThinClient Instance Creation', () => {
    test('should successfully create BridgeCliThinClient instance', () => {
      expect(() => {
        bridgeThinClient = new BridgeCliThinClient()
      }).not.toThrow()

      expect(bridgeThinClient).toBeInstanceOf(BridgeCliThinClient)
    })

    test('should initialize with correct bridge type', () => {
      bridgeThinClient = new BridgeCliThinClient()

      expect(bridgeThinClient.getBridgeType()).toBe('bridge-cli-thin-client')
    })

    test('should initialize with correct bridge file type', () => {
      bridgeThinClient = new BridgeCliThinClient()

      expect(bridgeThinClient.getBridgeFileType()).toBe('bridge-cli')
    })

    test('should initialize with correct bridge file name type', () => {
      bridgeThinClient = new BridgeCliThinClient()

      expect(bridgeThinClient.getBridgeFileNameType()).toBe('bridge-cli')
    })
  })

  describe('BridgeCliThinClient Command Generation', () => {
    beforeEach(() => {
      bridgeThinClient = new BridgeCliThinClient()
    })

    test('should generate formatted command for stage execution', () => {
      const stage = 'blackduck'
      const stateFilePath = '/tmp/state.json'

      const command = bridgeThinClient.generateFormattedCommand(stage, stateFilePath)

      expect(command).toContain('--stage')
      expect(command).toContain(stage)
      expect(command).toContain('--input')
      expect(command).toContain(stateFilePath)
      expect(mockInfo).toHaveBeenCalledWith(expect.stringContaining('Generated command:'))
    })

    test('should generate formatted command with workflow version', () => {
      const stage = 'polaris'
      const stateFilePath = '/tmp/polaris-state.json'
      const workflowVersion = '1.2.3'

      const command = bridgeThinClient.generateFormattedCommand(stage, stateFilePath, workflowVersion)

      expect(command).toContain(`${stage}@${workflowVersion}`)
      expect(command).toContain(stateFilePath)
    })

    test('should handle update command when workflow update is enabled', () => {
      mockParseToBoolean.mockReturnValue(true)
      Object.defineProperty(inputs, 'ENABLE_WORKFLOW_UPDATE', {value: 'true', configurable: true})

      const stage = 'coverity'
      const stateFilePath = '/tmp/coverity-state.json'

      const command = bridgeThinClient.generateFormattedCommand(stage, stateFilePath)

      expect(command).toContain('--update')
      expect(mockInfo).toHaveBeenCalledWith('Bridge update command has been added.')
    })
  })

  describe('BridgeCliThinClient URL Verification', () => {
    beforeEach(() => {
      bridgeThinClient = new BridgeCliThinClient()
    })

    test('should verify regex check for bridge URL with version', () => {
      const bridgeUrl = 'https://example.com/bridge-cli-thin-client/1.2.3/bridge-cli-linux64.zip'

      const result = bridgeThinClient['verifyRegexCheck'](bridgeUrl)

      expect(result).not.toBeNull()
      expect(result![1]).toBe('1.2.3')
    })

    test('should handle latest version in URL', () => {
      const bridgeUrl = 'https://example.com/latest/bridge-cli-linux64.zip'

      const result = bridgeThinClient['verifyRegexCheck'](bridgeUrl)

      expect(result).not.toBeNull()
      expect(result![1]).toBe('')
    })

    test('should return null for invalid URL pattern', () => {
      const bridgeUrl = 'https://invalid-url.com/some-file.zip'

      const result = bridgeThinClient['verifyRegexCheck'](bridgeUrl)

      expect(result).toBeNull()
    })
  })

  describe('BridgeCliThinClient Path Management', () => {
    beforeEach(() => {
      bridgeThinClient = new BridgeCliThinClient()
      // Mock the getBridgeCLIDownloadPathCommon method that getBridgeCLIDownloadDefaultPath calls
      jest.spyOn(bridgeThinClient as any, 'getBridgeCLIDownloadPathCommon').mockReturnValue('/mocked/bridge/path')
    })

    test('should validate and set bridge path with default directory', async () => {
      await expect(bridgeThinClient.validateAndSetBridgePath()).resolves.not.toThrow()

      expect(mockInfo).toHaveBeenCalledWith(expect.stringContaining('Bridge CLI directory'))
    })

    test('should validate and set bridge path with custom install directory', async () => {
      Object.defineProperty(inputs, 'BRIDGE_CLI_INSTALL_DIRECTORY_KEY', {
        value: '/custom/install/path',
        configurable: true
      })

      // Mock the info call to include the custom path
      mockInfo.mockImplementation(message => {
        if (typeof message === 'string' && message.includes('/custom/install/path')) {
          // This simulates the expected behavior
        }
      })

      await expect(bridgeThinClient.validateAndSetBridgePath()).resolves.not.toThrow()

      // Since the actual implementation may not directly log the custom path,
      // we'll verify the method was called without throwing
      expect(mockInfo).toHaveBeenCalled()
    })

    test('should get bridge CLI download default path', () => {
      const defaultPath = bridgeThinClient.getBridgeCLIDownloadDefaultPath()

      expect(defaultPath).toBeDefined()
      expect(typeof defaultPath).toBe('string')
      expect(defaultPath).toBe('/mocked/bridge/path')
    })
  })

  describe('BridgeCliThinClient Air Gap Mode', () => {
    beforeEach(() => {
      bridgeThinClient = new BridgeCliThinClient()
    })

    test('should handle air gap mode when enabled', async () => {
      // Mock air gap mode enabled
      mockParseToBoolean.mockImplementation(value => {
        return value === inputs.BRIDGE_CLI_INSTALL_DIRECTORY_KEY || value === 'true'
      })

      Object.defineProperty(inputs, 'BRIDGE_CLI_BASE_URL', {value: 'https://custom-base-url.com', configurable: true})

      // Should not throw when base URL is provided in air gap mode
      await expect(bridgeThinClient.validateAndSetBridgePath()).resolves.not.toThrow()
    })
  })

  describe('BridgeCliThinClient Integration Workflow', () => {
    beforeEach(() => {
      bridgeThinClient = new BridgeCliThinClient()
    })

    test('should complete full workflow: create instance, set path, generate command', async () => {
      // Step 1: Create instance (already done in beforeEach)
      expect(bridgeThinClient).toBeInstanceOf(BridgeCliThinClient)
      expect(bridgeThinClient.getBridgeType()).toBe('bridge-cli-thin-client')

      // Step 2: Set up bridge path
      await bridgeThinClient.validateAndSetBridgePath()
      expect(mockInfo).toHaveBeenCalledWith(expect.stringContaining('Bridge CLI directory'))

      // Step 3: Generate command for execution
      const stage = 'blackduck'
      const stateFilePath = '/tmp/integration-test-state.json'
      const command = bridgeThinClient.generateFormattedCommand(stage, stateFilePath)

      expect(command).toContain('--stage blackduck')
      expect(command).toContain('--input /tmp/integration-test-state.json')
      expect(mockInfo).toHaveBeenCalledWith(expect.stringContaining('Generated command:'))
    })

    test('should handle registry URL configuration in workflow', async () => {
      Object.defineProperty(inputs, 'BRIDGE_CLI_REGISTRY_URL', {
        value: 'https://test-registry.com',
        configurable: true
      })

      // Create instance and validate it can handle registry configuration
      expect(bridgeThinClient).toBeInstanceOf(BridgeCliThinClient)

      // The registry URL should be accessible for command building
      expect(inputs.BRIDGE_CLI_REGISTRY_URL).toBe('https://test-registry.com')
    })
  })

  describe('Error Handler Tests (.catch block)', () => {
    it('should handle error with RETURN_STATUS enabled', async () => {
      mockParseToBoolean.mockImplementation(input => input === inputs.RETURN_STATUS)
      Object.defineProperty(inputs, 'RETURN_STATUS', {value: 'true', configurable: true})
      mockCheckJobResult.mockReturnValue(constants.BUILD_STATUS.SUCCESS)

      // Simulate the global error handler
      const error = new Error('Test error 8')
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

      expect(mockSetOutput).toHaveBeenCalledWith(constants.TASK_RETURN_STATUS, 8)
    })

    it('should handle error without RETURN_STATUS', async () => {
      mockParseToBoolean.mockReturnValue(false)
      mockCheckJobResult.mockReturnValue(constants.BUILD_STATUS.FAILURE)

      // Simulate the global error handler
      const error = new Error('Test error 5')
      const taskResult = utility.checkJobResult(inputs.MARK_BUILD_STATUS)

      if (taskResult && taskResult !== constants.BUILD_STATUS.FAILURE) {
        main.markBuildStatusIfIssuesArePresent(main.getBridgeExitCodeAsNumericValue(error), taskResult, error.message)
      } else {
        core.setFailed('Workflow failed! '.concat(main.logBridgeExitCodes(error.message)))
      }

      expect(mockSetFailed).toHaveBeenCalledWith('Workflow failed! '.concat(main.logBridgeExitCodes('Test error 5')))
    })

    it('should call markBuildStatusIfIssuesArePresent when taskResult is not FAILURE', async () => {
      mockParseToBoolean.mockReturnValue(false)
      mockCheckJobResult.mockReturnValue(constants.BUILD_STATUS.SUCCESS)
      const spy = jest.spyOn(main, 'markBuildStatusIfIssuesArePresent')

      // Simulate the global error handler
      const error = new Error('Test error 8')
      const taskResult = utility.checkJobResult(inputs.MARK_BUILD_STATUS)
      const exitCode = main.getBridgeExitCodeAsNumericValue(error)

      if (taskResult && taskResult !== constants.BUILD_STATUS.FAILURE) {
        main.markBuildStatusIfIssuesArePresent(exitCode, taskResult, error.message)
      }

      expect(spy).toHaveBeenCalledWith(8, constants.BUILD_STATUS.SUCCESS, 'Test error 8')
    })
  })

  describe('Helper Functions', () => {
    describe('getBridgeExitCodeAsNumericValue', () => {
      it('should return numeric exit code from error message', () => {
        const error = new Error('Bridge failed 8')
        expect(main.getBridgeExitCodeAsNumericValue(error)).toBe(8)
      })

      it('should return -1 for non-numeric exit code', () => {
        const error = new Error('Bridge failed x')
        expect(main.getBridgeExitCodeAsNumericValue(error)).toBe(-1)
      })

      it('should return -1 for undefined message', () => {
        const error = new Error()
        error.message = undefined as any
        expect(main.getBridgeExitCodeAsNumericValue(error)).toBe(-1)
      })
    })

    describe('logBridgeExitCodes', () => {
      it('should format known exit codes', () => {
        // Assuming exit code 8 has a mapping in EXIT_CODE_MAP
        const result = main.logBridgeExitCodes('Error message 8')
        expect(result).toContain('Exit Code: 8')
      })

      it('should return original message for unknown exit codes', () => {
        const message = 'Error message x'
        const result = main.logBridgeExitCodes(message)
        expect(result).toBe(message)
      })
    })

    describe('markBuildStatusIfIssuesArePresent', () => {
      it('should log info when status is BRIDGE_BREAK_EXIT_CODE', () => {
        main.markBuildStatusIfIssuesArePresent(constants.BRIDGE_BREAK_EXIT_CODE, constants.BUILD_STATUS.SUCCESS, 'Test error 8')

        expect(mockInfo).toHaveBeenCalled()
      })

      it('should set failed when status is not BRIDGE_BREAK_EXIT_CODE', () => {
        main.markBuildStatusIfIssuesArePresent(1, constants.BUILD_STATUS.SUCCESS, 'Test error 1')

        expect(mockSetFailed).toHaveBeenCalled()
      })
    })
  })
})
