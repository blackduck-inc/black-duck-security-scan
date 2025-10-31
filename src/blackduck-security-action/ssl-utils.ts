import * as fs from 'fs'
import * as tls from 'tls'
import * as https from 'https'
import {debug, warning} from '@actions/core'
import * as inputs from './inputs'
// import * as httpsProxyAgent from 'https-proxy-agent'
import * as httpProxyAgent from 'http-proxy-agent'
import {getProxyConfig} from './proxy-utils'

export interface SSLConfig {
  trustAllCerts: boolean
  customCA?: string
  combinedCAs?: string[]
}

/**
 * Parse string to boolean
 */
function parseToBoolean(value: string | boolean): boolean {
  if (value !== null && value !== '' && (value.toString().toLowerCase() === 'true' || value === true)) {
    return true
  }
  return false
}

/**
 * Reads and validates SSL configuration from inputs
 */
export function getSSLConfig(): SSLConfig {
  const trustAllCerts = parseToBoolean(inputs.NETWORK_SSL_TRUST_ALL)
  let customCA: string | undefined

  if (trustAllCerts) {
    debug('SSL certificate verification disabled (NETWORK_SSL_TRUST_ALL=true)')
    return {trustAllCerts: true}
  }

  if (inputs.NETWORK_SSL_CERT_FILE) {
    try {
      customCA = fs.readFileSync(inputs.NETWORK_SSL_CERT_FILE, 'utf8')
      debug('Custom CA certificate loaded successfully')

      // Get system CAs and append custom CA
      const systemCAs = tls.rootCertificates || []
      const combinedCAs = [customCA, ...systemCAs]
      debug(`Using custom CA certificate with ${systemCAs.length} system CAs for SSL verification`)

      return {
        trustAllCerts: false,
        customCA,
        combinedCAs
      }
    } catch (error) {
      warning(`Failed to read custom CA certificate file: ${error}`)
    }
  }

  return {trustAllCerts: false}
}

/**
 * Creates an HTTPS agent with Proxy and combined SSL configuration
 */
export function createHTTPSAgent(sslConfig: SSLConfig, targetUrl: string): https.Agent {
  const proxyConfig = getProxyConfig(targetUrl)
  const sslOptions: https.AgentOptions = {}

  if (sslConfig.trustAllCerts) {
    sslOptions.rejectUnauthorized = false
    debug('SSL verification disabled for HTTPS agent')
  }

  if (sslConfig.combinedCAs) {
    sslOptions.ca = sslConfig.combinedCAs
    sslOptions.rejectUnauthorized = true
    debug('Using combined CA certificates for HTTPS agent')
  }

  if (proxyConfig.useProxy && proxyConfig.proxyUrl) {
    debug(`Creating HTTPS proxy agent with proxy: ${proxyConfig.proxyUrl.origin}`)
    // return new httpsProxyAgent.HttpsProxyAgent(proxyConfig.proxyUrl, sslOptions)
    return new httpProxyAgent.HttpProxyAgent(proxyConfig.proxyUrl, sslOptions)
  }

  debug('Creating HTTPS agent without proxy')
  return new https.Agent(sslOptions)
}

/**
 * Creates HTTPS request options with SSL configuration
 */
export function createHTTPSRequestOptions(parsedUrl: URL, sslConfig: SSLConfig, headers?: Record<string, string>): https.RequestOptions {
  const requestOptions: https.RequestOptions = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || 443,
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'GET',
    headers: {
      'User-Agent': 'BlackDuckSecurityAction',
      ...headers
    }
  }

  // Configure SSL options based on settings
  if (sslConfig.trustAllCerts) {
    requestOptions.rejectUnauthorized = false
    debug('SSL certificate verification disabled for this request')
  } else if (sslConfig.combinedCAs) {
    requestOptions.ca = sslConfig.combinedCAs
    debug(`Using combined CA certificates for SSL verification`)
  }

  return requestOptions
}

/**
 * Gets the current SSL configuration as a hash to detect changes
 */
export function getSSLConfigHash(): string {
  const trustAll = parseToBoolean(inputs.NETWORK_SSL_TRUST_ALL)
  const certFile = inputs.NETWORK_SSL_CERT_FILE?.trim() || ''
  return `trustAll:${trustAll}|certFile:${certFile}`
}
