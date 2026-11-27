import {Bridge} from '../../../src/blackduck-security-action/bridge-cli'
import * as inputs from '../../../src/blackduck-security-action/inputs'
import * as constants from '../../../src/application-constants'
import * as fs from 'fs'
import * as os from 'os'
import * as core from '@actions/core'
import path from 'path'

jest.mock('@actions/core')
jest.mock('os', () => ({
  ...jest.requireActual('os'),
  cpus: jest.fn()
}))
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn(),
  existsSync: jest.fn()
}))

const originalPlatform = process.platform
const originalArch = process.arch

function setInput(name: string, value: string): void {
  Object.defineProperty(inputs, name, {value, writable: true, configurable: true})
}

function setPlatform(platform: string, arch = 'x64'): void {
  Object.defineProperty(process, 'platform', {value: platform})
  Object.defineProperty(process, 'arch', {value: arch})
}

afterEach(() => {
  setInput('FEDRAMP_MODE', '')
  setInput('BRIDGE_CLI_DOWNLOAD_URL', '')
  Object.defineProperty(process, 'platform', {value: originalPlatform})
  Object.defineProperty(process, 'arch', {value: originalArch})
  jest.restoreAllMocks()
})

describe('Bridge bundle name (FedRAMP mode)', () => {
  it('returns the standard bundle when FedRAMP mode is off', () => {
    setInput('FEDRAMP_MODE', '')
    const bridge = new Bridge()
    expect(bridge.getBundleName()).toBe('bridge-cli-bundle')
    expect(bridge.getArtifactoryBaseUrl()).toBe(`${constants.BRIDGE_CLI_ARTIFACTORY_BASE_URL}bridge-cli-bundle/`)
  })

  it('returns the standard bundle when FedRAMP mode is false', () => {
    setInput('FEDRAMP_MODE', 'false')
    expect(new Bridge().getBundleName()).toBe('bridge-cli-bundle')
  })

  it('returns the FIPS bundle when FedRAMP mode is true', () => {
    setInput('FEDRAMP_MODE', 'true')
    const bridge = new Bridge()
    expect(bridge.getBundleName()).toBe('bridge-cli-fips-bundle')
    expect(bridge.getArtifactoryBaseUrl()).toBe(`${constants.BRIDGE_CLI_ARTIFACTORY_BASE_URL}bridge-cli-fips-bundle/`)
  })
})

describe('FIPS URLs per platform', () => {
  const cases: Array<[string, string, string]> = [
    ['win32', 'x64', 'win64'],
    ['linux', 'x64', 'linux64'],
    ['linux', 'arm64', 'linux_arm']
  ]

  it.each(cases)('builds the specific-version URL on %s/%s', (platform, arch, expected) => {
    setInput('FEDRAMP_MODE', 'true')
    setPlatform(platform, arch)
    const url = new Bridge().getVersionUrl('3.9.0')
    expect(url).toContain('/bridge-cli-fips-bundle/3.9.0/bridge-cli-fips-bundle-3.9.0-')
    expect(url.endsWith(`-${expected}.zip`)).toBe(true)
  })

  it.each(cases)('builds the latest URL on %s/%s', (platform, arch, expected) => {
    setInput('FEDRAMP_MODE', 'true')
    setPlatform(platform, arch)
    const url = new Bridge().getLatestVersionUrl()
    expect(url).toContain('/bridge-cli-fips-bundle/latest/bridge-cli-fips-bundle-')
    expect(url.endsWith(`-${expected}.zip`)).toBe(true)
  })

  it('keeps the standard URLs when FedRAMP mode is off', () => {
    setPlatform('linux', 'x64')
    expect(new Bridge().getVersionUrl('3.9.0')).toBe(`${constants.BRIDGE_CLI_ARTIFACTORY_BASE_URL}bridge-cli-bundle/3.9.0/bridge-cli-bundle-3.9.0-linux64.zip`)
  })
})

describe('FIPS default and install paths', () => {
  it('resolves the FIPS default path in FedRAMP mode', async () => {
    setInput('FEDRAMP_MODE', 'true')
    setPlatform('linux', 'x64')
    process.env['HOME'] = '/home/runner'
    const bridgePath = await new Bridge().getBridgePath()
    expect(bridgePath).toBe(path.join('/home/runner', '/bridge-cli-fips-bundle', 'bridge-cli-fips-bundle-linux64'))
  })

  it('resolves the standard default path when FedRAMP mode is off', async () => {
    setPlatform('linux', 'x64')
    process.env['HOME'] = '/home/runner'
    const bridgePath = await new Bridge().getBridgePath()
    expect(bridgePath).toBe(path.join('/home/runner', '/bridge-cli-bundle', 'bridge-cli-bundle-linux64'))
  })
})

