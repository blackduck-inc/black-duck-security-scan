import {BridgeCliBundle} from '../../../src/blackduck-security-action/bridge/bridge-cli-bundle'
import {HttpClient, HttpClientResponse} from 'typed-rest-client/HttpClient'
import {IncomingMessage} from 'http'
import {Socket} from 'net'
import {validateBridgeUrl} from '../../../src/blackduck-security-action/validators'
import * as inputs from '../../../src/blackduck-security-action/inputs'
import * as constants from '../../../src/application-constants'
import * as downloadUtility from '../../../src/blackduck-security-action/download-utility'
import {DownloadFileResponse, extractZipped} from '../../../src/blackduck-security-action/download-utility'
import os from 'os'
import mock = jest.mock
import Mocked = jest.Mocked

const util = require('../../../src/blackduck-security-action/utility')

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

test('Validate getBridgePath BRIDGE_CLI_INSTALL_DIRECTORY_KEY not empty', async () => {
  let sb = new BridgeCliBundle()
  Object.defineProperty(inputs, 'BRIDGE_CLI_INSTALL_DIRECTORY_KEY', {
    value: '/tmp'
  })

  await sb.validateAndSetBridgePath()
  expect(sb.bridgePath).toContain('tmp')
})

test('Validate getBridgePath BRIDGE_CLI_INSTALL_DIRECTORY_KEY if empty', async () => {
  let sb = new BridgeCliBundle()
  Object.defineProperty(inputs, 'BRIDGE_CLI_INSTALL_DIRECTORY_KEY', {
    value: ''
  })

  path.join = jest.fn()
  path.join.mockReturnValueOnce('/tmp/user')

  await sb.validateAndSetBridgePath()
  expect(sb.bridgePath).toContain('/tmp/user')
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
  httpResponse.readBody.mockResolvedValueOnce('\n' + '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 3.2 Final//EN">\n' + '<html>\n' + '<head><meta name="robots" content="noindex" />\n' + '<title>Index of bds-integrations-release/com/integration/blackduck-security-action</title>\n' + '</head>\n' + '<body>\n' + '<h1>Index of bds-integrations-release/com/integration/blackduck-security-action</h1>\n' + '<pre>Name    Last modified      Size</pre><hr/>\n' + '<pre><a href="../">../</a>\n' + '<a href="0.1.61/">0.1.61/</a>  04-Oct-2022 23:05    -\n' + '<a href="0.1.67/">0.1.67/</a>  07-Oct-2022 00:35    -\n' + '<a href="0.1.72/">0.1.72/</a>  17-Oct-2022 19:46    -\n' + '</pre>\n' + '<hr/><address style="font-size:small;">Artifactory/7.31.13 Server at sig-repo.blackduck.com Port 80</address></body></html>')
  httpResponse.message.statusCode = 200
  jest.spyOn(HttpClient.prototype, 'get').mockResolvedValueOnce(httpResponse)

  const sb = new BridgeCliBundle()
  const response = await sb.validateBridgeVersion('0.1.67')

  expect(response).toBe(true)
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
  expect(response).toContain('latest/bridge-cli-bundle')
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
  httpResponse.message.statusCode = 400
  jest.spyOn(HttpClient.prototype, 'get').mockResolvedValueOnce(httpResponse)

  const sb = new BridgeCliBundle()
  const response = await sb.getBridgeVersionFromLatestURL('https://artifact.com/latest/bridge-cli-bundle.zip')
  expect(response).toContain('')
})

test('Test fetch version details from BRIDGE_CLI_DOWNLOAD_URL for MAC', () => {
  const sb = new BridgeCliBundle()
  Object.defineProperty(inputs, 'BRIDGE_CLI_DOWNLOAD_VERSION', {value: ''})
  Object.defineProperty(inputs, 'BRIDGE_CLI_DOWNLOAD_URL', {value: 'https://test-url/bridge-cli-bundle-0.1.1-macosx.zip'})

  const response = sb.downloadBridge('/working_directory')
  expect(response).rejects.toThrowError()
})

test('Test fetch version details from BRIDGE_CLI_DOWNLOAD_URL For Windows', () => {
  const sb = new BridgeCliBundle()
  Object.defineProperty(inputs, 'BRIDGE_CLI_DOWNLOAD_VERSION', {value: ''})
  Object.defineProperty(inputs, 'BRIDGE_CLI_DOWNLOAD_URL', {value: 'https://test-url/bridge-cli-bundle-2.9.8-win64.zip'})

  const response = sb.downloadBridge('/working_directory')
  expect(response).rejects.toThrowError()
})

test('Test fetch version details from BRIDGE_CLI_DOWNLOAD_URL For Linux', () => {
  const sb = new BridgeCliBundle()
  Object.defineProperty(inputs, 'BRIDGE_CLI_DOWNLOAD_VERSION', {value: ''})
  Object.defineProperty(inputs, 'BRIDGE_CLI_DOWNLOAD_URL', {value: 'https://test-url/bridge-cli-bundle-2.9.8-linux64.zip'})

  const response = sb.downloadBridge('/working_directory')
  expect(response).rejects.toThrowError()
})

test('Test fetch version details from BRIDGE_CLI_DOWNLOAD_URL For Linux ARM', () => {
  const sb = new BridgeCliBundle()
  Object.defineProperty(inputs, 'BRIDGE_CLI_DOWNLOAD_VERSION', {value: ''})
  Object.defineProperty(inputs, 'BRIDGE_CLI_DOWNLOAD_URL', {value: 'https://test-url/bridge-cli-bundle-2.9.8-linux_arm.zip'})

  const response = sb.downloadBridge('/working_directory')
  expect(response).rejects.toThrowError()
})

test('Test without version details from BRIDGE_CLI_DOWNLOAD_URL', () => {
  const sb = new BridgeCliBundle()
  Object.defineProperty(inputs, 'BRIDGE_CLI_DOWNLOAD_VERSION', {value: ''})
  Object.defineProperty(inputs, 'BRIDGE_CLI_DOWNLOAD_URL', {value: 'https://test-url/bridge-cli-bundle-macosx.zip'})
  const downloadFileResp: DownloadFileResponse = {filePath: '/user/temp/download/', fileName: 'C:/ser/temp/download/bridge-win.zip'}

  jest.spyOn(BridgeCliBundle.prototype, 'getBridgeVersionFromLatestURL').mockResolvedValueOnce('0.1.0')
  jest.spyOn(downloadUtility, 'extractZipped').mockResolvedValueOnce(true)
  jest.spyOn(downloadUtility, 'getRemoteFile').mockResolvedValueOnce(downloadFileResp)
  fs.existsSync = jest.fn()
  fs.existsSync.mockReturnValueOnce(false)
  fs.renameSync = jest.fn()
  fs.renameSync.mockReturnValueOnce()

  try {
    sb.downloadBridge('/working_directory')
  } catch (error: any) {
    expect(error.message).toContain('')
  }
})

test('Test invalid path for BRIDGE_CLI_INSTALL_DIRECTORY_KEY', () => {
  const sb = new BridgeCliBundle()
  Object.defineProperty(inputs, 'BRIDGE_CLI_INSTALL_DIRECTORY_KEY', {value: '/test-dir'})
  const response = sb.downloadBridge('/working_directory')
  expect(response).rejects.toThrowError()
})

test('Test version file not exist failure', () => {
  const sb = new BridgeCliBundle()
  let response = sb.checkIfVersionExists('0.1.1', '')
  expect(response).resolves.toEqual(false)
})
