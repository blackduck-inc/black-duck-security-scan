import {checkJobResult, cleanUrl, clearHttpClientCache, createSSLConfiguredHttpClient, isBoolean, isPullRequestEvent} from '../../../src/blackduck-security-action/utility'
import * as constants from '../../../src/application-constants'

test('cleanUrl() trailing slash', () => {
  const validUrl = 'https://my-domain.com'
  const testUrl = `${validUrl}/`
  const response = cleanUrl(testUrl)
  expect(response).toBe(validUrl)
})

test('cleanUrl() no trailing slash', () => {
  const testUrl = 'https://my-domain.com'
  const response = cleanUrl(testUrl)
  expect(response).toBe(testUrl)
})

describe('isBoolean', () => {
  it('should return true with string value as true', function () {
    const result = isBoolean('true')
    expect(result).toEqual(true)
  })

  it('should return true with boolean input as true', function () {
    const result = isBoolean(true)
    expect(result).toEqual(true)
  })

  it('should return true with string value as FALSE', function () {
    const result = isBoolean('FALSE')
    expect(result).toEqual(true)
  })

  it('should return true with boolean input as false', function () {
    const result = isBoolean(false)
    expect(result).toEqual(true)
  })

  it('should return false with any random string value', function () {
    const result = isBoolean('test')
    expect(result).toEqual(false)
  })
})

describe('isPullRequestEvent', () => {
  let originalEventName: string

  beforeEach(() => {
    originalEventName = process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_EVENT_NAME] || ''
  })

  afterEach(() => {
    process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_EVENT_NAME] = originalEventName
  })

  it('should return true if event name is pull_request', () => {
    process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_EVENT_NAME] = 'pull_request'
    const result = isPullRequestEvent()
    expect(result).toEqual(true)
  })

  it('should return false if event name is not pull_request', () => {
    process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_EVENT_NAME] = 'push'
    const result = isPullRequestEvent()
    expect(result).toEqual(false)
  })

  it('should return false if event name is undefined', () => {
    process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_EVENT_NAME] = undefined
    const result = isPullRequestEvent()
    expect(result).toEqual(false)
  })
})

describe('checkJobResult', () => {
  it('should return the build status if it is valid', () => {
    const buildStatus = 'success'
    const result = checkJobResult(buildStatus)
    expect(result).toBe(buildStatus)
  })

  it('should return undefined if the build status is invalid', () => {
    const buildStatus = 'unstable'
    const result = checkJobResult(buildStatus)
    expect(result).toBeUndefined()
  })

  it('should return undefined if the build status is not provided', () => {
    const result = checkJobResult()
    expect(result).toBeUndefined()
  })
})

describe('SSL HTTP Client Functions', () => {
  let originalTrustAll: string | undefined
  let originalCertFile: string | undefined

  beforeEach(() => {
    originalTrustAll = process.env.NETWORK_SSL_TRUST_ALL
    originalCertFile = process.env.NETWORK_SSL_CERT_FILE
    clearHttpClientCache()
  })

  afterEach(() => {
    if (originalTrustAll !== undefined) {
      process.env.NETWORK_SSL_TRUST_ALL = originalTrustAll
    } else {
      delete process.env.NETWORK_SSL_TRUST_ALL
    }
    if (originalCertFile !== undefined) {
      process.env.NETWORK_SSL_CERT_FILE = originalCertFile
    } else {
      delete process.env.NETWORK_SSL_CERT_FILE
    }
    clearHttpClientCache()
  })

  describe('createSSLConfiguredHttpClient', () => {
    it('should create new HttpClient instance with default user agent', () => {
      const client1 = createSSLConfiguredHttpClient()
      expect(client1).toBeDefined()
    })

    it('should create new HttpClient instance with custom user agent', () => {
      const customUserAgent = 'TestAgent'
      const client = createSSLConfiguredHttpClient(customUserAgent)
      expect(client).toBeDefined()
    })

    it('should reuse cached HttpClient instance when SSL config unchanged', () => {
      const client1 = createSSLConfiguredHttpClient()
      const client2 = createSSLConfiguredHttpClient()
      expect(client1).toBe(client2)
    })

    it('should create new HttpClient instance when SSL config changes', () => {
      const client1 = createSSLConfiguredHttpClient()
      process.env.NETWORK_SSL_TRUST_ALL = 'true'
      clearHttpClientCache()
      const client2 = createSSLConfiguredHttpClient()
      expect(client1).not.toBe(client2)
    })

    it('should handle NETWORK_SSL_TRUST_ALL=true configuration', () => {
      process.env.NETWORK_SSL_TRUST_ALL = 'true'
      const client = createSSLConfiguredHttpClient()
      expect(client).toBeDefined()
    })

    it('should handle custom CA certificate file configuration', () => {
      process.env.NETWORK_SSL_CERT_FILE = '/path/to/cert.pem'
      const client = createSSLConfiguredHttpClient()
      expect(client).toBeDefined()
    })
  })

  describe('clearHttpClientCache', () => {
    it('should clear cached HttpClient instance', () => {
      const client1 = createSSLConfiguredHttpClient()
      clearHttpClientCache()
      const client2 = createSSLConfiguredHttpClient()
      expect(client1).not.toBe(client2)
    })

    it('should allow recreation of HttpClient with different SSL config after cache clear', () => {
      const client1 = createSSLConfiguredHttpClient()
      clearHttpClientCache()
      process.env.NETWORK_SSL_TRUST_ALL = 'true'
      const client2 = createSSLConfiguredHttpClient()
      expect(client1).not.toBe(client2)
    })
  })
})