describe('verifyFipsBridge (local, cached and pre-installed binaries)', () => {
  const setupBridge = (versionsContent: string | null): Bridge => {
    const bridge = new Bridge()
    bridge.bridgePath = path.join('/opt', 'bridge')
    ;(fs.existsSync as jest.Mock).mockReturnValue(versionsContent !== null)
    ;(fs.readFileSync as jest.Mock).mockReturnValue(versionsContent ?? '')
    return bridge
  }

  it('does nothing when FedRAMP mode is off', async () => {
    setInput('FEDRAMP_MODE', '')
    const bridge = setupBridge('bridge-cli-bundle: 3.9.0\n')
    await expect(bridge.verifyFipsBridge()).resolves.toBeUndefined()
  })

  it('accepts a FIPS bundle', async () => {
    setInput('FEDRAMP_MODE', 'true')
    const bridge = setupBridge('bridge-cli-fips-bundle: 3.9.0\n')
    await expect(bridge.verifyFipsBridge()).resolves.toBeUndefined()
  })

  it('rejects a standard non-FIPS bundle', async () => {
    setInput('FEDRAMP_MODE', 'true')
    const bridge = setupBridge('bridge-cli-bundle: 3.9.0\n')
    await expect(bridge.verifyFipsBridge()).rejects.toThrow(constants.FEDRAMP_BRIDGE_NOT_FIPS_ERROR)
  })

  it('rejects when versions.txt is missing', async () => {
    setInput('FEDRAMP_MODE', 'true')
    const bridge = setupBridge(null)
    await expect(bridge.verifyFipsBridge()).rejects.toThrow(constants.FEDRAMP_BRIDGE_NOT_FIPS_ERROR)
  })

  it('rejects when the Bridge path is not resolved', async () => {
    setInput('FEDRAMP_MODE', 'true')
    const bridge = setupBridge('bridge-cli-fips-bundle: 3.9.0\n')
    bridge.bridgePath = ''
    await expect(bridge.verifyFipsBridge()).rejects.toThrow(constants.FEDRAMP_BRIDGE_NOT_FIPS_ERROR)
  })

  it('rejects when versions.txt cannot be read', async () => {
    setInput('FEDRAMP_MODE', 'true')
    const bridge = setupBridge('bridge-cli-fips-bundle: 3.9.0\n')
    ;(fs.readFileSync as jest.Mock).mockImplementation(() => {
      throw new Error('EACCES')
    })
    await expect(bridge.verifyFipsBridge()).rejects.toThrow(constants.FEDRAMP_BRIDGE_NOT_FIPS_ERROR)
  })

  it('does not accept the FIPS key appearing only as part of another value', async () => {
    setInput('FEDRAMP_MODE', 'true')
    const bridge = setupBridge('bridge-cli-bundle: 3.9.0\nnote: bridge-cli-fips-bundle is not installed\n')
    await expect(bridge.verifyFipsBridge()).rejects.toThrow(constants.FEDRAMP_BRIDGE_NOT_FIPS_ERROR)
  })
})

describe('FIPS URLs on macOS', () => {
  const mockCpu = (model: string) => (os.cpus as jest.Mock).mockReturnValue([{model, speed: 0, times: {user: 0, nice: 0, sys: 0, idle: 0, irq: 0}}])

  it('builds the macos_arm URL for specific and latest versions', () => {
    setInput('FEDRAMP_MODE', 'true')
    setPlatform('darwin', 'arm64')
    mockCpu('Apple M2')
    const bridge = new Bridge()
    expect(bridge.getVersionUrl('3.9.0').endsWith('/bridge-cli-fips-bundle/3.9.0/bridge-cli-fips-bundle-3.9.0-macos_arm.zip')).toBe(true)
    expect(bridge.getLatestVersionUrl().endsWith('/bridge-cli-fips-bundle/latest/bridge-cli-fips-bundle-macos_arm.zip')).toBe(true)
  })

  it('does not build a macosx (Intel) FIPS URL', () => {
    setInput('FEDRAMP_MODE', 'true')
    setPlatform('darwin', 'x64')
    mockCpu('Intel(R) Core(TM) i7')
    const bridge = new Bridge()
    expect(() => bridge.getVersionUrl('3.9.0')).toThrow(constants.FEDRAMP_MAC_INTEL_UNSUPPORTED_ERROR)
    expect(() => bridge.getLatestVersionUrl()).toThrow(constants.FEDRAMP_MAC_INTEL_UNSUPPORTED_ERROR)
  })

  it('still builds the macosx URL for the standard bundle when FedRAMP mode is off', () => {
    setPlatform('darwin', 'x64')
    mockCpu('Intel(R) Core(TM) i7')
    expect(new Bridge().getLatestVersionUrl().endsWith('/bridge-cli-bundle/latest/bridge-cli-bundle-macosx.zip')).toBe(true)
  })
})

