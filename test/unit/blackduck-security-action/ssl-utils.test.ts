describe('SSL Utils Unit Tests', () => {
  let sslUtils: any
  let mockInputs: any
  let mockFs: any
  let mockTls: any
  let mockCore: any

  beforeEach(() => {
    jest.resetModules()

    // Create fresh mocks for each test
    mockInputs = {
      NETWORK_SSL_TRUST_ALL: false,
      NETWORK_SSL_CERT_FILE: ''
    }

    mockFs = {
      readFileSync: jest.fn()
    }

    mockTls = {
      rootCertificates: ['system-ca-1', 'system-ca-2']
    }

    mockCore = {
      debug: jest.fn(),
      warning: jest.fn()
    }

    // Mock modules
    jest.doMock('fs', () => mockFs)
    jest.doMock('tls', () => mockTls)
    jest.doMock('@actions/core', () => mockCore)
    jest.doMock('../../../src/blackduck-security-action/inputs', () => mockInputs)

    // Import after mocking
    sslUtils = require('../../../src/blackduck-security-action/ssl-utils')
  })

  describe('getSSLConfig', () => {
    test('should return trustAllCerts=true when NETWORK_SSL_TRUST_ALL is true', () => {
      mockInputs.NETWORK_SSL_TRUST_ALL = true

      const result = sslUtils.getSSLConfig()

      expect(result).toEqual({trustAllCerts: true})
      expect(mockCore.debug).toHaveBeenCalledWith('SSL certificate verification disabled (NETWORK_SSL_TRUST_ALL=true)')
    })

    test('should return trustAllCerts=true when NETWORK_SSL_TRUST_ALL is "true" string', () => {
      mockInputs.NETWORK_SSL_TRUST_ALL = 'true'

      const result = sslUtils.getSSLConfig()

      expect(result).toEqual({trustAllCerts: true})
    })

    test('should return trustAllCerts=true when NETWORK_SSL_TRUST_ALL is "TRUE" string', () => {
      mockInputs.NETWORK_SSL_TRUST_ALL = 'TRUE'

      const result = sslUtils.getSSLConfig()

      expect(result).toEqual({trustAllCerts: true})
    })

    test('should return trustAllCerts=false when NETWORK_SSL_TRUST_ALL is false', () => {
      mockInputs.NETWORK_SSL_TRUST_ALL = false

      const result = sslUtils.getSSLConfig()

      expect(result).toEqual({trustAllCerts: false})
    })

    test('should return trustAllCerts=false when NETWORK_SSL_TRUST_ALL is "false" string', () => {
      mockInputs.NETWORK_SSL_TRUST_ALL = 'false'

      const result = sslUtils.getSSLConfig()

      expect(result).toEqual({trustAllCerts: false})
    })

    test('should return trustAllCerts=false when NETWORK_SSL_TRUST_ALL is empty string', () => {
      mockInputs.NETWORK_SSL_TRUST_ALL = ''

      const result = sslUtils.getSSLConfig()

      expect(result).toEqual({trustAllCerts: false})
    })

    test('should return trustAllCerts=false when NETWORK_SSL_TRUST_ALL is null', () => {
      mockInputs.NETWORK_SSL_TRUST_ALL = null

      const result = sslUtils.getSSLConfig()

      expect(result).toEqual({trustAllCerts: false})
    })

    test('should load custom CA certificate when NETWORK_SSL_CERT_FILE is provided', () => {
      mockInputs.NETWORK_SSL_CERT_FILE = '/path/to/cert.pem'
      const mockCertContent = '-----BEGIN CERTIFICATE-----\ntest-cert\n-----END CERTIFICATE-----'
      mockFs.readFileSync.mockReturnValue(mockCertContent)

      const result = sslUtils.getSSLConfig()

      expect(mockFs.readFileSync).toHaveBeenCalledWith('/path/to/cert.pem', 'utf8')
      expect(result).toEqual({
        trustAllCerts: false,
        customCA: mockCertContent,
        combinedCAs: [mockCertContent, 'system-ca-1', 'system-ca-2']
      })
      expect(mockCore.debug).toHaveBeenCalledWith('Custom CA certificate loaded successfully')
      expect(mockCore.debug).toHaveBeenCalledWith('Using custom CA certificate with 2 system CAs for SSL verification')
    })

    test('should handle file read error and return default config', () => {
      mockInputs.NETWORK_SSL_CERT_FILE = '/path/to/nonexistent.pem'
      const mockError = new Error('File not found')
      mockFs.readFileSync.mockImplementation(() => {
        throw mockError
      })

      const result = sslUtils.getSSLConfig()

      expect(mockFs.readFileSync).toHaveBeenCalledWith('/path/to/nonexistent.pem', 'utf8')
      expect(result).toEqual({trustAllCerts: false})
      expect(mockCore.warning).toHaveBeenCalledWith(`Failed to read custom CA certificate file: ${mockError}`)
    })

    test('should handle empty rootCertificates array', () => {
      mockInputs.NETWORK_SSL_CERT_FILE = '/path/to/cert.pem'
      const mockCertContent = '-----BEGIN CERTIFICATE-----\ntest-cert\n-----END CERTIFICATE-----'
      mockFs.readFileSync.mockReturnValue(mockCertContent)
      mockTls.rootCertificates = []

      const result = sslUtils.getSSLConfig()

      expect(result).toEqual({
        trustAllCerts: false,
        customCA: mockCertContent,
        combinedCAs: [mockCertContent]
      })
      expect(mockCore.debug).toHaveBeenCalledWith('Using custom CA certificate with 0 system CAs for SSL verification')
    })

    test('should handle undefined rootCertificates', () => {
      mockInputs.NETWORK_SSL_CERT_FILE = '/path/to/cert.pem'
      const mockCertContent = '-----BEGIN CERTIFICATE-----\ntest-cert\n-----END CERTIFICATE-----'
      mockFs.readFileSync.mockReturnValue(mockCertContent)
      mockTls.rootCertificates = undefined

      const result = sslUtils.getSSLConfig()

      expect(result).toEqual({
        trustAllCerts: false,
        customCA: mockCertContent,
        combinedCAs: [mockCertContent]
      })
    })
  })

  describe('createHTTPSAgent', () => {
    test('should create agent with rejectUnauthorized=false when trustAllCerts is true', () => {
      const sslConfig = {trustAllCerts: true}

      const result = sslUtils.createHTTPSAgent(sslConfig)

      expect(result).toBeDefined()
      expect(mockCore.debug).toHaveBeenCalledWith('Creating HTTPS agent with SSL verification disabled')
    })

    test('should create agent with combinedCAs when provided', () => {
      const sslConfig = {
        trustAllCerts: false,
        combinedCAs: ['ca1', 'ca2', 'ca3']
      }

      const result = sslUtils.createHTTPSAgent(sslConfig)

      expect(result).toBeDefined()
      expect(mockCore.debug).toHaveBeenCalledWith('Creating HTTPS agent with combined CA certificates')
    })

    test('should create default agent when no special config', () => {
      const sslConfig = {trustAllCerts: false}

      const result = sslUtils.createHTTPSAgent(sslConfig)

      expect(result).toBeDefined()
      expect(mockCore.debug).toHaveBeenCalledWith('Creating default HTTPS agent')
    })
  })

  describe('createHTTPSRequestOptions', () => {
    test('should create basic request options with default values', () => {
      const parsedUrl = new URL('https://example.com/path?query=value')
      const sslConfig = {trustAllCerts: false}

      const result = sslUtils.createHTTPSRequestOptions(parsedUrl, sslConfig)

      expect(result).toEqual({
        hostname: 'example.com',
        port: 443,
        path: '/path?query=value',
        method: 'GET',
        headers: {
          'User-Agent': 'BlackDuckSecurityAction'
        }
      })
    })

    test('should use custom port when provided in URL', () => {
      const parsedUrl = new URL('https://example.com:8443/path')
      const sslConfig = {trustAllCerts: false}

      const result = sslUtils.createHTTPSRequestOptions(parsedUrl, sslConfig)

      expect(result.port).toBe('8443')
    })

    test('should merge custom headers with default headers', () => {
      const parsedUrl = new URL('https://example.com/path')
      const sslConfig = {trustAllCerts: false}
      const customHeaders = {
        Authorization: 'Bearer token',
        'Content-Type': 'application/json'
      }

      const result = sslUtils.createHTTPSRequestOptions(parsedUrl, sslConfig, customHeaders)

      expect(result.headers).toEqual({
        'User-Agent': 'BlackDuckSecurityAction',
        Authorization: 'Bearer token',
        'Content-Type': 'application/json'
      })
    })

    test('should set rejectUnauthorized=false when trustAllCerts is true', () => {
      const parsedUrl = new URL('https://example.com/path')
      const sslConfig = {trustAllCerts: true}

      const result = sslUtils.createHTTPSRequestOptions(parsedUrl, sslConfig)

      expect(result.rejectUnauthorized).toBe(false)
      expect(mockCore.debug).toHaveBeenCalledWith('SSL certificate verification disabled for this request')
    })

    test('should set ca when combinedCAs is provided', () => {
      const parsedUrl = new URL('https://example.com/path')
      const sslConfig = {
        trustAllCerts: false,
        combinedCAs: ['ca1', 'ca2']
      }

      const result = sslUtils.createHTTPSRequestOptions(parsedUrl, sslConfig)

      expect(result.ca).toEqual(['ca1', 'ca2'])
      expect(mockCore.debug).toHaveBeenCalledWith('Using combined CA certificates for SSL verification')
    })

    test('should handle URL with no path', () => {
      const parsedUrl = new URL('https://example.com')
      const sslConfig = {trustAllCerts: false}

      const result = sslUtils.createHTTPSRequestOptions(parsedUrl, sslConfig)

      expect(result.path).toBe('/')
    })

    test('should handle URL with empty search params', () => {
      const parsedUrl = new URL('https://example.com/path')
      const sslConfig = {trustAllCerts: false}

      const result = sslUtils.createHTTPSRequestOptions(parsedUrl, sslConfig)

      expect(result.path).toBe('/path')
    })
  })

  describe('getSSLConfigHash', () => {
    test('should generate hash with trustAll=false and empty certFile', () => {
      mockInputs.NETWORK_SSL_TRUST_ALL = false
      mockInputs.NETWORK_SSL_CERT_FILE = ''

      const result = sslUtils.getSSLConfigHash()

      expect(result).toBe('trustAll:false|certFile:')
    })

    test('should generate hash with trustAll=true and empty certFile', () => {
      mockInputs.NETWORK_SSL_TRUST_ALL = true

      const result = sslUtils.getSSLConfigHash()

      expect(result).toBe('trustAll:true|certFile:')
    })

    test('should generate hash with trustAll=false and certFile path', () => {
      mockInputs.NETWORK_SSL_TRUST_ALL = false
      mockInputs.NETWORK_SSL_CERT_FILE = '/path/to/cert.pem'

      const result = sslUtils.getSSLConfigHash()

      expect(result).toBe('trustAll:false|certFile:/path/to/cert.pem')
    })

    test('should generate hash with trustAll=true and certFile path', () => {
      mockInputs.NETWORK_SSL_TRUST_ALL = 'true'
      mockInputs.NETWORK_SSL_CERT_FILE = '/path/to/cert.pem'

      const result = sslUtils.getSSLConfigHash()

      expect(result).toBe('trustAll:true|certFile:/path/to/cert.pem')
    })

    test('should trim whitespace from cert file path', () => {
      mockInputs.NETWORK_SSL_TRUST_ALL = false
      mockInputs.NETWORK_SSL_CERT_FILE = '  /path/to/cert.pem  '

      const result = sslUtils.getSSLConfigHash()

      expect(result).toBe('trustAll:false|certFile:/path/to/cert.pem')
    })

    test('should handle undefined cert file', () => {
      mockInputs.NETWORK_SSL_TRUST_ALL = false
      mockInputs.NETWORK_SSL_CERT_FILE = undefined

      const result = sslUtils.getSSLConfigHash()

      expect(result).toBe('trustAll:false|certFile:')
    })
  })
})
