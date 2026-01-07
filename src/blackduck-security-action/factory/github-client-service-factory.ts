import {GithubClientServiceInterface} from '../service/github-client-service-interface'
import {GithubClientServiceCloud} from '../service/impl/cloud/github-client-service-cloud'
import {debug, info} from '@actions/core'
import * as constants from '../../application-constants'
import {GithubClientServiceV1} from '../service/impl/enterprise/v1/github-client-service-v1'
import * as inputs from '../inputs'
import {getSharedHttpClient} from '../utility'

export const GitHubClientServiceFactory = {
  DEFAULT_VERSION: '3.12',
  // V1 will have all currently supported versions
  // {V2, V3 ... Vn} will have breaking changes
  SUPPORTED_VERSIONS_V1: ['3.11', '3.12'],
  // Add new version here

  async fetchVersion(githubApiUrl: string): Promise<string> {
    // Handle empty or undefined URL
    if (!githubApiUrl || githubApiUrl.trim() === '') {
      debug(`Empty or undefined GitHub API URL provided. Default version: ${this.DEFAULT_VERSION} will be used.`)
      return this.DEFAULT_VERSION
    }

    const githubEnterpriseMetaUrl = '/meta'
    const githubToken = inputs.GITHUB_TOKEN

    try {
      const endpoint = githubApiUrl.concat(githubEnterpriseMetaUrl)
      debug(`Fetching GitHub Enterprise Server version from: ${endpoint}`)

      const httpClient = getSharedHttpClient()
      const httpResponse = await httpClient.get(endpoint, {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github+json'
      })

      if (httpResponse.message.statusCode === constants.HTTP_STATUS_OK) {
        const metaDataResponse = JSON.parse(await httpResponse.readBody())
        const installedVersion = metaDataResponse.installed_version
        debug(`Installed version: ${installedVersion}`)
        return installedVersion
      } else {
        debug(`No version info found for endpoint : ${endpoint}. Default version: ${this.DEFAULT_VERSION} will be used.`)
      }
    } catch (error) {
      debug(`Fetching version info for enterprise server failed : ${error}. Default version: ${this.DEFAULT_VERSION} will be used.`)
    }
    return this.DEFAULT_VERSION
  },

  async getGitHubClientServiceInstance(): Promise<GithubClientServiceInterface> {
    info('Fetching GitHub client service instance...')
    const githubApiUrl = process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_API_URL] || ''

    const useCloudInstance = (url: string): boolean => {
      // Handle empty URL case first
      if (!url || url.trim() === '') {
        debug('Empty GitHub API URL provided, treating as non-cloud instance')
        return false
      }

      try {
        const host = new URL(url).hostname
        const isCloud = url === constants.GITHUB_CLOUD_API_URL || host.endsWith('.ghe.com')
        debug(`GitHub API URL: ${url}, hostname: ${host}, isCloud: ${isCloud}`)
        return isCloud
      } catch (error) {
        debug(`Error parsing GitHub API URL: ${error}. URL: ${url}`)
        return url === constants.GITHUB_CLOUD_API_URL
      }
    }

    if (useCloudInstance(githubApiUrl)) {
      debug('Using GitHub client service Cloud instance')
      return new GithubClientServiceCloud()
    }

    debug(`Using GitHub Enterprise Server with API URL: ${githubApiUrl}`)
    const version = await this.fetchVersion(githubApiUrl)

    // Safely handle version splitting
    let major = ''
    let minor = ''

    if (version && typeof version === 'string') {
      const versionParts = version.split('.').slice(0, 2)
      major = versionParts[0] || ''
      minor = versionParts[1] || ''
    } else {
      debug(`Invalid version returned: ${version}, using default version parts`)
    }

    const majorMinorVersion = major && minor ? `${major}.${minor}` : this.DEFAULT_VERSION

    if (this.SUPPORTED_VERSIONS_V1.includes(majorMinorVersion)) {
      info(`Using GitHub Enterprise Server API v1 for version ${version}`)
    } else {
      info(`GitHub Enterprise Server version ${version} is not supported, proceeding with default version ${this.DEFAULT_VERSION}`)
    }
    debug('Using GitHub client service V1 instance')
    return new GithubClientServiceV1()
  }
}