describe('custom FIPS download URL version parsing', () => {
  const infoMock = core.info as jest.Mock

  const runDownload = async (url: string): Promise<void> => {
    setInput('BRIDGE_CLI_DOWNLOAD_URL', url)
    setInput('BRIDGE_CLI_DOWNLOAD_VERSION', '')
    const bridge = new Bridge()
    jest.spyOn(bridge, 'checkIfBridgeExists').mockResolvedValue(true)
    await bridge.downloadBridge('/tmp')
  }

  it('parses the version from a FIPS bundle URL in FedRAMP mode', async () => {
    setInput('FEDRAMP_MODE', 'true')
    await runDownload('https://repo.blackduck.com/x/bridge-cli-fips-bundle/3.9.0/bridge-cli-fips-bundle-3.9.0-linux64.zip')
    expect(infoMock).toHaveBeenCalledWith('Bridge CLI version is - 3.9.0')
  })

  it('does not parse a standard bundle URL as a FIPS bundle', async () => {
    setInput('FEDRAMP_MODE', 'true')
    infoMock.mockClear()
    await runDownload('https://repo.blackduck.com/x/bridge-cli-bundle/3.9.0/bridge-cli-bundle-3.9.0-linux64.zip')
    expect(infoMock).not.toHaveBeenCalledWith('Bridge CLI version is - 3.9.0')
  })

  it('still parses the standard bundle URL when FedRAMP mode is off', async () => {
    infoMock.mockClear()
    await runDownload('https://repo.blackduck.com/x/bridge-cli-bundle/3.9.0/bridge-cli-bundle-3.9.0-linux64.zip')
    expect(infoMock).toHaveBeenCalledWith('Bridge CLI version is - 3.9.0')
  })
})

describe('FIPS version listing', () => {
  it('lists versions from the FIPS bundle location', async () => {
    setInput('FEDRAMP_MODE', 'true')
    const bridge = new Bridge()
    const requestSpy = jest.spyOn(bridge as any, 'makeHttpsGetRequest').mockResolvedValue({statusCode: 200, body: '<html><a href="3.8.0/">3.8.0/</a><a href="3.9.0/">3.9.0/</a></html>'})
    const versions = await bridge.getAllAvailableBridgeVersions()
    expect(requestSpy).toHaveBeenCalledWith(`${constants.BRIDGE_CLI_ARTIFACTORY_BASE_URL}bridge-cli-fips-bundle/`)
    expect(versions).toEqual(['3.8.0', '3.9.0'])
  })

  it('lists versions from the standard location when FedRAMP mode is off', async () => {
    const bridge = new Bridge()
    const requestSpy = jest.spyOn(bridge as any, 'makeHttpsGetRequest').mockResolvedValue({statusCode: 200, body: '<html><a href="3.9.0/">3.9.0/</a></html>'})
    await bridge.getAllAvailableBridgeVersions()
    expect(requestSpy).toHaveBeenCalledWith(`${constants.BRIDGE_CLI_ARTIFACTORY_BASE_URL}bridge-cli-bundle/`)
  })
})

describe('versions.txt parsing with the FIPS key', () => {
  it('matches the FIPS key in FedRAMP mode', async () => {
    setInput('FEDRAMP_MODE', 'true')
    ;(fs.readFileSync as jest.Mock).mockReturnValue('bridge-cli-fips-bundle: 3.9.0\n')
    expect(await new Bridge().checkIfVersionExists('3.9.0', 'versions.txt')).toBe(true)
  })

  it('does not treat a standard non-FIPS bundle of the same version as a match', async () => {
    setInput('FEDRAMP_MODE', 'true')
    ;(fs.readFileSync as jest.Mock).mockReturnValue('bridge-cli-bundle: 3.9.0\n')
    expect(await new Bridge().checkIfVersionExists('3.9.0', 'versions.txt')).toBe(false)
  })

  it('still matches the standard key when FedRAMP mode is off', async () => {
    ;(fs.readFileSync as jest.Mock).mockReturnValue('bridge-cli-bundle: 3.9.0\n')
    expect(await new Bridge().checkIfVersionExists('3.9.0', 'versions.txt')).toBe(true)
  })
})
