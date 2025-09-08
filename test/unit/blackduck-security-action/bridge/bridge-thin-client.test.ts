import {BridgeThinClient} from '../../../../src/blackduck-security-action/bridge/bridge-thin-client'
import {ExecOptions} from '@actions/exec'
import * as downloadUtility from '../../../../src/blackduck-security-action/download-utility'
import * as utility from '../../../../src/blackduck-security-action/utility'
import * as core from '@actions/core'
import {execSync} from 'node:child_process'
import * as inputs from '../../../../src/blackduck-security-action/inputs'

// Mock external dependencies
jest.mock('@actions/core')
jest.mock('node:child_process')
jest.mock('../../../../src/blackduck-security-action/utility')
jest.mock('../../../../src/blackduck-security-action/download-utility')

describe('BridgeThinClient', () => {
  let bridgeThinClient: BridgeThinClient
  const mockDebug = jest.mocked(core.debug)
  const mockInfo = jest.mocked(core.info)
  const mockExecSync = jest.mocked(execSync)
  const mockCheckIfPathExists = jest.mocked(utility.checkIfPathExists)
  const mockGetOSPlatform = jest.mocked(utility.getOSPlatform)
  const mockParseToBoolean = jest.mocked(utility.parseToBoolean)
  const mockExtractZipped = jest.mocked(downloadUtility.extractZipped)

  beforeEach(() => {
    jest.clearAllMocks()
    bridgeThinClient = new BridgeThinClient()

    // Default mocks
    mockGetOSPlatform.mockReturnValue('linux64')
    mockParseToBoolean.mockReturnValue(false)
    mockCheckIfPathExists.mockReturnValue(true)
    mockExecSync.mockReturnValue(Buffer.from('1.2.3'))
  })

  describe('constructor and initialization', () => {
    it('should initialize with correct bridge type and file type', () => {
      expect(bridgeThinClient.getBridgeType()).toBe('bridge-cli-thin-client')
      expect(bridgeThinClient.getBridgeFileType()).toBe('bridge-cli')
    })

    it('should initialize URLs correctly on construction', () => {
      mockGetOSPlatform.mockReturnValue('macosx')
      const thinClient = new BridgeThinClient()

      expect(mockGetOSPlatform).toHaveBeenCalled()
    })
  })

  describe('generateFormattedCommand', () => {
    beforeEach(() => {
      jest.spyOn(bridgeThinClient as any, 'buildCommand').mockReturnValue('--stage test --input /path/state.json')
    })

    it('should generate correct command format', () => {
      const stage = 'testStage'
      const stateFilePath = '/path/to/state.json'

      const result = bridgeThinClient.generateFormattedCommand(stage, stateFilePath)

      expect(result).toBe('--stage test --input /path/state.json')
      expect(mockDebug).toHaveBeenCalledWith(`Generating command for stage: ${stage}, state file: ${stateFilePath}`)
      expect(mockInfo).toHaveBeenCalledWith('Generated command: --stage test --input /path/state.json')
    })
  })

  describe('getBridgeCLIDownloadDefaultPath', () => {
    it('should return correct download path with bridge type included', () => {
      jest.spyOn(bridgeThinClient as any, 'getBridgeCLIDownloadPathCommon').mockReturnValue('/mock/path')

      const result = bridgeThinClient.getBridgeCLIDownloadDefaultPath()

      expect(result).toBe('/mock/path')
      expect((bridgeThinClient as any).getBridgeCLIDownloadPathCommon).toHaveBeenCalledWith(true)
    })
  })

  describe('validateAndSetBridgePath', () => {
    beforeEach(() => {
      jest.spyOn(bridgeThinClient as any, 'getBridgeDefaultPath').mockReturnValue('/default/bridge/path')
      jest.spyOn(bridgeThinClient as any, 'validateAirGapExecutable').mockResolvedValue(undefined)
    })

    it('should use custom install directory when provided', async () => {
      Object.defineProperty(inputs, 'BRIDGE_CLI_INSTALL_DIRECTORY_KEY', {
        value: '/custom/install/dir',
        configurable: true
      })
      mockGetOSPlatform.mockReturnValue('linux64')

      await bridgeThinClient.validateAndSetBridgePath()

      expect(mockInfo).toHaveBeenCalledWith('Bridge CLI directory /custom/install/dir/bridge-cli-thin-client')
      expect((bridgeThinClient as any).bridgePath).toBe('/custom/install/dir/bridge-cli-thin-client/bridge-cli-linux64')
    })

    it('should use default path when custom directory not provided', async () => {
      Object.defineProperty(inputs, 'BRIDGE_CLI_INSTALL_DIRECTORY_KEY', {
        value: '',
        configurable: true
      })
      mockGetOSPlatform.mockReturnValue('macosx')

      await bridgeThinClient.validateAndSetBridgePath()

      expect(mockInfo).toHaveBeenCalledWith('Bridge CLI directory /default/bridge/path')
      expect((bridgeThinClient as any).bridgePath).toBe('/default/bridge/path/bridge-cli-macosx')
    })

    it('should validate air gap executable when air gap mode is enabled', async () => {
      mockParseToBoolean.mockReturnValue(true)
      Object.defineProperty(inputs, 'BRIDGE_CLI_INSTALL_DIRECTORY_KEY', {
        value: '',
        configurable: true
      })

      await bridgeThinClient.validateAndSetBridgePath()

      expect((bridgeThinClient as any).validateAirGapExecutable).toHaveBeenCalled()
    })
  })

  describe('getBridgeVersion', () => {
    beforeEach(() => {
      ;(bridgeThinClient as any).bridgePath = '/bridge/path'
    })

    it('should return version from bridge executable', async () => {
      mockExecSync.mockReturnValue(Buffer.from('Bridge CLI 2.1.0'))

      const result = await bridgeThinClient.getBridgeVersion()

      expect(result).toBe('Bridge CLI 2.1.0')
      expect(mockExecSync).toHaveBeenCalledWith('/bridge/path/bridge-cli --version')
      expect(mockDebug).toHaveBeenCalledWith('Getting bridge version from executable: /bridge/path/bridge-cli')
    })

    it('should throw error when executable fails', async () => {
      const error = new Error('Command failed')
      mockExecSync.mockImplementation(() => {
        throw error
      })

      await expect(bridgeThinClient.getBridgeVersion()).rejects.toThrow('Failed to get bridge version: Command failed')
    })
  })

  describe('isBridgeInstalled', () => {
    beforeEach(() => {
      jest.spyOn(bridgeThinClient, 'validateAndSetBridgePath').mockResolvedValue()
    })

    it('should return true when bridge is installed with correct version', async () => {
      mockCheckIfPathExists.mockReturnValue(true)

      const result = await bridgeThinClient.isBridgeInstalled('1.2.3')

      expect(result).toBe(true)
      expect((bridgeThinClient as any).currentVersion).toBe('1.2.3')
      expect((bridgeThinClient as any).isBridgeCLIInstalled).toBe(true)
    })

    it('should return false when bridge executable does not exist', async () => {
      mockCheckIfPathExists.mockReturnValue(false)

      const result = await bridgeThinClient.isBridgeInstalled('1.2.3')

      expect(result).toBe(false)
      expect(mockDebug).toHaveBeenCalledWith('Bridge executable does not exist')
    })

    it('should return false when version does not match', async () => {
      mockCheckIfPathExists.mockReturnValue(true)
      jest.spyOn(bridgeThinClient, 'getBridgeVersion').mockResolvedValue('1.2.4')

      const result = await bridgeThinClient.isBridgeInstalled('1.2.3')

      expect(result).toBe(false)
      expect((bridgeThinClient as any).isBridgeCLIInstalled).toBe(false)
    })

    it('should validate bridge path if not already set', async () => {
      ;(bridgeThinClient as any).bridgePath = ''

      await bridgeThinClient.isBridgeInstalled('1.2.3')

      expect(bridgeThinClient.validateAndSetBridgePath).toHaveBeenCalled()
    })

    it('should throw error when getBridgeVersion fails', async () => {
      const error = new Error('Version check failed')
      jest.spyOn(bridgeThinClient, 'getBridgeVersion').mockRejectedValue(error)

      await expect(bridgeThinClient.isBridgeInstalled('1.2.3')).rejects.toThrow('Version check failed')
      expect(mockDebug).toHaveBeenCalledWith('Failed to get bridge version: Version check failed')
    })
  })

  describe('executeCommand', () => {
    beforeEach(() => {
      jest.spyOn(bridgeThinClient as any, 'runBridgeCommand').mockResolvedValue(0)
      jest.spyOn(bridgeThinClient as any, 'appendRegisterCommand').mockReturnValue('register command')
    })

    it('should execute command without registration when registry URL is empty', async () => {
      mockParseToBoolean.mockReturnValue(false)
      const execOptions: ExecOptions = {cwd: '/test'}

      const result = await (bridgeThinClient as any).executeCommand('test command', execOptions)

      expect(result).toBe(0)
      expect(mockDebug).toHaveBeenCalledWith('Registry URL is empty')
      expect((bridgeThinClient as any).runBridgeCommand).toHaveBeenCalledTimes(1)
      expect((bridgeThinClient as any).runBridgeCommand).toHaveBeenCalledWith('test command', execOptions)
    })

    it('should execute registration command first when registry URL is provided', async () => {
      mockParseToBoolean.mockReturnValue(true)
      Object.defineProperty(inputs, 'BRIDGE_REGISTRY_URL', {
        value: 'https://registry.example.com',
        configurable: true
      })
      const execOptions: ExecOptions = {cwd: '/test'}

      const result = await (bridgeThinClient as any).executeCommand('test command', execOptions)

      expect(result).toBe(0)
      expect((bridgeThinClient as any).runBridgeCommand).toHaveBeenCalledTimes(2)
      expect((bridgeThinClient as any).runBridgeCommand).toHaveBeenNthCalledWith(1, 'register command', execOptions)
      expect((bridgeThinClient as any).runBridgeCommand).toHaveBeenNthCalledWith(2, 'test command', execOptions)
    })

    it('should throw error when registration command fails', async () => {
      mockParseToBoolean.mockReturnValue(true)
      Object.defineProperty(inputs, 'BRIDGE_REGISTRY_URL', {
        value: 'https://registry.example.com',
        configurable: true
      })
      const execOptions: ExecOptions = {cwd: '/test'}
      jest
        .spyOn(bridgeThinClient as any, 'runBridgeCommand')
        .mockResolvedValueOnce(1) // registration fails
        .mockResolvedValueOnce(0) // main command would succeed

      await expect((bridgeThinClient as any).executeCommand('test command', execOptions)).rejects.toThrow('Register command failed, returning early')
    })
  })

  describe('downloadBridge', () => {
    it('should call super.downloadBridge with debug logging', async () => {
      const superDownloadBridge = jest.spyOn(Object.getPrototypeOf(BridgeThinClient.prototype), 'downloadBridge').mockResolvedValue(undefined)

      await bridgeThinClient.downloadBridge('/temp/dir')

      expect(mockDebug).toHaveBeenCalledWith('Starting bridge download process...')
      expect(superDownloadBridge).toHaveBeenCalledWith('/temp/dir')
    })
  })

  describe('handleBridgeDownload', () => {
    it('should extract bridge to correct target path', async () => {
      const downloadResponse: {filePath: string} = {filePath: '/temp/bridge-cli-linux64.zip'}
      const extractPath = '/extract/path'

      await (bridgeThinClient as any).handleBridgeDownload(downloadResponse, extractPath)

      expect(mockDebug).toHaveBeenCalledWith('Starting bridge download handling - extracting to: /extract/path')
      expect(mockDebug).toHaveBeenCalledWith('Creating target extraction folder: /extract/path/bridge-cli-linux64')
      expect(mockExtractZipped).toHaveBeenCalledWith('/temp/bridge-cli-linux64.zip', '/extract/path/bridge-cli-linux64')
      expect(mockDebug).toHaveBeenCalledWith('Bridge archive extraction completed to /extract/path')
    })
  })

  describe('verifyRegexCheck', () => {
    beforeEach(() => {
      mockGetOSPlatform.mockReturnValue('linux64')
    })

    it('should return empty string array for latest URL', () => {
      const bridgeUrl = 'https://example.com/bridge-cli-thin-client/latest/bridge-cli-linux64.zip'

      const result = (bridgeThinClient as any).verifyRegexCheck(bridgeUrl)

      expect(result).toEqual(['', ''])
      expect(mockDebug).toHaveBeenCalledWith("URL contains 'latest', returning empty string as version")
    })

    it('should return match array for versioned URL', () => {
      const bridgeUrl = 'https://example.com/bridge-cli-thin-client/1.2.3/bridge-cli-linux64.zip'

      const result = (bridgeThinClient as any).verifyRegexCheck(bridgeUrl)

      expect(result).not.toBeNull()
      expect(result![1]).toBe('1.2.3')
      expect(mockDebug).toHaveBeenCalledWith('Verifying URL pattern for bridge type: bridge-cli-linux64')
      expect(mockDebug).toHaveBeenCalledWith('URL pattern verification result: match found')
    })

    it('should return null for invalid URL pattern', () => {
      const bridgeUrl = 'https://example.com/invalid-url.zip'

      const result = (bridgeThinClient as any).verifyRegexCheck(bridgeUrl)

      expect(result).toBeNull()
      expect(mockDebug).toHaveBeenCalledWith('URL pattern verification result: no match')
    })
  })

  describe('updateBridgeCLIVersion', () => {
    beforeEach(() => {
      jest.spyOn(bridgeThinClient, 'getVersionUrl').mockReturnValue('https://example.com/bridge-1.2.3.zip')
      jest.spyOn(bridgeThinClient as any, 'executeUseBridgeCommand').mockResolvedValue(undefined)
      jest.spyOn(bridgeThinClient as any, 'getBridgeExecutablePath').mockReturnValue('/bridge/path/bridge-cli')
    })

    it('should return bridge URL for non-air gap mode', async () => {
      mockParseToBoolean.mockReturnValue(false)

      const result = await (bridgeThinClient as any).updateBridgeCLIVersion('1.2.3')

      expect(result).toEqual({
        bridgeUrl: 'https://example.com/bridge-1.2.3.zip',
        bridgeVersion: '1.2.3'
      })
    })

    it('should execute use command in air gap mode', async () => {
      mockParseToBoolean.mockReturnValue(true)

      const result = await (bridgeThinClient as any).updateBridgeCLIVersion('1.2.3')

      expect(result).toEqual({
        bridgeUrl: '',
        bridgeVersion: '1.2.3'
      })
      expect((bridgeThinClient as any).executeUseBridgeCommand).toHaveBeenCalledWith('/bridge/path/bridge-cli', '1.2.3')
    })
  })

  describe('checkIfBridgeExistsInAirGap', () => {
    it('should validate and set bridge path and return true', async () => {
      jest.spyOn(bridgeThinClient, 'validateAndSetBridgePath').mockResolvedValue()

      const result = await (bridgeThinClient as any).checkIfBridgeExistsInAirGap()

      expect(result).toBe(true)
      expect(bridgeThinClient.validateAndSetBridgePath).toHaveBeenCalled()
    })
  })

  describe('private methods', () => {
    describe('buildCommand', () => {
      beforeEach(() => {
        jest.spyOn(bridgeThinClient as any, 'handleBridgeUpdateCommand').mockReturnValue('--update')
      })

      it('should build command with workflow version', () => {
        jest.resetModules()
        let polarisWorkflowVersion = '2.0.0'
        // Re-import BridgeThinClient to use the mocked inputs
        const {BridgeThinClient} = require('../../../../src/blackduck-security-action/bridge/bridge-thin-client')
        const thinClient = new BridgeThinClient()
        jest.spyOn(thinClient, 'handleBridgeUpdateCommand').mockReturnValue('--update')
        const result = (thinClient as any).buildCommand('test', '/path/state.json', polarisWorkflowVersion)
        expect(result).toBe('--stage test@2.0.0 --input /path/state.json --update')
      })

      it('should build command without workflow version', () => {
        jest.resetModules()
        // Re-import BridgeThinClient to use the mocked inputs
        const {BridgeThinClient} = require('../../../../src/blackduck-security-action/bridge/bridge-thin-client')
        const thinClient = new BridgeThinClient()
        jest.spyOn(thinClient, 'handleBridgeUpdateCommand').mockReturnValue('--update')
        const result = (thinClient as any).buildCommand('test', '/path/state.json')
        expect(result).toBe('--stage test --input /path/state.json --update')
      })
    })

    describe('appendRegisterCommand', () => {
      beforeEach(() => {
        ;(bridgeThinClient as any).bridgeExecutablePath = '/bridge/path/bridge-cli'
        Object.defineProperty(inputs, 'BRIDGE_REGISTRY_URL', {
          value: 'https://registry.example.com',
          configurable: true
        })
      })

      it('should build register command correctly', () => {
        const result = (bridgeThinClient as any).appendRegisterCommand()

        expect(result).toBe('/bridge/path/bridge-cli  --register https://registry.example.com')
        expect(mockDebug).toHaveBeenCalledWith('Building register command')
        expect(mockDebug).toHaveBeenCalledWith('Register command built: /bridge/path/bridge-cli  --register https://registry.example.com')
      })
    })

    describe('handleBridgeUpdateCommand', () => {
      it('should return empty string when update is disabled', () => {
        Object.defineProperty(inputs, 'DISABLE_BRIDGE_WORKFLOW_UPDATE', {
          value: '',
          configurable: true
        })
        mockParseToBoolean.mockReturnValue(true)

        const result = (bridgeThinClient as any).handleBridgeUpdateCommand()

        expect(result).toBe('')
        expect(mockInfo).toHaveBeenCalledWith('Bridge workflow update is disabled')
      })

      it('should return update command when update is enabled', () => {
        Object.defineProperty(inputs, 'DISABLE_BRIDGE_WORKFLOW_UPDATE', {
          value: 'false',
          configurable: true
        })
        mockParseToBoolean.mockReturnValue(false)

        const result = (bridgeThinClient as any).handleBridgeUpdateCommand()

        expect(result).toBe('--update')
        expect(mockInfo).toHaveBeenCalledWith('Bridge update command has been added.')
      })
    })

    describe('ensureBridgePathIsSet', () => {
      it('should validate and set bridge path if not set', async () => {
        jest.spyOn(bridgeThinClient, 'validateAndSetBridgePath').mockResolvedValue()
        ;(bridgeThinClient as any).bridgePath = ''

        await (bridgeThinClient as any).ensureBridgePathIsSet()
        expect(bridgeThinClient.validateAndSetBridgePath).toHaveBeenCalled()
      })

      it('should not validate if bridge path is already set', async () => {
        jest.spyOn(bridgeThinClient, 'validateAndSetBridgePath').mockResolvedValue()
        ;(bridgeThinClient as any).bridgePath = '/existing/path'

        await (bridgeThinClient as any).ensureBridgePathIsSet()

        expect(bridgeThinClient.validateAndSetBridgePath).not.toHaveBeenCalled()
      })
    })

    describe('getBridgeExecutablePath', () => {
      it('should return correct executable path', () => {
        ;(bridgeThinClient as any).bridgePath = '/bridge/path'

        const result = (bridgeThinClient as any).getBridgeExecutablePath()

        expect(result).toBe('/bridge/path/bridge-cli')
      })
    })

    describe('isBridgeExecutableAvailable', () => {
      it('should return true when executable exists', () => {
        mockCheckIfPathExists.mockReturnValue(true)

        const result = (bridgeThinClient as any).isBridgeExecutableAvailable('/bridge/path/bridge-cli')

        expect(result).toBe(true)
      })

      it('should return false when executable does not exist', () => {
        mockCheckIfPathExists.mockReturnValue(false)

        const result = (bridgeThinClient as any).isBridgeExecutableAvailable('/bridge/path/bridge-cli')

        expect(result).toBe(false)
        expect(mockDebug).toHaveBeenCalledWith('Bridge executable does not exist')
      })
    })

    describe('isVersionMatch', () => {
      it('should return true when versions match', () => {
        const result = (bridgeThinClient as any).isVersionMatch('1.2.3', '1.2.3')

        expect(result).toBe(true)
      })

      it('should return false when versions do not match', () => {
        const result = (bridgeThinClient as any).isVersionMatch('1.2.3', '1.2.4')

        expect(result).toBe(false)
      })
    })
  })

  describe('getLatestVersionRegexPattern', () => {
    it('should return correct regex pattern for latest version', () => {
      const pattern = (bridgeThinClient as any).getLatestVersionRegexPattern()

      expect(pattern.source).toContain('bridge-cli-')
    })
  })

  describe('executeUseBridgeCommand', () => {
    const bridgeExecutable = '/mock/path/bridge-cli'
    const bridgeVersion = '2.3.4'

    it('should execute the use bridge command successfully', async () => {
      mockExecSync.mockReturnValue(Buffer.from(''))
      await (bridgeThinClient as any).executeUseBridgeCommand(bridgeExecutable, bridgeVersion)
      expect(mockExecSync).toHaveBeenCalledWith(`${bridgeExecutable} --use bridge-cli@${bridgeVersion}`, {stdio: 'pipe'})
      expect(mockDebug).toHaveBeenCalledWith('Different bridge version found, running --use bridge command')
      expect(mockDebug).toHaveBeenCalledWith(`Successfully executed --use bridge command: ${bridgeExecutable} --use bridge-cli@${bridgeVersion} with version ${bridgeVersion}`)
    })

    it('should throw error when execSync fails', async () => {
      const error = new Error('Failed to execute')
      mockExecSync.mockImplementation(() => {
        throw error
      })
      await expect((bridgeThinClient as any).executeUseBridgeCommand(bridgeExecutable, bridgeVersion)).rejects.toThrow('Failed to execute')
      expect(mockDebug).toHaveBeenCalledWith('Different bridge version found, running --use bridge command')
      expect(mockDebug).toHaveBeenCalledWith(`Failed to execute --use bridge command: ${error.message}`)
    })
  })
})
