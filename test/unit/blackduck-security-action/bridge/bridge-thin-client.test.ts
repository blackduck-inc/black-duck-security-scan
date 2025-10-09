import {BridgeThinClient} from '../../../../src/blackduck-security-action/bridge/bridge-thin-client'
import * as downloadUtility from '../../../../src/blackduck-security-action/download-utility'
import * as utility from '../../../../src/blackduck-security-action/utility'
import * as core from '@actions/core'
import {execSync} from 'node:child_process'
import * as inputs from '../../../../src/blackduck-security-action/inputs'
import * as constants from '../../../../src/application-constants'
import path from 'path'

// Mock external dependencies
jest.mock('@actions/core')
jest.mock('node:child_process')
jest.mock('../../../../src/blackduck-security-action/utility')
jest.mock('../../../../src/blackduck-security-action/download-utility')
jest.mock('path')

describe('BridgeThinClient', () => {
  let bridgeThinClient: BridgeThinClient
  const mockDebug = jest.mocked(core.debug)
  const mockInfo = jest.mocked(core.info)
  const mockExecSync = jest.mocked(execSync)
  const mockGetOSPlatform = jest.mocked(utility.getOSPlatform)
  const mockParseToBoolean = jest.mocked(utility.parseToBoolean)
  const mockExtractZipped = jest.mocked(downloadUtility.extractZipped)
  const mockPathJoin = jest.mocked(path.join)
  const mockPathBasename = jest.mocked(path.basename)

  beforeEach(() => {
    bridgeThinClient = new BridgeThinClient()

    // Setup default constants
    Object.defineProperty(constants, 'BRIDGE_CLI_STAGE_OPTION', {value: '--stage', configurable: true})
    Object.defineProperty(constants, 'BRIDGE_CLI_INPUT_OPTION', {value: '--input', configurable: true})
    Object.defineProperty(constants, 'BRIDGE_CLI_SPACE', {value: ' ', configurable: true})

    jest.clearAllMocks()
  })

  describe('getBridgeType', () => {
    test('should return correct bridge type', () => {
      expect(bridgeThinClient.getBridgeType()).toBe('bridge-cli-thin-client')
    })
  })

  describe('getBridgeFileType', () => {
    test('should return correct bridge file type', () => {
      expect(bridgeThinClient.getBridgeFileType()).toBe('bridge-cli')
    })
  })

  describe('getBridgeFileNameType', () => {
    test('should return correct bridge file name type', () => {
      expect(bridgeThinClient.getBridgeFileNameType()).toBe('bridge-cli')
    })
  })

  describe('generateFormattedCommand', () => {
    beforeEach(() => {
      mockParseToBoolean.mockReturnValue(false)
    })

    test('should generate command without workflow version', () => {
      const stage = 'connect'
      const stateFilePath = '/tmp/input.json'

      const command = bridgeThinClient.generateFormattedCommand(stage, stateFilePath)

      expect(command).toBe('--stage connect --input /tmp/input.json')
      expect(mockDebug).toHaveBeenCalledWith('Generating command for stage: connect, state file: /tmp/input.json')
      expect(mockInfo).toHaveBeenCalledWith('Generated command: --stage connect --input /tmp/input.json')
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
      expect(mockInfo).toHaveBeenCalledWith('Bridge update command has been added.')
    })

    test('should not include update command when workflow update is disabled', () => {
      mockParseToBoolean.mockReturnValue(false)
      Object.defineProperty(inputs, 'ENABLE_WORKFLOW_UPDATE', {value: 'false', configurable: true})

      const stage = 'connect'
      const stateFilePath = '/tmp/input.json'

      const command = bridgeThinClient.generateFormattedCommand(stage, stateFilePath)

      expect(command).toBe('--stage connect --input /tmp/input.json')
      expect(mockInfo).toHaveBeenCalledWith('Bridge workflow update is disabled')
    })
  })

  describe('executeCommand', () => {
    test('should execute command without registry URL', async () => {
      Object.defineProperty(inputs, 'BRIDGE_REGISTRY_URL', {value: '', configurable: true})

      jest.spyOn(bridgeThinClient as any, 'runBridgeCommand').mockResolvedValue(0)

      const result = await (bridgeThinClient as any).executeCommand('test-command', {cwd: '/tmp'})

      expect(result).toBe(0)
      expect(mockDebug).toHaveBeenCalledWith('Registry URL is empty')
    })

    test('should execute register command when registry URL is provided', async () => {
      Object.defineProperty(inputs, 'BRIDGE_REGISTRY_URL', {value: 'https://registry.example.com', configurable: true})

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
      Object.defineProperty(inputs, 'BRIDGE_REGISTRY_URL', {value: 'https://registry.example.com', configurable: true})

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

      jest.spyOn(bridgeThinClient as any, 'isAirGapMode').mockReturnValue(false)

      await bridgeThinClient.validateAndSetBridgePath()

      expect(mockPathJoin).toHaveBeenCalledWith('/custom/path', 'bridge-cli-thin-client')
      expect(mockPathJoin).toHaveBeenCalledWith('/custom/path/bridge-cli-thin-client', 'bridge-cli-linux64')
      expect(mockInfo).toHaveBeenCalledWith('Bridge CLI directory /custom/path/bridge-cli-thin-client')
    })

    test('should set bridge path with default directory', async () => {
      Object.defineProperty(inputs, 'BRIDGE_CLI_INSTALL_DIRECTORY_KEY', {value: '', configurable: true})

      jest.spyOn(bridgeThinClient as any, 'getBridgeDefaultPath').mockReturnValue('/default/path')
      jest.spyOn(bridgeThinClient as any, 'isAirGapMode').mockReturnValue(false)

      await bridgeThinClient.validateAndSetBridgePath()

      expect(mockPathJoin).toHaveBeenCalledWith('/default/path', 'bridge-cli-linux64')
      expect(mockInfo).toHaveBeenCalledWith('Bridge CLI directory /default/path')
    })

    test('should validate air gap executable when in air gap mode', async () => {
      Object.defineProperty(inputs, 'BRIDGE_CLI_INSTALL_DIRECTORY_KEY', {value: '/custom/path', configurable: true})

      jest.spyOn(bridgeThinClient as any, 'isAirGapMode').mockReturnValue(true)
      jest.spyOn(bridgeThinClient as any, 'validateAirGapExecutable').mockResolvedValue(undefined)

      await bridgeThinClient.validateAndSetBridgePath()

      expect(bridgeThinClient['validateAirGapExecutable']).toHaveBeenCalled()
    })
  })

  describe('getBridgeCLIDownloadDefaultPath', () => {
    test('should return default download path', () => {
      jest.spyOn(bridgeThinClient as any, 'getBridgeCLIDownloadPathCommon').mockReturnValue('/default/download/path')

      const path = bridgeThinClient.getBridgeCLIDownloadDefaultPath()

      expect(path).toBe('/default/download/path')
      expect(bridgeThinClient['getBridgeCLIDownloadPathCommon']).toHaveBeenCalledWith(true)
    })
  })

  describe('buildRegisterCommand', () => {
    test('should build register command with registry URL', () => {
      Object.defineProperty(inputs, 'BRIDGE_REGISTRY_URL', {value: 'https://registry.example.com', configurable: true})

      // Set up bridgeExecutablePath
      bridgeThinClient['bridgeExecutablePath'] = '/path/to/bridge-cli'

      const command = (bridgeThinClient as any).buildRegisterCommand()

      expect(command).toBe('/path/to/bridge-cli  --register https://registry.example.com')
      expect(mockDebug).toHaveBeenCalledWith('Building register command')
      expect(mockDebug).toHaveBeenCalledWith('Register command built: /path/to/bridge-cli  --register https://registry.example.com')
    })
  })

  describe('Platform-specific tests', () => {
    test('should work on macOS', () => {
      mockGetOSPlatform.mockReturnValue('macosx')

      const bridgeType = bridgeThinClient.getBridgeType()

      expect(bridgeType).toBe('bridge-cli-thin-client')
    })

    test('should work on Linux', () => {
      mockGetOSPlatform.mockReturnValue('linux64')

      const bridgeType = bridgeThinClient.getBridgeType()

      expect(bridgeType).toBe('bridge-cli-thin-client')
    })

    test('should work on Windows', () => {
      mockGetOSPlatform.mockReturnValue('win64')

      const bridgeType = bridgeThinClient.getBridgeType()

      expect(bridgeType).toBe('bridge-cli-thin-client')
    })
  })

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
      Object.defineProperty(inputs, 'BRIDGE_REGISTRY_URL', {value: '', configurable: true})

      jest.spyOn(bridgeThinClient as any, 'runBridgeCommand').mockRejectedValue(new Error('Command execution failed'))

      await expect((bridgeThinClient as any).executeCommand('test-command', {cwd: '/tmp'})).rejects.toThrow('Command execution failed')
    })
  })
})
