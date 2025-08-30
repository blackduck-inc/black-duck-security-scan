import {BridgeCliBundle} from '../../../../src/blackduck-security-action/bridge/bridge-cli-bundle'
import {HttpClient, HttpClientResponse} from 'typed-rest-client/HttpClient'
import {IncomingMessage} from 'http'
import {Socket} from 'net'
import {validateBridgeUrl} from '../../../../src/blackduck-security-action/validators'
import * as inputs from '../../../../src/blackduck-security-action/inputs'
import * as constants from '../../../../src/application-constants'
import os from 'os'
import {BridgeToolsParameter} from '../../../../src/blackduck-security-action/tools-parameter' // Mock @actions/core before other imports
import mock = jest.mock
import Mocked = jest.Mocked

// Mock @actions/core before other imports
jest.mock('@actions/core', () => ({
  getInput: jest.fn(() => ''),
  info: jest.fn(),
  debug: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
  exportVariable: jest.fn()
}))

const ioUtils = require('@actions/io/lib/io-util')
mock('@actions/io/lib/io-util')

const path = require('path')
mock('path')

const ex = require('@actions/exec')
mock('@actions/exec')

const fs = require('fs')
mock('fs')

beforeEach(() => {
  Object.defineProperty(constants, 'RETRY_COUNT', {value: 3})
  Object.defineProperty(constants, 'RETRY_DELAY_IN_MILLISECONDS', {value: 100})
  Object.defineProperty(constants, 'NON_RETRY_HTTP_CODES', {value: new Set([200, 201, 401, 403, 416]), configurable: true})

  Object.defineProperty(process, 'platform', {
    value: process.platform
  })
})

test('Test executeBridgeCommand for MAC', () => {
  const sb = new BridgeCliBundle()

  path.join = jest.fn()
  path.join.mockReturnValueOnce('/user')

  ioUtils.tryGetExecutablePath = jest.fn()
  ioUtils.tryGetExecutablePath.mockReturnValueOnce('/user/somepath')

  ex.exec = jest.fn()
  ex.exec.mockReturnValueOnce(0)

  Object.defineProperty(process, 'platform', {
    value: 'darwin'
  })

  const response = sb.executeBridgeCommand('command', 'c:\\working_directory')

  expect(response).resolves.toEqual(0)
})

test('Test executeBridgeCommand for Linux', () => {
  const sb = new BridgeCliBundle()

  path.join = jest.fn()
  path.join.mockReturnValueOnce('/user')

  ioUtils.tryGetExecutablePath = jest.fn()
  ioUtils.tryGetExecutablePath.mockReturnValueOnce('/somepath')

  ex.exec = jest.fn()
  ex.exec.mockReturnValueOnce(0)

  Object.defineProperty(process, 'platform', {
    value: 'linux'
  })

  const response = sb.executeBridgeCommand('command', 'working_directory')

  expect(response).resolves.toEqual(0)
})

test('Test executeBridgeCommand for Windows', () => {
  const sb = new BridgeCliBundle()

  path.join = jest.fn()
  path.join.mockReturnValueOnce('c:\\')

  ioUtils.tryGetExecutablePath = jest.fn()
  ioUtils.tryGetExecutablePath.mockReturnValueOnce('c:\\somepath')

  ex.exec = jest.fn()
  ex.exec.mockReturnValueOnce(0)

  Object.defineProperty(process, 'platform', {
    value: 'win32'
  })

  const response = sb.executeBridgeCommand('command', 'working_directory')

  expect(response).resolves.toEqual(0)
})

test('Test executeBridgeCommand for bridge failure', () => {
  const sb = new BridgeCliBundle()

  ioUtils.tryGetExecutablePath = jest.fn()
  ioUtils.tryGetExecutablePath.mockReturnValueOnce('')

  ex.exec = jest.fn()
  ex.exec.mockImplementation(() => {
    throw new Error()
  })

  Object.defineProperty(process, 'platform', {
    value: 'linux'
  })

  const response = sb.executeBridgeCommand('', 'working_directory')
  expect(response).rejects.toThrowError()
})

