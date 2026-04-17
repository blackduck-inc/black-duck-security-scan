import * as configVariables from 'actions-artifact-v2/lib/internal/shared/config'
import {tmpdir} from 'os'
import {addArtifactDomainsToNoProxy, restoreNoProxy, uploadDiagnostics, uploadSarifReportAsArtifact} from '../../../src/blackduck-security-action/artifacts'
import * as inputs from '../../../src/blackduck-security-action/inputs'
import * as artifact from 'actions-artifact-v2/lib/artifact'
import * as utility from '../../../src/blackduck-security-action/utility'

const fs = require('fs')

// Mock the artifact module
jest.mock('actions-artifact-v2', () => ({
  DefaultArtifactClient: jest.fn().mockImplementation(() => ({
    uploadArtifact: jest.fn(),
    downloadArtifact: jest.fn()
  }))
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
    const mockArtifactClient: Partial<artifact.ArtifactClient> = {
      uploadArtifact: mockUploadArtifact as any // Casting to any due to typing issues
    }
    process.env['GITHUB_SERVER_URL'] = 'https://github.com'
    jest.spyOn(artifact, 'DefaultArtifactClient').mockReturnValue(mockArtifactClient as artifact.ArtifactClient)
    jest.spyOn(fs, 'existsSync').mockReturnValue(true)
    jest.spyOn(fs, 'readdirSync').mockReturnValue(['bridge.log'])
    jest.spyOn(configVariables, 'getGitHubWorkspaceDir').mockReturnValue('./test')

    await uploadDiagnostics()

    expect(mockUploadArtifact).toHaveBeenCalledTimes(1)
    expect(mockUploadArtifact).toHaveBeenCalledWith('bridge_diagnostics_1749123407519', ['./test/.bridge/bridge.log'], './test/.bridge', {})
  })
})

test('Test uploadDiagnostics expect API error', () => {
  let files: string[] = ['bridge.log']
  Object.defineProperty(inputs, 'DIAGNOSTICS_RETENTION_DAYS', {value: 10})
  jest.spyOn(configVariables, 'getGitHubWorkspaceDir').mockReturnValue('.')

  const dir = (fs.readdirSync = jest.fn())
  dir.mockReturnValue(files)
  jest.spyOn(fs.statSync('./test/.bridge/bridge.log'), 'isDirectory').mockReturnValue(false)
  uploadDiagnostics().catch(Error)
})

test('Test uploadDiagnostics - invalid value for retention days', () => {
  let files: string[] = ['bridge.log']
  Object.defineProperty(inputs, 'DIAGNOSTICS_RETENTION_DAYS', {value: 'invalid'})
  jest.spyOn(configVariables, 'getGitHubWorkspaceDir').mockReturnValue('.')

  const dir = (fs.readdirSync = jest.fn())
  dir.mockReturnValue(files)
  jest.spyOn(fs.statSync('./test/.bridge/bridge.log'), 'isDirectory').mockReturnValue(false)
  uploadDiagnostics().catch(Error)
})

describe('uploadSarifReport', () => {
  it('should upload Sarif report as artifact', async () => {
    // Mocking artifact client and its uploadArtifact function
    const mockUploadArtifact = jest.fn()
    const mockArtifactClient: Partial<artifact.ArtifactClient> = {
      uploadArtifact: mockUploadArtifact as any // Casting to any due to typing issues
    }
    process.env['GITHUB_SERVER_URL'] = 'https://github.com'
    jest.spyOn(artifact, 'DefaultArtifactClient').mockReturnValue(mockArtifactClient as artifact.ArtifactClient)
    jest.spyOn(utility, 'getDefaultSarifReportPath').mockReturnValue('mocked-sarif-path')
    jest.spyOn(utility, 'checkIfPathExists').mockReturnValue(true)

    const defaultSarifReportDirectory = '.'
    const userSarifFilePath = 'mocked-sarif-path'
    const artifactName = 'mocked-artifact-name'

    await uploadSarifReportAsArtifact(defaultSarifReportDirectory, userSarifFilePath, artifactName)

    expect(mockUploadArtifact).toHaveBeenCalledTimes(1)
    expect(mockUploadArtifact).toHaveBeenCalledWith(artifactName, [userSarifFilePath], '.', {})
  })
})

