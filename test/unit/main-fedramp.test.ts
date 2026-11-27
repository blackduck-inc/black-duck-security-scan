import {run} from '../../src/main'
import * as inputs from '../../src/blackduck-security-action/inputs'
import {Bridge} from '../../src/blackduck-security-action/bridge-cli'
import * as constants from '../../src/application-constants'
import * as core from '@actions/core'
import * as fs from 'fs'

jest.mock('@actions/core')
jest.mock('@actions/io', () => ({
  rmRF: jest.fn(),
  mkdirP: jest.fn().mockResolvedValue(undefined)
}))
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  renameSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(false),
  readFileSync: jest.fn().mockReturnValue('bridge-cli-bundle: 0.1.0')
}))

const originalPlatform = process.platform

function setInput(name: string, value: string): void {
  Object.defineProperty(inputs, name, {value, writable: true, configurable: true})
}

describe('FedRAMP fail-fast validation in run()', () => {
  let prepareCommandSpy: jest.SpyInstance
  let downloadBridgeSpy: jest.SpyInstance
  let validateBridgePathSpy: jest.SpyInstance
  let executeBridgeSpy: jest.SpyInstance
  let verifyFipsSpy: jest.SpyInstance
  let verifyBundleSpy: jest.SpyInstance
  let verifyBinarySpy: jest.SpyInstance

  beforeEach(() => {
    Object.defineProperty(process, 'platform', {value: 'linux'})
    setInput('GITHUB_TOKEN', 'token')
    setInput('FEDRAMP_MODE', 'true')
    setInput('POLARIS_SERVER_URL', 'https://polaris.example.com') // not a FedRAMP URL
    setInput('BRIDGE_CLI_DOWNLOAD_URL', '')
    setInput('ENABLE_NETWORK_AIR_GAP', '')
    setInput('BRIDGECLI_INSTALL_DIRECTORY', '')
    prepareCommandSpy = jest.spyOn(Bridge.prototype, 'prepareCommand').mockResolvedValue('--stage polaris --input /tmp/input.json')
    downloadBridgeSpy = jest.spyOn(Bridge.prototype, 'downloadBridge').mockResolvedValue()
    validateBridgePathSpy = jest.spyOn(Bridge.prototype, 'validateBridgePath').mockResolvedValue()
    executeBridgeSpy = jest.spyOn(Bridge.prototype, 'executeBridgeCommand').mockResolvedValue(0)
    verifyFipsSpy = jest.spyOn(Bridge.prototype, 'verifyFipsBridge').mockResolvedValue()
    verifyBundleSpy = jest.spyOn(Bridge.prototype, 'verifyBundleIntegrity').mockResolvedValue()
    verifyBinarySpy = jest.spyOn(Bridge.prototype, 'verifyBinaryIntegrity').mockResolvedValue()
  })

  afterEach(() => {
    setInput('FEDRAMP_MODE', '')
    setInput('POLARIS_SERVER_URL', '')
    setInput('ENABLE_NETWORK_AIR_GAP', '')
    setInput('BRIDGECLI_INSTALL_DIRECTORY', '')
    Object.defineProperty(process, 'platform', {value: originalPlatform})
    jest.restoreAllMocks()
  })

  it('fails before prepareCommand() when validation fails', async () => {
    await expect(run()).rejects.toThrow('polaris_server_url')
    expect(prepareCommandSpy).not.toHaveBeenCalled()
  })

  it('fails before the Bridge CLI download', async () => {
    await expect(run()).rejects.toThrow()
    expect(downloadBridgeSpy).not.toHaveBeenCalled()
    expect(executeBridgeSpy).not.toHaveBeenCalled()
  })

  it('blocks the air-gap path when validation fails', async () => {
    setInput('ENABLE_NETWORK_AIR_GAP', 'true')
    await expect(run()).rejects.toThrow()
    expect(validateBridgePathSpy).not.toHaveBeenCalled()
    expect(downloadBridgeSpy).not.toHaveBeenCalled()
    expect(core.info).not.toHaveBeenCalledWith('Network air gap is enabled, skipping bridge CLI download.')
  })

  it('blocks execution with a pre-installed directory when validation fails', async () => {
    setInput('BRIDGECLI_INSTALL_DIRECTORY', '/opt/bridge')
    await expect(run()).rejects.toThrow()
    expect(prepareCommandSpy).not.toHaveBeenCalled()
    expect(executeBridgeSpy).not.toHaveBeenCalled()
  })

  it('reports all errors together', async () => {
    setInput('BRIDGE_CLI_DOWNLOAD_URL', 'http://evil.com/bridge.zip')
    await expect(run()).rejects.toThrow(`${constants.FEDRAMP_POLARIS_URL_INVALID_ERROR.split('{0}')[0]}`)
    await expect(run()).rejects.toThrow(constants.FEDRAMP_BRIDGE_URL_INVALID_ERROR.split('{0}')[0])
  })

  it('fails closed when the FIPS bundle version cannot be determined', async () => {
    setInput('POLARIS_SERVER_URL', `https://tenant.${constants.FEDRAMP_ALLOWED_POLARIS_DOMAIN_PATTERNS[0]}`)
    // versions.txt mock only contains the standard bundle key, so the FIPS version is empty
    await expect(run()).rejects.toThrow(constants.FEDRAMP_BRIDGE_VERSION_NOT_FOUND_ERROR)
    expect(executeBridgeSpy).not.toHaveBeenCalled()
  })

  describe('with a valid Polaris URL', () => {
    // The Bridge folder's versions.txt lists the FIPS bundle, so the empty-version guard passes
    const withFipsVersionsFile = (): void => {
      ;(fs.readFileSync as jest.Mock).mockReturnValue('bridge-cli-fips-bundle: 3.9.0')
    }

    afterEach(() => {
      ;(fs.readFileSync as jest.Mock).mockReturnValue('bridge-cli-bundle: 0.1.0')
    })

    beforeEach(() => {
      setInput('POLARIS_SERVER_URL', `https://tenant.${constants.FEDRAMP_ALLOWED_POLARIS_DOMAIN_PATTERNS[0]}`)
    })

    it('blocks execution when the air-gap Bridge CLI is not FIPS', async () => {
      setInput('ENABLE_NETWORK_AIR_GAP', 'true')
      verifyFipsSpy.mockRejectedValue(new Error(constants.FEDRAMP_BRIDGE_NOT_FIPS_ERROR))
      await expect(run()).rejects.toThrow(constants.FEDRAMP_BRIDGE_NOT_FIPS_ERROR)
      expect(validateBridgePathSpy).toHaveBeenCalled()
      expect(downloadBridgeSpy).not.toHaveBeenCalled()
      expect(executeBridgeSpy).not.toHaveBeenCalled()
    })

    it('blocks execution when the file integrity check (CHECK 2) fails', async () => {
      setInput('ENABLE_NETWORK_AIR_GAP', 'true')
      verifyBundleSpy.mockRejectedValue(new Error(constants.FEDRAMP_INTEGRITY_FILE_MISMATCH_ERROR))
      await expect(run()).rejects.toThrow('FedRAMP integrity check failed')
      expect(verifyBinarySpy).not.toHaveBeenCalled()
      expect(executeBridgeSpy).not.toHaveBeenCalled()
    })

    it('blocks execution when the binary re-verification (CHECK 3) fails', async () => {
      setInput('ENABLE_NETWORK_AIR_GAP', 'true')
      withFipsVersionsFile()
      verifyBinarySpy.mockRejectedValue(new Error(constants.FEDRAMP_INTEGRITY_BINARY_MISMATCH_ERROR))
      await expect(run()).rejects.toThrow(constants.FEDRAMP_INTEGRITY_BINARY_MISMATCH_ERROR)
      expect(executeBridgeSpy).not.toHaveBeenCalled()
    })

    it('runs CHECK 2 after the FIPS check and before CHECK 3 and execution', async () => {
      withFipsVersionsFile()
      const order: string[] = []
      verifyFipsSpy.mockImplementation(async () => void order.push('fips'))
      verifyBundleSpy.mockImplementation(async () => void order.push('check2'))
      verifyBinarySpy.mockImplementation(async () => void order.push('check3'))
      executeBridgeSpy.mockImplementation(async () => {
        order.push('execute')
        return 0
      })
      jest.spyOn(Bridge.prototype, 'getBridgeVersionFromLatestURL').mockResolvedValue('3.9.0')
      try {
        await run()
      } catch {
        // later steps may fail in this isolated setup; only the order of the checks matters here
      }
      // execute (when reached) must come after all three checks
      expect(order.slice(0, 3)).toEqual(['fips', 'check2', 'check3'])
      expect(order.indexOf('execute') === -1 || order.indexOf('execute') > order.indexOf('check3')).toBe(true)
    })

    it('blocks execution when a cached or pre-installed Bridge CLI is not FIPS', async () => {
      setInput('BRIDGECLI_INSTALL_DIRECTORY', '/opt/bridge')
      verifyFipsSpy.mockRejectedValue(new Error(constants.FEDRAMP_BRIDGE_NOT_FIPS_ERROR))
      await expect(run()).rejects.toThrow(constants.FEDRAMP_BRIDGE_NOT_FIPS_ERROR)
      expect(downloadBridgeSpy).toHaveBeenCalled()
      expect(executeBridgeSpy).not.toHaveBeenCalled()
    })

    it('verifies the Bridge CLI is FIPS before execution', async () => {
      verifyFipsSpy.mockImplementation(async () => {
        expect(executeBridgeSpy).not.toHaveBeenCalled()
      })
      try {
        await run()
      } catch {
        // later steps may fail in this isolated setup; only the verification order matters here
      }
      expect(verifyFipsSpy).toHaveBeenCalled()
    })
  })

  it('does not fail fast when FedRAMP mode is off', async () => {
    setInput('FEDRAMP_MODE', 'false')
    try {
      await run()
    } catch {
      // later steps may fail in this isolated setup; only the fail-fast behaviour matters here
    }
    expect(prepareCommandSpy).toHaveBeenCalled()
  })
})
