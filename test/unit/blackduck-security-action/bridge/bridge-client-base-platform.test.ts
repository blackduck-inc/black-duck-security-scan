import {BridgeClientBase} from '../../../../src/blackduck-security-action/bridge/bridge-client-base'
import * as constants from '../../../../src/application-constants'
import * as os from 'os'
import * as semver from 'semver'

// Mock external dependencies
jest.mock('@actions/core', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warning: jest.fn(),
  getInput: jest.fn((name: string) => {
    // Provide default mock values for inputs if needed
    switch (name) {
      case 'BRIDGE_CLI_INSTALL_DIRECTORY_KEY':
        return ''
      case 'ENABLE_NETWORK_AIR_GAP':
        return 'false'
      case 'BRIDGE_CLI_DOWNLOAD_URL_KEY':
        return ''
      case 'BRIDGE_CLI_DOWNLOAD_VERSION_KEY':
        return ''
      default:
        return ''
    }
  })
}))

jest.mock('@actions/io/lib/io-util', () => ({
  tryGetExecutablePath: jest.fn()
}))

jest.mock('os')
jest.mock('semver')

// Mock constants module
jest.mock('../../../../src/application-constants', () => ({
  WINDOWS_PLATFORM_NAME: 'win32',
  MAC_PLATFORM_NAME: 'darwin',
  LINUX_PLATFORM_NAME: 'linux',
  MIN_SUPPORTED_BRIDGE_CLI_MAC_ARM_VERSION: '2.1.0',
  MIN_SUPPORTED_BRIDGE_CLI_LINUX_ARM_VERSION: '3.5.1'
}))

const {info} = require('@actions/core')
const {tryGetExecutablePath} = require('@actions/io/lib/io-util')

// Create a concrete test class that extends the abstract BridgeClientBase
class TestBridgeClient extends BridgeClientBase {
  constructor() {
    super()
    this.bridgePath = '/test/bridge/path'
    this.bridgeUrlPattern = 'https://test.com/$version/$platform/bridge.zip'
  }

  // Make selectPlatform public for testing
  public selectPlatform(version: string, isARM: boolean, isValidVersionForARM: boolean, armPlatform: string, defaultPlatform: string, minVersion: string): string {
    return super.selectPlatform(version, isARM, isValidVersionForARM, armPlatform, defaultPlatform, minVersion)
  }

  getBridgeFileType(): string {
    return 'bridge-cli'
  }

  async getBridgeVersion(): Promise<string> {
    return '1.0.0'
  }

  getBridgeFileNameType(): string {
    return 'bridge-cli'
  }

  getBridgeType(): string {
    return 'bridge'
  }

  generateFormattedCommand(): string {
    return 'test command'
  }

  async isBridgeInstalled(): Promise<boolean> {
    return false
  }

  async validateAndSetBridgePath(): Promise<void> {
    // Test implementation
  }

  protected async checkIfBridgeExistsInAirGap(): Promise<boolean> {
    return false
  }

  protected async executeCommand(): Promise<number> {
    return 0
  }

  protected getLatestVersionRegexPattern(): RegExp {
    return /latest/g
  }

  protected getBridgeCLIDownloadDefaultPath(): string {
    return '/default/path'
  }

  protected async handleBridgeDownload(): Promise<void> {
    // Test implementation
  }

  protected initializeUrls(): void {
    // Test implementation
  }

  protected async processBaseUrlWithLatest(): Promise<{bridgeUrl: string; bridgeVersion: string}> {
    return {bridgeUrl: 'test-url', bridgeVersion: '1.0.0'}
  }

  protected async processLatestVersion(): Promise<{bridgeUrl: string; bridgeVersion: string}> {
    return {bridgeUrl: 'test-url', bridgeVersion: '1.0.0'}
  }

  protected async updateBridgeCLIVersion(): Promise<{bridgeUrl: string; bridgeVersion: string}> {
    return {bridgeUrl: 'test-url', bridgeVersion: '1.0.0'}
  }

  protected verifyRegexCheck(): RegExpMatchArray | null {
    return null
  }
}