test('Validate bridge URL Windows', () => {
  Object.defineProperty(process, 'platform', {
    value: 'win32'
  })

  const resp = validateBridgeUrl('http://download/bridge-win.zip')
  expect(resp).toBeTruthy()
})

test('Validate bridge URL MAC', () => {
  Object.defineProperty(process, 'platform', {
    value: 'darwin'
  })

  const resp = validateBridgeUrl('http://download/bridge-mac.zip')
  expect(resp).toBeTruthy()
})

test('Validate bridge URL Linux', () => {
  Object.defineProperty(process, 'platform', {
    value: 'linux'
  })

  const resp = validateBridgeUrl('http://download/bridge-linux.zip')
  expect(resp).toBeTruthy()
})

test('Test validateBridgeVersion', async () => {
  const incomingMessage: IncomingMessage = new IncomingMessage(new Socket())

  const httpResponse: Mocked<HttpClientResponse> = {
    message: incomingMessage,
    readBody: jest.fn()
  }
  httpResponse.readBody.mockResolvedValueOnce('\n' + '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 3.2 Final//EN">\n' + '<html>\n' + '<head><meta name="robots" content="noindex" />\n' + '<title>Index of bds-integrations-release/com/integration/blackduck-security-action</title>\n' + '</head>\n' + '<body>\n' + '<h1>Index of bds-integrations-release/com/integration/blackduck-security-action</h1>\n' + '<pre>Name    Last modified      Size</pre><hr/>\n' + '<pre><a href="../..">../</a>\n' + '<a href="0.1.61/">0.1.61/</a>  04-Oct-2022 23:05    -\n' + '<a href="0.1.67/">0.1.67/</a>  07-Oct-2022 00:35    -\n' + '<a href="0.1.72/">0.1.72/</a>  17-Oct-2022 19:46    -\n' + '</pre>\n' + '<hr/><address style="font-size:small;">Artifactory/7.31.13 Server at sig-repo.blackduck.com Port 80</address></body></html>')
  httpResponse.message.statusCode = 200
  jest.spyOn(HttpClient.prototype, 'get').mockResolvedValueOnce(httpResponse)

  const sb = new BridgeCliBundle()
  const response = await sb.validateBridgeVersion('0.1.67')

  expect(response).toBe(true)
})

test('Test getFormattedCommandForCoverity returns correct parameters and command', () => {
  Object.defineProperty(inputs, 'COVERITY_URL', {value: 'http://coverity.example.com', configurable: true})
  Object.defineProperty(inputs, 'COVERITY_USER', {value: 'testuser', configurable: true})
  Object.defineProperty(inputs, 'COVERITY_PASSPHRASE', {value: 'testpass', configurable: true})
  Object.defineProperty(inputs, 'COVERITY_PROJECT_NAME', {value: 'TestProject', configurable: true})
  Object.defineProperty(inputs, 'COVERITY_STREAM_NAME', {value: 'TestStream', configurable: true})

  // Mock path.join to return the expected file path
  path.join = jest.fn()
  path.join.mockReturnValueOnce('/tmp/coverity_input.json')

  let tempPath = '/tmp'
  const coverityCommandFormatter = new BridgeToolsParameter(tempPath)
  const coverityParams = coverityCommandFormatter.getFormattedCommandForCoverity()

  expect(coverityParams).not.toBeNull()
  expect(coverityParams.stage).toBe('connect')
  expect(coverityParams.stateFilePath).toContain('coverity_input.json')
  expect(typeof coverityParams.workflowVersion).toBe('string')
})

test('Test getFormattedCommandForSRM returns correct parameters and command', () => {
  Object.defineProperty(inputs, 'SRM_URL', {value: 'http://srm.example.com', configurable: true})
  Object.defineProperty(inputs, 'SRM_TOKEN', {value: 'srm-token', configurable: true})
  Object.defineProperty(inputs, 'SRM_PROJECT_NAME', {value: 'SRMProject', configurable: true})
  Object.defineProperty(inputs, 'SRM_PROJECT_ID', {value: 'SRMProjectId', configurable: true})

  let tempPath = '/tmp'

  // Mock path.join to return a proper file path
  path.join = jest.fn()
  path.join.mockReturnValueOnce('/tmp/srm_input.json')

  const srmCommandFormatter = new BridgeToolsParameter(tempPath)
  const srmParams = srmCommandFormatter.getFormattedCommandForSRM()

  expect(srmParams).not.toBeNull()
  expect(srmParams.stage).toBe('srm')
  expect(srmParams.stateFilePath).toContain('srm_input.json')
  expect(typeof srmParams.workflowVersion).toBe('string')
})

