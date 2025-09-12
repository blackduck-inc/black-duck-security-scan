import {extractZipped, getRemoteFile} from '../../../src/blackduck-security-action/download-utility'
import {tmpdir} from 'os'
import * as path from 'path'
import * as toolCache from '@actions/tool-cache'

// Mock the modules
jest.mock('path')
jest.mock('@actions/tool-cache')

const mockedPath = jest.mocked(path)
const mockedToolCache = jest.mocked(toolCache)

let tempPath = '/temp'

beforeEach(() => {
  tempPath = tmpdir()
  Object.defineProperty(process, 'platform', {
    value: 'darwin'
  })
  jest.clearAllMocks()
})

test('Test getRemoteFile', async () => {
  mockedPath.join.mockReturnValueOnce('/user')
  mockedToolCache.downloadTool.mockResolvedValueOnce('/path-to-bridge/bridge')

  const data = await getRemoteFile(tempPath, 'http://blackduck.bridge.com/bridge_macOs_1.zip')
  expect(data.fileName).toContain('bridge')
})

test('Test getRemoteFile linux', async () => {
  mockedPath.join.mockReturnValueOnce('/user')

  Object.defineProperty(process, 'platform', {
    value: 'linux'
  })

  mockedToolCache.downloadTool.mockResolvedValueOnce('/path-to-bridge/bridge')

  const data = await getRemoteFile(tempPath, 'http://blackduck.bridge.com/bridge_linux_1.zip')
  expect(data.fileName).toContain('bridge')
})

test('Test getRemoteFile windows', async () => {
  mockedPath.join.mockReturnValueOnce('/user')

  Object.defineProperty(process, 'platform', {
    value: 'win32'
  })

  mockedToolCache.downloadTool.mockResolvedValueOnce('/path-to-bridge/bridge')

  const data = await getRemoteFile(tempPath, 'http://blackduck.bridge.com/bridge_win_1.zip')
  expect(data.fileName).toContain('bridge')
})

test('Test getRemoteFile for url to be empty', async () => {
  mockedPath.join.mockReturnValueOnce('/user')
  mockedToolCache.downloadTool.mockResolvedValueOnce('/path-to-bridge/bridge')

  await expect(getRemoteFile(tempPath, '')).rejects.toThrowError()
})

test('Test extractZipped', async () => {
  mockedToolCache.extractZip.mockResolvedValueOnce('/destination-directory')

  const result = await extractZipped('file', '/destination-directory')
  expect(result).toBe(true)
})

test('Test extractZipped for file name to be empty', async () => {
  mockedToolCache.extractZip.mockResolvedValueOnce('/destination-directory')

  await expect(extractZipped('', '/destination-directory')).rejects.toThrowError()
})

test('Test extractZipped for destination path to be empty', async () => {
  mockedToolCache.extractZip.mockResolvedValueOnce('/destination-directory')

  await expect(extractZipped('file', '')).rejects.toThrowError()
})