describe('addArtifactDomainsToNoProxy', () => {
  const savedEnv: Record<string, string | undefined> = {}

  beforeEach(() => {
    savedEnv.HTTPS_PROXY = process.env.HTTPS_PROXY
    savedEnv.https_proxy = process.env.https_proxy
    savedEnv.HTTP_PROXY = process.env.HTTP_PROXY
    savedEnv.http_proxy = process.env.http_proxy
    savedEnv.NO_PROXY = process.env.NO_PROXY
    savedEnv.no_proxy = process.env.no_proxy
    delete process.env.HTTPS_PROXY
    delete process.env.https_proxy
    delete process.env.HTTP_PROXY
    delete process.env.http_proxy
    delete process.env.NO_PROXY
    delete process.env.no_proxy
  })

  afterEach(() => {
    if (savedEnv.HTTPS_PROXY !== undefined) process.env.HTTPS_PROXY = savedEnv.HTTPS_PROXY
    else delete process.env.HTTPS_PROXY
    if (savedEnv.https_proxy !== undefined) process.env.https_proxy = savedEnv.https_proxy
    else delete process.env.https_proxy
    if (savedEnv.HTTP_PROXY !== undefined) process.env.HTTP_PROXY = savedEnv.HTTP_PROXY
    else delete process.env.HTTP_PROXY
    if (savedEnv.http_proxy !== undefined) process.env.http_proxy = savedEnv.http_proxy
    else delete process.env.http_proxy
    if (savedEnv.NO_PROXY !== undefined) process.env.NO_PROXY = savedEnv.NO_PROXY
    else delete process.env.NO_PROXY
    if (savedEnv.no_proxy !== undefined) process.env.no_proxy = savedEnv.no_proxy
    else delete process.env.no_proxy
  })

  it('should not modify NO_PROXY when no proxy is configured', () => {
    const saved = addArtifactDomainsToNoProxy()
    expect(process.env.NO_PROXY).toBeUndefined()
    expect(process.env.no_proxy).toBeUndefined()
    restoreNoProxy(saved)
  })

  it('should add artifact domains to NO_PROXY when proxy is configured', () => {
    process.env.HTTPS_PROXY = 'http://proxy.example.com:8080'
    process.env.NO_PROXY = 'localhost,127.0.0.1'

    const saved = addArtifactDomainsToNoProxy()

    expect(process.env.NO_PROXY).toBe('localhost,127.0.0.1,.blob.core.windows.net,.actions.githubusercontent.com')

    restoreNoProxy(saved)
    expect(process.env.NO_PROXY).toBe('localhost,127.0.0.1')
  })

  it('should set NO_PROXY with just artifact domains when NO_PROXY was empty', () => {
    process.env.HTTP_PROXY = 'http://proxy.example.com:8080'

    const saved = addArtifactDomainsToNoProxy()

    expect(process.env.NO_PROXY).toBe('.blob.core.windows.net,.actions.githubusercontent.com')
    expect(saved.originalNoProxy).toBeUndefined()

    restoreNoProxy(saved)
    expect(process.env.NO_PROXY).toBeUndefined()
  })

  it('should restore NO_PROXY correctly after restoreNoProxy', () => {
    process.env.HTTPS_PROXY = 'http://proxy.example.com:8080'
    process.env.NO_PROXY = 'original.domain.com'

    const saved = addArtifactDomainsToNoProxy()

    expect(process.env.NO_PROXY).toContain('.blob.core.windows.net')
    expect(process.env.NO_PROXY).toContain('original.domain.com')

    restoreNoProxy(saved)

    expect(process.env.NO_PROXY).toBe('original.domain.com')
  })

  it('should use lowercase no_proxy value when NO_PROXY is not set', () => {
    process.env.https_proxy = 'http://proxy.example.com:8080'
    process.env.no_proxy = 'internal.corp.com'

    const saved = addArtifactDomainsToNoProxy()

    expect(process.env.NO_PROXY).toBe('internal.corp.com,.blob.core.windows.net,.actions.githubusercontent.com')

    restoreNoProxy(saved)
    expect(process.env.no_proxy).toBe('internal.corp.com')
  })
})