test('Test getVersionUrl - mac - Intel', () => {
  Object.defineProperty(process, 'platform', {value: 'darwin'})

  const sb = new BridgeCliBundle()
  const response = sb.getVersionUrl('0.1.0')

  expect(response).toContain('mac')

  Object.defineProperty(process, 'platform', {value: null})
})

test('Test getVersionUrl - mac - ARM with version greater 2.1.0', () => {
  Object.defineProperty(process, 'platform', {value: 'darwin'})
  const cpusMock = jest.spyOn(os, 'cpus')
  cpusMock.mockReturnValue([
    {
      model: 'Apple M1',
      speed: 3200,
      times: {user: 100, nice: 0, sys: 50, idle: 500, irq: 0}
    }
  ])

  const sb = new BridgeCliBundle()
  const response = sb.getVersionUrl('2.1.2')
  expect(response).toContain('macos_arm')
  Object.defineProperty(process, 'platform', {value: null})
  cpusMock.mockRestore()
})

test('Test getVersionUrl win', () => {
  Object.defineProperty(process, 'platform', {value: 'win32'})

  const sb = new BridgeCliBundle()
  const response = sb.getVersionUrl('0.1.0')

  expect(response).toContain('win')

  Object.defineProperty(process, 'platform', {value: null})
})

test('Test getVersionUrl linux', () => {
  Object.defineProperty(process, 'platform', {value: 'linux'})

  const sb = new BridgeCliBundle()
  const response = sb.getVersionUrl('0.1.0')

  expect(response).toContain('linux')

  Object.defineProperty(process, 'platform', {value: null})
})

test('Latest URL Version success', async () => {
  Object.defineProperty(constants, 'LATEST_GLOBAL_VERSION_URL', {value: 'https://artifact.com/latest/version.txt'})

  const incomingMessage: IncomingMessage = new IncomingMessage(new Socket())
  const sb = new BridgeCliBundle()
  const httpResponse: Mocked<HttpClientResponse> = {
    message: incomingMessage,
    readBody: jest.fn()
  }
  httpResponse.readBody.mockResolvedValue('bridge-cli-bundle: 0.3.1')
  httpResponse.message.statusCode = 200
  jest.spyOn(HttpClient.prototype, 'get').mockResolvedValueOnce(httpResponse)

  const response = await sb.getBridgeVersionFromLatestURL('https://artifact.com/latest/bridge-cli-bundle.zip')
  expect(response).toContain('0.3.1')
})

test('Latest URL Version success', async () => {
  Object.defineProperty(process, 'platform', {value: 'darwin'})
  const incomingMessage: IncomingMessage = new IncomingMessage(new Socket())
  const sb = new BridgeCliBundle()
  const httpResponse: Mocked<HttpClientResponse> = {
    message: incomingMessage,
    readBody: jest.fn()
  }
  httpResponse.readBody.mockResolvedValue('bridge-cli-bundle: 0.3.1')
  httpResponse.message.statusCode = 200
  jest.spyOn(HttpClient.prototype, 'get').mockResolvedValueOnce(httpResponse)

  const response = sb.getVersionUrl('0.3.1')
  expect(response).toContain('https://repo.blackduck.com/bds-integrations-release/com/blackduck/integration/bridge/binaries/bridge-cli-bundle/0.3.1/bridge-cli-bundle-0.3.1-macosx.zip')
})

