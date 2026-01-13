import {debug, info} from '@actions/core'

export interface ProxyConfig {
  useProxy: boolean
  proxyUrl?: URL
}

/**
 * Gets Proxy configuration from environment variables.
 * Supports HTTPS_PROXY/https_proxy and HTTP_PROXY/http_proxy.
 * Respects NO_PROXY/no_proxy which takes priority to bypass proxy for specific hosts.
 * Returns proxy configuration object.
 */
export function getProxyConfig(targetUrl: string): ProxyConfig {
  // Check NO_PROXY first - it takes priority
  const noProxy = process.env.NO_PROXY || process.env.no_proxy
  if (noProxy && shouldBypassProxy(targetUrl, noProxy)) {
    debug(`Bypassing proxy for ${targetUrl} due to NO_PROXY configuration`)
    return {useProxy: false}
  }

  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy
  const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy

  const proxyUrl = httpsProxy || httpProxy
  if (!proxyUrl) {
    debug('No proxy configured (HTTPS_PROXY/HTTP_PROXY environment variables not set)')
    return {useProxy: false}
  }

  try {
    const parsedProxyUrl = new URL(proxyUrl)
    debug(`Using proxy: ${parsedProxyUrl.origin} for target URL: ${targetUrl}`)
    return {
      useProxy: true,
      proxyUrl: parsedProxyUrl
    }
  } catch (error) {
    debug(`Invalid proxy URL format: ${proxyUrl}. Error: ${error}. Proxy will not be used.`)
    return {useProxy: false}
  }
}

/**
 * Checks if a hostname matches a NO_PROXY pattern entry
 */
function matchesNoProxyPattern(hostname: string, pattern: string): boolean {
  // Handle wildcard subdomain patterns (*.example.com)
  if (pattern.startsWith('*.')) {
    const domain = pattern.substring(2)
    return hostname === domain || hostname.endsWith(`.${domain}`)
  }

  // Handle suffix wildcard patterns (*example.com)
  if (pattern.startsWith('*')) {
    const suffix = pattern.substring(1)
    return hostname.endsWith(suffix)
  }

  // Handle domain suffix match (.example.com matches subdomain.example.com)
  if (pattern.startsWith('.')) {
    return hostname.endsWith(pattern)
  }

  // Handle exact match or subdomain match (example.com matches example.com or sub.example.com)
  return hostname === pattern || hostname.endsWith(`.${pattern}`)
}

/**
 * Determines if a target URL should bypass proxy based on NO_PROXY rules
 */
export function shouldBypassProxy(targetUrl: string, noProxy: string): boolean {
  try {
    const target = new URL(targetUrl)
    const hostname = target.hostname.toLowerCase()

    // Split NO_PROXY by comma and trim whitespace
    info(`[SPLIT DEBUG] About to split noProxy: ${noProxy}`)
    const noProxyList = noProxy.split(',').map(entry => entry.trim().toLowerCase())

    for (const entry of noProxyList) {
      if (!entry) continue

      if (matchesNoProxyPattern(hostname, entry)) {
        return true
      }
    }

    return false
  } catch {
    return false
  }
}
