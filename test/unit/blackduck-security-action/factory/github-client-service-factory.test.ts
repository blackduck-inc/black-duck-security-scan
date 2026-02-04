import * as inputs from '../../../../src/blackduck-security-action/inputs'
import {HttpClient, HttpClientResponse} from 'typed-rest-client/HttpClient'
import {GitHubClientServiceFactory} from '../../../../src/blackduck-security-action/factory/github-client-service-factory'
import {IncomingMessage} from 'http'
import {Socket} from 'net'
import Mocked = jest.Mocked
import {GithubClientServiceCloud} from '../../../../src/blackduck-security-action/service/impl/cloud/github-client-service-cloud'
import {GithubClientServiceV1} from '../../../../src/blackduck-security-action/service/impl/enterprise/v1/github-client-service-v1'
import * as core from '@actions/core'

describe('fetchVersion()', () => {
  beforeEach(() => {
    Object.defineProperty(inputs, 'GITHUB_TOKEN', {value: 'test-token'})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should fetch version successfully for supported version', async () => {
    const githubApiUrl = 'https://api.example.com'
    const expectedVersion = '3.11'
    const mockMetaDataResponse = JSON.stringify({installed_version: expectedVersion})

    const incomingMessage: IncomingMessage = new IncomingMessage(new Socket())
    const httpResponse: Mocked<HttpClientResponse> = {
      message: incomingMessage,
      readBody: jest.fn()
    }
    httpResponse.readBody.mockResolvedValue(mockMetaDataResponse)
    httpResponse.message.statusCode = 200
    jest.spyOn(HttpClient.prototype, 'get').mockResolvedValueOnce(httpResponse)

    const version = await GitHubClientServiceFactory.fetchVersion(githubApiUrl)

    expect(version).toBe(expectedVersion)
  })

  it('should fetch the default version if the HTTP status is not OK', async () => {
    const githubApiUrl = 'https://api.example.com'
    const incomingMessage: IncomingMessage = new IncomingMessage(new Socket())
    const httpResponse: Mocked<HttpClientResponse> = {
      message: incomingMessage,
      readBody: jest.fn()
    }
    httpResponse.message.statusCode = 404
    jest.spyOn(HttpClient.prototype, 'get').mockResolvedValueOnce(httpResponse)

    const version = await GitHubClientServiceFactory.fetchVersion(githubApiUrl)

    expect(version).toBe(GitHubClientServiceFactory.DEFAULT_VERSION)
  })

  it('should fetch the default version if fetching version info fails', async () => {
    const githubApiUrl = 'https://api.example.com'
    const errorMessage = 'Network error'

    jest.spyOn(HttpClient.prototype, 'get').mockRejectedValue(new Error(errorMessage))

    const version = await GitHubClientServiceFactory.fetchVersion(githubApiUrl)

    expect(version).toBe(GitHubClientServiceFactory.DEFAULT_VERSION)
  })
})

