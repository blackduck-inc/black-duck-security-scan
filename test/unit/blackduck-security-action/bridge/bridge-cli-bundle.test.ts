// Mock external dependencies BEFORE any imports
import * as inputs from '../../../../src/blackduck-security-action/inputs'
import {ENABLE_NETWORK_AIR_GAP} from '../../../../src/blackduck-security-action/inputs'
import {BridgeCliBundle} from '../../../../src/blackduck-security-action/bridge/bridge-cli-bundle'
import {ExecOptions} from '@actions/exec'
import * as downloadUtility from '../../../../src/blackduck-security-action/download-utility'
import * as utility from '../../../../src/blackduck-security-action/utility'
import * as core from '@actions/core'
import * as fs from 'fs'
import {rmRF} from '@actions/io'

jest.mock('@actions/core')
jest.mock('@actions/exec')
jest.mock('@actions/io', () => ({
  rmRF: jest.fn(),
  mkdirP: jest.fn(),
  which: jest.fn(),
  findInPath: jest.fn(),
  tryGetExecutablePath: jest.fn(),
  isDirectory: jest.fn(),
  exists: jest.fn(),
  isFile: jest.fn(),
  mv: jest.fn(),
  cp: jest.fn()
}))
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  renameSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  rmSync: jest.fn(),
  statSync: jest.fn(),
  constants: {
    F_OK: 0,
    R_OK: 4,
    W_OK: 2,
    X_OK: 1
  },
  promises: {
    chmod: jest.fn(),
    stat: jest.fn(),
    access: jest.fn()
  },
  chmod: jest.fn(),
  chmodSync: jest.fn(),
  stat: jest.fn(),
  access: jest.fn(),
  accessSync: jest.fn()
}))
jest.mock('../../../../src/blackduck-security-action/utility')
jest.mock('../../../../src/blackduck-security-action/download-utility')
jest.mock('../../../../src/blackduck-security-action/inputs', () => {
  const mockInputs = {}

  // Define all input properties as configurable and writable
  const inputProperties = ['POLARIS_WORKFLOW_VERSION', 'BLACKDUCKSCA_WORKFLOW_VERSION', 'SRM_WORKFLOW_VERSION', 'COVERITY_WORKFLOW_VERSION', 'BRIDGE_CLI_INSTALL_DIRECTORY_KEY', 'ENABLE_NETWORK_AIR_GAP', 'BRIDGE_CLI_DOWNLOAD_URL', 'BRIDGE_CLI_DOWNLOAD_VERSION']

  inputProperties.forEach(prop => {
    Object.defineProperty(mockInputs, prop, {
      configurable: true,
      writable: true,
      value: ''
    })
  })

  return mockInputs
})

