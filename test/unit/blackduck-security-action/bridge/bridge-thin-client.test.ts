import {BridgeCliThinClient} from '../../../../src/blackduck-security-action/bridge/bridge-cli-thin-client'
import * as downloadUtility from '../../../../src/blackduck-security-action/download-utility'
import * as utility from '../../../../src/blackduck-security-action/utility'
import * as core from '@actions/core'
import {execSync} from 'node:child_process'
import * as inputs from '../../../../src/blackduck-security-action/inputs'
import * as constants from '../../../../src/application-constants'
import path from 'path' // Mock external dependencies

// Mock external dependencies
jest.mock('@actions/core')
jest.mock('node:child_process')
jest.mock('../../../../src/blackduck-security-action/utility')
jest.mock('../../../../src/blackduck-security-action/download-utility')
jest.mock('path')

describe('BridgeThinClient', () => {
  let bridgeThinClient: BridgeCliThinClient
  const mockDebug = jest.mocked(core.debug)
  const mockInfo = jest.mocked(core.info)
  const mockExecSync = jest.mocked(execSync)
  const mockGetOSPlatform = jest.mocked(utility.getOSPlatform)
  const mockParseToBoolean = jest.mocked(utility.parseToBoolean)
  const mockExtractZipped = jest.mocked(downloadUtility.extractZipped)
  const mockPathJoin = jest.mocked(path.join)
  const mockPathBasename = jest.mocked(path.basename)

  beforeEach(() => {
    // Mock required inputs and constants to prevent initialization errors
    Object.defineProperty(inputs, 'BRIDGE_CLI_BASE_URL', {value: 'https://example.com', configurable: true})
    Object.defineProperty(constants, 'BRIDGE_CLI_ARTIFACTORY_URL', {value: 'https://default.example.com', configurable: true})
    Object.defineProperty(constants, 'BRIDGE_CLI_STAGE_OPTION', {value: '--stage', configurable: true})
    Object.defineProperty(constants, 'BRIDGE_CLI_INPUT_OPTION', {value: '--input', configurable: true})
    Object.defineProperty(constants, 'BRIDGE_CLI_SPACE', {value: ' ', configurable: true})

    // Mock air gap mode to false by default to avoid initialization issues
    mockParseToBoolean.mockReturnValue(false)

    bridgeThinClient = new BridgeCliThinClient()

    jest.clearAllMocks()
  })

  // Basic getters - consolidated into single test
  describe('Basic Properties', () => {
    test('should return correct bridge identifiers', () => {
      expect(bridgeThinClient.getBridgeType()).toBe('bridge-cli-thin-client')
      expect(bridgeThinClient.getBridgeFileType()).toBe('bridge-cli')
      expect(bridgeThinClient.getBridgeFileNameType()).toBe('bridge-cli')
    })
  })

  describe('generateFormattedCommand', () => {
    beforeEach(() => {
      mockParseToBoolean.mockReturnValue(false)
      mockGetOSPlatform.mockReturnValue('linux64')
    })

    test('should generate command without workflow version', () => {
      const stage = 'connect'
      const stateFilePath = '/tmp/input.json'

      const command = bridgeThinClient.generateFormattedCommand(stage, stateFilePath)

      expect(command).toBe('--stage connect --input /tmp/input.json')
      expect(mockDebug).toHaveBeenCalledWith('Generated command for stage: connect, state file: /tmp/input.json -> --stage connect --input /tmp/input.json')
    })

    test('should generate command with workflow version', () => {
      const stage = 'connect'
      const stateFilePath = '/tmp/input.json'
      const workflowVersion = '1.0.0'

      const command = bridgeThinClient.generateFormattedCommand(stage, stateFilePath, workflowVersion)

      expect(command).toBe('--stage connect@1.0.0 --input /tmp/input.json')
    })

    test('should include update command when workflow update is enabled', () => {
      mockParseToBoolean.mockReturnValue(true)
      Object.defineProperty(inputs, 'ENABLE_WORKFLOW_UPDATE', {value: 'true', configurable: true})

      const stage = 'connect'
      const stateFilePath = '/tmp/input.json'

      const command = bridgeThinClient.generateFormattedCommand(stage, stateFilePath)

      expect(command).toBe('--stage connect --input /tmp/input.json --update')
      expect(mockInfo).toHaveBeenCalledWith('Bridge workflow update enabled.')
    })

    test('should not include update command when workflow update is disabled', () => {
      mockParseToBoolean.mockReturnValue(false)
      Object.defineProperty(inputs, 'ENABLE_WORKFLOW_UPDATE', {value: 'false', configurable: true})

      const stage = 'connect'
      const stateFilePath = '/tmp/input.json'

      const command = bridgeThinClient.generateFormattedCommand(stage, stateFilePath)

      expect(command).toBe('--stage connect --input /tmp/input.json')
      expect(mockInfo).toHaveBeenCalledWith('Bridge workflow update disabled')
    })
  })

  describe('executeCommand', () => {
    test('should execute command without registry URL', async () => {
      Object.defineProperty(inputs, 'BRIDGECLI_REGISTRY_URL', {value: '', configurable: true})

      jest.spyOn(bridgeThinClient as any, 'runBridgeCommand').mockResolvedValue(0)

      const result = await (bridgeThinClient as any).executeCommand('test-command', {cwd: '/tmp'})

      expect(result).toBe(0)
      expect(mockDebug).toHaveBeenCalledWith('Registry URL is empty')
    })

    test('should execute register command when registry URL is provided', async () => {
      Object.defineProperty(inputs, 'BRIDGE_CLI_REGISTRY_URL', {value: 'https://registry.example.com', configurable: true})

      const mockRunBridgeCommand = jest
        .fn()
        .mockResolvedValueOnce(0) // register command success
        .mockResolvedValueOnce(0) // main command success

      jest.spyOn(bridgeThinClient as any, 'runBridgeCommand').mockImplementation(mockRunBridgeCommand)
      jest.spyOn(bridgeThinClient as any, 'buildRegisterCommand').mockReturnValue('register-command')

      const result = await (bridgeThinClient as any).executeCommand('test-command', {cwd: '/tmp'})

      expect(result).toBe(0)
      expect(mockRunBridgeCommand).toHaveBeenCalledTimes(2)
      expect(mockRunBridgeCommand).toHaveBeenNthCalledWith(1, 'register-command', {cwd: '/tmp'})
      expect(mockRunBridgeCommand).toHaveBeenNthCalledWith(2, 'test-command', {cwd: '/tmp'})
    })

    test('should throw error when register command fails', async () => {
      Object.defineProperty(inputs, 'BRIDGE_CLI_REGISTRY_URL', {value: 'https://registry.example.com', configurable: true})

      jest.spyOn(bridgeThinClient as any, 'runBridgeCommand').mockResolvedValueOnce(1) // register command fails
      jest.spyOn(bridgeThinClient as any, 'buildRegisterCommand').mockReturnValue('register-command')

      await expect((bridgeThinClient as any).executeCommand('test-command', {cwd: '/tmp'})).rejects.toThrow('Register command failed, returning early')
    })
  })

  describe('handleBridgeDownload', () => {
    test('should extract bridge download to correct path', async () => {
      const downloadResponse = {
        filePath: '/tmp/bridge-download.zip',
        url: 'https://example.com/bridge.zip'
      }
      const extractZippedFilePath = '/tmp/extract'

      mockPathBasename.mockReturnValue('bridge-download')
      mockPathJoin.mockReturnValue('/tmp/extract/bridge-download')
      mockExtractZipped.mockResolvedValue(true)

      await (bridgeThinClient as any).handleBridgeDownload(downloadResponse, extractZippedFilePath)

      expect(mockPathBasename).toHaveBeenCalledWith('/tmp/bridge-download.zip', '.zip')
      expect(mockPathJoin).toHaveBeenCalledWith('/tmp/extract', 'bridge-download')
      expect(mockExtractZipped).toHaveBeenCalledWith('/tmp/bridge-download.zip', '/tmp/extract/bridge-download')
      expect(mockDebug).toHaveBeenCalledWith('Starting bridge download handling - extracting to: /tmp/extract')
      expect(mockDebug).toHaveBeenCalledWith('Creating target extraction folder: /tmp/extract/bridge-download')
    })
  })

  describe('verifyRegexCheck', () => {
    beforeEach(() => {
      mockGetOSPlatform.mockReturnValue('linux64')
    })

    test('should return match for latest URL', () => {
      const bridgeUrl = 'https://example.com/bridge-cli-thin-client/latest/bridge-cli-linux64.zip'

      const result = (bridgeThinClient as any).verifyRegexCheck(bridgeUrl)

      expect(result).toEqual(['', ''])
      expect(mockDebug).toHaveBeenCalledWith("URL contains 'latest', returning empty string as version")
    })

    test('should return match for versioned URL', () => {
      const bridgeUrl = 'https://example.com/bridge-cli-thin-client/2.1.0/bridge-cli-linux64.zip'

      const result = (bridgeThinClient as any).verifyRegexCheck(bridgeUrl)

      expect(result).toBeTruthy()
      expect(result?.[1]).toBe('2.1.0')
      expect(mockDebug).toHaveBeenCalledWith('Verifying URL pattern for bridge type: bridge-cli-linux64')
      expect(mockDebug).toHaveBeenCalledWith('URL pattern verification result: match found')
    })

    test('should return null for invalid URL', () => {
      const bridgeUrl = 'https://example.com/invalid-url.zip'

      const result = (bridgeThinClient as any).verifyRegexCheck(bridgeUrl)

      expect(result).toBeNull()
      expect(mockDebug).toHaveBeenCalledWith('URL pattern verification result: no match')
    })
  })

  describe('getBridgeVersion', () => {
    test('should return bridge version from executable', async () => {
      const mockVersion = 'Bridge CLI 2.1.0'
      mockExecSync.mockReturnValue(Buffer.from(mockVersion))

      jest.spyOn(bridgeThinClient as any, 'getBridgeExecutablePath').mockReturnValue('/path/to/bridge-cli')

      const version = await bridgeThinClient.getBridgeVersion()

      expect(version).toBe('Bridge CLI 2.1.0')
      expect(mockExecSync).toHaveBeenCalledWith('/path/to/bridge-cli --version')
      expect(mockDebug).toHaveBeenCalledWith('Getting bridge version from executable: /path/to/bridge-cli')
    })

    test('should throw error when executable fails', async () => {
      const error = new Error('Command failed')
      mockExecSync.mockImplementation(() => {
        throw error
      })

      jest.spyOn(bridgeThinClient as any, 'getBridgeExecutablePath').mockReturnValue('/path/to/bridge-cli')

      await expect(bridgeThinClient.getBridgeVersion()).rejects.toThrow('Failed to get bridge version: Command failed')
    })
  })

  describe('validateAndSetBridgePath', () => {
    beforeEach(() => {
      mockGetOSPlatform.mockReturnValue('linux64')
      mockPathJoin.mockImplementation((...paths) => paths.join('/'))
    })

    test('should set bridge path with custom install directory', async () => {
      Object.defineProperty(inputs, 'BRIDGE_CLI_INSTALL_DIRECTORY_KEY', {value: '/custom/path', configurable: true})

      jest.spyOn(bridgeThinClient as any, 'isNetworkAirGapEnabled').mockReturnValue(false)
      jest.spyOn(utility, 'checkIfPathExists').mockReturnValue(true)

      await bridgeThinClient.validateAndSetBridgePath()

      expect(mockPathJoin).toHaveBeenCalledWith('/custom/path', 'bridge-cli-thin-client')
      expect(mockPathJoin).toHaveBeenCalledWith('/custom/path/bridge-cli-thin-client', 'bridge-cli-linux64')
      expect(mockDebug).toHaveBeenCalledWith('Bridge CLI directory /custom/path/bridge-cli-thin-client/bridge-cli-linux64')
    })

    test('should set bridge path with default directory', async () => {
      // Set to empty string to test the else branch
      Object.defineProperty(inputs, 'BRIDGE_CLI_INSTALL_DIRECTORY_KEY', {value: '', configurable: true})

      jest.spyOn(bridgeThinClient as any, 'getBridgeDefaultPath').mockReturnValue('/default/path')
      jest.spyOn(bridgeThinClient as any, 'isNetworkAirGapEnabled').mockReturnValue(false)

      await bridgeThinClient.validateAndSetBridgePath()

      expect(mockPathJoin).toHaveBeenCalledWith('/default/path', 'bridge-cli-linux64')
      expect(mockDebug).toHaveBeenCalledWith('Bridge CLI directory /default/path/bridge-cli-linux64')
    })

    test('should set bridge path with undefined directory key', async () => {
      // Test with undefined to cover the other branch
      Object.defineProperty(inputs, 'BRIDGE_CLI_INSTALL_DIRECTORY_KEY', {value: undefined, configurable: true})

      jest.spyOn(bridgeThinClient as any, 'getBridgeDefaultPath').mockReturnValue('/default/path')
      jest.spyOn(bridgeThinClient as any, 'isNetworkAirGapEnabled').mockReturnValue(false)

      await bridgeThinClient.validateAndSetBridgePath()

      expect(mockPathJoin).toHaveBeenCalledWith('/default/path', 'bridge-cli-linux64')
      expect(mockDebug).toHaveBeenCalledWith('Bridge CLI directory /default/path/bridge-cli-linux64')
    })

    test('should validate air gap executable when in air gap mode', async () => {
      Object.defineProperty(inputs, 'BRIDGE_CLI_INSTALL_DIRECTORY_KEY', {value: '/custom/path', configurable: true})

      jest.spyOn(bridgeThinClient as any, 'isNetworkAirGapEnabled').mockReturnValue(true)
      jest.spyOn(bridgeThinClient as any, 'validateAirGapExecutable').mockResolvedValue(undefined)
      jest.spyOn(utility, 'checkIfPathExists').mockReturnValue(true)

      await bridgeThinClient.validateAndSetBridgePath()

      expect(bridgeThinClient['validateAirGapExecutable']).toHaveBeenCalled()
    })
  })

  describe('getBridgeCLIDownloadDefaultPath', () => {
    test('should return default download path', () => {
      // Mock path.join to return predictable paths for testing
      mockPathJoin.mockImplementation((...paths) => {
        if (paths.length === 2 && paths[1] === 'bridge-cli-thin-client') {
          return '/mocked/home/.blackduck/integrations/bridge-cli-thin-client'
        }
        return paths.join('/')
      })

      const path = bridgeThinClient.getBridgeCLIDownloadDefaultPath()

      expect(path).toBe('/mocked/home/.blackduck/integrations/bridge-cli-thin-client')
      expect(mockPathJoin).toHaveBeenCalledWith(expect.any(String), 'bridge-cli-thin-client')
    })
  })

  describe('buildRegisterCommand', () => {
    test('should build register command with registry URL', () => {
      Object.defineProperty(inputs, 'BRIDGE_CLI_REGISTRY_URL', {value: 'https://registry.example.com', configurable: true})

      // Set up bridgeExecutablePath
      bridgeThinClient['bridgeExecutablePath'] = '/path/to/bridge-cli'

      const command = (bridgeThinClient as any).buildRegisterCommand()

      expect(command).toBe('/path/to/bridge-cli  --register https://registry.example.com')
      expect(mockDebug).toHaveBeenCalledWith('Building register command')
      expect(mockDebug).toHaveBeenCalledWith('Register command built: /path/to/bridge-cli  --register https://registry.example.com')
    })
  })

  // REMOVED: Platform-specific tests that only test getBridgeType() - redundant and not platform-dependent

  describe('Error handling', () => {
    test('should handle extraction errors gracefully', async () => {
      const downloadResponse = {
        filePath: '/tmp/bridge-download.zip',
        url: 'https://example.com/bridge.zip'
      }
      const extractZippedFilePath = '/tmp/extract'

      mockPathBasename.mockReturnValue('bridge-download')
      mockPathJoin.mockReturnValue('/tmp/extract/bridge-download')
      mockExtractZipped.mockRejectedValue(new Error('Extraction failed'))

      await expect((bridgeThinClient as any).handleBridgeDownload(downloadResponse, extractZippedFilePath)).rejects.toThrow('Extraction failed')
    })

    test('should handle command execution errors', async () => {
      Object.defineProperty(inputs, 'BRIDGECLI_REGISTRY_URL', {value: '', configurable: true})

      jest.spyOn(bridgeThinClient as any, 'runBridgeCommand').mockRejectedValue(new Error('Command execution failed'))

      await expect((bridgeThinClient as any).executeCommand('test-command', {cwd: '/tmp'})).rejects.toThrow('Command execution failed')
    })
  })

  describe('isBridgeInstalled', () => {
    beforeEach(() => {
      jest.spyOn(bridgeThinClient as any, 'ensureBridgePathIsSet').mockResolvedValue(undefined)
      jest.spyOn(bridgeThinClient as any, 'getBridgeExecutablePath').mockReturnValue('/path/to/bridge-cli')
      jest.spyOn(utility, 'checkIfPathExists').mockReturnValue(true)
    })

    test('should return true when bridge is installed with matching version', async () => {
      const requestedVersion = 'Bridge CLI 2.1.0'
      // Mock getBridgeVersion to return the requested version
      const mockGetBridgeVersion = jest.spyOn(bridgeThinClient, 'getBridgeVersion').mockResolvedValue(requestedVersion)

      const result = await bridgeThinClient.isBridgeInstalled(requestedVersion)

      expect(result).toBe(true)
      expect(mockGetBridgeVersion).toHaveBeenCalled()
    })

    test('should return false when bridge is not installed', async () => {
      jest.spyOn(utility, 'checkIfPathExists').mockReturnValue(false)

      const result = await bridgeThinClient.isBridgeInstalled('2.1.0')

      expect(result).toBe(false)
      expect(mockDebug).toHaveBeenCalledWith('Bridge executable does not exist')
    })

    test('should return false when bridge version does not match', async () => {
      jest.spyOn(bridgeThinClient, 'getBridgeVersion').mockResolvedValue('Bridge CLI 2.0.0')

      const result = await bridgeThinClient.isBridgeInstalled('Bridge CLI 2.1.0')

      expect(result).toBe(false)
    })

    test('should throw error when bridge version check fails', async () => {
      jest.spyOn(bridgeThinClient, 'getBridgeVersion').mockRejectedValue(new Error('Version check failed'))

      await expect(bridgeThinClient.isBridgeInstalled('2.1.0')).rejects.toThrow('Version check failed')
      expect(mockDebug).toHaveBeenCalledWith('Failed to get bridge version: Version check failed')
    })
  })

  describe('updateBridgeCLIVersion', () => {
    beforeEach(() => {
      jest.spyOn(bridgeThinClient as any, 'getBridgeExecutablePath').mockReturnValue('/path/to/bridge-cli')
      jest.spyOn(bridgeThinClient, 'getAllAvailableBridgeVersions').mockResolvedValue(['2.1.0', '2.0.0', '1.9.0'])
      jest.spyOn(bridgeThinClient as any, 'getVersionUrl').mockReturnValue('https://example.com/bridge-2.1.0.zip')
    })

    test('should return existing bridge when executable exists', async () => {
      jest.spyOn(utility, 'checkIfPathExists').mockReturnValue(true)
      jest.spyOn(bridgeThinClient as any, 'executeUseBridgeCommand').mockResolvedValue(undefined)

      const result = await (bridgeThinClient as any).updateBridgeCLIVersion('2.1.0')

      expect(result).toEqual({bridgeUrl: '', bridgeVersion: '2.1.0'})
      expect(mockInfo).toHaveBeenCalledWith('Bridge CLI already exists')
    })

    test('should return download URL when executable does not exist', async () => {
      jest.spyOn(utility, 'checkIfPathExists').mockReturnValue(false)

      const result = await (bridgeThinClient as any).updateBridgeCLIVersion('2.1.0')

      expect(result).toEqual({bridgeUrl: 'https://example.com/bridge-2.1.0.zip', bridgeVersion: '2.1.0'})
    })

    test('should throw error when version validation fails', async () => {
      jest.spyOn(bridgeThinClient, 'getAllAvailableBridgeVersions').mockResolvedValue(['2.0.0', '1.9.0']) // exclude the requested version
      Object.defineProperty(constants, 'BRIDGE_VERSION_NOT_FOUND_ERROR', {value: 'Version not found', configurable: true})

      await expect((bridgeThinClient as any).updateBridgeCLIVersion('invalid-version')).rejects.toThrow('Version not found')
    })
  })

  describe('initializeUrls', () => {
    test('should initialize URLs when base URL is determined', async () => {
      jest.spyOn(bridgeThinClient as any, 'determineBaseUrl').mockResolvedValue('https://example.com')
      jest.spyOn(bridgeThinClient as any, 'setupBridgeUrls').mockImplementation(() => {})

      await (bridgeThinClient as any).initializeUrls()

      expect(bridgeThinClient['setupBridgeUrls']).toHaveBeenCalledWith('https://example.com')
    })

    test('should handle empty base URL', async () => {
      jest.spyOn(bridgeThinClient as any, 'determineBaseUrl').mockResolvedValue('')
      jest.spyOn(bridgeThinClient as any, 'setupBridgeUrls').mockImplementation(() => {})

      await (bridgeThinClient as any).initializeUrls()

      expect(bridgeThinClient['setupBridgeUrls']).toHaveBeenCalledWith('')
    })
  })

  describe('ensureBridgePathIsSet', () => {
    test('should set bridge path when not already set', async () => {
      // Use delete to properly unset the property
      delete (bridgeThinClient as any)['bridgePath']
      jest.spyOn(bridgeThinClient, 'validateAndSetBridgePath').mockResolvedValue(undefined)

      await (bridgeThinClient as any).ensureBridgePathIsSet()

      expect(bridgeThinClient.validateAndSetBridgePath).toHaveBeenCalled()
    })

    test('should not set bridge path when already set', async () => {
      bridgeThinClient['bridgePath'] = '/existing/path'
      jest.spyOn(bridgeThinClient, 'validateAndSetBridgePath').mockResolvedValue(undefined)

      await (bridgeThinClient as any).ensureBridgePathIsSet()

      expect(bridgeThinClient.validateAndSetBridgePath).not.toHaveBeenCalled()
    })
  })

  describe('buildCommand', () => {
    test('should build command with all parts', () => {
      mockParseToBoolean.mockReturnValue(true)
      Object.defineProperty(inputs, 'ENABLE_WORKFLOW_UPDATE', {value: 'true', configurable: true})

      const command = (bridgeThinClient as any).buildCommand('connect', '/tmp/input.json', '1.0.0')

      expect(command).toBe('--stage connect@1.0.0 --input /tmp/input.json --update')
    })

    test('should build command without workflow version', () => {
      mockParseToBoolean.mockReturnValue(false)

      const command = (bridgeThinClient as any).buildCommand('connect', '/tmp/input.json')

      expect(command).toBe('--stage connect --input /tmp/input.json')
    })
  })

  describe('handleBridgeUpdateCommand', () => {
    test('should return update command when enabled', () => {
      mockParseToBoolean.mockReturnValue(true)

      const updateCommand = (bridgeThinClient as any).handleBridgeUpdateCommand()

      expect(updateCommand).toBe('--update')
      expect(mockInfo).toHaveBeenCalledWith('Bridge workflow update enabled.')
    })

    test('should return empty string when disabled', () => {
      mockParseToBoolean.mockReturnValue(false)

      const updateCommand = (bridgeThinClient as any).handleBridgeUpdateCommand()

      expect(updateCommand).toBe('')
      expect(mockInfo).toHaveBeenCalledWith('Bridge workflow update disabled')
    })
  })

  describe('checkIfBridgeExistsInAirGap', () => {
    test('should set bridge path when not already set', async () => {
      jest.spyOn(bridgeThinClient, 'validateAndSetBridgePath').mockResolvedValue(undefined)
      jest.spyOn(utility, 'checkIfPathExists').mockReturnValue(true)

      const result = await (bridgeThinClient as any).checkIfBridgeExistsInAirGap()

      expect(bridgeThinClient.validateAndSetBridgePath).toHaveBeenCalled()
      expect(result).toBe(true)
    })

    test('should return false when bridge does not exist', async () => {
      bridgeThinClient['bridgePath'] = '/existing/path'
      jest.spyOn(utility, 'checkIfPathExists').mockReturnValue(false)

      const result = await (bridgeThinClient as any).checkIfBridgeExistsInAirGap()

      expect(result).toBe(false)
    })
  })

  describe('executeUseBridgeCommand', () => {
    test('should execute use bridge command successfully', async () => {
      const bridgeExecutable = '/path/to/bridge-cli'
      const bridgeVersion = '2.1.0'
      const expectedCommand = `${bridgeExecutable} --use bridge-cli@${bridgeVersion}`

      mockExecSync.mockReturnValue(Buffer.from('Success'))

      await (bridgeThinClient as any).executeUseBridgeCommand(bridgeExecutable, bridgeVersion)

      expect(mockDebug).toHaveBeenCalledWith('Different bridge version found, running --use bridge command')
      expect(mockExecSync).toHaveBeenCalledWith(expectedCommand, {stdio: 'pipe'})
      expect(mockDebug).toHaveBeenCalledWith(`Successfully executed --use bridge command: ${expectedCommand} with version ${bridgeVersion}`)
    })

    test('should throw error when use bridge command fails', async () => {
      const bridgeExecutable = '/path/to/bridge-cli'
      const bridgeVersion = '2.1.0'
      const error = new Error('Command execution failed')

      mockExecSync.mockImplementation(() => {
        throw error
      })

      await expect((bridgeThinClient as any).executeUseBridgeCommand(bridgeExecutable, bridgeVersion)).rejects.toThrow(error)

      expect(mockDebug).toHaveBeenCalledWith('Failed to execute --use bridge command: Command execution failed')
    })

    test('should handle special characters in executable path', async () => {
      const bridgeExecutable = '/path with spaces/to/bridge-cli'
      const bridgeVersion = '2.1.0'
      const expectedCommand = `${bridgeExecutable} --use bridge-cli@${bridgeVersion}`

      mockExecSync.mockReturnValue(Buffer.from('Success'))

      await (bridgeThinClient as any).executeUseBridgeCommand(bridgeExecutable, bridgeVersion)

      expect(mockExecSync).toHaveBeenCalledWith(expectedCommand, {stdio: 'pipe'})
    })
  })

  describe('validateBridgeVersion', () => {
    test('should return true for valid version', async () => {
      const availableVersions = ['2.0.0', '2.1.0', '2.2.0']
      jest.spyOn(bridgeThinClient, 'getAllAvailableBridgeVersions').mockResolvedValue(availableVersions)

      const result = await bridgeThinClient.validateBridgeVersion('2.1.0')

      expect(result).toBe(true)
    })

    test('should return false for invalid version', async () => {
      const availableVersions = ['2.0.0', '2.1.0', '2.2.0']
      jest.spyOn(bridgeThinClient, 'getAllAvailableBridgeVersions').mockResolvedValue(availableVersions)

      const result = await bridgeThinClient.validateBridgeVersion('3.0.0')

      expect(result).toBe(false)
    })

    test('should trim whitespace from version before validation', async () => {
      const availableVersions = ['2.0.0', '2.1.0', '2.2.0']
      jest.spyOn(bridgeThinClient, 'getAllAvailableBridgeVersions').mockResolvedValue(availableVersions)

      const result = await bridgeThinClient.validateBridgeVersion('  2.1.0  ')

      expect(result).toBe(true)
    })

    test('should handle empty available versions list', async () => {
      jest.spyOn(bridgeThinClient, 'getAllAvailableBridgeVersions').mockResolvedValue([])

      const result = await bridgeThinClient.validateBridgeVersion('2.1.0')

      expect(result).toBe(false)
    })

    test('should handle error from getAllAvailableBridgeVersions', async () => {
      jest.spyOn(bridgeThinClient, 'getAllAvailableBridgeVersions').mockRejectedValue(new Error('Failed to get versions'))

      await expect(bridgeThinClient.validateBridgeVersion('2.1.0')).rejects.toThrow('Failed to get versions')
    })
  })

  describe('processBaseUrlWithLatest', () => {
    test('should return bridge URL and version for latest', async () => {
      const expectedVersion = '2.1.0'
      const expectedUrl = 'https://example.com/bridge-cli-thin-client/latest/bridge-cli-platform.zip'

      jest.spyOn(bridgeThinClient as any, 'getNormalizedVersionUrl').mockReturnValue('https://example.com/versions.txt')
      jest.spyOn(bridgeThinClient, 'getBridgeVersionFromLatestURL').mockResolvedValue(expectedVersion)

      // Set the bridgeUrlLatestPattern
      ;(bridgeThinClient as any).bridgeUrlLatestPattern = expectedUrl

      const result = await (bridgeThinClient as any).processBaseUrlWithLatest()

      expect(result).toEqual({
        bridgeUrl: expectedUrl,
        bridgeVersion: expectedVersion
      })
      expect(mockDebug).toHaveBeenCalledWith(`Retrieved bridge version: ${expectedVersion}`)
    })

    test('should throw error when bridge version is empty', async () => {
      const versionUrl = 'https://example.com/versions.txt'

      jest.spyOn(bridgeThinClient as any, 'getNormalizedVersionUrl').mockReturnValue(versionUrl)
      jest.spyOn(bridgeThinClient, 'getBridgeVersionFromLatestURL').mockResolvedValue('')

      await expect((bridgeThinClient as any).processBaseUrlWithLatest()).rejects.toThrow(`Unable to retrieve the latest Bridge CLI version from ${versionUrl}. Stopping execution.`)
    })

    test('should throw error when bridge version is null', async () => {
      const versionUrl = 'https://example.com/versions.txt'

      jest.spyOn(bridgeThinClient as any, 'getNormalizedVersionUrl').mockReturnValue(versionUrl)
      jest.spyOn(bridgeThinClient, 'getBridgeVersionFromLatestURL').mockResolvedValue(null as any)

      await expect((bridgeThinClient as any).processBaseUrlWithLatest()).rejects.toThrow(`Unable to retrieve the latest Bridge CLI version from ${versionUrl}. Stopping execution.`)
    })

    test('should handle error from getBridgeVersionFromLatestURL', async () => {
      jest.spyOn(bridgeThinClient as any, 'getNormalizedVersionUrl').mockReturnValue('https://example.com/versions.txt')
      jest.spyOn(bridgeThinClient, 'getBridgeVersionFromLatestURL').mockRejectedValue(new Error('Network error'))

      await expect((bridgeThinClient as any).processBaseUrlWithLatest()).rejects.toThrow('Network error')
    })
  })

  describe('processLatestVersion', () => {
    test('should return processBaseUrlWithLatest result when bridge does not exist locally', async () => {
      const expectedResult = {bridgeUrl: 'https://example.com/bridge.zip', bridgeVersion: '2.1.0'}

      jest.spyOn(bridgeThinClient as any, 'checkIfBridgeExistsLocally').mockResolvedValue(false)
      jest.spyOn(bridgeThinClient as any, 'processBaseUrlWithLatest').mockResolvedValue(expectedResult)

      const result = await (bridgeThinClient as any).processLatestVersion()

      expect(result).toEqual(expectedResult)
      expect(bridgeThinClient['processBaseUrlWithLatest']).toHaveBeenCalled()
    })

    test('should update to latest version when current version is different', async () => {
      const currentVersion = '2.0.0'
      const latestVersion = '2.1.0'
      const latestVersionInfo = {bridgeUrl: 'https://example.com/bridge.zip', bridgeVersion: latestVersion}

      jest.spyOn(bridgeThinClient as any, 'checkIfBridgeExistsLocally').mockResolvedValue(true)
      jest.spyOn(bridgeThinClient, 'getBridgeVersion').mockResolvedValue(currentVersion)
      jest.spyOn(bridgeThinClient as any, 'getLatestVersionInfo').mockResolvedValue(latestVersionInfo)
      jest.spyOn(bridgeThinClient as any, 'getBridgeExecutablePath').mockReturnValue('/path/to/bridge-cli')
      jest.spyOn(bridgeThinClient as any, 'executeUseBridgeCommand').mockResolvedValue(undefined)

      const result = await (bridgeThinClient as any).processLatestVersion()

      expect(result).toEqual({bridgeUrl: '', bridgeVersion: latestVersion})
      expect(mockInfo).toHaveBeenCalledWith('Bridge CLI already exists')
      expect(mockDebug).toHaveBeenCalledWith(`Bridge CLI already exists with version ${currentVersion}, but latest version ${latestVersion} is available. Updating to latest.`)
      expect(bridgeThinClient['executeUseBridgeCommand']).toHaveBeenCalledWith('/path/to/bridge-cli', latestVersion)
    })

    test('should return current version when it matches latest version', async () => {
      const currentVersion = '2.1.0'
      const latestVersionInfo = {bridgeUrl: 'https://example.com/bridge.zip', bridgeVersion: currentVersion}

      jest.spyOn(bridgeThinClient as any, 'checkIfBridgeExistsLocally').mockResolvedValue(true)
      jest.spyOn(bridgeThinClient, 'getBridgeVersion').mockResolvedValue(currentVersion)
      jest.spyOn(bridgeThinClient as any, 'getLatestVersionInfo').mockResolvedValue(latestVersionInfo)

      const result = await (bridgeThinClient as any).processLatestVersion()

      expect(result).toEqual({bridgeUrl: '', bridgeVersion: currentVersion})
    })

    test('should use cached version when available', async () => {
      const cachedVersion = '2.1.0'
      const latestVersionInfo = {bridgeUrl: 'https://example.com/bridge.zip', bridgeVersion: cachedVersion}

      // Set cached version
      ;(bridgeThinClient as any).currentVersion = cachedVersion

      jest.spyOn(bridgeThinClient as any, 'checkIfBridgeExistsLocally').mockResolvedValue(true)
      jest.spyOn(bridgeThinClient, 'getBridgeVersion').mockResolvedValue('should-not-be-called')
      jest.spyOn(bridgeThinClient as any, 'getLatestVersionInfo').mockResolvedValue(latestVersionInfo)

      const result = await (bridgeThinClient as any).processLatestVersion()

      expect(result).toEqual({bridgeUrl: '', bridgeVersion: cachedVersion})
      expect(bridgeThinClient.getBridgeVersion).not.toHaveBeenCalled()
    })

    test('should handle missing latest version gracefully', async () => {
      const currentVersion = '2.0.0'
      const latestVersionInfo = {bridgeUrl: 'https://example.com/bridge.zip', bridgeVersion: ''}

      jest.spyOn(bridgeThinClient as any, 'checkIfBridgeExistsLocally').mockResolvedValue(true)
      jest.spyOn(bridgeThinClient, 'getBridgeVersion').mockResolvedValue(currentVersion)
      jest.spyOn(bridgeThinClient as any, 'getLatestVersionInfo').mockResolvedValue(latestVersionInfo)

      const result = await (bridgeThinClient as any).processLatestVersion()

      expect(result).toEqual({bridgeUrl: '', bridgeVersion: currentVersion})
    })

    test('should fallback to processBaseUrlWithLatest when error occurs', async () => {
      const fallbackResult = {bridgeUrl: 'https://example.com/bridge.zip', bridgeVersion: '2.1.0'}

      jest.spyOn(bridgeThinClient as any, 'checkIfBridgeExistsLocally').mockResolvedValue(true)
      jest.spyOn(bridgeThinClient, 'getBridgeVersion').mockRejectedValue(new Error('Version check failed'))
      jest.spyOn(bridgeThinClient as any, 'processBaseUrlWithLatest').mockResolvedValue(fallbackResult)

      const result = await (bridgeThinClient as any).processLatestVersion()

      expect(result).toEqual(fallbackResult)
      expect(mockDebug).toHaveBeenCalledWith('Error checking bridge version: Version check failed. Proceeding with latest version download.')
      expect(bridgeThinClient['processBaseUrlWithLatest']).toHaveBeenCalled()
    })

    test('should handle executeUseBridgeCommand failure', async () => {
      const currentVersion = '2.0.0'
      const latestVersion = '2.1.0'
      const latestVersionInfo = {bridgeUrl: 'https://example.com/bridge.zip', bridgeVersion: latestVersion}
      const fallbackResult = {bridgeUrl: 'https://example.com/bridge.zip', bridgeVersion: '2.1.0'}

      jest.spyOn(bridgeThinClient as any, 'checkIfBridgeExistsLocally').mockResolvedValue(true)
      jest.spyOn(bridgeThinClient, 'getBridgeVersion').mockResolvedValue(currentVersion)
      jest.spyOn(bridgeThinClient as any, 'getLatestVersionInfo').mockResolvedValue(latestVersionInfo)
      jest.spyOn(bridgeThinClient as any, 'getBridgeExecutablePath').mockReturnValue('/path/to/bridge-cli')
      jest.spyOn(bridgeThinClient as any, 'executeUseBridgeCommand').mockRejectedValue(new Error('Use command failed'))
      jest.spyOn(bridgeThinClient as any, 'processBaseUrlWithLatest').mockResolvedValue(fallbackResult)

      const result = await (bridgeThinClient as any).processLatestVersion()

      expect(result).toEqual(fallbackResult)
      expect(mockDebug).toHaveBeenCalledWith('Error checking bridge version: Use command failed. Proceeding with latest version download.')
    })
  })

  describe('setupBridgeUrls', () => {
    test('should execute setupBridgeUrls method successfully', () => {
      // This test ensures the method executes without errors
      expect(() => {
        bridgeThinClient.setupBridgeUrls('https://example.com')
      }).not.toThrow()
    })

    test('should handle URLs with trailing slash', () => {
      // This test ensures the method executes without errors for URLs with trailing slash
      expect(() => {
        bridgeThinClient.setupBridgeUrls('https://example.com/')
      }).not.toThrow()
    })
  })

  describe('shouldSkipAirGapDownload', () => {
    beforeEach(() => {
      jest.spyOn(bridgeThinClient as any, 'checkIfBridgeExistsInAirGap').mockResolvedValue(true)
    })

    test('should return false when bridge does not exist in air gap', async () => {
      jest.spyOn(bridgeThinClient as any, 'checkIfBridgeExistsInAirGap').mockResolvedValue(false)

      const result = await (bridgeThinClient as any).shouldSkipAirGapDownload()

      expect(result).toBe(false)
    })

    test('should return true when bridge exists but no base URL provided', async () => {
      Object.defineProperty(inputs, 'BRIDGE_CLI_BASE_URL', {value: '', configurable: true})

      const result = await (bridgeThinClient as any).shouldSkipAirGapDownload()

      expect(result).toBe(true)
    })

    test('should update bridge when base URL provided with specific version', async () => {
      Object.defineProperty(inputs, 'BRIDGE_CLI_BASE_URL', {value: 'https://example.com', configurable: true})
      Object.defineProperty(inputs, 'BRIDGE_CLI_DOWNLOAD_VERSION', {value: '2.1.0', configurable: true})

      jest.spyOn(bridgeThinClient, 'getBridgeVersion').mockResolvedValue('2.0.0')
      jest.spyOn(bridgeThinClient as any, 'getBridgeExecutablePath').mockReturnValue('/path/to/bridge')
      jest.spyOn(bridgeThinClient as any, 'executeUseBridgeCommand').mockResolvedValue(undefined)

      const result = await (bridgeThinClient as any).shouldSkipAirGapDownload()

      expect(result).toBe(true)
      expect(mockDebug).toHaveBeenCalledWith('Air gap mode with base URL specified - checking for version update')
      expect(mockDebug).toHaveBeenCalledWith('Target version specified: 2.1.0')
      expect(mockDebug).toHaveBeenCalledWith('Current version: 2.0.0, Target version: 2.1.0 - updating bridge')
    })

    test('should skip update when versions match with specific version', async () => {
      Object.defineProperty(inputs, 'BRIDGE_CLI_BASE_URL', {value: 'https://example.com', configurable: true})
      Object.defineProperty(inputs, 'BRIDGE_CLI_DOWNLOAD_VERSION', {value: '2.1.0', configurable: true})

      jest.spyOn(bridgeThinClient, 'getBridgeVersion').mockResolvedValue('2.1.0')

      const result = await (bridgeThinClient as any).shouldSkipAirGapDownload()

      expect(result).toBe(true)
      expect(mockDebug).toHaveBeenCalledWith('Bridge already at target version: 2.1.0')
    })

    test('should update to latest version when no version specified', async () => {
      Object.defineProperty(inputs, 'BRIDGE_CLI_BASE_URL', {value: 'https://example.com', configurable: true})
      Object.defineProperty(inputs, 'BRIDGE_CLI_DOWNLOAD_VERSION', {value: '', configurable: true})

      jest.spyOn(bridgeThinClient, 'getBridgeVersion').mockResolvedValue('2.0.0')
      jest.spyOn(bridgeThinClient as any, 'getLatestVersionInfo').mockResolvedValue({bridgeVersion: '2.1.0'})
      jest.spyOn(bridgeThinClient as any, 'getBridgeExecutablePath').mockReturnValue('/path/to/bridge')
      jest.spyOn(bridgeThinClient as any, 'executeUseBridgeCommand').mockResolvedValue(undefined)

      const result = await (bridgeThinClient as any).shouldSkipAirGapDownload()

      expect(result).toBe(true)
      expect(mockDebug).toHaveBeenCalledWith('No version specified, determining latest version')
      expect(mockDebug).toHaveBeenCalledWith('Latest version determined: 2.1.0')
      expect(mockDebug).toHaveBeenCalledWith('Current version: 2.0.0, Target version: 2.1.0 - updating bridge')
    })

    test('should use cached current version', async () => {
      Object.defineProperty(inputs, 'BRIDGE_CLI_BASE_URL', {value: 'https://example.com', configurable: true})
      Object.defineProperty(inputs, 'BRIDGE_CLI_DOWNLOAD_VERSION', {value: '2.1.0', configurable: true})

      // Set cached version
      ;(bridgeThinClient as any).currentVersion = '2.0.0'
      const getBridgeVersionSpy = jest.spyOn(bridgeThinClient, 'getBridgeVersion')
      jest.spyOn(bridgeThinClient as any, 'getBridgeExecutablePath').mockReturnValue('/path/to/bridge')
      jest.spyOn(bridgeThinClient as any, 'executeUseBridgeCommand').mockResolvedValue(undefined)

      const result = await (bridgeThinClient as any).shouldSkipAirGapDownload()

      expect(result).toBe(true)
      expect(getBridgeVersionSpy).not.toHaveBeenCalled() // Should use cached version
    })

    test('should return false when error occurs during version check', async () => {
      Object.defineProperty(inputs, 'BRIDGE_CLI_BASE_URL', {value: 'https://example.com', configurable: true})
      Object.defineProperty(inputs, 'BRIDGE_CLI_DOWNLOAD_VERSION', {value: '2.1.0', configurable: true})

      jest.spyOn(bridgeThinClient, 'getBridgeVersion').mockRejectedValue(new Error('Version check failed'))

      const result = await (bridgeThinClient as any).shouldSkipAirGapDownload()

      expect(result).toBe(false)
      expect(mockDebug).toHaveBeenCalledWith('Error checking version for air gap update: Version check failed')
    })

    test('should return true by default when bridge exists', async () => {
      Object.defineProperty(inputs, 'BRIDGE_CLI_BASE_URL', {value: '', configurable: true})

      const result = await (bridgeThinClient as any).shouldSkipAirGapDownload()

      expect(result).toBe(true)
    })
  })

  describe('handleRegistrationIfNeeded', () => {
    test('should return early when no registry URL provided', async () => {
      Object.defineProperty(inputs, 'BRIDGE_CLI_REGISTRY_URL', {value: '', configurable: true})

      await (bridgeThinClient as any).handleRegistrationIfNeeded({})

      expect(mockDebug).toHaveBeenCalledWith('Registry URL is empty')
    })

    test('should execute register command when registry URL is provided', async () => {
      Object.defineProperty(inputs, 'BRIDGE_CLI_REGISTRY_URL', {value: 'https://registry.example.com', configurable: true})

      jest.spyOn(bridgeThinClient as any, 'buildRegisterCommand').mockReturnValue('register-command')
      jest.spyOn(bridgeThinClient as any, 'runBridgeCommand').mockResolvedValue(0)

      await (bridgeThinClient as any).handleRegistrationIfNeeded({cwd: '/tmp'})

      expect(bridgeThinClient['runBridgeCommand']).toHaveBeenCalledWith('register-command', {cwd: '/tmp'})
    })

    test('should throw error when register command fails', async () => {
      Object.defineProperty(inputs, 'BRIDGE_CLI_REGISTRY_URL', {value: 'https://registry.example.com', configurable: true})

      jest.spyOn(bridgeThinClient as any, 'buildRegisterCommand').mockReturnValue('register-command')
      jest.spyOn(bridgeThinClient as any, 'runBridgeCommand').mockResolvedValue(1)

      await expect((bridgeThinClient as any).handleRegistrationIfNeeded({cwd: '/tmp'})).rejects.toThrow('Register command failed, returning early')
    })
  })
})
