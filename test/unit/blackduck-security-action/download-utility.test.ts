import mock = jest.mock
import {extractZipped, getRemoteFile} from '../../../src/blackduck-security-action/download-utility'
import {cleanupTempDir, createTempDir} from '../../../src/blackduck-security-action/utility'
import {tmpdir} from 'os'
import * as toolCache from '@actions/tool-cache'

mock('@actions/tool-cache')
mock('@actions/core')
mock('fs')
mock('path', () => {
  const actualPath = jest.requireActual('path')
  return {
    ...actualPath,
    join: jest.fn(actualPath.join)
  }
})

import * as path from 'path'

let tempPath = '/temp'

beforeEach(() => {
  tempPath = tmpdir()
  jest.mocked(path.join).mockReset()
  Object.defineProperty(process, 'platform', {
    value: 'darwin'
  })
})

test('Test getRemoteFile', () => {
  jest.mocked(path.join).mockReturnValueOnce('/user')
  ;(toolCache.downloadTool as jest.Mock) = jest.fn()
  ;(toolCache.downloadTool as jest.Mock).mockReturnValueOnce('/path-to-bridge/bridge')

  getRemoteFile(tempPath, 'http://blackduck.bridge.com/bridge_macOs_1.zip').then(data => {
    expect(data.fileName).toContain('bridge')
  })
})

test('Test getRemoteFile linux', () => {
  jest.mocked(path.join).mockReturnValueOnce('/user')

  Object.defineProperty(process, 'platform', {
    value: 'linux'
  })
  ;(toolCache.downloadTool as jest.Mock) = jest.fn()
  ;(toolCache.downloadTool as jest.Mock).mockReturnValueOnce('/path-to-bridge/bridge')

  getRemoteFile(tempPath, 'http://blackduck.bridge.com/bridge_linux_1.zip').then(data => {
    expect(data.fileName).toContain('bridge')
  })
})

test('Test getRemoteFile windows', () => {
  jest.mocked(path.join).mockReturnValueOnce('/user')

  Object.defineProperty(process, 'platform', {
    value: 'win32'
  })
  ;(toolCache.downloadTool as jest.Mock) = jest.fn()
  ;(toolCache.downloadTool as jest.Mock).mockReturnValueOnce('/path-to-bridge/bridge')

  getRemoteFile(tempPath, 'http://blackduck.bridge.com/bridge_win_1.zip').then(data => {
    expect(data.fileName).toContain('bridge')
  })
})

test('Test getRemoteFile for url to be empty', () => {
  jest.mocked(path.join).mockReturnValueOnce('/user')
  ;(toolCache.downloadTool as jest.Mock) = jest.fn()
  ;(toolCache.downloadTool as jest.Mock).mockReturnValueOnce('/path-to-bridge/bridge')

  const response = getRemoteFile(tempPath, '')
  expect(response).rejects.toThrowError()
})

test('Test extractZipped', () => {
  ;(toolCache.extractZip as jest.Mock) = jest.fn()
  ;(toolCache.extractZip as jest.Mock).mockReturnValueOnce('/destination-directory')

  extractZipped('file', '/destination-directory').then(data => {
    expect(data).toBe(true)
  })
})

test('Test extractZipped for file name to be empty', () => {
  ;(toolCache.extractZip as jest.Mock) = jest.fn()
  ;(toolCache.extractZip as jest.Mock).mockReturnValueOnce('/destination-directory')

  const response = extractZipped('', '/destination-directory')
  expect(response).rejects.toThrowError()
})

test('Test extractZipped for destination path to be empty', () => {
  ;(toolCache.extractZip as jest.Mock) = jest.fn()
  ;(toolCache.extractZip as jest.Mock).mockReturnValueOnce('/destination-directory')

  const response = extractZipped('file', '')
  expect(response).rejects.toThrowError()
})