test('Latest URL Version success for MAC ARM arch', async () => {
  Object.defineProperty(process, 'platform', {value: 'darwin'})
  const cpusMock = jest.spyOn(os, 'cpus')
  cpusMock.mockReturnValue([
    {
      model: 'Apple M1',
      speed: 3200,
      times: {user: 100, nice: 0, sys: 50, idle: 500, irq: 0}
    }
  ])

  const sb = new BridgeCliBundle()
  const response = sb.getVersionUrl('2.3.1')
  expect(response).toContain('macos_arm')
  Object.defineProperty(process, 'platform', {value: null})
  cpusMock.mockRestore()
})

test('Latest url version if not provided', async () => {
  const incomingMessage: IncomingMessage = new IncomingMessage(new Socket())

  const stub = jest.fn()
  stub()

  const httpResponse: Mocked<HttpClientResponse> = {
    message: incomingMessage,
    readBody: jest.fn()
  }
  httpResponse.readBody.mockResolvedValue('error')
  jest.spyOn(HttpClient.prototype, 'get').mockRejectedValue(httpResponse)

  const sb = new BridgeCliBundle()
  jest.spyOn(sb, 'getBridgeVersionFromLatestURL')
  const response = await sb.getBridgeVersionFromLatestURL('https://artifact.com/latest/bridge-cli-bundle.zip')
  expect(response).toContain('')
})

test('Latest URL Version failure', async () => {
  const incomingMessage: IncomingMessage = new IncomingMessage(new Socket())

  const httpResponse: Mocked<HttpClientResponse> = {
    message: incomingMessage,
    readBody: jest.fn()
  }
  httpResponse.readBody.mockResolvedValue('error')
  httpResponse.message.statusCode = 404
  jest.spyOn(HttpClient.prototype, 'get').mockResolvedValueOnce(httpResponse)

  const sb = new BridgeCliBundle()
  const response = await sb.getBridgeVersionFromLatestURL('https://artifact.com/latest/bridge-cli-bundle.zip')
  expect(response).toContain('')
})

