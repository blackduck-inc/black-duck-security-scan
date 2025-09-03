import * as configVariables from 'actions-artifact-v2/lib/internal/shared/config'
import {tmpdir} from 'os'
import {uploadDiagnostics, uploadSarifReportAsArtifact} from '../../../src/blackduck-security-action/artifacts'
import * as inputs from '../../../src/blackduck-security-action/inputs'
import * as artifactV1 from 'actions-artifact-v1'
import {DefaultArtifactClient} from 'actions-artifact-v2'
import * as utility from '../../../src/blackduck-security-action/utility'

const fs = require('fs')

// Mock the artifact modules
jest.mock('actions-artifact-v2', () => ({
  DefaultArtifactClient: jest.fn()
}))

jest.mock('actions-artifact-v1', () => ({
  create: jest.fn()
}))

// Mock the config module
jest.mock('actions-artifact-v2/lib/internal/shared/config', () => ({
  getGitHubWorkspaceDir: jest.fn()
}))

let tempPath = '/temp'
beforeEach(() => {
  tempPath = tmpdir()
  Object.defineProperty(process, 'platform', {
    value: 'linux'
  })
  jest.spyOn(utility, 'getRealSystemTime').mockReturnValue('1749123407519') // Mock with a fixed timestamp
})

afterEach(() => {
  jest.restoreAllMocks() // Restore original implementation after each test
})

describe('uploadDiagnostics - success', () => {
  it('should call uploadArtifact with the correct arguments', async () => {
    // Mocking artifact client and its uploadArtifact function
    const mockUploadArtifact = jest.fn()
    const mockArtifactClient = {
      uploadArtifact: mockUploadArtifact
    }
    process.env['GITHUB_SERVER_URL'] = 'https://github.com'
    ;(DefaultArtifactClient as jest.MockedClass<typeof DefaultArtifactClient>).mockImplementation(() => mockArtifactClient as any)
    jest.spyOn(fs, 'existsSync').mockReturnValue(true)
    jest.spyOn(fs, 'readdirSync').mockReturnValue(['bridge.log'])
    jest.spyOn(configVariables, 'getGitHubWorkspaceDir').mockReturnValue('.')
    jest.spyOn(utility, 'isGitHubCloud').mockReturnValue(true)

    await uploadDiagnostics()

    expect(mockUploadArtifact).toHaveBeenCalledTimes(1)
    expect(mockUploadArtifact).toHaveBeenCalledWith('bridge_diagnostics_1749123407519', ['./.bridge/bridge.log'], './.bridge', {})
  })
})

test('Test uploadDiagnostics expect API error', () => {
  let files: string[] = ['bridge.log']
  Object.defineProperty(inputs, 'DIAGNOSTICS_RETENTION_DAYS', {value: 10})
  jest.spyOn(configVariables, 'getGitHubWorkspaceDir').mockReturnValue('.')
  jest.spyOn(fs, 'existsSync').mockReturnValue(true)
  jest.spyOn(utility, 'isGitHubCloud').mockReturnValue(false)

  const mockCreate = artifactV1.create as jest.MockedFunction<typeof artifactV1.create>
  const mockUploadArtifact = jest.fn().mockRejectedValue(new Error('API Error'))
  mockCreate.mockReturnValue({
    uploadArtifact: mockUploadArtifact
  } as any)

  const dir = (fs.readdirSync = jest.fn())
  dir.mockReturnValue(files)
  jest.spyOn(fs.statSync('./.bridge/bridge.log'), 'isDirectory').mockReturnValue(false)
  uploadDiagnostics().catch(Error)
})

test('Test uploadDiagnostics - invalid value for retention days', () => {
  let files: string[] = ['bridge.log']
  Object.defineProperty(inputs, 'DIAGNOSTICS_RETENTION_DAYS', {value: 'invalid'})
  jest.spyOn(configVariables, 'getGitHubWorkspaceDir').mockReturnValue('.')
  jest.spyOn(fs, 'existsSync').mockReturnValue(true)
  jest.spyOn(utility, 'isGitHubCloud').mockReturnValue(false)

  const mockCreate = artifactV1.create as jest.MockedFunction<typeof artifactV1.create>
  const mockUploadArtifact = jest.fn()
  mockCreate.mockReturnValue({
    uploadArtifact: mockUploadArtifact
  } as any)

  const dir = (fs.readdirSync = jest.fn())
  dir.mockReturnValue(files)
  jest.spyOn(fs.statSync('./.bridge/bridge.log'), 'isDirectory').mockReturnValue(false)
  uploadDiagnostics().catch(Error)
})

describe('uploadSarifReport', () => {
  it('should upload Sarif report as artifact', async () => {
    // Mocking artifact client and its uploadArtifact function
    const mockUploadArtifact = jest.fn()
    const mockArtifactClient = {
      uploadArtifact: mockUploadArtifact
    }
    process.env['GITHUB_SERVER_URL'] = 'https://github.com'
    ;(DefaultArtifactClient as jest.MockedClass<typeof DefaultArtifactClient>).mockImplementation(() => mockArtifactClient as any)
    jest.spyOn(utility, 'getDefaultSarifReportPath').mockReturnValue('mocked-sarif-path')
    jest.spyOn(utility, 'checkIfPathExists').mockReturnValue(true)
    jest.spyOn(utility, 'isGitHubCloud').mockReturnValue(true)

    const defaultSarifReportDirectory = '.'
    const userSarifFilePath = 'mocked-sarif-path'
    const artifactName = 'mocked-artifact-name'

    await uploadSarifReportAsArtifact(defaultSarifReportDirectory, userSarifFilePath, artifactName)

    expect(mockUploadArtifact).toHaveBeenCalledTimes(1)
    expect(mockUploadArtifact).toHaveBeenCalledWith(artifactName, [userSarifFilePath], '.', {})
  })
})