describe('BridgeClientBase Platform Methods', () => {
  let bridgeClient: TestBridgeClient
  let mockProcess: any

  beforeEach(() => {
    jest.clearAllMocks()
    bridgeClient = new TestBridgeClient()

    // Mock process.platform and process.arch
    mockProcess = {
      platform: 'darwin',
      arch: 'x64'
    }
    Object.defineProperty(process, 'platform', {
      value: mockProcess.platform,
      writable: true
    })
    Object.defineProperty(process, 'arch', {
      value: mockProcess.arch,
      writable: true
    })
  })

  describe('selectPlatform', () => {
    it('should return default platform when ARM is detected but version is not valid for ARM', () => {
      const result = bridgeClient.selectPlatform('1.0.0', true, false, 'linux_arm', 'linux64', '2.1.0')

      expect(result).toBe('linux64')
      expect(info).toHaveBeenCalledWith('Detected Bridge CLI version (1.0.0) below the minimum ARM support requirement (2.1.0). Defaulting to linux64 platform.')
    })

    it('should return ARM platform when ARM is detected and version is valid for ARM', () => {
      const result = bridgeClient.selectPlatform('2.2.0', true, true, 'linux_arm', 'linux64', '2.1.0')

      expect(result).toBe('linux_arm')
      expect(info).not.toHaveBeenCalled()
    })

    it('should return default platform when not ARM', () => {
      const result = bridgeClient.selectPlatform('2.2.0', false, true, 'linux_arm', 'linux64', '2.1.0')

      expect(result).toBe('linux64')
      expect(info).not.toHaveBeenCalled()
    })

    it('should return default platform when ARM but version is invalid for ARM', () => {
      const result = bridgeClient.selectPlatform('1.9.0', true, false, 'macos_arm', 'macosx', '2.1.0')

      expect(result).toBe('macosx')
      expect(info).toHaveBeenCalledWith('Detected Bridge CLI version (1.9.0) below the minimum ARM support requirement (2.1.0). Defaulting to macosx platform.')
    })
  })

  describe('setBridgeExecutablePath', () => {
    beforeEach(() => {
      tryGetExecutablePath.mockResolvedValue('/mocked/executable/path')
    })

    it('should set executable path for Windows platform', async () => {
      Object.defineProperty(process, 'platform', {
        value: constants.WINDOWS_PLATFORM_NAME,
        writable: true
      })

      await bridgeClient.setBridgeExecutablePath()

      expect(tryGetExecutablePath).toHaveBeenCalledWith('/test/bridge/path\\bridge-cli', ['.exe'])
      expect(bridgeClient.bridgeExecutablePath).toBe('/mocked/executable/path')
    })

    it('should set executable path for Mac platform', async () => {
      Object.defineProperty(process, 'platform', {
        value: constants.MAC_PLATFORM_NAME,
        writable: true
      })

      await bridgeClient.setBridgeExecutablePath()

      expect(tryGetExecutablePath).toHaveBeenCalledWith('/test/bridge/path/bridge-cli', [])
      expect(bridgeClient.bridgeExecutablePath).toBe('/mocked/executable/path')
    })

    it('should set executable path for Linux platform', async () => {
      Object.defineProperty(process, 'platform', {
        value: constants.LINUX_PLATFORM_NAME,
        writable: true
      })

      await bridgeClient.setBridgeExecutablePath()

      expect(tryGetExecutablePath).toHaveBeenCalledWith('/test/bridge/path/bridge-cli', [])
      expect(bridgeClient.bridgeExecutablePath).toBe('/mocked/executable/path')
    })

    it('should not set executable path for unsupported platform', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'unsupported',
        writable: true
      })

      await bridgeClient.setBridgeExecutablePath()

      expect(tryGetExecutablePath).not.toHaveBeenCalled()
      expect(bridgeClient.bridgeExecutablePath).toBe('')
    })
  })

  describe('getVersionUrl', () => {
    beforeEach(() => {
      // Mock getPlatformForVersion to return predictable values
      jest.spyOn(bridgeClient as any, 'getPlatformForVersion').mockReturnValue('linux64')
    })

    it('should replace version and platform placeholders in URL pattern', () => {
      const result = bridgeClient.getVersionUrl('2.3.0')

      expect(result).toBe('https://test.com/2.3.0/linux64/bridge.zip')
      expect(bridgeClient['getPlatformForVersion']).toHaveBeenCalledWith('2.3.0')
    })

    it('should handle multiple version placeholders', () => {
      bridgeClient['bridgeUrlPattern'] = 'https://test.com/$version/path/$version/$platform/file.zip'

      const result = bridgeClient.getVersionUrl('1.5.0')

      expect(result).toBe('https://test.com/1.5.0/path/1.5.0/linux64/file.zip')
    })
  })

  describe('getPlatformForVersion', () => {
    beforeEach(() => {
      // Reset mocks
      jest.restoreAllMocks()

      // Mock os.cpus()
      const mockCpus = jest.mocked(os.cpus)

      // Mock semver.gte
      const mockSemverGte = jest.mocked(semver.gte)

      // Mock selectPlatform method
      jest.spyOn(bridgeClient, 'selectPlatform' as any).mockImplementation((version, isARM, isValidVersionForARM, armPlatform, defaultPlatform) => {
        return isARM && isValidVersionForARM ? armPlatform : defaultPlatform
      })
    })

    describe('Mac platform', () => {
      beforeEach(() => {
        Object.defineProperty(process, 'platform', {
          value: constants.MAC_PLATFORM_NAME,
          writable: true
        })
      })

      it('should detect Intel Mac and return Mac platform', () => {
        const mockCpus = jest.mocked(os.cpus)
        mockCpus.mockReturnValue([{model: 'Intel(R) Core(TM) i7'} as any])

        const mockSemverGte = jest.mocked(semver.gte)
        mockSemverGte.mockReturnValue(true)

        const result = bridgeClient['getPlatformForVersion']('2.2.0')

        expect(bridgeClient.selectPlatform).toHaveBeenCalledWith('2.2.0', false, true, bridgeClient['MAC_ARM_PLATFORM'], bridgeClient['MAC_PLATFORM'], constants.MIN_SUPPORTED_BRIDGE_CLI_MAC_ARM_VERSION)
      })

      it('should detect ARM Mac with supported version and return ARM Mac platform', () => {
        const mockCpus = jest.mocked(os.cpus)
        mockCpus.mockReturnValue([{model: 'Apple M1'} as any])

        const mockSemverGte = jest.mocked(semver.gte)
        mockSemverGte.mockReturnValue(true)

        bridgeClient['selectPlatform'] = jest.fn().mockReturnValue('macos_arm')

        const result = bridgeClient['getPlatformForVersion']('2.2.0')

        expect(bridgeClient.selectPlatform).toHaveBeenCalledWith('2.2.0', true, true, bridgeClient['MAC_ARM_PLATFORM'], bridgeClient['MAC_PLATFORM'], constants.MIN_SUPPORTED_BRIDGE_CLI_MAC_ARM_VERSION)
        expect(result).toBe('macos_arm')
      })

      it('should detect ARM Mac with unsupported version and return default Mac platform', () => {
        const mockCpus = jest.mocked(os.cpus)
        mockCpus.mockReturnValue([{model: 'Apple M1'} as any])

        const mockSemverGte = jest.mocked(semver.gte)
        mockSemverGte.mockReturnValue(false)

        bridgeClient['selectPlatform'] = jest.fn().mockReturnValue('macosx')

        const result = bridgeClient['getPlatformForVersion']('1.9.0')

        expect(bridgeClient.selectPlatform).toHaveBeenCalledWith('1.9.0', true, false, bridgeClient['MAC_ARM_PLATFORM'], bridgeClient['MAC_PLATFORM'], constants.MIN_SUPPORTED_BRIDGE_CLI_MAC_ARM_VERSION)
        expect(result).toBe('macosx')
      })
    })

    describe('Linux platform', () => {
      beforeEach(() => {
        Object.defineProperty(process, 'platform', {
          value: constants.LINUX_PLATFORM_NAME,
          writable: true
        })
      })

      it('should detect x64 Linux and return Linux platform', () => {
        Object.defineProperty(process, 'arch', {
          value: 'x64',
          writable: true
        })

        const mockSemverGte = jest.mocked(semver.gte)
        mockSemverGte.mockReturnValue(true)

        bridgeClient['selectPlatform'] = jest.fn().mockReturnValue('linux64')

        const result = bridgeClient['getPlatformForVersion']('3.6.0')

        expect(bridgeClient.selectPlatform).toHaveBeenCalledWith('3.6.0', false, true, bridgeClient['LINUX_ARM_PLATFORM'], bridgeClient['LINUX_PLATFORM'], constants.MIN_SUPPORTED_BRIDGE_CLI_LINUX_ARM_VERSION)
        expect(result).toBe('linux64')
      })

      it('should detect ARM Linux with supported version and return ARM Linux platform', () => {
        Object.defineProperty(process, 'arch', {
          value: 'arm64',
          writable: true
        })

        const mockSemverGte = jest.mocked(semver.gte)
        mockSemverGte.mockReturnValue(true)

        bridgeClient['selectPlatform'] = jest.fn().mockReturnValue('linux_arm')

        const result = bridgeClient['getPlatformForVersion']('3.6.0')

        expect(bridgeClient.selectPlatform).toHaveBeenCalledWith('3.6.0', true, true, bridgeClient['LINUX_ARM_PLATFORM'], bridgeClient['LINUX_PLATFORM'], constants.MIN_SUPPORTED_BRIDGE_CLI_LINUX_ARM_VERSION)
        expect(result).toBe('linux_arm')
      })

      it('should detect aarch64 Linux as ARM', () => {
        Object.defineProperty(process, 'arch', {
          value: 'aarch64',
          writable: true
        })

        const mockSemverGte = jest.mocked(semver.gte)
        mockSemverGte.mockReturnValue(false)

        bridgeClient['selectPlatform'] = jest.fn().mockReturnValue('linux64')

        const result = bridgeClient['getPlatformForVersion']('3.0.0')

        expect(bridgeClient.selectPlatform).toHaveBeenCalledWith('3.0.0', true, false, bridgeClient['LINUX_ARM_PLATFORM'], bridgeClient['LINUX_PLATFORM'], constants.MIN_SUPPORTED_BRIDGE_CLI_LINUX_ARM_VERSION)
        expect(result).toBe('linux64')
      })

      it('should detect armv7l Linux as ARM', () => {
        Object.defineProperty(process, 'arch', {
          value: 'armv7l',
          writable: true
        })

        const mockSemverGte = jest.mocked(semver.gte)
        mockSemverGte.mockReturnValue(true)

        bridgeClient['selectPlatform'] = jest.fn().mockReturnValue('linux_arm')

        const result = bridgeClient['getPlatformForVersion']('3.6.0')

        expect(bridgeClient.selectPlatform).toHaveBeenCalledWith('3.6.0', true, true, bridgeClient['LINUX_ARM_PLATFORM'], bridgeClient['LINUX_PLATFORM'], constants.MIN_SUPPORTED_BRIDGE_CLI_LINUX_ARM_VERSION)
        expect(result).toBe('linux_arm')
      })
    })

    describe('Windows platform', () => {
      it('should return Windows platform for Windows', () => {
        Object.defineProperty(process, 'platform', {
          value: constants.WINDOWS_PLATFORM_NAME,
          writable: true
        })

        const result = bridgeClient['getPlatformForVersion']('2.0.0')

        expect(result).toBe(bridgeClient['WINDOWS_PLATFORM'])
        expect(bridgeClient.selectPlatform).not.toHaveBeenCalled()
      })
    })

    describe('Unsupported platform', () => {
      it('should return Windows platform as default for unsupported platforms', () => {
        Object.defineProperty(process, 'platform', {
          value: 'freebsd',
          writable: true
        })

        const result = bridgeClient['getPlatformForVersion']('2.0.0')

        expect(result).toBe(bridgeClient['WINDOWS_PLATFORM'])
        expect(bridgeClient.selectPlatform).not.toHaveBeenCalled()
      })
    })
  })
})
