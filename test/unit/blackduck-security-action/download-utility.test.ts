import mock = jest.mock
import {extractZipped, getRemoteFile} from '../../../src/blackduck-security-action/download-utility'
import {cleanupTempDir, createTempDir} from '../../../src/blackduck-security-action/utility'
import {tmpdir} from 'os'
import * as toolCache from '@actions/tool-cache'

mock('@actions/tool-cache')
mock('@actions/core')
mock('fs')
jest.mock('../../../src/blackduck-security-action/tool-cache-local', () => ({
  downloadTool: jest.fn()
}))
mock('path', () => {
  const actualPath = jest.requireActual('path')
  return {
    ...actualPath,
    join: jest.fn(actualPath.join)
  }
})

import * as path from 'path'
import * as toolCacheLocal from '../../../src/blackduck-security-action/tool-cache-local'

const fs = require('fs')

let tempPath = '/temp'

beforeEach(() => {
  tempPath = tmpdir()
  jest.mocked(path.join).mockReset()
  Object.defineProperty(process, 'platform', {
    value: 'darwin'
  })
})

test('Test getRemoteFile', async () => {
  jest.mocked(path.join).mockReturnValueOnce('/user')
  fs.lstatSync = jest.fn().mockReturnValue({isDirectory: () => true})
  ;(toolCacheLocal.downloadTool as jest.Mock).mockResolvedValueOnce('/path-to-bridge/bridge')

  const data = await getRemoteFile(tempPath, 'http://blackduck.bridge.com/bridge_macOs_1.zip')
  expect(data.fileName).toContain('bridge')
})

test('Test getRemoteFile linux', async () => {
  jest.mocked(path.join).mockReturnValueOnce('/user')
  fs.lstatSync = jest.fn().mockReturnValue({isDirectory: () => true})

  Object.defineProperty(process, 'platform', {
    value: 'linux'
  })
  ;(toolCacheLocal.downloadTool as jest.Mock).mockResolvedValueOnce('/path-to-bridge/bridge')

  const data = await getRemoteFile(tempPath, 'http://blackduck.bridge.com/bridge_linux_1.zip')
  expect(data.fileName).toContain('bridge')
})

test('Test getRemoteFile windows', async () => {
  jest.mocked(path.join).mockReturnValueOnce('/user')
  fs.lstatSync = jest.fn().mockReturnValue({isDirectory: () => true})

  Object.defineProperty(process, 'platform', {
    value: 'win32'
  })
  ;(toolCacheLocal.downloadTool as jest.Mock).mockResolvedValueOnce('/path-to-bridge/bridge')

  const data = await getRemoteFile(tempPath, 'http://blackduck.bridge.com/bridge_win_1.zip')
  expect(data.fileName).toContain('bridge')
})

test('Test getRemoteFile for url to be empty', async () => {
  jest.mocked(path.join).mockReturnValueOnce('/user')

  await expect(getRemoteFile(tempPath, '')).rejects.toThrow()
})

test('Test extractZipped', async () => {
  ;(toolCache.extractZip as jest.Mock) = jest.fn()
  ;(toolCache.extractZip as jest.Mock).mockReturnValueOnce('/destination-directory')

  const data = await extractZipped('file', '/destination-directory')
  expect(data).toBe(true)
})

test('Test extractZipped for file name to be empty', async () => {
  ;(toolCache.extractZip as jest.Mock) = jest.fn()
  ;(toolCache.extractZip as jest.Mock).mockReturnValueOnce('/destination-directory')

  await expect(extractZipped('', '/destination-directory')).rejects.toThrow()
})

test('Test extractZipped for destination path to be empty', async () => {
  ;(toolCache.extractZip as jest.Mock) = jest.fn()
  ;(toolCache.extractZip as jest.Mock).mockReturnValueOnce('/destination-directory')

  await expect(extractZipped('file', '')).rejects.toThrow()
})
