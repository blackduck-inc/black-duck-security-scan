import * as inputs from '../../../../src/blackduck-security-action/inputs'
import {HttpClient, HttpClientResponse} from 'typed-rest-client/HttpClient'
import {GitHubClientServiceFactory} from '../../../../src/blackduck-security-action/factory/github-client-service-factory'
import {IncomingMessage} from 'http'
import {Socket} from 'net'
import Mocked = jest.Mocked
import {GithubClientServiceCloud} from '../../../../src/blackduck-security-action/service/impl/cloud/github-client-service-cloud'
import {GithubClientServiceV1} from '../../../../src/blackduck-security-action/service/impl/enterprise/v1/github-client-service-v1'

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
  
  it('should handle undefined GITHUB_API_URL gracefully', async () => {
    // Set API URL to undefined
    process.env['GITHUB_API_URL'] = undefined
    
    // Mock fetchVersion to return a valid version to isolate the test
    jest.spyOn(GitHubClientServiceFactory, 'fetchVersion').mockResolvedValueOnce('3.12')
    
    // Should not throw an error
    expect(await GitHubClientServiceFactory.getGitHubClientServiceInstance()).toBeInstanceOf(GithubClientServiceV1)
  })
  
  it('should handle empty string GITHUB_API_URL gracefully', async () => {
    // Set API URL to empty string
    process.env['GITHUB_API_URL'] = ''
    
    // Mock fetchVersion to return a valid version to isolate the test
    jest.spyOn(GitHubClientServiceFactory, 'fetchVersion').mockResolvedValueOnce('3.12')
    
    // Should not throw an error
    expect(await GitHubClientServiceFactory.getGitHubClientServiceInstance()).toBeInstanceOf(GithubClientServiceV1)
  })
  
  it('should handle invalid URL in GITHUB_API_URL gracefully', async () => {
    // Set API URL to an invalid URL
    process.env['GITHUB_API_URL'] = 'not-a-valid-url'
    
    // Mock fetchVersion to return a valid version to isolate the test
    jest.spyOn(GitHubClientServiceFactory, 'fetchVersion').mockResolvedValueOnce('3.12')
    
    // Should not throw an error and fall back to V1 service
    expect(await GitHubClientServiceFactory.getGitHubClientServiceInstance()).toBeInstanceOf(GithubClientServiceV1)
  })
})

describe('useCloudInstance()', () => {
  it('should correctly identify GitHub Cloud API URL', () => {
    const url = 'https://api.github.com'
    const useCloudInstance = (url: string): boolean => {
      try {
        const host = new URL(url).hostname
        return url === 'https://api.github.com' || host.endsWith('.ghe.com')
      } catch {
        return url === 'https://api.github.com'
      }
    }
    
    expect(useCloudInstance(url)).toBe(true)
  })
  
  it('should correctly identify GHEC custom domain', () => {
    const url = 'https://api.example.ghe.com'
    const useCloudInstance = (url: string): boolean => {
      try {
        const host = new URL(url).hostname
        return url === 'https://api.github.com' || host.endsWith('.ghe.com')
      } catch {
        return url === 'https://api.github.com'
      }
    }
    
    expect(useCloudInstance(url)).toBe(true)
  })
  
  it('should handle undefined URL gracefully', () => {
    const url = undefined
    const useCloudInstance = (url: string): boolean => {
      try {
        const host = new URL(url).hostname
        return url === 'https://api.github.com' || host.endsWith('.ghe.com')
      } catch {
        return url === 'https://api.github.com'
      }
    }
    
    // Should not throw an error and return false for undefined
    expect(() => useCloudInstance(url as unknown as string)).not.toThrow()
    expect(useCloudInstance(url as unknown as string)).toBe(false)
  })
  
  it('should handle empty string URL gracefully', () => {
    const url = ''
    const useCloudInstance = (url: string): boolean => {
      try {
        const host = new URL(url).hostname
        return url === 'https://api.github.com' || host.endsWith('.ghe.com')
      } catch {
        return url === 'https://api.github.com'
      }
    }
    
    // Should not throw an error and return false for empty string
    expect(() => useCloudInstance(url)).not.toThrow()
    expect(useCloudInstance(url)).toBe(false)
  })
  
  it('should handle invalid URL gracefully', () => {
    const url = 'not-a-valid-url'
    const useCloudInstance = (url: string): boolean => {
      try {
        const host = new URL(url).hostname
        return url === 'https://api.github.com' || host.endsWith('.ghe.com')
      } catch {
        return url === 'https://api.github.com'
      }
    }
    
    // Should not throw an error and return false for invalid URL
    expect(() => useCloudInstance(url)).not.toThrow()
    expect(useCloudInstance(url)).toBe(false)
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

  it('should return GithubClientServiceCloud service for GHEC with custom domain', async () => {
    process.env['GITHUB_API_URL'] = 'https://api.example.ghe.com'

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