describe('updateBridgeCLIVersion', () => {
  let bridgeCliBundle: BridgeCliBundle

  beforeEach(() => {
    bridgeCliBundle = new BridgeCliBundle()
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('should return bridge URL and version when air gap is disabled and version is valid', async () => {
    // Mock inputs
    Object.defineProperty(inputs, 'ENABLE_NETWORK_AIR_GAP', {value: 'false', configurable: true})
    Object.defineProperty(inputs, 'BRIDGE_CLI_DOWNLOAD_URL', {value: '', configurable: true})

    // Mock validateBridgeVersion to return true
    jest.spyOn(bridgeCliBundle, 'validateBridgeVersion').mockResolvedValue(true)
    jest.spyOn(bridgeCliBundle, 'getVersionUrl').mockReturnValue('https://repo.blackduck.com/bridge-cli-bundle-1.2.3-macosx.zip')

    const result = await (bridgeCliBundle as any).updateBridgeCLIVersion('1.2.3')

    expect(result).toEqual({
      bridgeUrl: 'https://repo.blackduck.com/bridge-cli-bundle-1.2.3-macosx.zip',
      bridgeVersion: '1.2.3'
    })
    expect(bridgeCliBundle.validateBridgeVersion).toHaveBeenCalledWith('1.2.3')
  })

  test('should throw error when air gap is enabled, download URL is empty, and version is provided', async () => {
    // Mock inputs for air gap mode
    Object.defineProperty(inputs, 'ENABLE_NETWORK_AIR_GAP', {value: 'true', configurable: true})
    Object.defineProperty(inputs, 'BRIDGE_CLI_DOWNLOAD_URL', {value: '', configurable: true})

    await expect((bridgeCliBundle as any).updateBridgeCLIVersion('1.2.3')).rejects.toThrow("Unable to use the specified Bridge CLI version in air gap mode. Please provide a valid 'BRIDGE_CLI_DOWNLOAD_URL'.")
  })

  test('should return bridge URL and version when air gap is enabled but download URL is provided', async () => {
    // Mock inputs for air gap mode with download URL
    Object.defineProperty(inputs, 'ENABLE_NETWORK_AIR_GAP', {value: 'true', configurable: true})
    Object.defineProperty(inputs, 'BRIDGE_CLI_DOWNLOAD_URL', {value: 'https://custom.com/bridge.zip', configurable: true})

    // Mock validateBridgeVersion to return true
    jest.spyOn(bridgeCliBundle, 'validateBridgeVersion').mockResolvedValue(true)
    jest.spyOn(bridgeCliBundle, 'getVersionUrl').mockReturnValue('https://repo.blackduck.com/bridge-cli-bundle-1.2.3-macosx.zip')

    const result = await (bridgeCliBundle as any).updateBridgeCLIVersion('1.2.3')

    expect(result).toEqual({
      bridgeUrl: 'https://repo.blackduck.com/bridge-cli-bundle-1.2.3-macosx.zip',
      bridgeVersion: '1.2.3'
    })
  })

  test('should allow air gap mode when version is empty', async () => {
    // Mock inputs for air gap mode
    Object.defineProperty(inputs, 'ENABLE_NETWORK_AIR_GAP', {value: 'true', configurable: true})
    Object.defineProperty(inputs, 'BRIDGE_CLI_DOWNLOAD_URL', {value: '', configurable: true})

    // Mock validateBridgeVersion to return true
    jest.spyOn(bridgeCliBundle, 'validateBridgeVersion').mockResolvedValue(true)
    jest.spyOn(bridgeCliBundle, 'getVersionUrl').mockReturnValue('https://repo.blackduck.com/bridge-cli-bundle--macosx.zip')

    const result = await (bridgeCliBundle as any).updateBridgeCLIVersion('')

    expect(result).toEqual({
      bridgeUrl: 'https://repo.blackduck.com/bridge-cli-bundle--macosx.zip',
      bridgeVersion: ''
    })
    expect(bridgeCliBundle.validateBridgeVersion).toHaveBeenCalledWith('')
  })

  test('should throw error when bridge version validation fails', async () => {
    // Mock inputs
    Object.defineProperty(inputs, 'ENABLE_NETWORK_AIR_GAP', {value: 'false', configurable: true})
    Object.defineProperty(inputs, 'BRIDGE_CLI_DOWNLOAD_URL', {value: '', configurable: true})

    // Mock validateBridgeVersion to return false
    jest.spyOn(bridgeCliBundle, 'validateBridgeVersion').mockResolvedValue(false)

    await expect((bridgeCliBundle as any).updateBridgeCLIVersion('invalid.version')).rejects.toThrow(constants.BRIDGE_VERSION_NOT_FOUND_ERROR)
    expect(bridgeCliBundle.validateBridgeVersion).toHaveBeenCalledWith('invalid.version')
  })

  test('should trim whitespace from bridge URL', async () => {
    // Mock inputs
    Object.defineProperty(inputs, 'ENABLE_NETWORK_AIR_GAP', {value: 'false', configurable: true})
    Object.defineProperty(inputs, 'BRIDGE_CLI_DOWNLOAD_URL', {value: '', configurable: true})

    // Mock validateBridgeVersion to return true
    jest.spyOn(bridgeCliBundle, 'validateBridgeVersion').mockResolvedValue(true)
    // Mock getVersionUrl to return URL with whitespace
    jest.spyOn(bridgeCliBundle, 'getVersionUrl').mockReturnValue('  https://repo.blackduck.com/bridge-cli-bundle-1.2.3-macosx.zip  ')

    const result = await (bridgeCliBundle as any).updateBridgeCLIVersion('1.2.3')

    expect(result).toEqual({
      bridgeUrl: 'https://repo.blackduck.com/bridge-cli-bundle-1.2.3-macosx.zip',
      bridgeVersion: '1.2.3'
    })
  })

  test('should handle version validation error properly', async () => {
    // Mock inputs
    Object.defineProperty(inputs, 'ENABLE_NETWORK_AIR_GAP', {value: 'false', configurable: true})
    Object.defineProperty(inputs, 'BRIDGE_CLI_DOWNLOAD_URL', {value: '', configurable: true})

    // Mock validateBridgeVersion to throw an error
    jest.spyOn(bridgeCliBundle, 'validateBridgeVersion').mockRejectedValue(new Error('Network error'))

    await expect((bridgeCliBundle as any).updateBridgeCLIVersion('1.2.3')).rejects.toThrow('Network error')
  })
})

describe('checkIfVersionExists', () => {
  let bridgeCliBundle: BridgeCliBundle

  beforeEach(() => {
    bridgeCliBundle = new BridgeCliBundle()
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('should return true when version exists in file content', async () => {
    const mockFileContent = 'bridge-cli-bundle: 1.2.3\nother-tool: 2.0.0'
    const mockFilePath = '/path/to/versions.txt'
    const bridgeVersion = '1.2.3'

    fs.readFileSync = jest.fn().mockReturnValue(mockFileContent)

    const result = await bridgeCliBundle.checkIfVersionExists(bridgeVersion, mockFilePath)

    expect(result).toBe(true)
    expect(fs.readFileSync).toHaveBeenCalledWith(mockFilePath, 'utf-8')
  })

  test('should return false when version does not exist in file content', async () => {
    const mockFileContent = 'bridge-cli-bundle: 1.2.3\nother-tool: 2.0.0'
    const mockFilePath = '/path/to/versions.txt'
    const bridgeVersion = '1.2.4'

    fs.readFileSync = jest.fn().mockReturnValue(mockFileContent)

    const result = await bridgeCliBundle.checkIfVersionExists(bridgeVersion, mockFilePath)

    expect(result).toBe(false)
    expect(fs.readFileSync).toHaveBeenCalledWith(mockFilePath, 'utf-8')
  })

  test('should return false when file reading throws an error', async () => {
    const mockFilePath = '/path/to/nonexistent/versions.txt'
    const bridgeVersion = '1.2.3'
    const mockError = new Error('File not found')

    fs.readFileSync = jest.fn().mockImplementation(() => {
      throw mockError
    })

    // Mock the info function to capture the error message
    const mockInfo = jest.fn()
    jest.doMock('@actions/core', () => ({
      info: mockInfo
    }))

    const result = await bridgeCliBundle.checkIfVersionExists(bridgeVersion, mockFilePath)

    expect(result).toBe(false)
    expect(fs.readFileSync).toHaveBeenCalledWith(mockFilePath, 'utf-8')
  })

  test('should handle empty file content', async () => {
    const mockFileContent = ''
    const mockFilePath = '/path/to/versions.txt'
    const bridgeVersion = '1.2.3'

    fs.readFileSync = jest.fn().mockReturnValue(mockFileContent)

    const result = await bridgeCliBundle.checkIfVersionExists(bridgeVersion, mockFilePath)

    expect(result).toBe(false)
    expect(fs.readFileSync).toHaveBeenCalledWith(mockFilePath, 'utf-8')
  })

  test('should handle file content with bridge-cli-bundle but different version format', async () => {
    const mockFileContent = 'bridge-cli-bundle-1.2.3\nother content'
    const mockFilePath = '/path/to/versions.txt'
    const bridgeVersion = '1.2.3'

    fs.readFileSync = jest.fn().mockReturnValue(mockFileContent)

    const result = await bridgeCliBundle.checkIfVersionExists(bridgeVersion, mockFilePath)

    expect(result).toBe(false)
    expect(fs.readFileSync).toHaveBeenCalledWith(mockFilePath, 'utf-8')
  })

  test('should handle multiple bridge-cli-bundle entries and find correct version', async () => {
    const mockFileContent = `bridge-cli-bundle: 1.2.2
other-tool: 2.0.0
bridge-cli-bundle: 1.2.3
another-tool: 3.0.0`
    const mockFilePath = '/path/to/versions.txt'
    const bridgeVersion = '1.2.3'

    fs.readFileSync = jest.fn().mockReturnValue(mockFileContent)

    const result = await bridgeCliBundle.checkIfVersionExists(bridgeVersion, mockFilePath)

    expect(result).toBe(true)
    expect(fs.readFileSync).toHaveBeenCalledWith(mockFilePath, 'utf-8')
  })
})

// Test class to access protected methods
class TestBridgeCliBundle extends BridgeCliBundle {
  public testVerifyRegexCheck(bridgeUrl: string): RegExpMatchArray | null {
    return this.verifyRegexCheck(bridgeUrl)
  }
}

test('Test verifyRegexCheck with valid bridge URL - returns match array', () => {
  const sb = new TestBridgeCliBundle()
  const bridgeUrl = 'https://repo.blackduck.com/bridge-cli-bundle-1.2.3-macosx.zip'

  const result = sb.testVerifyRegexCheck(bridgeUrl)

  expect(result).not.toBeNull()
  expect(result).toHaveLength(2)
  expect(result![1]).toBe('1.2.3')
})

test('Test verifyRegexCheck with valid bridge URL containing multiple dots in version', () => {
  const sb = new TestBridgeCliBundle()
  const bridgeUrl = 'https://repo.blackduck.com/bridge-cli-bundle-2.1.0-linux64.zip'

  const result = sb.testVerifyRegexCheck(bridgeUrl)

  expect(result).not.toBeNull()
  expect(result).toHaveLength(2)
  expect(result![1]).toBe('2.1.0')
})

test('Test verifyRegexCheck with valid bridge URL - Windows platform', () => {
  const sb = new TestBridgeCliBundle()
  const bridgeUrl = 'https://repo.blackduck.com/bridge-cli-bundle-0.1.67-win64.zip'

  const result = sb.testVerifyRegexCheck(bridgeUrl)

  expect(result).not.toBeNull()
  expect(result).toHaveLength(2)
  expect(result![1]).toBe('0.1.67')
})

test('Test verifyRegexCheck with valid bridge URL - complex version number', () => {
  const sb = new TestBridgeCliBundle()
  const bridgeUrl = 'https://repo.blackduck.com/bridge-cli-bundle-10.20.30.40-macos_arm.zip'

  const result = sb.testVerifyRegexCheck(bridgeUrl)

  expect(result).not.toBeNull()
  expect(result).toHaveLength(2)
  expect(result![1]).toBe('10.20.30.40')
})

test('Test verifyRegexCheck with invalid bridge URL - wrong bridge type', () => {
  const sb = new TestBridgeCliBundle()
  const bridgeUrl = 'https://repo.blackduck.com/bridge-thin-client-1.2.3-macosx.zip'

  const result = sb.testVerifyRegexCheck(bridgeUrl)

  expect(result).toBeNull()
})

test('Test verifyRegexCheck with invalid bridge URL - no bridge type match', () => {
  const sb = new TestBridgeCliBundle()
  const bridgeUrl = 'https://repo.blackduck.com/some-other-tool-1.2.3-macosx.zip'

  const result = sb.testVerifyRegexCheck(bridgeUrl)

  expect(result).toBeNull()
})

test('Test verifyRegexCheck with empty string', () => {
  const sb = new TestBridgeCliBundle()
  const bridgeUrl = ''

  const result = sb.testVerifyRegexCheck(bridgeUrl)

  expect(result).toBeNull()
})

test('Test verifyRegexCheck with URL containing partial version numbers', () => {
  const sb = new TestBridgeCliBundle()
  const bridgeUrl = 'https://repo.blackduck.com/bridge-cli-bundle-1.-macosx.zip'

  const result = sb.testVerifyRegexCheck(bridgeUrl)

  expect(result).not.toBeNull()
  expect(result).toHaveLength(2)
  expect(result![1]).toBe('1.')
})

test('Test verifyRegexCheck with long path containing bridge pattern', () => {
  const sb = new TestBridgeCliBundle()
  const bridgeUrl = 'https://repo.blackduck.com/very/long/path/to/bridge-cli-bundle-3.4.5-linux_arm.zip'

  const result = sb.testVerifyRegexCheck(bridgeUrl)

  expect(result).not.toBeNull()
  expect(result).toHaveLength(2)
  expect(result![1]).toBe('3.4.5')
})

test('Test verifyRegexCheck with URL containing additional parameters', () => {
  const sb = new TestBridgeCliBundle()
  const bridgeUrl = 'https://repo.blackduck.com/bridge-cli-bundle-1.0.0-macosx.zip?auth=token&download=true'

  const result = sb.testVerifyRegexCheck(bridgeUrl)

  expect(result).not.toBeNull()
  expect(result).toHaveLength(2)
  expect(result![1]).toBe('1.0.0')
})
