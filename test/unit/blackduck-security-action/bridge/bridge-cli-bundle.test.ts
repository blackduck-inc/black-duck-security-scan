import * as fsOriginal from 'fs'
import {BridgeCliBundle} from '../../../../src/blackduck-security-action/bridge/bridge-cli-bundle'
import * as core from '@actions/core'
import {rmRF} from '@actions/io'
import * as utility from '../../../../src/blackduck-security-action/utility'
import * as downloadUtility from '../../../../src/blackduck-security-action/download-utility'
import {DownloadFileResponse} from '../../../../src/blackduck-security-action/download-utility'
import * as inputs from '../../../../src/blackduck-security-action/inputs'
import * as constants from '../../../../src/application-constants'

// -------------------- MOCKS --------------------

// Partial mock for fs (keep fs.promises intact)
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn(),
  existsSync: jest.fn(),
  readdirSync: jest.fn(),
  rmdirSync: jest.fn(),
  renameSync: jest.fn()
}))

jest.mock('@actions/core', () => ({
  getInput: jest.fn().mockReturnValue(''),
  debug: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  setFailed: jest.fn(),
  summary: {
    addRaw: jest.fn().mockReturnThis(),
    write: jest.fn().mockReturnThis()
  }
}))

jest.mock('@actions/exec', () => ({
  exec: jest.fn()
}))

jest.mock('path', () => ({
  ...jest.requireActual('path'),
  join: jest.fn((...args) => args.join('/'))
}))

jest.mock('@actions/io', () => ({
  rmRF: jest.fn(),
  mkdirP: jest.fn(),
  cp: jest.fn(),
  mv: jest.fn(),
  chmod: jest.fn()
}))

jest.mock('../../../../src/blackduck-security-action/utility')
jest.mock('../../../../src/blackduck-security-action/download-utility')

class BridgeCliBundleTest extends BridgeCliBundle {
  public callCreateUpdateVersionInfo(currentVersion: string, latestVersion: string) {
    return this.createUpdateVersionInfo(currentVersion, latestVersion)
  }

  public callCreateCurrentVersionInfo(currentVersion: string) {
    return this.createCurrentVersionInfo(currentVersion)
  }

  public getBridgeUrlLatestPattern() {
    return this.bridgeUrlLatestPattern
  }
}

// -------------------- TEST SUITE --------------------