describe('getGitHubClientServiceInstance()', () => {
  const originalEnv = process.env

  beforeEach(() => {
    Object.defineProperty(inputs, 'GITHUB_TOKEN', {value: 'test-token'})
    // Reset process.env for clean state
    process.env = {...originalEnv}
  })

  afterEach(() => {
    jest.restoreAllMocks()
    // Clean up environment variables
    delete process.env['GITHUB_API_URL']
    process.env = originalEnv
  })

  it('should return GithubClientServiceCloud service', async () => {
    process.env['GITHUB_API_URL'] = 'https://api.github.com'

    expect(await GitHubClientServiceFactory.getGitHubClientServiceInstance()).toBeInstanceOf(GithubClientServiceCloud)
  })

  it('should return GithubClientServiceV1 service for version 3.15', async () => {
    process.env['GITHUB_API_URL'] = 'https://api.example.com'
    jest.spyOn(GitHubClientServiceFactory, 'fetchVersion').mockResolvedValueOnce('3.15.0')

    expect(await GitHubClientServiceFactory.getGitHubClientServiceInstance()).toBeInstanceOf(GithubClientServiceV1)
  })

  it('should return GithubClientServiceV1 service for version 3.16', async () => {
    process.env['GITHUB_API_URL'] = 'https://api.example.com'
    jest.spyOn(GitHubClientServiceFactory, 'fetchVersion').mockResolvedValueOnce('3.16.5')

    expect(await GitHubClientServiceFactory.getGitHubClientServiceInstance()).toBeInstanceOf(GithubClientServiceV1)
  })

  it('should return GithubClientServiceV1 service for version 3.17', async () => {
    process.env['GITHUB_API_URL'] = 'https://api.example.com'
    jest.spyOn(GitHubClientServiceFactory, 'fetchVersion').mockResolvedValueOnce('3.17.7')

    expect(await GitHubClientServiceFactory.getGitHubClientServiceInstance()).toBeInstanceOf(GithubClientServiceV1)
  })

  it('should return GithubClientServiceV1 service for unsupported version', async () => {
    process.env['GITHUB_API_URL'] = 'https://api.example.com'
    jest.spyOn(GitHubClientServiceFactory, 'fetchVersion').mockResolvedValueOnce('3.18.0')

    expect(await GitHubClientServiceFactory.getGitHubClientServiceInstance()).toBeInstanceOf(GithubClientServiceV1)
  })

  it('should log supported version message when version is supported', async () => {
    process.env['GITHUB_API_URL'] = 'https://api.example.com'
    jest.spyOn(GitHubClientServiceFactory, 'fetchVersion').mockResolvedValueOnce('3.17.7')
    const infoSpy = jest.spyOn(core, 'info').mockImplementation()

    await GitHubClientServiceFactory.getGitHubClientServiceInstance()

    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('GitHub Enterprise version: 3.17.7'))
    expect(infoSpy).toHaveBeenCalledWith('GitHub Enterprise Version is supported')
  })

  it('should log unsupported version message when version is not supported', async () => {
    process.env['GITHUB_API_URL'] = 'https://api.example.com'
    jest.spyOn(GitHubClientServiceFactory, 'fetchVersion').mockResolvedValueOnce('3.20.1')
    const infoSpy = jest.spyOn(core, 'info').mockImplementation()

    await GitHubClientServiceFactory.getGitHubClientServiceInstance()

    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('GitHub Enterprise version: 3.20.1'))
    expect(infoSpy).toHaveBeenCalledWith('Proceeding with default REST API version')
  })

  it('should always log supported versions list', async () => {
    process.env['GITHUB_API_URL'] = 'https://api.example.com'
    jest.spyOn(GitHubClientServiceFactory, 'fetchVersion').mockResolvedValueOnce('3.17.0')
    const infoSpy = jest.spyOn(core, 'info').mockImplementation()

    await GitHubClientServiceFactory.getGitHubClientServiceInstance()

    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('Supported versions:'))
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('3.15'))
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('3.16'))
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('3.17'))
  })

  it('should extract only major.minor version and ignore patch version', async () => {
    process.env['GITHUB_API_URL'] = 'https://api.example.com'
    jest.spyOn(GitHubClientServiceFactory, 'fetchVersion').mockResolvedValueOnce('3.17.999')
    const infoSpy = jest.spyOn(core, 'info').mockImplementation()

    await GitHubClientServiceFactory.getGitHubClientServiceInstance()

    // Should log full version (3.17.999)
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('GitHub Enterprise version: 3.17.999'))
    // Should be supported (because major.minor 3.17 is in the list)
    expect(infoSpy).toHaveBeenCalledWith('GitHub Enterprise Version is supported')
  })

  it('should return GithubClientServiceV1 for version 3.15.0 (supported)', async () => {
    process.env['GITHUB_API_URL'] = 'https://api.example.com'
    jest.spyOn(GitHubClientServiceFactory, 'fetchVersion').mockResolvedValueOnce('3.15.0')

    const service = await GitHubClientServiceFactory.getGitHubClientServiceInstance()

    expect(service).toBeInstanceOf(GithubClientServiceV1)
  })

  it('should use default version 3.17', () => {
    expect(GitHubClientServiceFactory.DEFAULT_VERSION).toBe('3.17')
  })

  it('should have all supported versions in the list', () => {
    expect(GitHubClientServiceFactory.SUPPORTED_VERSIONS_V1).toContain('3.15')
    expect(GitHubClientServiceFactory.SUPPORTED_VERSIONS_V1).toContain('3.16')
    expect(GitHubClientServiceFactory.SUPPORTED_VERSIONS_V1).toContain('3.17')
  })

  it('should return GithubClientServiceCloud service for GHEC data residency domain', async () => {
    process.env['GITHUB_API_URL'] = 'https://api.blackduck.ghe.com'
    expect(await GitHubClientServiceFactory.getGitHubClientServiceInstance()).toBeInstanceOf(GithubClientServiceCloud)
  })

  it('should return GithubClientServiceCloud service for GHEC .github.com domain', async () => {
    process.env['GITHUB_API_URL'] = 'https://api.custom.github.com'
    expect(await GitHubClientServiceFactory.getGitHubClientServiceInstance()).toBeInstanceOf(GithubClientServiceCloud)
  })
})
