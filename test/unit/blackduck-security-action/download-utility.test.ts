import mock = jest.mock
import {extractZipped, getRemoteFile} from '../../../src/blackduck-security-action/download-utility'
import {cleanupTempDir, createTempDir} from '../../../src/blackduck-security-action/utility'
import {tmpdir} from 'os'

const path = require('path')
mock('path')

const toolCache = require('@actions/tool-cache')
mock('@actions/tool-cache')

const toolCacheLocal = require('../../../src/blackduck-security-action/tool-cache-local')
mock('../../../src/blackduck-security-action/tool-cache-local')

const fs = require('fs')
mock('fs')

let tempPath = '/temp'

beforeEach(() => {
  tempPath = tmpdir()
  Object.defineProperty(process, 'platform', {
    value: 'darwin'
  })
})

test('Test getRemoteFile', async () => {
  path.join = jest.fn()
  path.join.mockReturnValueOnce('/user')

  fs.lstatSync = jest.fn()
  fs.lstatSync.mockReturnValueOnce({isDirectory: () => true})

  toolCacheLocal.downloadTool = jest.fn()
  toolCacheLocal.downloadTool.mockResolvedValueOnce('/path-to-bridge/bridge')

  const data = await getRemoteFile(tempPath, 'http://blackduck.bridge.com/bridge_macOs_1.zip')
  expect(data.fileName).toContain('bridge')
})

test('Test getRemoteFile linux', async () => {
  path.join = jest.fn()
  path.join.mockReturnValueOnce('/user')

  Object.defineProperty(process, 'platform', {
    value: 'linux'
  })

  fs.lstatSync = jest.fn()
  fs.lstatSync.mockReturnValueOnce({isDirectory: () => true})

  toolCacheLocal.downloadTool = jest.fn()
  toolCacheLocal.downloadTool.mockResolvedValueOnce('/path-to-bridge/bridge')

  const data = await getRemoteFile(tempPath, 'http://blackduck.bridge.com/bridge_linux_1.zip')
  expect(data.fileName).toContain('bridge')
})

test('Test getRemoteFile windows', async () => {
  path.join = jest.fn()
  path.join.mockReturnValueOnce('/user')

  Object.defineProperty(process, 'platform', {
    value: 'win32'
  })

  fs.lstatSync = jest.fn()
  fs.lstatSync.mockReturnValueOnce({isDirectory: () => true})

  toolCacheLocal.downloadTool = jest.fn()
  toolCacheLocal.downloadTool.mockResolvedValueOnce('/path-to-bridge/bridge')

  const data = await getRemoteFile(tempPath, 'http://blackduck.bridge.com/bridge_win_1.zip')
  expect(data.fileName).toContain('bridge')
})

test('Test getRemoteFile for url to be empty', () => {
  path.join = jest.fn()
  path.join.mockReturnValueOnce('/user')

  toolCache.downloadTool = jest.fn()
  toolCache.downloadTool.mockReturnValueOnce('/path-to-bridge/bridge')

  const response = getRemoteFile(tempPath, '')
  expect(response).rejects.toThrowError()
})

test('Test extractZipped', async () => {
  toolCache.extractZip = jest.fn()

  toolCache.extractZip.mockResolvedValueOnce('/destination-directory')

  const data = await extractZipped('file', '/destination-directory')
  expect(data).toBe(true)
})

test('Test extractZipped for file name to be empty', () => {
  toolCache.extractZip = jest.fn()

  toolCache.extractZip.mockReturnValueOnce('/destination-directory')

  let returnedResponse
  const response = extractZipped('', '/destination-directory')
  expect(response).rejects.toThrowError()
})

test('Test extractZipped for destination path to be empty', () => {
  toolCache.extractZip = jest.fn()

  toolCache.extractZip.mockReturnValueOnce('/destination-directory')

  let returnedResponse
  const response = extractZipped('file', '')
  expect(response).rejects.toThrowError()
})
