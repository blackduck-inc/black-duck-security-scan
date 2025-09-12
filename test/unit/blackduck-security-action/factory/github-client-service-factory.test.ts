// Mock typed-rest-client module
jest.mock('typed-rest-client/HttpClient', () => {
  const mockGet = jest.fn()
  const mockPost = jest.fn()
  const mockPut = jest.fn()
  const mockDelete = jest.fn()

  const MockHttpClient = jest.fn().mockImplementation(() => ({
    get: mockGet,
    post: mockPost,
    put: mockPut,
    delete: mockDelete
  }))

  // Add methods to prototype so spyOn works
  MockHttpClient.prototype.get = mockGet
  MockHttpClient.prototype.post = mockPost
  MockHttpClient.prototype.put = mockPut
  MockHttpClient.prototype.delete = mockDelete

  return {
    HttpClient: MockHttpClient,
    HttpClientResponse: jest.fn()
  }
})

import {HttpClient, HttpClientResponse} from 'typed-rest-client/HttpClient'
import {GitHubClientServiceFactory} from '../../../../src/blackduck-security-action/factory/github-client-service-factory'
import {IncomingMessage} from 'http'
import {Socket} from 'net'
import {GithubClientServiceCloud} from '../../../../src/blackduck-security-action/service/impl/cloud/github-client-service-cloud'
import {GithubClientServiceV1} from '../../../../src/blackduck-security-action/service/impl/enterprise/v1/github-client-service-v1'
import Mocked = jest.Mocked

describe('fetchVersion()', () => {
  beforeEach(() => {
    // Mock the inputs module with GITHUB_TOKEN
    jest.doMock('../../../../src/blackduck-security-action/inputs', () => ({
      GITHUB_TOKEN: 'test-token'
    }))
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.resetModules()
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
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should return GithubClientServiceCloud service', async () => {
    process.env['GITHUB_API_URL'] = 'https://api.github.com'

    expect(await GitHubClientServiceFactory.getGitHubClientServiceInstance()).toBeInstanceOf(GithubClientServiceCloud)
  })

  it('should return GithubClientServiceV1 service for version 3.11', async () => {
    process.env['GITHUB_API_URL'] = 'https://api.example.com'
    jest.spyOn(GitHubClientServiceFactory, 'fetchVersion').mockResolvedValueOnce('3.11')

    expect(await GitHubClientServiceFactory.getGitHubClientServiceInstance()).toBeInstanceOf(GithubClientServiceV1)
  })

  it('should return GithubClientServiceV1 service for unsupported version', async () => {
    process.env['GITHUB_API_URL'] = 'https://api.example.com'
    jest.spyOn(GitHubClientServiceFactory, 'fetchVersion').mockResolvedValueOnce('3.13')

    expect(await GitHubClientServiceFactory.getGitHubClientServiceInstance()).toBeInstanceOf(GithubClientServiceV1)
  })
})