describe('BridgeCliBundle', () => {
  let bridgeCliBundle: BridgeCliBundle
  const mockDebug = jest.mocked(core.debug)
  const mockInfo = jest.mocked(core.info)
  const mockFsExistsSync = jest.mocked(fs.existsSync)
  const mockFsReadFileSync = jest.mocked(fs.readFileSync)
  const mockFsRenameSync = jest.mocked(fs.renameSync)
  const mockRmRF = jest.mocked(rmRF)
  const mockCheckIfPathExists = jest.mocked(utility.checkIfPathExists)
  const mockGetOSPlatform = jest.mocked(utility.getOSPlatform)
  const mockParseToBoolean = jest.mocked(utility.parseToBoolean)
  const mockExtractZipped = jest.mocked(downloadUtility.extractZipped)

  beforeEach(() => {
    jest.clearAllMocks()
    bridgeCliBundle = new BridgeCliBundle()

    // Default mocks
    mockGetOSPlatform.mockReturnValue('linux64')
    mockParseToBoolean.mockReturnValue(false)
    mockCheckIfPathExists.mockReturnValue(true)
  })

  describe('constructor and initialization', () => {
    it('should initialize with correct bridge type and file type', () => {
      expect(bridgeCliBundle.getBridgeType()).toBe('bridge-cli-bundle')
      expect(bridgeCliBundle.getBridgeFileType()).toBe('bridge-cli')
    })

    it('should initialize URLs correctly', () => {
      mockGetOSPlatform.mockReturnValue('macosx')
      const bundle = new BridgeCliBundle()

      // Test that initializeUrls is called during construction
      expect(mockGetOSPlatform).toHaveBeenCalled()
    })
  })

  describe('generateFormattedCommand', () => {
    it('should generate correct command format', () => {
      const stage = 'testStage'
      const stateFilePath = '/path/to/state.json'

      const result = bridgeCliBundle.generateFormattedCommand(stage, stateFilePath)

      expect(result).toBe('--stage testStage --input /path/to/state.json')
      expect(mockDebug).toHaveBeenCalledWith(`Generating command for stage: ${stage}, state file: ${stateFilePath}`)
      expect(mockInfo).toHaveBeenCalledWith(`Generated command: --stage testStage --input /path/to/state.json`)
    })

    it('should log workflow version info when workflow versions are present', () => {
      // Create a new instance with mocked workflow versions by directly manipulating the static property
      const originalWorkflowVersions = (BridgeCliBundle as any).WORKFLOW_VERSIONS
      ;(BridgeCliBundle as any).WORKFLOW_VERSIONS = ['1.0.0', '', '', '']

      const result = bridgeCliBundle.generateFormattedCommand('test', '/path/state.json')

      expect(mockInfo).toHaveBeenCalledWith('Detected workflow version for Polaris, Black Duck SCA, Coverity, or SRM is not applicable for Bridge CLI Bundle.')

      // Restore original value
      ;(BridgeCliBundle as any).WORKFLOW_VERSIONS = originalWorkflowVersions
    })
  })

  describe('getBridgeCLIDownloadDefaultPath', () => {
    it('should return correct download path', () => {
      jest.spyOn(bridgeCliBundle as any, 'getBridgeCLIDownloadPathCommon').mockReturnValue('/mock/path')

      const result = bridgeCliBundle.getBridgeCLIDownloadDefaultPath()

      expect(result).toBe('/mock/path')
      expect((bridgeCliBundle as any).getBridgeCLIDownloadPathCommon).toHaveBeenCalledWith(false)
    })
  })

  describe('validateAndSetBridgePath', () => {
    beforeEach(() => {
      jest.spyOn(bridgeCliBundle as any, 'getBridgeDefaultPath').mockReturnValue('/default/bridge/path')
      jest.spyOn(bridgeCliBundle as any, 'validateAirGapExecutable').mockResolvedValue(undefined)
    })

    // it('should use custom install directory when provided', async () => {
    //   Object.defineProperty(inputs, 'BRIDGE_CLI_INSTALL_DIRECTORY_KEY', {
    //     value: '/custom/install/dir',
    //     configurable: true
    //   })
    //   mockGetOSPlatform.mockReturnValue('linux64')
    //
    //   await bridgeCliBundle.validateAndSetBridgePath()
    //
    //   expect(mockInfo).toHaveBeenCalledWith('Bridge CLI directory /custom/install/dir/bridge-cli-bundle')
    //   expect((bridgeCliBundle as any).bridgePath).toBe('/custom/install/dir/bridge-cli-bundle/bridge-cli-bundle-linux64')
    // })

    it('should use default path when custom directory not provided', async () => {
      Object.defineProperty(inputs, 'BRIDGE_CLI_INSTALL_DIRECTORY_KEY', {
        value: '',
        configurable: true
      })
      mockGetOSPlatform.mockReturnValue('linux64')

      await bridgeCliBundle.validateAndSetBridgePath()

      expect(mockInfo).toHaveBeenCalledWith('Bridge CLI directory /default/bridge/path')
      expect((bridgeCliBundle as any).bridgePath).toBe('/default/bridge/path/bridge-cli-bundle-linux64')
    })

    it('should validate air gap executable when air gap mode is enabled', async () => {
      mockParseToBoolean.mockReturnValue(true)
      // Directly set the mock value instead of spying
      Object.defineProperty(inputs, 'BRIDGE_CLI_INSTALL_DIRECTORY_KEY', {
        value: '',
        configurable: true
      })

      await bridgeCliBundle.validateAndSetBridgePath()

      expect((bridgeCliBundle as any).validateAirGapExecutable).toHaveBeenCalled()
    })

    it('should not validate air gap executable when air gap mode is disabled', async () => {
      mockParseToBoolean.mockReturnValue(false)

      await bridgeCliBundle.validateAndSetBridgePath()

      expect((bridgeCliBundle as any).validateAirGapExecutable).not.toHaveBeenCalled()
    })
  })

  describe('getBridgeVersion', () => {
    beforeEach(() => {
      ;(bridgeCliBundle as any).bridgePath = '/bridge/path'
    })

    it('should return version from versions.txt file', async () => {
      const versionContent = 'bridge-cli-bundle: 1.2.3\nother-tool: 4.5.6'
      mockFsReadFileSync.mockReturnValue(versionContent)

      const result = await bridgeCliBundle.getBridgeVersion()

      expect(result).toBe('1.2.3')
      expect(mockFsReadFileSync).toHaveBeenCalledWith('/bridge/path/versions.txt', 'utf-8')
      expect(mockDebug).toHaveBeenCalledWith('Reading bridge version from: /bridge/path/versions.txt')
      expect(mockDebug).toHaveBeenCalledWith('Extracted bridge version: 1.2.3')
    })

    it('should return empty string when version pattern not found', async () => {
      const versionContent = 'other-tool: 4.5.6\nyet-another-tool: 7.8.9'
      mockFsReadFileSync.mockReturnValue(versionContent)

      const result = await bridgeCliBundle.getBridgeVersion()

      expect(result).toBe('')
      expect(mockDebug).toHaveBeenCalledWith('Extracted bridge version: not found')
    })

    it('should return empty string when file read fails', async () => {
      const error = new Error('File not found')
      mockFsReadFileSync.mockImplementation(() => {
        throw error
      })

      const result = await bridgeCliBundle.getBridgeVersion()

      expect(result).toBe('')
      expect(mockDebug).toHaveBeenCalledWith('Error reading bridge version file: File not found')
    })
  })

  describe('checkIfVersionExists', () => {
    it('should return true when version exists in file', async () => {
      const versionContent = 'bridge-cli-bundle: 1.2.3\nother-tool: 4.5.6'
      mockFsReadFileSync.mockReturnValue(versionContent)

      const result = await bridgeCliBundle.checkIfVersionExists('1.2.3', '/path/to/versions.txt')

      expect(result).toBe(true)
      expect(mockFsReadFileSync).toHaveBeenCalledWith('/path/to/versions.txt', 'utf-8')
    })

    it('should return false when version does not exist in file', async () => {
      const versionContent = 'bridge-cli-bundle: 1.2.3\nother-tool: 4.5.6'
      mockFsReadFileSync.mockReturnValue(versionContent)

      const result = await bridgeCliBundle.checkIfVersionExists('2.0.0', '/path/to/versions.txt')

      expect(result).toBe(false)
    })

    it('should return false when file read fails', async () => {
      const error = new Error('File read error')
      mockFsReadFileSync.mockImplementation(() => {
        throw error
      })

      const result = await bridgeCliBundle.checkIfVersionExists('1.2.3', '/path/to/versions.txt')

      expect(result).toBe(false)
      expect(mockInfo).toHaveBeenCalledWith('Error reading version file content: File read error')
    })
  })

  describe('isBridgeInstalled', () => {
    beforeEach(() => {
      jest.spyOn(bridgeCliBundle, 'validateAndSetBridgePath').mockResolvedValue()
      jest.spyOn(bridgeCliBundle, 'checkIfVersionExists').mockResolvedValue(true)
    })

    it('should validate and set bridge path if not already set', async () => {
      ;(bridgeCliBundle as any).bridgePath = ''

      await bridgeCliBundle.isBridgeInstalled('1.2.3')

      expect(bridgeCliBundle.validateAndSetBridgePath).toHaveBeenCalled()
    })

    it('should return false when version file does not exist', async () => {
      ;(bridgeCliBundle as any).bridgePath = '/bridge/path'
      mockCheckIfPathExists.mockReturnValue(false)

      const result = await bridgeCliBundle.isBridgeInstalled('1.2.3')

      expect(result).toBe(false)
      expect(mockDebug).toHaveBeenCalledWith('Bridge CLI version file could not be found at /bridge/path')
    })

    it('should return true when version exists', async () => {
      ;(bridgeCliBundle as any).bridgePath = '/bridge/path'
      mockCheckIfPathExists.mockReturnValue(true)

      const result = await bridgeCliBundle.isBridgeInstalled('1.2.3')

      expect(result).toBe(true)
      expect(mockDebug).toHaveBeenCalledWith('Version file found at /bridge/path')
      expect(bridgeCliBundle.checkIfVersionExists).toHaveBeenCalledWith('1.2.3', '/bridge/path/versions.txt')
    })
  })

  describe('validateBridgeVersion', () => {
    it('should return true when version exists in available versions', async () => {
      jest.spyOn(bridgeCliBundle, 'getAllAvailableBridgeVersions').mockResolvedValue(['1.2.3', '1.2.4', '1.3.0'])

      const result = await bridgeCliBundle.validateBridgeVersion('1.2.3')

      expect(result).toBe(true)
    })

    it('should return false when version does not exist in available versions', async () => {
      jest.spyOn(bridgeCliBundle, 'getAllAvailableBridgeVersions').mockResolvedValue(['1.2.3', '1.2.4', '1.3.0'])

      const result = await bridgeCliBundle.validateBridgeVersion('2.0.0')

      expect(result).toBe(false)
    })

    it('should trim version before checking', async () => {
      jest.spyOn(bridgeCliBundle, 'getAllAvailableBridgeVersions').mockResolvedValue(['1.2.3', '1.2.4', '1.3.0'])

      const result = await bridgeCliBundle.validateBridgeVersion('  1.2.3  ')

      expect(result).toBe(true)
    })
  })

  describe('executeCommand', () => {
    it('should call runBridgeCommand with correct parameters', async () => {
      const mockRunBridgeCommand = jest.spyOn(bridgeCliBundle as any, 'runBridgeCommand').mockResolvedValue(0)
      const bridgeCommand = 'test command'
      const execOptions: ExecOptions = {cwd: '/test/dir'}

      const result = await (bridgeCliBundle as any).executeCommand(bridgeCommand, execOptions)

      expect(result).toBe(0)
      expect(mockRunBridgeCommand).toHaveBeenCalledWith(bridgeCommand, execOptions)
    })
  })

  describe('handleBridgeDownload', () => {
    beforeEach(() => {
      ;(bridgeCliBundle as any).bridgePath = '/final/bridge/path'
      jest.spyOn(bridgeCliBundle as any, 'moveBridgeFiles').mockResolvedValue(undefined)
    })

    it('should extract and move bridge files', async () => {
      const downloadResponse: {filePath: string} = {filePath: '/temp/bridge.zip'}
      const extractPath = '/extract/path'

      await (bridgeCliBundle as any).handleBridgeDownload(downloadResponse, extractPath)

      expect(mockExtractZipped).toHaveBeenCalledWith('/temp/bridge.zip', '/extract/path/bridge-cli-bundle')
      expect((bridgeCliBundle as any).moveBridgeFiles).toHaveBeenCalledWith('/temp/bridge.zip', '/extract/path/bridge-cli-bundle')
      expect(mockDebug).toHaveBeenCalledWith('Starting bridge download handling - extracting to: /extract/path/bridge-cli-bundle')
      expect(mockDebug).toHaveBeenCalledWith('Bridge archive extraction completed')
      expect(mockDebug).toHaveBeenCalledWith('Bridge files moved to final location')
    })
  })

  describe('updateBridgeCLIVersion', () => {
    beforeEach(() => {
      jest.spyOn(bridgeCliBundle, 'validateBridgeVersion').mockResolvedValue(true)
      jest.spyOn(bridgeCliBundle, 'getVersionUrl').mockReturnValue('https://example.com/bridge-1.2.3.zip')
    })

    it('should return bridge URL and version when version is valid', async () => {
      mockParseToBoolean.mockReturnValue(false)

      const result = await (bridgeCliBundle as any).updateBridgeCLIVersion('1.2.3')

      expect(result).toEqual({
        bridgeUrl: 'https://example.com/bridge-1.2.3.zip',
        bridgeVersion: '1.2.3'
      })
    })

    it('should throw error when version is invalid', async () => {
      jest.spyOn(bridgeCliBundle, 'validateBridgeVersion').mockResolvedValue(false)

      await expect((bridgeCliBundle as any).updateBridgeCLIVersion('invalid.version')).rejects.toThrow('Bridge CLI version not found')
    })

    it('should throw error in air gap mode without download URL', async () => {
      mockParseToBoolean.mockReturnValue(true)

      Object.defineProperty(inputs, 'BRIDGE_CLI_DOWNLOAD_URL', {value: '', configurable: true})
      Object.defineProperty(inputs, 'BRIDGE_CLI_DOWNLOAD_VERSION', {value: '1.2.3', configurable: true})
      Object.defineProperty(inputs, 'ENABLE_NETWORK_AIR_GAP', {value: 'true', configurable: true})
      await expect((bridgeCliBundle as any).updateBridgeCLIVersion('1.2.3')).rejects.toThrow("Unable to use the specified Bridge CLI version in air gap mode. Please provide a valid 'BRIDGE_CLI_DOWNLOAD_URL'.")
    })
  })

  describe('checkIfBridgeExistsInAirGap', () => {
    it('should validate and set bridge path and return true', async () => {
      jest.spyOn(bridgeCliBundle, 'validateAndSetBridgePath').mockResolvedValue()

      const result = await (bridgeCliBundle as any).checkIfBridgeExistsInAirGap()

      expect(result).toBe(true)
      expect(bridgeCliBundle.validateAndSetBridgePath).toHaveBeenCalled()
    })
  })

  describe('verifyRegexCheck', () => {
    it('should return match array when URL matches pattern', () => {
      const bridgeUrl = 'https://example.com/bridge-cli-bundle-1.2.3-linux64.zip'

      const result = (bridgeCliBundle as any).verifyRegexCheck(bridgeUrl)

      expect(result).not.toBeNull()
      expect(result![1]).toBe('1.2.3')
      expect(mockDebug).toHaveBeenCalledWith('Verifying URL pattern for bridge type: bridge-cli-bundle')
      expect(mockDebug).toHaveBeenCalledWith('URL pattern verification result: match found')
    })

    it('should return null when URL does not match pattern', () => {
      const bridgeUrl = 'https://example.com/invalid-url.zip'

      const result = (bridgeCliBundle as any).verifyRegexCheck(bridgeUrl)

      expect(result).toBeNull()
      expect(mockDebug).toHaveBeenCalledWith('URL pattern verification result: no match')
    })
  })

  // describe('downloadBridge', () => {
  //   beforeEach(() => {
  //     jest.spyOn(BridgeCliBundle.prototype, 'downloadBridge').mockImplementation(jest.fn().mockResolvedValue(undefined))
  //   })
  //
  //   it('should clear existing bridge folder and call super.downloadBridge', async () => {
  //     ;(bridgeCliBundle as any).bridgePath = '/existing/bridge/path'
  //     mockFsExistsSync.mockReturnValue(true)
  //
  //     const superDownloadBridge = jest.spyOn(Object.getPrototypeOf(BridgeCliBundle.prototype), 'downloadBridge').mockResolvedValue(undefined)
  //
  //     await bridgeCliBundle.downloadBridge('/temp/dir')
  //
  //     expect(mockDebug).toHaveBeenCalledWith('Starting bridge download process...')
  //     expect(mockInfo).toHaveBeenCalledWith('Clear the existing bridge folder, if available from /existing/bridge/path')
  //     expect(mockRmRF).toHaveBeenCalledWith('/existing/bridge/path')
  //     expect(superDownloadBridge).toHaveBeenCalledWith('/temp/dir')
  //   })
  //
  //   it('should not clear folder if it does not exist', async () => {
  //     ;(bridgeCliBundle as any).bridgePath = '/non/existing/path'
  //     mockFsExistsSync.mockReturnValue(false)
  //
  //     const superDownloadBridge = jest.spyOn(Object.getPrototypeOf(BridgeCliBundle.prototype), 'downloadBridge').mockResolvedValue(undefined)
  //
  //     await bridgeCliBundle.downloadBridge('/temp/dir')
  //
  //     expect(mockRmRF).not.toHaveBeenCalled()
  //     expect(superDownloadBridge).toHaveBeenCalledWith('/temp/dir')
  //   })
  // })

  describe('getLatestVersionRegexPattern', () => {
    it('should return correct regex pattern for latest version', () => {
      const pattern = (bridgeCliBundle as any).getLatestVersionRegexPattern()

      expect(pattern.source).toBe('(bridge-cli-bundle-(win64|linux64|linux_arm|macosx|macos_arm)\\.zip)')
    })
  })

  describe('private methods', () => {
    describe('moveBridgeFiles', () => {
      it('should rename folder from source to bridge path', async () => {
        ;(bridgeCliBundle as any).bridgePath = '/final/bridge/path'

        await (bridgeCliBundle as any).moveBridgeFiles('/temp/bridge.zip', '/extract/path')

        expect(mockFsRenameSync).toHaveBeenCalledWith('/extract/path/bridge', '/final/bridge/path')
        expect(mockDebug).toHaveBeenCalledWith('Rename folder from /extract/path/bridge to /final/bridge/path')
      })
    })

    describe('buildCommand', () => {
      it('should build command with correct format', () => {
        const result = (bridgeCliBundle as any).buildCommand('testStage', '/path/to/state.json')

        expect(result).toBe('--stage testStage --input /path/to/state.json')
      })
    })

    describe('getVersionFilePath', () => {
      it('should return correct version file path', () => {
        ;(bridgeCliBundle as any).bridgePath = '/bridge/path'

        const result = (bridgeCliBundle as any).getVersionFilePath()

        expect(result).toBe('/bridge/path/versions.txt')
      })
    })
  })
})
