import {
  checkJobResult,
  cleanUrl,
  clearHttpClientCache,
  createSSLConfiguredHttpClient,
  isBoolean,
  isPullRequestEvent,
  parseToBoolean,
  extractInputJsonFilename,
  getSharedHttpClient,
  sleep,
  createTempDir,
  cleanupTempDir,
  checkIfPathExists
} from '../../../src/blackduck-security-action/utility'
import * as constants from '../../../src/application-constants'
import * as fs from 'fs'
import * as path from 'path'

// Mock filesystem operations and @actions/io
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  mkdtempSync: jest.fn(),
  existsSync: jest.fn()
}))

jest.mock('@actions/io', () => ({
  rmRF: jest.fn()
}))

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

describe('parseToBoolean', () => {
  test.each([
    ['true', true],
    ['TRUE', true],
    ['True', true],
    ['false', false],
    ['FALSE', false],
    ['False', false],
    ['', false],
    ['invalid', false],
    ['0', false],
    ['1', false]
  ])('parseToBoolean(%s) should return %s', (input, expected) => {
    expect(parseToBoolean(input)).toBe(expected)
  })
})

describe('extractInputJsonFilename', () => {
  test('should extract input filename from bridge command', () => {
    const command = 'bridge-cli --stage blackduck --input /path/to/input.json --other-args'
    const result = extractInputJsonFilename(command)
    expect(result).toBe('/path/to/input.json')
  })

  test('should return empty string when no input parameter found', () => {
    const command = 'bridge-cli --stage blackduck --other-args'
    const result = extractInputJsonFilename(command)
    expect(result).toBe('')
  })

  test('should handle input parameter at the end', () => {
    const command = 'bridge-cli --stage blackduck --input /final/input.json'
    const result = extractInputJsonFilename(command)
    expect(result).toBe('/final/input.json')
  })

  test('should handle Windows-style paths', () => {
    const command = 'bridge-cli --stage blackduck --input C:\\temp\\input.json'
    const result = extractInputJsonFilename(command)
    expect(result).toBe('C:\\temp\\input.json')
  })
})

describe('getSharedHttpClient', () => {
  test('should return a shared HTTP client instance', () => {
    const client1 = getSharedHttpClient()
    const client2 = getSharedHttpClient()
    expect(client1).toBe(client2)
    expect(client1).toBeDefined()
  })

  test('should return different instances after cache clear', () => {
    const client1 = getSharedHttpClient()
    clearHttpClientCache()
    const client2 = getSharedHttpClient()
    expect(client1).not.toBe(client2)
  })
})

describe('sleep', () => {
  test('should resolve after specified milliseconds', async () => {
    const startTime = Date.now()
    await sleep(50)
    const endTime = Date.now()
    const elapsed = endTime - startTime
    // Allow some tolerance for timer precision
    expect(elapsed).toBeGreaterThanOrEqual(40)
    expect(elapsed).toBeLessThan(100)
  })

})

import {rmRF} from '@actions/io'

describe('File System Operations', () => {
  const mockExistsSync = jest.mocked(fs.existsSync)
  const mockMkdtempSync = jest.mocked(fs.mkdtempSync)
  const mockRmRF = jest.mocked(rmRF)

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('checkIfPathExists', () => {
    test('should return true when path exists', () => {
      mockExistsSync.mockReturnValue(true)
      const result = checkIfPathExists('/existing/path')
      expect(result).toBe(true)
      expect(mockExistsSync).toHaveBeenCalledWith('/existing/path')
    })

    test('should return false when path does not exist', () => {
      mockExistsSync.mockReturnValue(false)
      const result = checkIfPathExists('/non-existing/path')
      expect(result).toBe(false)
      expect(mockExistsSync).toHaveBeenCalledWith('/non-existing/path')
    })

    test('should throw exception when fs.existsSync throws', () => {
      mockExistsSync.mockImplementation(() => {
        throw new Error('Permission denied')
      })

      expect(() => checkIfPathExists('/protected/path')).toThrow('Permission denied')
    })
  })

  describe('createTempDir', () => {
    test('should create temporary directory successfully', async () => {
      const expectedPath = '/var/folders/test/blackduck-security-actionABC123'
      mockMkdtempSync.mockReturnValue(expectedPath)

      const result = await createTempDir()

      // Match pattern that works on both Linux/macOS (/tmp) and macOS (/var/folders)
      expect(result).toMatch(/blackduck-security-action/)
      expect(mockMkdtempSync).toHaveBeenCalledWith(expect.stringContaining('blackduck-security-action'))
    })

    test('should handle directory creation errors', async () => {
      mockMkdtempSync.mockImplementation(() => {
        throw new Error('Permission denied')
      })

      await expect(createTempDir()).rejects.toThrow('Permission denied')
    })
  })

  describe('cleanupTempDir', () => {
    test('should clean up temporary directory successfully', async () => {
      mockExistsSync.mockReturnValue(true)
      mockRmRF.mockResolvedValue()

      const tempDir = '/tmp/test-dir'
      await cleanupTempDir(tempDir)

      expect(mockRmRF).toHaveBeenCalledWith(tempDir)
    })

    test('should not attempt cleanup if directory does not exist', async () => {
      mockExistsSync.mockReturnValue(false)
      mockRmRF.mockResolvedValue()

      const tempDir = '/tmp/non-existing-dir'
      await cleanupTempDir(tempDir)

      expect(mockRmRF).not.toHaveBeenCalled()
    })

    test('should propagate cleanup errors', async () => {
      mockExistsSync.mockReturnValue(true)
      mockRmRF.mockRejectedValue(new Error('Permission denied'))

      const tempDir = '/tmp/test-dir'
      // The function does not handle errors, so they should be propagated
      await expect(cleanupTempDir(tempDir)).rejects.toThrow('Permission denied')
    })
  })
})

describe('URL and String Utilities', () => {
  describe('cleanUrl edge cases', () => {
    test('should handle multiple trailing slashes', () => {
      // The cleanUrl function only removes a single trailing slash, not multiple
      expect(cleanUrl('https://example.com///')).toBe('https://example.com//')
    })

    test('should handle empty string', () => {
      expect(cleanUrl('')).toBe('')
    })

    test('should handle URL with query parameters', () => {
      expect(cleanUrl('https://example.com/path?param=value/')).toBe('https://example.com/path?param=value')
    })

    test('should handle URL with fragment', () => {
      expect(cleanUrl('https://example.com/path#fragment/')).toBe('https://example.com/path#fragment')
    })
  })

  describe('isBoolean edge cases', () => {
    test('should handle null and undefined', () => {
      // The function checks `value !== null` first, so null should short-circuit to false
      expect(isBoolean(null as any)).toBe(false)
      // undefined !== null is true, so it continues to toString() which would throw
      expect(() => isBoolean(undefined as any)).toThrow()
    })

    test('should handle numbers', () => {
      expect(isBoolean(0 as any)).toBe(false)
      expect(isBoolean(1 as any)).toBe(false)
    })

    test('should handle objects', () => {
      expect(isBoolean({} as any)).toBe(false)
      expect(isBoolean([] as any)).toBe(false)
    })
  })
})
