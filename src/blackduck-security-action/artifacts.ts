import * as artifact from 'actions-artifact-v1'
import * as constants from '../application-constants'
import * as fs from 'fs'
import * as inputs from './inputs'

import {UploadArtifactOptions, UploadArtifactResponse} from 'actions-artifact-v2/lib/internal/shared/interfaces'
import {checkIfPathExists, getDefaultSarifReportPath, getIntegrationDefaultSarifReportPath, getRealSystemTime, isGitHubCloud} from './utility'

import {DefaultArtifactClient} from 'actions-artifact-v2'
import {exists} from '@actions/io/lib/io-util'
import {getGitHubWorkspaceDir} from 'actions-artifact-v2/lib/internal/shared/config'
import path from 'path'
import {debug, warning} from '@actions/core'

// Domains that should bypass corporate proxy for artifact uploads.
// Azure Blob Storage is used by @actions/artifact v2 for blob uploads.
// GitHub Actions results service is used for artifact API calls.
const ARTIFACT_NO_PROXY_DOMAINS = ['.blob.core.windows.net', '.actions.githubusercontent.com']

/**
 * Temporarily adds artifact-related domains to NO_PROXY to prevent
 * corporate proxies from interfering with Azure Blob Storage uploads.
 * Returns the original NO_PROXY value for restoration.
 */
export function addArtifactDomainsToNoProxy(): {originalNoProxy: string | undefined; originalNoProxyLower: string | undefined} {
  const originalNoProxy = process.env.NO_PROXY
  const originalNoProxyLower = process.env.no_proxy

  // Only modify if proxy is configured
  const hasProxy = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy
  if (!hasProxy) {
    return {originalNoProxy, originalNoProxyLower}
  }

  const domainsToAdd = ARTIFACT_NO_PROXY_DOMAINS.join(',')
  const currentNoProxy = originalNoProxy || originalNoProxyLower || ''
  const updatedNoProxy = currentNoProxy ? `${currentNoProxy},${domainsToAdd}` : domainsToAdd

  process.env.NO_PROXY = updatedNoProxy
  process.env.no_proxy = updatedNoProxy
  debug(`Added artifact domains to NO_PROXY for proxy bypass: ${domainsToAdd}`)

  return {originalNoProxy, originalNoProxyLower}
}

/**
 * Restores NO_PROXY to its original value after artifact upload.
 */
export function restoreNoProxy(saved: {originalNoProxy: string | undefined; originalNoProxyLower: string | undefined}): void {
  if (saved.originalNoProxy !== undefined) {
    process.env.NO_PROXY = saved.originalNoProxy
  } else {
    delete process.env.NO_PROXY
  }
  if (saved.originalNoProxyLower !== undefined) {
    process.env.no_proxy = saved.originalNoProxyLower
  } else {
    delete process.env.no_proxy
  }
  debug('Restored NO_PROXY to original value after artifact upload')
}


export async function uploadDiagnostics(): Promise<UploadArtifactResponse | void> {
  let artifactClient
  let options: UploadArtifactOptions | artifact.UploadOptions = {}

  if (isGitHubCloud()) {
    artifactClient = new DefaultArtifactClient()
  } else {
    artifactClient = artifact.create()
    options = {
      continueOnError: true
    } as artifact.UploadOptions
  }
  const pwd = getGitHubWorkspaceDir().concat(getBridgeDiagnosticsFolder())
  let files: string[] = []
  files = getFiles(pwd, files)

  if (inputs.DIAGNOSTICS_RETENTION_DAYS) {
    const retentionDays = parseInt(inputs.DIAGNOSTICS_RETENTION_DAYS)
    if (!Number.isInteger(retentionDays)) {
      warning('Invalid Diagnostics Retention Days, hence continuing with default 90 days')
    } else {
      options.retentionDays = retentionDays
    }
  }
  if (files.length > 0) {
    const savedNoProxy = addArtifactDomainsToNoProxy()
    try {
      return await artifactClient.uploadArtifact('bridge_diagnostics_'.concat(getRealSystemTime()), files, pwd, options)
    } finally {
      restoreNoProxy(savedNoProxy)
    }
  }
}

function getBridgeDiagnosticsFolder(): string {
  if (process.platform === 'win32') {
    return '\\.bridge'
  } else {
    return '/.bridge'
  }
}

export function getFiles(dir: string, allFiles: string[]): string[] {
  allFiles = allFiles || []

  if (fs.existsSync(dir)) {
    const currDirFiles = fs.readdirSync(dir)
    for (const item of currDirFiles) {
      const name = dir.concat('/').concat() + item
      if (fs.statSync(name).isDirectory()) {
        getFiles(name, allFiles)
      } else {
        allFiles.push(name)
      }
    }
  }
  return allFiles
}

export async function uploadSarifReportAsArtifact(defaultSarifReportDirectory: string, userSarifFilePath: string, artifactName: string): Promise<UploadArtifactResponse | undefined> {
  let artifactClient
  let options: UploadArtifactOptions | artifact.UploadOptions = {}

  if (isGitHubCloud()) {
    artifactClient = new DefaultArtifactClient()
  } else {
    artifactClient = artifact.create()
    options = {
      continueOnError: true
    } as artifact.UploadOptions
  }

  let sarifFilePath: string
  let rootDir: string

  if (defaultSarifReportDirectory === constants.BLACKDUCK_SARIF_GENERATOR_DIRECTORY || defaultSarifReportDirectory === constants.POLARIS_SARIF_GENERATOR_DIRECTORY) {
    sarifFilePath = userSarifFilePath ? userSarifFilePath : getDefaultSarifReportPath(defaultSarifReportDirectory, true)
    rootDir = userSarifFilePath ? path.dirname(userSarifFilePath) : getDefaultSarifReportPath(defaultSarifReportDirectory, false)
  } else {
    sarifFilePath = userSarifFilePath ? userSarifFilePath : getIntegrationDefaultSarifReportPath(defaultSarifReportDirectory, true)
    rootDir = userSarifFilePath ? path.dirname(userSarifFilePath) : getIntegrationDefaultSarifReportPath(defaultSarifReportDirectory, false)
  }

  if ((await exists(rootDir)) && checkIfPathExists(sarifFilePath)) {
    const savedNoProxy = addArtifactDomainsToNoProxy()
    try {
      return await artifactClient.uploadArtifact(artifactName, [sarifFilePath], rootDir, options)
    } finally {
      restoreNoProxy(savedNoProxy)
    }
  }
}
