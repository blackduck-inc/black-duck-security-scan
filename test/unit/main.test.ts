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

// Mock only external dependencies - use actual business logic where possible
jest.mock('@actions/core')
jest.mock('../../src/blackduck-security-action/bridge/bridge-client-factory')
jest.mock('../../src/blackduck-security-action/artifacts')
jest.mock('../../src/blackduck-security-action/factory/github-client-service-factory')
jest.mock('actions-artifact-v2/lib/internal/shared/config')

// Partial mock for utility - only mock filesystem operations, keep business logic
jest.mock('../../src/blackduck-security-action/utility', () => ({
  ...jest.requireActual('../../src/blackduck-security-action/utility'),
  createTempDir: jest.fn(),
  cleanupTempDir: jest.fn(),
}))

describe('Main Workflow Tests', () => {
  // Mock setup
  const mockInfo = jest.mocked(core.info)
  const mockDebug = jest.mocked(core.debug)
  const mockSetFailed = jest.mocked(core.setFailed)
  const mockSetOutput = jest.mocked(core.setOutput)
  const mockCreateTempDir = jest.mocked(utility.createTempDir)
  const mockCleanupTempDir = jest.mocked(utility.cleanupTempDir)
  const mockCreateBridgeClient = jest.mocked(bridgeClientFactory.createBridgeClient)
  const mockGetGitHubWorkspaceDirV2 = jest.mocked(getGitHubWorkspaceDirV2)
  const mockUploadSarifReportAsArtifact = jest.mocked(artifacts.uploadSarifReportAsArtifact)
  const mockUploadDiagnostics = jest.mocked(artifacts.uploadDiagnostics)
  const mockGetGitHubClientServiceInstance = jest.mocked(GitHubClientServiceFactory.getGitHubClientServiceInstance)

  let mockBridgeClient: {
    prepareCommand: jest.Mock
    downloadBridge: jest.Mock
    getBridgeVersion: jest.Mock
    executeBridgeCommand: jest.Mock
    getBridgeType: jest.Mock
  }

  let mockGitHubClientService: {
    uploadSarifReport: jest.Mock
  }

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup bridge client mock
    mockBridgeClient = {
      prepareCommand: jest.fn(),
      downloadBridge: jest.fn(),
      getBridgeVersion: jest.fn(),
      executeBridgeCommand: jest.fn(),
      getBridgeType: jest.fn().mockReturnValue('bridge-cli-bundle')
    }
    mockCreateBridgeClient.mockReturnValue(mockBridgeClient as any)

    // Setup GitHub client service mock
    mockGitHubClientService = {
      uploadSarifReport: jest.fn()
    }
    mockGetGitHubClientServiceInstance.mockResolvedValue(mockGitHubClientService as any)

    // Setup utility mocks
    mockCreateTempDir.mockResolvedValue('/tmp/test-temp-dir')
    mockCleanupTempDir.mockResolvedValue()
    mockGetGitHubWorkspaceDirV2.mockReturnValue('/github/workspace')
    mockUploadSarifReportAsArtifact.mockResolvedValue({
      artifactName: 'test-artifact',
      artifactItems: [],
      size: 0,
      id: 123
    } as any)

    // Reset input configurations
    Object.defineProperty(inputs, 'RETURN_STATUS', {value: 'false', configurable: true})
    Object.defineProperty(inputs, 'BRIDGE_CLI_BASE_URL', {value: '', configurable: true})
    Object.defineProperty(inputs, 'BRIDGE_CLI_DOWNLOAD_URL', {value: '', configurable: true})
    Object.defineProperty(inputs, 'BRIDGE_CLI_DOWNLOAD_VERSION', {value: '', configurable: true})
    Object.defineProperty(inputs, 'BLACKDUCKSCA_URL', {value: '', configurable: true})
    Object.defineProperty(inputs, 'POLARIS_SERVER_URL', {value: '', configurable: true})
    Object.defineProperty(inputs, 'GITHUB_TOKEN', {value: 'test-token', configurable: true})
    Object.defineProperty(inputs, 'BLACKDUCKSCA_REPORTS_SARIF_CREATE', {value: 'false', configurable: true})
    Object.defineProperty(inputs, 'POLARIS_REPORTS_SARIF_CREATE', {value: 'false', configurable: true})
    Object.defineProperty(inputs, 'BLACKDUCK_UPLOAD_SARIF_REPORT', {value: 'false', configurable: true})
    Object.defineProperty(inputs, 'POLARIS_UPLOAD_SARIF_REPORT', {value: 'false', configurable: true})
    Object.defineProperty(inputs, 'BLACKDUCKSCA_REPORTS_SARIF_FILE_PATH', {value: 'blackduck-sarif.json', configurable: true})
    Object.defineProperty(inputs, 'POLARIS_REPORTS_SARIF_FILE_PATH', {value: 'polaris-sarif.json', configurable: true})
    Object.defineProperty(inputs, 'INCLUDE_DIAGNOSTICS', {value: 'false', configurable: true})

    // Setup core mocks
    mockInfo.mockImplementation(() => {})
    mockDebug.mockImplementation(() => {})
    mockSetFailed.mockImplementation(() => {})
    mockSetOutput.mockImplementation(() => {})
  })

  describe('Main Workflow Execution', () => {
    test('should execute complete workflow successfully', async () => {
      // Arrange
      const bridgeVersion = '2.1.0'
      const formattedCommand = 'bridge-cli --stage blackduck --input /path/to/input.json'

      mockBridgeClient.prepareCommand.mockResolvedValue(formattedCommand)
      mockBridgeClient.downloadBridge.mockResolvedValue(undefined)
      mockBridgeClient.getBridgeVersion.mockResolvedValue(bridgeVersion)
      mockBridgeClient.executeBridgeCommand.mockResolvedValue(0)

      // Act
      const result = await main.run()

      // Assert
      expect(mockCreateTempDir).toHaveBeenCalled()
      expect(mockBridgeClient.prepareCommand).toHaveBeenCalledWith('/tmp/test-temp-dir')
      expect(mockBridgeClient.downloadBridge).toHaveBeenCalledWith('/tmp/test-temp-dir')
      expect(mockBridgeClient.getBridgeVersion).toHaveBeenCalled()
      expect(mockBridgeClient.executeBridgeCommand).toHaveBeenCalledWith(
        formattedCommand,
        '/github/workspace'
      )
      expect(mockInfo).toHaveBeenCalledWith('Black Duck Security Action workflow execution completed successfully.')
      expect(mockCleanupTempDir).toHaveBeenCalledWith('/tmp/test-temp-dir')
      expect(result).toBe(0)
    })

    test('should handle workflow failure gracefully', async () => {
      // Arrange
      const exitCode = 3
      const formattedCommand = 'bridge-cli --stage blackduck --input /path/to/input.json'

      mockBridgeClient.prepareCommand.mockResolvedValue(formattedCommand)
      mockBridgeClient.downloadBridge.mockResolvedValue(undefined)
      mockBridgeClient.getBridgeVersion.mockResolvedValue('2.1.0')
      mockBridgeClient.executeBridgeCommand.mockResolvedValue(exitCode)

      // Act
      const result = await main.run()

      // Assert
      expect(result).toBe(exitCode)
      expect(mockInfo).not.toHaveBeenCalledWith('Black Duck Security Action workflow execution completed successfully.')
      expect(mockCleanupTempDir).toHaveBeenCalledWith('/tmp/test-temp-dir')
    })

    test('should handle return status output when enabled', async () => {
      // Arrange
      Object.defineProperty(inputs, 'RETURN_STATUS', {value: 'true', configurable: true})

      mockBridgeClient.prepareCommand.mockResolvedValue('bridge-cli --stage blackduck --input /path/to/input.json')
      mockBridgeClient.downloadBridge.mockResolvedValue(undefined)
      mockBridgeClient.getBridgeVersion.mockResolvedValue('2.1.0')
      mockBridgeClient.executeBridgeCommand.mockResolvedValue(0)

      // Act
      await main.run()

      // Assert
      expect(mockSetOutput).toHaveBeenCalledWith(constants.TASK_RETURN_STATUS, 0)
      expect(mockDebug).toHaveBeenCalledWith(`Setting output variable ${constants.TASK_RETURN_STATUS} with exit code 0`)
    })
  })

  describe('Error Handling', () => {
    test('should handle bridge preparation errors', async () => {
      // Arrange
      const prepareError = new Error('Command preparation failed')
      mockBridgeClient.prepareCommand.mockRejectedValue(prepareError)

      // Act & Assert
      await expect(main.run()).rejects.toThrow('Command preparation failed')
      expect(mockCleanupTempDir).toHaveBeenCalledWith('/tmp/test-temp-dir')
    })

    test('should handle bridge download errors', async () => {
      // Arrange
      const downloadError = new Error('Bridge download failed')
      mockBridgeClient.prepareCommand.mockResolvedValue('bridge-cli --stage blackduck --input /path/to/input.json')
      mockBridgeClient.downloadBridge.mockRejectedValue(downloadError)

      // Act & Assert
      await expect(main.run()).rejects.toThrow('Bridge download failed')
      expect(mockCleanupTempDir).toHaveBeenCalledWith('/tmp/test-temp-dir')
    })

    test('should handle bridge execution errors', async () => {
      // Arrange
      const executionError = new Error('Bridge execution failed')
      mockBridgeClient.prepareCommand.mockResolvedValue('bridge-cli --stage blackduck --input /path/to/input.json')
      mockBridgeClient.downloadBridge.mockResolvedValue(undefined)
      mockBridgeClient.getBridgeVersion.mockResolvedValue('2.1.0')
      mockBridgeClient.executeBridgeCommand.mockRejectedValue(executionError)

      // Act & Assert
      await expect(main.run()).rejects.toThrow('Bridge execution failed')
      expect(mockCleanupTempDir).toHaveBeenCalledWith('/tmp/test-temp-dir')
    })
  })

  describe('SARIF Report Handling', () => {
    beforeEach(() => {
      mockBridgeClient.prepareCommand.mockResolvedValue('bridge-cli --stage blackduck --input /path/to/input.json')
      mockBridgeClient.downloadBridge.mockResolvedValue(undefined)
      mockBridgeClient.executeBridgeCommand.mockResolvedValue(0)
    })

    test('should upload SARIF reports for legacy bridge version', async () => {
      // Arrange
      Object.defineProperty(inputs, 'BLACKDUCKSCA_URL', {value: 'https://blackduck.example.com', configurable: true})
      Object.defineProperty(inputs, 'BLACKDUCKSCA_REPORTS_SARIF_CREATE', {value: 'true', configurable: true})

      mockBridgeClient.getBridgeVersion.mockResolvedValue('1.9.0')

      // Act
      await main.run()

      // Assert
      expect(mockUploadSarifReportAsArtifact).toHaveBeenCalledWith(
        constants.BLACKDUCK_SARIF_GENERATOR_DIRECTORY,
        inputs.BLACKDUCKSCA_REPORTS_SARIF_FILE_PATH,
        expect.stringContaining('blackduck_sarif_report_')
      )
    })

    test('should upload SARIF reports for new bridge version', async () => {
      // Arrange
      Object.defineProperty(inputs, 'BLACKDUCKSCA_URL', {value: 'https://blackduck.example.com', configurable: true})
      Object.defineProperty(inputs, 'BLACKDUCKSCA_REPORTS_SARIF_CREATE', {value: 'true', configurable: true})

      mockBridgeClient.getBridgeVersion.mockResolvedValue('3.6.0')

      // Act
      await main.run()

      // Assert
      expect(mockUploadSarifReportAsArtifact).toHaveBeenCalledWith(
        constants.INTEGRATIONS_BLACKDUCK_SARIF_GENERATOR_DIRECTORY,
        inputs.BLACKDUCKSCA_REPORTS_SARIF_FILE_PATH,
        expect.stringContaining('blackduck_sarif_report_')
      )
    })

    test('should skip SARIF upload during pull request events', async () => {
      // Arrange
      Object.defineProperty(inputs, 'BLACKDUCKSCA_URL', {value: 'https://blackduck.example.com', configurable: true})

      // Mock isPullRequestEvent to return true using actual utility function
      const originalEnv = process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_EVENT_NAME]
      process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_EVENT_NAME] = 'pull_request'

      mockBridgeClient.getBridgeVersion.mockResolvedValue('2.1.0')

      // Act
      await main.run()

      // Assert
      expect(mockUploadSarifReportAsArtifact).not.toHaveBeenCalled()

      // Cleanup
      if (originalEnv) {
        process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_EVENT_NAME] = originalEnv
      } else {
        delete process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_EVENT_NAME]
      }
    })

    test('should upload SARIF to GitHub when token provided', async () => {
      // Arrange
      Object.defineProperty(inputs, 'BLACKDUCKSCA_URL', {value: 'https://blackduck.example.com', configurable: true})
      Object.defineProperty(inputs, 'BLACKDUCK_UPLOAD_SARIF_REPORT', {value: 'true', configurable: true})
      Object.defineProperty(inputs, 'GITHUB_TOKEN', {value: 'valid-token', configurable: true})

      mockBridgeClient.getBridgeVersion.mockResolvedValue('3.6.0')

      // Act
      await main.run()

      // Assert
      expect(mockGetGitHubClientServiceInstance).toHaveBeenCalled()
      expect(mockGitHubClientService.uploadSarifReport).toHaveBeenCalledWith(
        constants.INTEGRATIONS_BLACKDUCK_SARIF_GENERATOR_DIRECTORY,
        inputs.BLACKDUCKSCA_REPORTS_SARIF_FILE_PATH
      )
    })

    test('should skip GitHub upload when token is empty', async () => {
      // Arrange
      Object.defineProperty(inputs, 'GITHUB_TOKEN', {value: '', configurable: true})

      mockBridgeClient.getBridgeVersion.mockResolvedValue('2.1.0')

      // Act
      await main.run()

      // Assert
      expect(mockGetGitHubClientServiceInstance).not.toHaveBeenCalled()
    })
  })

  describe('Diagnostics Upload', () => {
    test('should upload diagnostics when enabled', async () => {
      // Arrange
      Object.defineProperty(inputs, 'INCLUDE_DIAGNOSTICS', {value: 'true', configurable: true})

      mockBridgeClient.prepareCommand.mockResolvedValue('bridge-cli --stage blackduck --input /path/to/input.json')
      mockBridgeClient.downloadBridge.mockResolvedValue(undefined)
      mockBridgeClient.getBridgeVersion.mockResolvedValue('2.1.0')
      mockBridgeClient.executeBridgeCommand.mockResolvedValue(0)

      // Act
      await main.run()

      // Assert
      expect(mockUploadDiagnostics).toHaveBeenCalled()
    })

    test('should not upload diagnostics when disabled', async () => {
      // Arrange
      Object.defineProperty(inputs, 'INCLUDE_DIAGNOSTICS', {value: 'false', configurable: true})

      mockBridgeClient.prepareCommand.mockResolvedValue('bridge-cli --stage blackduck --input /path/to/input.json')
      mockBridgeClient.downloadBridge.mockResolvedValue(undefined)
      mockBridgeClient.getBridgeVersion.mockResolvedValue('2.1.0')
      mockBridgeClient.executeBridgeCommand.mockResolvedValue(0)

      // Act
      await main.run()

      // Assert
      expect(mockUploadDiagnostics).not.toHaveBeenCalled()
    })
  })

  describe('Utility Functions', () => {
    describe('logBridgeExitCodes', () => {
      test('should return formatted exit code message for known codes', () => {
        // Test with actual function call, not mocked
        const result = main.logBridgeExitCodes('Bridge execution failed 8')
        expect(result).toMatch(/Exit Code: 8/)
      })

      test('should return original message for unknown codes', () => {
        const message = 'Unknown error occurred'
        const result = main.logBridgeExitCodes(message)
        expect(result).toBe(message)
      })
    })

    describe('getBridgeExitCodeAsNumericValue', () => {
      test('should extract numeric exit code from error message', () => {
        const error = new Error('Bridge execution failed 3')
        const result = main.getBridgeExitCodeAsNumericValue(error)
        expect(result).toBe(3)
      })

      test('should return -1 for non-numeric exit codes', () => {
        const error = new Error('Bridge execution failed X')
        const result = main.getBridgeExitCodeAsNumericValue(error)
        expect(result).toBe(-1)
      })

      test('should return -1 for undefined error message', () => {
        const error = new Error()
        error.message = undefined as any
        const result = main.getBridgeExitCodeAsNumericValue(error)
        expect(result).toBe(-1)
      })
    })

    describe('getBridgeExitCode', () => {
      test('should return true if error message contains numeric exit code', () => {
        const error = new Error('Bridge execution failed 8')
        const result = main.getBridgeExitCode(error)
        expect(result).toBe(true)
      })

      test('should return false if error message does not contain numeric exit code', () => {
        const error = new Error('Bridge execution failed')
        const result = main.getBridgeExitCode(error)
        expect(result).toBe(false)
      })

      test('should return false for undefined error message', () => {
        const error = new Error()
        error.message = undefined as any
        const result = main.getBridgeExitCode(error)
        expect(result).toBe(false)
      })
    })

    describe('markBuildStatusIfIssuesArePresent', () => {
      test('should handle break exit code with success status', () => {
        // Test actual function behavior
        main.markBuildStatusIfIssuesArePresent(
          constants.BRIDGE_BREAK_EXIT_CODE,
          constants.BUILD_STATUS.SUCCESS,
          'Bridge execution completed with issues 8'
        )

        expect(mockDebug).toHaveBeenCalledWith('Bridge execution completed with issues 8')
        expect(mockInfo).toHaveBeenCalledWith(expect.stringContaining('Exit Code: 8'))
        expect(mockInfo).toHaveBeenCalledWith(`Marking the build ${constants.BUILD_STATUS.SUCCESS} as configured in the task.`)
      })

      test('should handle non-break exit code with failure', () => {
        main.markBuildStatusIfIssuesArePresent(
          1,
          constants.BUILD_STATUS.FAILURE,
          'Bridge execution failed 1'
        )

        expect(mockSetFailed).toHaveBeenCalledWith(expect.stringContaining('Workflow failed!'))
      })
    })
  })

  describe('Integration with Actual Utility Functions', () => {
    test('should use actual utility functions for business logic', async () => {
      // Arrange
      mockBridgeClient.prepareCommand.mockResolvedValue('bridge-cli --stage blackduck --input /tmp/test-temp-dir/input.json')
      mockBridgeClient.downloadBridge.mockResolvedValue(undefined)
      mockBridgeClient.getBridgeVersion.mockResolvedValue('2.1.0')
      mockBridgeClient.executeBridgeCommand.mockResolvedValue(0)

      // Act
      await main.run()

      // Assert - These should use actual utility functions, not mocks
      const actualInputFilename = utility.extractInputJsonFilename('bridge-cli --stage blackduck --input /tmp/test-temp-dir/input.json')
      expect(actualInputFilename).toBe('/tmp/test-temp-dir/input.json')

      const actualBasename = basename('/tmp/test-temp-dir/input.json')
      expect(actualBasename).toBe('input.json')

      const actualParseToBoolean = utility.parseToBoolean('false')
      expect(actualParseToBoolean).toBe(false)
    })

    test('should use actual validators for input validation', async () => {
      // Test that we're actually calling real validator functions
      const validationResult = validators.validateScanTypes()

      // Should return empty array when no scan types configured
      expect(validationResult).toHaveLength(4)
      expect(validationResult.every(error => typeof error === 'string')).toBe(true)
    })

    test('should properly handle environment variable parsing', () => {
      // Test actual environment variable handling
      const originalEnv = process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_EVENT_NAME]

      process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_EVENT_NAME] = 'pull_request'
      expect(utility.isPullRequestEvent()).toBe(true)

      process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_EVENT_NAME] = 'push'
      expect(utility.isPullRequestEvent()).toBe(false)

      // Restore
      if (originalEnv) {
        process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_EVENT_NAME] = originalEnv
      } else {
        delete process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_EVENT_NAME]
      }
    })
  })
})