describe('BridgeCliBundle', () => {
  let bridgeCliBundle: BridgeCliBundle
  const mockDebug = jest.mocked(core.debug)
  const mockInfo = jest.mocked(core.info)
  const mockReadFileSync = jest.mocked(fsOriginal.readFileSync)
  const mockCheckIfPathExists = jest.mocked(utility.checkIfPathExists)
  const mockParseToBoolean = jest.mocked(utility.parseToBoolean)
  const mockRmRF = jest.mocked(rmRF)
  const mockExistsSync = jest.mocked(fsOriginal.existsSync)
  const mockReaddirSync = jest.mocked(fsOriginal.readdirSync)
  const mockRmdirSync = jest.mocked(fsOriginal.rmdirSync)
  const mockRenameSync = jest.mocked(fsOriginal.renameSync)

  beforeEach(() => {
    // Setup inputs/constants
    Object.defineProperty(inputs, 'BRIDGE_CLI_BASE_URL', {value: 'https://example.com', configurable: true})
    Object.defineProperty(inputs, 'POLARIS_WORKFLOW_VERSION', {value: '', configurable: true})
    Object.defineProperty(inputs, 'BLACKDUCKSCA_WORKFLOW_VERSION', {value: '', configurable: true})
    Object.defineProperty(inputs, 'SRM_WORKFLOW_VERSION', {value: '', configurable: true})
    Object.defineProperty(inputs, 'COVERITY_WORKFLOW_VERSION', {value: '', configurable: true})
    Object.defineProperty(constants, 'BRIDGE_CLI_ARTIFACTORY_URL', {
      value: 'https://default.example.com',
      configurable: true
    })
    Object.defineProperty(constants, 'BRIDGE_CLI_STAGE_OPTION', {value: '--stage', configurable: true})
    Object.defineProperty(constants, 'BRIDGE_CLI_INPUT_OPTION', {value: '--input', configurable: true})
    Object.defineProperty(constants, 'BRIDGE_CLI_SPACE', {value: ' ', configurable: true})
    Object.defineProperty(constants, 'BRIDGE_VERSION_NOT_FOUND_ERROR', {
      value: 'Bridge version not found',
      configurable: true
    })

    // Default air gap mode
    mockParseToBoolean.mockReturnValue(false)

    bridgeCliBundle = new BridgeCliBundle()

    jest.clearAllMocks()
  })

  // -------------------- BASIC TESTS --------------------
  describe('getBridgeType', () => {
    test('should return correct bridge type', () => {
      expect(bridgeCliBundle.getBridgeType()).toBe('bridge-cli-bundle')
    })
  })

  describe('getBridgeFileType', () => {
    test('should return correct bridge file type', () => {
      expect(bridgeCliBundle.getBridgeFileType()).toBe('bridge-cli')
    })
  })

  describe('getBridgeFileNameType', () => {
    test('should return correct bridge file name type', () => {
      expect(bridgeCliBundle.getBridgeFileNameType()).toBe('bridge-cli-bundle')
    })
  })

  describe('verifyRegexCheck', () => {
    test('should match URL pattern correctly', () => {
      const bridgeUrl = 'https://example.com/bridge-cli-bundle-2.1.0-linux64.zip'
      const result = bridgeCliBundle.verifyRegexCheck(bridgeUrl)
      expect(result).toBeTruthy()
      expect(result![1]).toBe('2.1.0')
    })

    test('should return null for invalid URL pattern', () => {
      const bridgeUrl = 'https://example.com/invalid-url'
      const result = bridgeCliBundle.verifyRegexCheck(bridgeUrl)
      expect(result).toBeNull()
    })
  })

  // -------------------- COMMAND TESTS --------------------
  describe('generateFormattedCommand', () => {
    test('should generate command and log workflow version info', () => {
      const stage = 'connect'
      const stateFilePath = '/tmp/input.json'

      jest.spyOn(bridgeCliBundle as any, 'logWorkflowVersionInfo').mockImplementation(() => {})
      jest.spyOn(bridgeCliBundle as any, 'buildCommand').mockReturnValue('--stage connect --input /tmp/input.json')

      const command = bridgeCliBundle.generateFormattedCommand(stage, stateFilePath)

      expect(command).toBe('--stage connect --input /tmp/input.json')
      expect(mockDebug).toHaveBeenCalledWith('Generating command for stage: connect, state file: /tmp/input.json')
      expect(mockInfo).toHaveBeenCalledWith('Generated command: --stage connect --input /tmp/input.json')
    })
  })

  describe('executeCommand', () => {
    test('should return 0 for successful execution', async () => {
      const execSpy = jest.spyOn(bridgeCliBundle as any, 'runBridgeCommand').mockResolvedValue(0)
      const result = await bridgeCliBundle.executeCommand('cmd', {cwd: '/tmp'})
      expect(result).toBe(0)
      expect(execSpy).toHaveBeenCalled()
    })

    test('should return non-zero exit code on failure', async () => {
      jest.spyOn(bridgeCliBundle as any, 'runBridgeCommand').mockResolvedValue(1)
      const result = await bridgeCliBundle.executeCommand('cmd', {cwd: '/tmp'})
      expect(result).toBe(1)
    })
  })

  // -------------------- VERSION TESTS --------------------
  describe('getBridgeVersion', () => {
    test('should read version from file successfully', async () => {
      const versionContent = 'bridge-cli-bundle: 2.1.0\nother-info:test'
      mockReadFileSync.mockReturnValue(versionContent)
      jest.spyOn(bridgeCliBundle as any, 'getVersionFilePath').mockReturnValue('/tmp/versions.txt')

      const version = await bridgeCliBundle.getBridgeVersion()
      expect(version).toBe('2.1.0')
      expect(mockDebug).toHaveBeenCalledWith('Reading bridge version from: /tmp/versions.txt')
      expect(mockDebug).toHaveBeenCalledWith('Version file content read successfully')
      expect(mockDebug).toHaveBeenCalledWith('Extracted bridge version: 2.1.0')
    })

    test('should return empty string when file read fails', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File not found')
      })
      jest.spyOn(bridgeCliBundle as any, 'getVersionFilePath').mockReturnValue('/tmp/versions.txt')

      const version = await bridgeCliBundle.getBridgeVersion()
      expect(version).toBe('')
      expect(mockDebug).toHaveBeenCalledWith('Error reading bridge version file: File not found')
    })

    test('should return empty string when version not found in content', async () => {
      const versionContent = 'other-tool: 1.0.0\nno-bridge-version'
      mockReadFileSync.mockReturnValue(versionContent)
      jest.spyOn(bridgeCliBundle as any, 'getVersionFilePath').mockReturnValue('/tmp/versions.txt')

      const version = await bridgeCliBundle.getBridgeVersion()
      expect(version).toBe('')
      expect(mockDebug).toHaveBeenCalledWith('Extracted bridge version: not found')
    })
  })

  describe('checkIfVersionExists', () => {
    test('should return true when version exists in file', async () => {
      const versionContent = 'bridge-cli-bundle: 2.1.0\nother-content'
      mockReadFileSync.mockReturnValue(versionContent)

      const exists = await bridgeCliBundle.checkIfVersionExists('2.1.0', '/tmp/versions.txt')
      expect(exists).toBe(true)
    })

    test('should return false when version does not exist in file', async () => {
      const versionContent = 'bridge-cli-bundle: 1.9.0\nother-content'
      mockReadFileSync.mockReturnValue(versionContent)

      const exists = await bridgeCliBundle.checkIfVersionExists('2.1.0', '/tmp/versions.txt')
      expect(exists).toBe(false)
    })

    test('should return false when file read fails', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File read error')
      })

      const exists = await bridgeCliBundle.checkIfVersionExists('2.1.0', '/tmp/versions.txt')
      expect(exists).toBe(false)
      expect(mockInfo).toHaveBeenCalledWith('Error reading version file content: File read error')
    })
  })

  // -------------------- INSTALLATION CHECK --------------------
  describe('isBridgeInstalled', () => {
    test('should return true if bridge version exists', async () => {
      ;(bridgeCliBundle as any).bridgePath = '/tmp/bridge'
      jest.spyOn(bridgeCliBundle, 'validateAndSetBridgePath').mockResolvedValue()
      mockCheckIfPathExists.mockReturnValue(true)
      jest.spyOn(bridgeCliBundle, 'checkIfVersionExists').mockResolvedValue(true)
      jest.spyOn(bridgeCliBundle as any, 'getVersionFilePath').mockReturnValue('/tmp/versions.txt')

      const installed = await bridgeCliBundle.isBridgeInstalled('2.1.0')
      expect(installed).toBe(true)
      expect(mockDebug).toHaveBeenCalledWith('Version file found at /tmp/versions.txt')
    })

    test('should return false if version file does not exist', async () => {
      ;(bridgeCliBundle as any).bridgePath = '/tmp/bridge'
      jest.spyOn(bridgeCliBundle, 'validateAndSetBridgePath').mockResolvedValue()
      mockCheckIfPathExists.mockReturnValue(false)
      jest.spyOn(bridgeCliBundle as any, 'getVersionFilePath').mockReturnValue('/tmp/versions.txt')

      const installed = await bridgeCliBundle.isBridgeInstalled('2.1.0')
      expect(installed).toBe(false)
      expect(mockDebug).toHaveBeenCalledWith('Bridge CLI version file could not be found at /tmp/versions.txt')
    })

    test('should call validateAndSetBridgePath if bridgePath not set', async () => {
      ;(bridgeCliBundle as any).bridgePath = undefined
      const validateSpy = jest.spyOn(bridgeCliBundle, 'validateAndSetBridgePath').mockResolvedValue()
      mockCheckIfPathExists.mockReturnValue(false)
      jest.spyOn(bridgeCliBundle as any, 'getVersionFilePath').mockReturnValue('/tmp/versions.txt')

      await bridgeCliBundle.isBridgeInstalled('2.1.0')
      expect(validateSpy).toHaveBeenCalled()
    })
  })

  // -------------------- VALIDATION TESTS --------------------
  describe('validateBridgeVersion', () => {
    test('should return true for valid version', async () => {
      jest.spyOn(bridgeCliBundle as any, 'getAllAvailableBridgeVersions').mockResolvedValue(['2.0.0', '2.1.0', '2.2.0'])

      const isValid = await bridgeCliBundle.validateBridgeVersion('2.1.0')
      expect(isValid).toBe(true)
    })

    test('should return false for invalid version', async () => {
      jest.spyOn(bridgeCliBundle as any, 'getAllAvailableBridgeVersions').mockResolvedValue(['2.0.0', '2.1.0', '2.2.0'])

      const isValid = await bridgeCliBundle.validateBridgeVersion('3.0.0')
      expect(isValid).toBe(false)
    })

    test('should trim version before checking', async () => {
      jest.spyOn(bridgeCliBundle as any, 'getAllAvailableBridgeVersions').mockResolvedValue(['2.0.0', '2.1.0', '2.2.0'])

      const isValid = await bridgeCliBundle.validateBridgeVersion('  2.1.0  ')
      expect(isValid).toBe(true)
    })
  })

  // -------------------- PRIVATE METHOD TESTS --------------------
  describe('private methods', () => {
    describe('clearExistingBridge', () => {
      test('should clear existing bridge folder when it exists', async () => {
        ;(bridgeCliBundle as any).bridgePath = '/tmp/bridge'
        mockExistsSync.mockReturnValue(true)

        await (bridgeCliBundle as any).clearExistingBridge()

        expect(mockInfo).toHaveBeenCalledWith('Clear the existing bridge folder, if available from /tmp/bridge')
        expect(mockRmRF).toHaveBeenCalledWith('/tmp/bridge')
      })

      test('should not clear when bridge folder does not exist', async () => {
        ;(bridgeCliBundle as any).bridgePath = '/tmp/bridge'
        mockExistsSync.mockReturnValue(false)

        await (bridgeCliBundle as any).clearExistingBridge()

        expect(mockInfo).not.toHaveBeenCalled()
        expect(mockRmRF).not.toHaveBeenCalled()
      })
    })

    describe('constructBridgePath', () => {
      test('should construct path with osPlatform when available', () => {
        ;(bridgeCliBundle as any).osPlatform = 'linux64'
        jest.spyOn(bridgeCliBundle as any, 'getBridgeType').mockReturnValue('bridge-cli-bundle')

        const result = (bridgeCliBundle as any).constructBridgePath('/base/path')
        expect(result).toBe('/base/path/bridge-cli-bundle-linux64')
      })

      test('should construct path with getPlatformName when osPlatform not available', () => {
        ;(bridgeCliBundle as any).osPlatform = undefined
        jest.spyOn(bridgeCliBundle as any, 'getBridgeType').mockReturnValue('bridge-cli-bundle')
        jest.spyOn(bridgeCliBundle as any, 'getPlatformName').mockReturnValue('macosx')

        const result = (bridgeCliBundle as any).constructBridgePath('/base/path')
        expect(result).toBe('/base/path/bridge-cli-bundle-macosx')
      })

      test('should construct path with getPlatformName for Windows when osPlatform not available', () => {
        ;(bridgeCliBundle as any).osPlatform = undefined
        jest.spyOn(bridgeCliBundle as any, 'getBridgeType').mockReturnValue('bridge-cli-bundle')
        jest.spyOn(bridgeCliBundle as any, 'getPlatformName').mockReturnValue('win64')

        const result = (bridgeCliBundle as any).constructBridgePath('/base/path')
        expect(result).toBe('/base/path/bridge-cli-bundle-win64')
      })

      test('should construct path with getPlatformName for Linux when osPlatform not available', () => {
        ;(bridgeCliBundle as any).osPlatform = undefined
        jest.spyOn(bridgeCliBundle as any, 'getBridgeType').mockReturnValue('bridge-cli-bundle')
        jest.spyOn(bridgeCliBundle as any, 'getPlatformName').mockReturnValue('linux64')

        const result = (bridgeCliBundle as any).constructBridgePath('/base/path')
        expect(result).toBe('/base/path/bridge-cli-bundle-linux64')
      })
    })

    describe('extractVersionFromContent', () => {
      test('should extract version from valid content', () => {
        const versionContent = 'bridge-cli-bundle: 2.1.0\nother-info: test'
        const result = (bridgeCliBundle as any).extractVersionFromContent(versionContent)
        expect(result).toBe('2.1.0')
      })

      test('should return empty string when no version found', () => {
        const versionContent = 'other-tool: 1.0.0\nno-bridge-version'
        const result = (bridgeCliBundle as any).extractVersionFromContent(versionContent)
        expect(result).toBe('')
      })
    })

    describe('isVersionInContent', () => {
      test('should return true when version is in content', () => {
        const contents = 'bridge-cli-bundle: 2.1.0\nother-content'
        const result = (bridgeCliBundle as any).isVersionInContent('2.1.0', contents)
        expect(result).toBe(true)
      })

      test('should return false when version is not in content', () => {
        const contents = 'bridge-cli-bundle: 1.9.0\nother-content'
        const result = (bridgeCliBundle as any).isVersionInContent('2.1.0', contents)
        expect(result).toBe(false)
      })
    })

    describe('extractAndMoveBridge', () => {
      test('should extract archive and move bridge files', async () => {
        const downloadResponse = {
          filePath: '/tmp/bridge.zip',
          fileName: 'bridge.zip'
        } as DownloadFileResponse
        const extractPath = '/tmp/extract'

        const extractZippedSpy = jest.spyOn(downloadUtility, 'extractZipped').mockResolvedValue(true)
        const moveBridgeFilesSpy = jest.spyOn(bridgeCliBundle as any, 'moveBridgeFiles').mockResolvedValue(undefined)

        await (bridgeCliBundle as any).extractAndMoveBridge(downloadResponse, extractPath)

        expect(extractZippedSpy).toHaveBeenCalledWith('/tmp/bridge.zip', extractPath)
        expect(mockDebug).toHaveBeenCalledWith('Bridge archive extraction completed')
        expect(moveBridgeFilesSpy).toHaveBeenCalledWith('/tmp/bridge.zip', extractPath)
        expect(mockDebug).toHaveBeenCalledWith('Bridge files moved to final location')
      })
    })

    describe('cleanupEmptyDirectory', () => {
      test('should remove empty directory', async () => {
        const extractPath = '/tmp/extract'
        mockExistsSync.mockReturnValue(true)
        mockReaddirSync.mockReturnValue([] as any)
        mockRmdirSync.mockImplementation(() => {})

        await (bridgeCliBundle as any).cleanupEmptyDirectory(extractPath)

        expect(mockRmdirSync).toHaveBeenCalledWith(extractPath)
        expect(mockDebug).toHaveBeenCalledWith('Removed empty extraction directory: /tmp/extract')
      })

      test('should not remove directory if it does not exist', async () => {
        const extractPath = '/tmp/extract'
        mockExistsSync.mockReturnValue(false)
        mockRmdirSync.mockImplementation(() => {})

        await (bridgeCliBundle as any).cleanupEmptyDirectory(extractPath)

        expect(mockRmdirSync).not.toHaveBeenCalled()
      })

      test('should not remove directory if it is not empty', async () => {
        const extractPath = '/tmp/extract'
        mockExistsSync.mockReturnValue(true)
        mockReaddirSync.mockReturnValue(['file.txt'] as any)
        mockRmdirSync.mockImplementation(() => {})

        await (bridgeCliBundle as any).cleanupEmptyDirectory(extractPath)

        expect(mockRmdirSync).not.toHaveBeenCalled()
      })
    })

    describe('moveBridgeFiles', () => {
      test('should rename folder from source to bridge path', async () => {
        const downloadFilePath = '/tmp/bridge-cli-bundle-2.1.0.zip'
        const extractPath = '/tmp/extract'
        ;(bridgeCliBundle as any).bridgePath = '/tmp/final/bridge'

        mockRenameSync.mockImplementation(() => {})

        await (bridgeCliBundle as any).moveBridgeFiles(downloadFilePath, extractPath)

        expect(mockDebug).toHaveBeenCalledWith('Rename folder from /tmp/extract/bridge-cli-bundle-2.1.0 to /tmp/final/bridge')
        expect(mockRenameSync).toHaveBeenCalledWith('/tmp/extract/bridge-cli-bundle-2.1.0', '/tmp/final/bridge')
      })
    })

    describe('logWorkflowVersionInfo', () => {
      test('should log warning when workflow versions are set', () => {
        Object.defineProperty(inputs, 'POLARIS_WORKFLOW_VERSION', {value: '1.0.0', configurable: true})
        ;(bridgeCliBundle as any).logWorkflowVersionInfo()

        expect(mockInfo).toHaveBeenCalledWith('Detected workflow version for Polaris, Black Duck SCA, Coverity, or SRM is not applicable for Bridge CLI Bundle.')
      })

      test('should not log warning when no workflow versions are set', () => {
        Object.defineProperty(inputs, 'POLARIS_WORKFLOW_VERSION', {value: '', configurable: true})
        Object.defineProperty(inputs, 'BLACKDUCKSCA_WORKFLOW_VERSION', {value: '', configurable: true})
        Object.defineProperty(inputs, 'SRM_WORKFLOW_VERSION', {value: '', configurable: true})
        Object.defineProperty(inputs, 'COVERITY_WORKFLOW_VERSION', {value: '', configurable: true})
        ;(bridgeCliBundle as any).logWorkflowVersionInfo()

        expect(mockInfo).not.toHaveBeenCalledWith('Detected workflow version for Polaris, Black Duck SCA, Coverity, or SRM is not applicable for Bridge CLI Bundle.')
      })
    })

    describe('buildCommand', () => {
      test('should build command with stage and state file path', () => {
        const stage = 'connect'
        const stateFilePath = '/tmp/input.json'

        const result = (bridgeCliBundle as any).buildCommand(stage, stateFilePath)
        expect(result).toBe('--stage connect --input /tmp/input.json')
      })
    })

    describe('getVersionFilePath', () => {
      test('should return correct version file path', () => {
        ;(bridgeCliBundle as any).bridgePath = '/tmp/bridge'
        const result = (bridgeCliBundle as any).getVersionFilePath()
        expect(result).toBe('/tmp/bridge/versions.txt')
      })
    })

    describe('handleExistingBridge', () => {
      test('should return null when no current version exists', async () => {
        jest.spyOn(bridgeCliBundle, 'getBridgeVersion').mockResolvedValue('')

        const result = await (bridgeCliBundle as any).handleExistingBridge()
        expect(result).toBeNull()
      })

      test('should return update info when update is needed', async () => {
        jest.spyOn(bridgeCliBundle, 'getBridgeVersion').mockResolvedValue('2.0.0')
        jest.spyOn(bridgeCliBundle as any, 'getLatestVersionInfo').mockResolvedValue({bridgeVersion: '2.1.0'})
        jest.spyOn(bridgeCliBundle as any, 'shouldUpdateBridge').mockReturnValue(true)
        jest.spyOn(bridgeCliBundle as any, 'createUpdateVersionInfo').mockReturnValue({
          bridgeUrl: 'update-url',
          bridgeVersion: '2.1.0'
        })

        const result = await (bridgeCliBundle as any).handleExistingBridge()
        expect(result).toEqual({bridgeUrl: 'update-url', bridgeVersion: '2.1.0'})
      })

      test('should return current info when no update is needed', async () => {
        jest.spyOn(bridgeCliBundle, 'getBridgeVersion').mockResolvedValue('2.1.0')
        jest.spyOn(bridgeCliBundle as any, 'getLatestVersionInfo').mockResolvedValue({bridgeVersion: '2.1.0'})
        jest.spyOn(bridgeCliBundle as any, 'shouldUpdateBridge').mockReturnValue(false)
        jest.spyOn(bridgeCliBundle as any, 'createCurrentVersionInfo').mockReturnValue({
          bridgeUrl: '',
          bridgeVersion: '2.1.0'
        })

        const result = await (bridgeCliBundle as any).handleExistingBridge()
        expect(result).toEqual({bridgeUrl: '', bridgeVersion: '2.1.0'})
      })
    })
  })

  // -------------------- PROTECTED METHOD TESTS --------------------
  describe('processLatestVersion', () => {
    test('should return existing version info if bridge exists locally', async () => {
      jest.spyOn(bridgeCliBundle as any, 'checkIfBridgeExistsLocally').mockResolvedValue(true)
      const handleExistingBridgeSpy = jest.spyOn(bridgeCliBundle as any, 'handleExistingBridge').mockResolvedValue({
        bridgeUrl: 'url',
        bridgeVersion: '2.0.0'
      })

      const result = await (bridgeCliBundle as any).processLatestVersion()
      expect(result).toEqual({bridgeUrl: 'url', bridgeVersion: '2.0.0'})
      expect(handleExistingBridgeSpy).toHaveBeenCalled()
    })

    test('should call processBaseUrlWithLatest if bridge does not exist locally', async () => {
      jest.spyOn(bridgeCliBundle as any, 'checkIfBridgeExistsLocally').mockResolvedValue(false)
      const baseUrlSpy = jest.spyOn(bridgeCliBundle as any, 'processBaseUrlWithLatest').mockResolvedValue({
        bridgeUrl: 'url-latest',
        bridgeVersion: '2.1.0'
      })

      const result = await (bridgeCliBundle as any).processLatestVersion()
      expect(result).toEqual({bridgeUrl: 'url-latest', bridgeVersion: '2.1.0'})
      expect(baseUrlSpy).toHaveBeenCalled()
    })

    test('should fallback to processBaseUrlWithLatest if handleExistingBridge throws error', async () => {
      jest.spyOn(bridgeCliBundle as any, 'checkIfBridgeExistsLocally').mockResolvedValue(true)
      jest.spyOn(bridgeCliBundle as any, 'handleExistingBridge').mockRejectedValue(new Error('Version check failed'))
      const baseUrlSpy = jest.spyOn(bridgeCliBundle as any, 'processBaseUrlWithLatest').mockResolvedValue({
        bridgeUrl: 'fallback-url',
        bridgeVersion: '2.1.0'
      })

      const result = await (bridgeCliBundle as any).processLatestVersion()
      expect(result).toEqual({bridgeUrl: 'fallback-url', bridgeVersion: '2.1.0'})
      expect(baseUrlSpy).toHaveBeenCalled()
      expect(mockDebug).toHaveBeenCalledWith('Error checking bridge version: Version check failed. Proceeding with latest version download.')
    })
  })

  describe('processBaseUrlWithLatest', () => {
    test('should throw error if latest version not found', async () => {
      // Set up the bridge URL pattern so getNormalizedVersionUrl() works
      ;(bridgeCliBundle as any).bridgeUrlLatestPattern = 'https://example.com/bridge-cli-bundle-latest.zip'

      // Mock the HTTP request to return empty response body
      jest.spyOn(bridgeCliBundle as any, 'makeHttpsGetRequest').mockResolvedValue({
        statusCode: 200,
        body: 'some-other-tool: 1.0.0\nno-bridge-cli-bundle-version'
      })

      await expect((bridgeCliBundle as any).processBaseUrlWithLatest()).rejects.toThrow('Unable to retrieve the latest Bridge CLI version from https://example.com/bridge-cli-bundle-latest.zip. Stopping execution.')
    })

    test('should return bridge info if not installed', async () => {
      jest.spyOn(bridgeCliBundle as any, 'getNormalizedVersionUrl').mockReturnValue('url')
      jest.spyOn(bridgeCliBundle as any, 'getBridgeVersionFromLatestURL').mockResolvedValue('2.1.0')
      jest.spyOn(bridgeCliBundle as any, 'isBridgeInstalled').mockResolvedValue(false)
      ;(bridgeCliBundle as any).bridgeUrlLatestPattern = 'https://latest.zip'

      const result = await (bridgeCliBundle as any).processBaseUrlWithLatest()
      expect(result).toEqual({bridgeUrl: 'https://latest.zip', bridgeVersion: '2.1.0'})
    })

    test('should return empty URL if bridge already installed', async () => {
      jest.spyOn(bridgeCliBundle as any, 'getNormalizedVersionUrl').mockReturnValue('url')
      jest.spyOn(bridgeCliBundle as any, 'getBridgeVersionFromLatestURL').mockResolvedValue('2.1.0')
      jest.spyOn(bridgeCliBundle as any, 'isBridgeInstalled').mockResolvedValue(true)
      ;(bridgeCliBundle as any).bridgeUrlLatestPattern = 'https://latest.zip'

      const result = await (bridgeCliBundle as any).processBaseUrlWithLatest()
      expect(result).toEqual({bridgeUrl: '', bridgeVersion: '2.1.0'})
      expect(mockInfo).toHaveBeenCalledWith('Bridge CLI already exists')
    })
  })

  describe('Bridge CLI Version Info', () => {
    describe('checkIfBridgeExistsInAirGap', () => {
      test('should return true if executable exists', async () => {
        ;(bridgeCliBundle as any).bridgePath = '/tmp/bridge'
        mockCheckIfPathExists.mockReturnValue(true)

        const exists = await (bridgeCliBundle as any).checkIfBridgeExistsInAirGap()
        expect(exists).toBe(true)
      })

      test('should call validateAndSetBridgePath if bridgePath not set', async () => {
        ;(bridgeCliBundle as any).bridgePath = undefined
        const validateSpy = jest.spyOn(bridgeCliBundle, 'validateAndSetBridgePath').mockResolvedValue()

        await (bridgeCliBundle as any).checkIfBridgeExistsInAirGap()
        expect(validateSpy).toHaveBeenCalled()
      })
    })

    describe('initializeUrls', () => {
      test('should setup bridge URLs if base URL exists', async () => {
        jest.spyOn(bridgeCliBundle as any, 'getPlatformName').mockReturnValue('linux64')
        jest.spyOn(bridgeCliBundle as any, 'determineBaseUrl').mockResolvedValue('https://example.com')
        const setupSpy = jest.spyOn(bridgeCliBundle as any, 'setupBridgeUrls')

        await (bridgeCliBundle as any).initializeUrls()
        expect((bridgeCliBundle as any).osPlatform).toBe('linux64')
        expect(setupSpy).toHaveBeenCalledWith('https://example.com')
      })
    })

    describe('handleBridgeDownload', () => {
      test('should extract and move bridge, then cleanup empty directory', async () => {
        const downloadResponse = {
          filePath: '/tmp/bridge.zip',
          fileName: 'https://example.com/bridge.zip'
        } as DownloadFileResponse

        const extractPath = '/tmp/extract/bridge-cli-bundle'

        jest.spyOn(bridgeCliBundle as any, 'getBridgeType').mockReturnValue('bridge-cli-bundle')
        const extractAndMoveSpy = jest.spyOn(bridgeCliBundle as any, 'extractAndMoveBridge').mockResolvedValue(undefined)
        const cleanupSpy = jest.spyOn(bridgeCliBundle as any, 'cleanupEmptyDirectory').mockResolvedValue(undefined)

        await (bridgeCliBundle as any).handleBridgeDownload(downloadResponse, '/tmp/extract')

        expect(mockDebug).toHaveBeenCalledWith('Starting bridge download handling - extracting to: /tmp/extract/bridge-cli-bundle')
        expect(extractAndMoveSpy).toHaveBeenCalledWith(downloadResponse, extractPath)
        expect(cleanupSpy).toHaveBeenCalledWith(extractPath)
      })
    })

    describe('updateBridgeCLIVersion', () => {
      test('should return bridge URL if version is valid', async () => {
        const requestedVersion = '2.1.0'
        jest.spyOn(bridgeCliBundle as any, 'validateBridgeVersion').mockResolvedValue(true)
        jest.spyOn(bridgeCliBundle as any, 'getVersionUrl').mockReturnValue('https://example.com/bridge.zip  ')

        const result = await (bridgeCliBundle as any).updateBridgeCLIVersion(requestedVersion)

        expect(result).toEqual({
          bridgeUrl: 'https://example.com/bridge.zip',
          bridgeVersion: requestedVersion
        })
      })

      test('should throw error if version is invalid', async () => {
        const requestedVersion = '3.0.0'
        jest.spyOn(bridgeCliBundle as any, 'validateBridgeVersion').mockResolvedValue(false)

        await expect((bridgeCliBundle as any).updateBridgeCLIVersion(requestedVersion)).rejects.toThrow(constants.BRIDGE_VERSION_NOT_FOUND_ERROR)
      })
    })

    // -------------------- DOWNLOAD TESTS --------------------
    describe('downloadBridge', () => {
      test('should clear existing bridge and call parent downloadBridge', async () => {
        const clearSpy = jest.spyOn(bridgeCliBundle as any, 'clearExistingBridge').mockResolvedValue(undefined)
        const superDownloadSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(bridgeCliBundle)), 'downloadBridge').mockResolvedValue(undefined)

        await bridgeCliBundle.downloadBridge('/tmp')

        expect(mockDebug).toHaveBeenCalledWith('Starting bridge download process...')
        expect(clearSpy).toHaveBeenCalled()
        expect(superDownloadSpy).toHaveBeenCalledWith('/tmp')
      })
    })

    describe('getBridgeCLIDownloadDefaultPath', () => {
      test('should return default download path', () => {
        jest.spyOn(bridgeCliBundle as any, 'getBridgeCLIDownloadPathCommon').mockReturnValue('/default/path')

        const result = bridgeCliBundle.getBridgeCLIDownloadDefaultPath()
        expect(result).toBe('/default/path')
      })
    })

    describe('validateAndSetBridgePath', () => {
      test('should set bridge path and validate air gap executable', async () => {
        Object.defineProperty(inputs, 'BRIDGE_CLI_INSTALL_DIRECTORY_KEY', {value: '/custom/path', configurable: true})
        jest.spyOn(bridgeCliBundle as any, 'getBridgeType').mockReturnValue('bridge-cli-bundle')
        jest.spyOn(bridgeCliBundle as any, 'constructBridgePath').mockReturnValue('/custom/path/bridge-cli-bundle/platform')
        jest.spyOn(bridgeCliBundle as any, 'isAirGapMode').mockReturnValue(true)
        const validateAirGapSpy = jest.spyOn(bridgeCliBundle as any, 'validateAirGapExecutable').mockResolvedValue(undefined)

        await bridgeCliBundle.validateAndSetBridgePath()

        expect(mockInfo).toHaveBeenCalledWith('Bridge CLI directory /custom/path/bridge-cli-bundle')
        expect((bridgeCliBundle as any).bridgePath).toBe('/custom/path/bridge-cli-bundle/platform')
        expect(validateAirGapSpy).toHaveBeenCalledWith('/custom/path/bridge-cli-bundle/platform')
      })

      test('should use default path when no custom directory specified', async () => {
        Object.defineProperty(inputs, 'BRIDGE_CLI_INSTALL_DIRECTORY_KEY', {value: '', configurable: true})
        jest.spyOn(bridgeCliBundle as any, 'getBridgeDefaultPath').mockReturnValue('/default/path')
        jest.spyOn(bridgeCliBundle as any, 'constructBridgePath').mockReturnValue('/default/path/platform')
        jest.spyOn(bridgeCliBundle as any, 'isAirGapMode').mockReturnValue(false)

        await bridgeCliBundle.validateAndSetBridgePath()

        expect((bridgeCliBundle as any).bridgePath).toBe('/default/path/platform')
      })
    })

    describe('Bridge CLI Version Info', () => {
      let instance: BridgeCliBundleTest

      beforeEach(() => {
        instance = new BridgeCliBundleTest()
        jest.spyOn(console, 'info').mockImplementation(() => {})
        jest.spyOn(console, 'debug').mockImplementation(() => {})
      })

      it('should return latest version info with bridge URL', () => {
        const result = instance.callCreateUpdateVersionInfo('1.0.0', '1.1.0')
        expect(result.bridgeVersion).toBe('1.1.0')
        expect(result.bridgeUrl).toBe(instance.getBridgeUrlLatestPattern())
      })

      it('should return current version info without bridge URL', () => {
        const result = instance.callCreateCurrentVersionInfo('1.1.0')
        expect(result.bridgeVersion).toBe('1.1.0')
        expect(result.bridgeUrl).toBe('')
      })
    })
  })
})
