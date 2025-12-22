import {checkJobResult, cleanUrl, isBoolean, isPullRequestEvent, isGitHubCloud, createSSLConfiguredHttpClient, clearHttpClientCache, updateCoverityConfigForBridgeVersion, isVersionLess, isVersionGreaterOrEqual} from '../../../src/blackduck-security-action/utility'
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

describe('isGitHubCloud', () => {
  let originalServerUrl: string

  beforeEach(() => {
    originalServerUrl = process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_SERVER_URL] || ''
  })

  afterEach(() => {
    process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_SERVER_URL] = originalServerUrl
  })

  it('should return true if server URL is GitHub Cloud URL', () => {
    process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_SERVER_URL] = constants.GITHUB_CLOUD_URL
    const result = isGitHubCloud()
    expect(result).toEqual(true)
  })

  it('should return true if server URL is a GHEC domain with data residency (*.ghe.com)', () => {
    process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_SERVER_URL] = 'https://example.ghe.com'
    const result = isGitHubCloud()
    expect(result).toEqual(true)
  })

  it('should return false if server URL is a GitHub Enterprise Server URL', () => {
    process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_SERVER_URL] = 'https://github.example.com'
    const result = isGitHubCloud()
    expect(result).toEqual(false)
  })

  it('should return false if server URL is undefined', () => {
    process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_SERVER_URL] = undefined
    const result = isGitHubCloud()
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

  describe('updateCoverityConfigForBridgeVersion', () => {
    test('should convert new format to legacy for Bridge CLI < 3.9.0', () => {
      const tempFile = '/tmp/test_coverity_input.json'
      const testData = {
        data: {
          coverity: {
            prcomment: {
              enabled: true,
              impacts: ['HIGH', 'MEDIUM']
            }
          }
        }
      }

      // Write test data to temporary file
      require('fs').writeFileSync(tempFile, JSON.stringify(testData, null, 2))

      // Call the function with version < 3.9.0
      updateCoverityConfigForBridgeVersion('coverity_input.json', '3.8.0', tempFile)

      // Read the updated file
      const updatedData = JSON.parse(require('fs').readFileSync(tempFile, 'utf-8'))

      // Verify conversion to legacy format
      expect(updatedData.data.coverity.automation).toEqual({prcomment: true})
      expect(updatedData.data.coverity.prcomment).toBeUndefined()

      // Cleanup
      require('fs').unlinkSync(tempFile)
    })

    test('should preserve new format for Bridge CLI >= 3.9.0', () => {
      const tempFile = '/tmp/test_coverity_input2.json'
      const testData = {
        data: {
          coverity: {
            prcomment: {
              enabled: true,
              impacts: ['HIGH', 'MEDIUM']
            }
          }
        }
      }

      // Write test data to temporary file
      require('fs').writeFileSync(tempFile, JSON.stringify(testData, null, 2))

      // Call the function with version >= 3.9.0
      updateCoverityConfigForBridgeVersion('coverity_input.json', '3.9.0', tempFile)

      // Read the file (should be unchanged)
      const updatedData = JSON.parse(require('fs').readFileSync(tempFile, 'utf-8'))

      // Verify new format is preserved
      expect(updatedData.data.coverity.prcomment).toEqual({
        enabled: true,
        impacts: ['HIGH', 'MEDIUM']
      })
      expect(updatedData.data.coverity.automation).toBeUndefined()

      // Cleanup
      require('fs').unlinkSync(tempFile)
    })
  })
})

describe('Version Comparison Helper Functions', () => {
  describe('isVersionLess', () => {
    test('should return true when first version is less than second version (normal versions)', () => {
      expect(isVersionLess('3.8.0', '3.9.0')).toBe(true)
    })

    test('should return false when first version is greater than second version (normal versions)', () => {
      expect(isVersionLess('3.9.0', '3.8.0')).toBe(false)
    })

    test('should return false when both versions are equal (normal versions)', () => {
      expect(isVersionLess('3.9.0', '3.9.0')).toBe(false)
    })

    test('should return true when first version is less than second version (RC versions)', () => {
      expect(isVersionLess('3.9.2rc2', '3.9.3')).toBe(true)
    })

    test('should return false when first version is greater than second version (RC versions)', () => {
      expect(isVersionLess('3.9.3', '3.9.2rc2')).toBe(false)
    })

    test('should handle RC version vs normal version comparison correctly (coerce strips pre-release)', () => {
      // coerce('3.9.0rc1') -> '3.9.0', so 3.9.0 < 3.9.0 = false
      expect(isVersionLess('3.9.0rc1', '3.9.0')).toBe(false)
    })

    test('should handle comparison between two RC versions (coerce strips pre-release)', () => {
      // coerce('3.9.0rc1') -> '3.9.0', coerce('3.9.0rc2') -> '3.9.0', so 3.9.0 < 3.9.0 = false
      expect(isVersionLess('3.9.0rc1', '3.9.0rc2')).toBe(false)
    })

    test('should return false when versions cannot be coerced', () => {
      expect(isVersionLess('invalid', '3.9.0')).toBe(false)
      expect(isVersionLess('3.9.0', 'invalid')).toBe(false)
    })
  })

  describe('isVersionGreaterOrEqual', () => {
    test('should return true when first version is greater than second version (normal versions)', () => {
      expect(isVersionGreaterOrEqual('3.9.0', '3.8.0')).toBe(true)
    })

    test('should return false when first version is less than second version (normal versions)', () => {
      expect(isVersionGreaterOrEqual('3.8.0', '3.9.0')).toBe(false)
    })

    test('should return true when both versions are equal (normal versions)', () => {
      expect(isVersionGreaterOrEqual('3.9.0', '3.9.0')).toBe(true)
    })

    test('should return true when first version is greater than second version (RC versions)', () => {
      expect(isVersionGreaterOrEqual('3.9.3', '3.9.2rc2')).toBe(true)
    })

    test('should return false when first version is less than second version (RC versions)', () => {
      expect(isVersionGreaterOrEqual('3.9.2rc2', '3.9.3')).toBe(false)
    })

    test('should handle RC version vs normal version comparison correctly (coerce strips pre-release)', () => {
      // coerce('3.9.0rc1') -> '3.9.0', so 3.9.0 >= 3.9.0 = true
      expect(isVersionGreaterOrEqual('3.9.0', '3.9.0rc1')).toBe(true)
    })

    test('should handle comparison between two RC versions (coerce strips pre-release)', () => {
      // coerce('3.9.0rc1') -> '3.9.0', coerce('3.9.0rc2') -> '3.9.0', so 3.9.0 >= 3.9.0 = true
      expect(isVersionGreaterOrEqual('3.9.0rc2', '3.9.0rc1')).toBe(true)
    })

    test('should return false when versions cannot be coerced', () => {
      expect(isVersionGreaterOrEqual('invalid', '3.9.0')).toBe(false)
      expect(isVersionGreaterOrEqual('3.9.0', 'invalid')).toBe(false)
    })
  })
})
