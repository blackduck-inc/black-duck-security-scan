import {RetryHelper} from './retry-helper'
import * as core from '@actions/core'
import * as io from '@actions/io'
import * as fs from 'fs'
import * as path from 'path'
import * as httpm from '@actions/http-client'
import * as ifm from '@actions/http-client/lib/interfaces'

import * as stream from 'stream'
import * as util from 'util'
import * as https from 'https'
import * as url from 'url'

import {OutgoingHttpHeaders} from 'http'
import {v4 as uuidv4} from 'uuid'
import os from 'os'
import {NON_RETRY_HTTP_CODES, RETRY_COUNT, RETRY_DELAY_IN_MILLISECONDS} from '../application-constants'
import {createHTTPSRequestOptions, getSSLConfig} from './ssl-utils'

export class HTTPError extends Error {
  constructor(readonly httpStatusCode: number | undefined) {
    super(`Unexpected HTTP response: ${httpStatusCode}`)
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

const userAgent = 'actions/tool-cache'

/**
 * Download a tool from a bridge download URL and stream it into a file
 *
 * @param bridgeDownloadUrl       URL of the bridge tool to download
 * @param dest      path to download tool
 * @param auth      authorization header
 * @param headers   other headers
 * @returns         path to downloaded tool
 */
export async function downloadTool(bridgeDownloadUrl: string, dest?: string, auth?: string, headers?: OutgoingHttpHeaders): Promise<string> {
  dest = dest || path.join(os.tmpdir(), uuidv4())
  await io.mkdirP(path.dirname(dest))
  core.debug(`Downloading ${bridgeDownloadUrl}`)
  core.debug(`Destination ${dest}`)

  const retryHelper = new RetryHelper(RETRY_COUNT, RETRY_DELAY_IN_MILLISECONDS)
  return await retryHelper.execute(
    async () => {
      return await downloadToolAttempt(bridgeDownloadUrl, dest || '', auth, headers)
    },
    (err: Error) => {
      if (err instanceof HTTPError && err.httpStatusCode) {
        if (!NON_RETRY_HTTP_CODES.has(Number(err.httpStatusCode))) {
          return true
        }
      } else if (!err.message.includes('Destination file path')) {
        return true
      }
      // Otherwise retry
      return false
    }
  )
}

async function downloadToolAttempt(bridgeDownloadUrl: string, dest: string, auth?: string, headers?: OutgoingHttpHeaders): Promise<string> {
  if (fs.existsSync(dest)) {
    throw new Error(`Destination file path ${dest} already exists`)
  }

  // Get SSL configuration
  const sslConfig = getSSLConfig()

  // Use direct Node.js https for custom SSL configuration (custom CA or trust all)
  if (bridgeDownloadUrl.startsWith('https:') && (sslConfig.customCA || sslConfig.trustAllCerts)) {
    return await downloadWithCustomSSL(bridgeDownloadUrl, dest, sslConfig, auth, headers)
  }

  // Fallback to @actions/http-client for standard cases
  try {
    const httpClientOptions: ifm.RequestOptions = {
      allowRetries: false
    }

    // Configure SSL options for @actions/http-client
    if (sslConfig.trustAllCerts) {
      httpClientOptions.ignoreSslError = true
      core.debug('SSL certificate verification disabled for @actions/http-client')
    }

    const httpClient = new httpm.HttpClient(userAgent, [], httpClientOptions)

    if (auth) {
      core.debug('set auth')
      if (headers === undefined) {
        headers = {}
      }
      headers.authorization = auth
    }

    const response: httpm.HttpClientResponse = await httpClient.get(bridgeDownloadUrl, headers)
    if (response.message.statusCode && (response.message.statusCode < 200 || response.message.statusCode >= 400)) {
      const err = new HTTPError(response.message.statusCode)
      core.debug(`Failed to download from "${bridgeDownloadUrl}". Code(${response.message.statusCode}) Message(${response.message.statusMessage})`)
      throw err
    }

    // Download the response body
    const pipeline = util.promisify(stream.pipeline)
    const responseMessageFactory = _getGlobal<() => stream.Readable>('TEST_DOWNLOAD_TOOL_RESPONSE_MESSAGE_FACTORY', () => response.message)
    const readStream = responseMessageFactory()
    let succeeded = false
    try {
      await pipeline(readStream, fs.createWriteStream(dest))
      core.debug('download complete')
      succeeded = true
      return dest
    } finally {
      // Error, delete dest before retry
      if (!succeeded) {
        core.debug('download failed')
        try {
          await io.rmRF(dest)
        } catch (err) {
          core.debug(`Failed to delete '${dest}'. ${err}`)
        }
      }
    }
  } finally {
    // Cleanup completed
  }
}

async function downloadWithCustomSSL(downloadUrl: string, dest: string, sslConfig: import('./ssl-utils').SSLConfig, auth?: string, headers?: OutgoingHttpHeaders): Promise<string> {
  if (sslConfig.trustAllCerts) {
    core.debug('Using direct Node.js HTTPS with SSL verification disabled (trust all certificates)')
  } else {
    core.debug('Using direct Node.js HTTPS with custom CA certificate')
  }

  return new Promise<string>((resolve, reject) => {
    const parsedUrl = new url.URL(downloadUrl)
    const downloadStartTime = Date.now()
    let totalBytes = 0
    let downloadedBytes = 0

    // Create request options with SSL configuration
    const headerRecord: Record<string, string> = {
      'User-Agent': userAgent
    }

    // Convert OutgoingHttpHeaders to Record<string, string>
    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        if (typeof value === 'string') {
          headerRecord[key] = value
        } else if (Array.isArray(value)) {
          headerRecord[key] = value.join(', ')
        }
      }
    }

    const requestOptions = createHTTPSRequestOptions(parsedUrl, sslConfig, headerRecord)

    if (auth) {
      if (requestOptions.headers) {
        requestOptions.headers.authorization = auth
      }
    }

    const req = https.request(requestOptions, res => {
      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 400)) {
        reject(new HTTPError(res.statusCode))
        return
      }

      // Get total file size if available
      const contentLength = res.headers['content-length']
      if (contentLength) {
        totalBytes = parseInt(contentLength, 10)
        core.debug(`Download size: ${totalBytes} bytes`)
      }

      const writeStream = fs.createWriteStream(dest)
      let succeeded = false

      // Track download progress
      res.on('data', chunk => {
        downloadedBytes += chunk.length
      })

      res.pipe(writeStream)

      writeStream.on('finish', () => {
        const downloadTime = Date.now() - downloadStartTime
        core.debug(`Download complete in ${downloadTime}ms`)
        core.debug(`Total bytes downloaded: ${downloadedBytes}`)

        // Verify file exists and has content
        if (fs.existsSync(dest)) {
          const fileStats = fs.statSync(dest)
          if (fileStats.size > 0) {
            core.debug(`File verified: ${dest} (${fileStats.size} bytes)`)
            succeeded = true
            resolve(dest)
          } else {
            reject(new Error('Downloaded file is empty'))
          }
        } else {
          reject(new Error('Downloaded file does not exist'))
        }
      })

      writeStream.on('error', err => {
        core.debug('download failed due to write stream error')
        if (!succeeded) {
          try {
            fs.unlinkSync(dest)
          } catch (unlinkErr) {
            core.debug(`Failed to delete '${dest}'. ${unlinkErr}`)
          }
        }
        reject(err)
      })

      res.on('error', err => {
        core.debug('download failed due to response error')
        if (!succeeded) {
          try {
            fs.unlinkSync(dest)
          } catch (unlinkErr) {
            core.debug(`Failed to delete '${dest}'. ${unlinkErr}`)
          }
        }
        reject(err)
      })

      res.on('end', () => {
        core.debug('Response stream ended')
      })
    })

    req.on('error', err => {
      core.debug(`Request failed: ${err.message}`)
      reject(err)
    })

    req.setTimeout(300000, () => {
      core.debug('Download timeout after 5 minutes')
      req.destroy()
      reject(new Error('Download timeout'))
    })

    req.end()
  })
}

function _getGlobal<T>(key: string, defaultValue: T): T {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const value = (global as any)[key] as T | undefined
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return value !== undefined ? value : defaultValue
}
