import {cleanupTempDir, createTempDir} from '../../src/synopsys-action/utility'
import {SynopsysToolsParameter} from '../../src/synopsys-action/tools-parameter'

let tempPath = '/temp'

beforeAll(() => {
  createTempDir().then(path => (tempPath = path))
})

afterAll(() => {
  cleanupTempDir(tempPath)
})

test('Test getFormattedCommandForPolaris', () => {
  const stp: SynopsysToolsParameter = new SynopsysToolsParameter(tempPath)

  const resp = stp.getFormattedCommandForPolaris('access_token', 'application_name', 'project_name', 'http://server_url.com', ['SAST'])

  expect(resp).not.toBeNull()
  expect(resp).toContain('--stage polaris')
})

test('Test missing data error in getFormattedCommandForPolaris', () => {
  const stp: SynopsysToolsParameter = new SynopsysToolsParameter(tempPath)

  try {
    stp.getFormattedCommandForPolaris('', 'application_name', 'project_name', 'http://server_url.com', ['SAST'])
  } catch (error: any) {
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toContain('parameters for Altair is missing')
  }
})

test('Test wrong assessment type error in getFormattedCommandForPolaris', () => {
  const stp: SynopsysToolsParameter = new SynopsysToolsParameter(tempPath)

  try {
    stp.getFormattedCommandForPolaris('access_token', 'application_name', 'project_name', 'http://server_url.com', ['SAST'])
  } catch (error: any) {
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toContain('Provided Assessment type not found')
  }
})

test('Test getFormattedCommandForCoverity', () => {
  const stp: SynopsysToolsParameter = new SynopsysToolsParameter(tempPath)

  const resp = stp.getFormattedCommandForCoverity('userNm', 'pwd', 'http://server_url.com', 'synopsys-action', 'strean name', '/', '10005', 'test', 'main')

  expect(resp).not.toBeNull()
  expect(resp).toContain('--stage connect')
})

test('Test missing data error in getFormattedCommandForCoverity', () => {
  const stp: SynopsysToolsParameter = new SynopsysToolsParameter(tempPath)

  try {
    stp.getFormattedCommandForCoverity('', 'pwd', 'http://server_url.com', 'synopsys-action', 'strean name', '/', '10005', 'test', 'main')
  } catch (error: any) {
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toContain('required parameters for Coverity is missing')
  }
})

test('Test in getFormattedCommandForCoverityInstallDirectory', () => {
  const stp: SynopsysToolsParameter = new SynopsysToolsParameter(tempPath)

  try {
    stp.getFormattedCommandForCoverity('usr', 'pwd', 'http://server_url.com', 'synopsys-action', 'stream name', '/', '10005', 'test', 'main')
  } catch (error: any) {
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toContain('Invalid Install Directory')
  }
})

test('Test getFormattedCommandForBlackduck', () => {
  const stp: SynopsysToolsParameter = new SynopsysToolsParameter(tempPath)

  const resp = stp.getFormattedCommandForBlackduck('http://blackduck.com', 'token', 'http://server_url.com', 'true', [])

  expect(resp).not.toBeNull()
  expect(resp).toContain('--stage blackduck')
})

test('Test missing data error in getFormattedCommandForBlackduck', () => {
  const stp: SynopsysToolsParameter = new SynopsysToolsParameter(tempPath)

  try {
    stp.getFormattedCommandForBlackduck('', 'token', 'http://server_url.com', 'true', [])
  } catch (error: any) {
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toContain('required parameters for Coverity is missing')
  }
})
