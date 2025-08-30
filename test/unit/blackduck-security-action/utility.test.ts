import {checkJobResult, cleanUrl, clearHttpClientCache, createSSLConfiguredHttpClient, isBoolean, isPullRequestEvent, updatePolarisSarifPath} from '../../../src/blackduck-security-action/utility'
import * as constants from '../../../src/application-constants'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

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

describe('updatePolarisSarifPath', () => {
  let tempDir: string
  let tempFilePath: string

  beforeEach(() => {
    // Create a temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'polaris-test-'))
    tempFilePath = path.join(tempDir, 'polaris_input.json')
  })

  afterEach(() => {
    // Clean up temporary files
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, {recursive: true, force: true})
    }
  })

  describe('when SARIF configuration already exists', () => {
    it('should update existing SARIF file path', () => {
      // Arrange
      const initialConfig = {
        data: {
          polaris: {
            reports: {
              sarif: {
                file: {
                  path: '/old/path/to/sarif.json'
                }
              }
            }
          }
        }
      }
      const newSarifPath = '/new/path/to/sarif.json'

      fs.writeFileSync(tempFilePath, JSON.stringify(initialConfig, null, 2))

      // Act
      updatePolarisSarifPath(tempFilePath, newSarifPath)

      // Assert
      const updatedContent = fs.readFileSync(tempFilePath, 'utf-8')
      const updatedConfig = JSON.parse(updatedContent)
      expect(updatedConfig.data.polaris.reports.sarif.file.path).toBe(newSarifPath)
    })

    it('should preserve other configuration properties when updating SARIF path', () => {
      // Arrange
      const initialConfig = {
        data: {
          polaris: {
            accesstoken: 'test-token',
            serverUrl: 'https://test.polaris.com',
            application: {name: 'test-app'},
            project: {name: 'test-project'},
            reports: {
              sarif: {
                create: true,
                file: {
                  path: '/old/path/to/sarif.json'
                },
                severities: ['high', 'medium']
              }
            }
          }
        }
      }
      const newSarifPath = '/new/path/to/sarif.json'

      fs.writeFileSync(tempFilePath, JSON.stringify(initialConfig, null, 2))

      // Act
      updatePolarisSarifPath(tempFilePath, newSarifPath)

      // Assert
      const updatedContent = fs.readFileSync(tempFilePath, 'utf-8')
      const updatedConfig = JSON.parse(updatedContent)
      expect(updatedConfig.data.polaris.reports.sarif.file.path).toBe(newSarifPath)
      expect(updatedConfig.data.polaris.reports.sarif.create).toBe(true)
      expect(updatedConfig.data.polaris.reports.sarif.severities).toEqual(['high', 'medium'])
      expect(updatedConfig.data.polaris.accesstoken).toBe('test-token')
      expect(updatedConfig.data.polaris.serverUrl).toBe('https://test.polaris.com')
    })
  })

  describe('when SARIF configuration does not exist', () => {
    it('should create complete SARIF structure and set path when config has no polaris data', () => {
      // Arrange
      const initialConfig = {
        data: {}
      }
      const newSarifPath = '/new/path/to/sarif.json'

      fs.writeFileSync(tempFilePath, JSON.stringify(initialConfig, null, 2))

      // Act
      updatePolarisSarifPath(tempFilePath, newSarifPath)

      // Assert
      const updatedContent = fs.readFileSync(tempFilePath, 'utf-8')
      const updatedConfig = JSON.parse(updatedContent)
      expect(updatedConfig.data.polaris.reports.sarif.file.path).toBe(newSarifPath)
    })

    it('should create SARIF structure when polaris exists but no reports', () => {
      // Arrange
      const initialConfig = {
        data: {
          polaris: {
            accesstoken: 'test-token',
            serverUrl: 'https://test.polaris.com'
          }
        }
      }
      const newSarifPath = '/new/path/to/sarif.json'

      fs.writeFileSync(tempFilePath, JSON.stringify(initialConfig, null, 2))

      // Act
      updatePolarisSarifPath(tempFilePath, newSarifPath)

      // Assert
      const updatedContent = fs.readFileSync(tempFilePath, 'utf-8')
      const updatedConfig = JSON.parse(updatedContent)
      expect(updatedConfig.data.polaris.reports.sarif.file.path).toBe(newSarifPath)
      expect(updatedConfig.data.polaris.accesstoken).toBe('test-token')
    })

    it('should create SARIF file structure when reports exist but no sarif', () => {
      // Arrange
      const initialConfig = {
        data: {
          polaris: {
            accesstoken: 'test-token',
            reports: {
              someOtherReport: {
                enabled: true
              }
            }
          }
        }
      }
      const newSarifPath = '/new/path/to/sarif.json'

      fs.writeFileSync(tempFilePath, JSON.stringify(initialConfig, null, 2))

      // Act
      updatePolarisSarifPath(tempFilePath, newSarifPath)

      // Assert
      const updatedContent = fs.readFileSync(tempFilePath, 'utf-8')
      const updatedConfig = JSON.parse(updatedContent)
      expect(updatedConfig.data.polaris.reports.sarif.file.path).toBe(newSarifPath)
      expect(updatedConfig.data.polaris.reports.someOtherReport.enabled).toBe(true)
    })

    it('should create file structure when sarif exists but no file', () => {
      // Arrange
      const initialConfig = {
        data: {
          polaris: {
            reports: {
              sarif: {
                create: true,
                severities: ['high']
              }
            }
          }
        }
      }
      const newSarifPath = '/new/path/to/sarif.json'

      fs.writeFileSync(tempFilePath, JSON.stringify(initialConfig, null, 2))

      // Act
      updatePolarisSarifPath(tempFilePath, newSarifPath)

      // Assert
      const updatedContent = fs.readFileSync(tempFilePath, 'utf-8')
      const updatedConfig = JSON.parse(updatedContent)
      expect(updatedConfig.data.polaris.reports.sarif.file.path).toBe(newSarifPath)
      expect(updatedConfig.data.polaris.reports.sarif.create).toBe(true)
      expect(updatedConfig.data.polaris.reports.sarif.severities).toEqual(['high'])
    })
  })

  describe('error handling', () => {
    it('should handle invalid JSON gracefully', () => {
      // Arrange
      const invalidJson = '{ invalid json content'
      fs.writeFileSync(tempFilePath, invalidJson)

      // Act & Assert - should not throw
      expect(() => {
        updatePolarisSarifPath(tempFilePath, '/new/path/sarif.json')
      }).not.toThrow()
    })

    it('should handle non-existent file gracefully', () => {
      // Arrange
      const nonExistentPath = path.join(tempDir, 'non-existent.json')

      // Act & Assert - should not throw
      expect(() => {
        updatePolarisSarifPath(nonExistentPath, '/new/path/sarif.json')
      }).not.toThrow()
    })

    it('should handle null/undefined data gracefully', () => {
      // Arrange
      const configWithNullData = {
        data: null
      }
      fs.writeFileSync(tempFilePath, JSON.stringify(configWithNullData, null, 2))

      // Act & Assert - should not throw
      expect(() => {
        updatePolarisSarifPath(tempFilePath, '/new/path/sarif.json')
      }).not.toThrow()
    })
  })

  describe('file formatting', () => {
    it('should maintain proper JSON formatting with 2-space indentation', () => {
      // Arrange
      const initialConfig = {
        data: {
          polaris: {
            accesstoken: 'test-token',
            reports: {
              sarif: {
                file: {
                  path: '/old/path/sarif.json'
                }
              }
            }
          }
        }
      }
      fs.writeFileSync(tempFilePath, JSON.stringify(initialConfig))

      // Act
      updatePolarisSarifPath(tempFilePath, '/new/path/sarif.json')

      // Assert
      const updatedContent = fs.readFileSync(tempFilePath, 'utf-8')
      const lines = updatedContent.split('\n')

      // Check that the JSON is properly formatted with 2-space indentation
      expect(lines[0]).toBe('{')
      expect(lines[1]).toBe('  "data": {')
      expect(lines[2]).toBe('    "polaris": {')
    })
  })

  describe('path validation', () => {
    it('should handle empty string as SARIF path', () => {
      // Arrange
      const initialConfig = {
        data: {
          polaris: {
            reports: {
              sarif: {
                file: {
                  path: '/old/path/sarif.json'
                }
              }
            }
          }
        }
      }
      fs.writeFileSync(tempFilePath, JSON.stringify(initialConfig, null, 2))

      // Act
      updatePolarisSarifPath(tempFilePath, '')

      // Assert
      const updatedContent = fs.readFileSync(tempFilePath, 'utf-8')
      const updatedConfig = JSON.parse(updatedContent)
      expect(updatedConfig.data.polaris.reports.sarif.file.path).toBe('')
    })

    it('should handle special characters in SARIF path', () => {
      // Arrange
      const initialConfig = {
        data: {
          polaris: {
            reports: {
              sarif: {
                file: {
                  path: '/old/path/sarif.json'
                }
              }
            }
          }
        }
      }
      const specialPath = '/path/with spaces/and-special_chars@123/sarif.json'
      fs.writeFileSync(tempFilePath, JSON.stringify(initialConfig, null, 2))

      // Act
      updatePolarisSarifPath(tempFilePath, specialPath)

      // Assert
      const updatedContent = fs.readFileSync(tempFilePath, 'utf-8')
      const updatedConfig = JSON.parse(updatedContent)
      expect(updatedConfig.data.polaris.reports.sarif.file.path).toBe(specialPath)
    })
  })
})
