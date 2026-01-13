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
        // Ensure installedVersion is a valid string before returning
        if (installedVersion && typeof installedVersion === 'string') {
          return installedVersion
        } else {
          debug(`Invalid installed_version in response: ${installedVersion}. Default version: ${this.DEFAULT_VERSION} will be used.`)
          return this.DEFAULT_VERSION
        }
      } else {
        debug(`No version info found for endpoint : ${endpoint}. Default version: ${this.DEFAULT_VERSION} will be used.`)
      }
    } catch (error) {
      debug(`Fetching version info for enterprise server failed : ${error}. Default version: ${this.DEFAULT_VERSION} will be used.`)
    }
    return this.DEFAULT_VERSION
  },

  async getGitHubClientServiceInstance(): Promise<GithubClientServiceInterface> {
    try {
      info('Fetching GitHub client service instance...')
      const envVarName = constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_API_URL
      info(`Environment variable name: ${envVarName}`)
      const envValue = process.env[envVarName]
      info(`Environment variable value: ${envValue}`)
      info(`Environment variable type: ${typeof envValue}`)

      const githubApiUrl = envValue || ''
      info(`Raw GitHub API URL from environment: '${githubApiUrl}' (length: ${githubApiUrl.length})`)

      const useCloudInstance = (url: string): boolean => {
        // Handle empty URL case first
        if (!url || url.trim() === '') {
          info('Empty GitHub API URL provided, treating as non-cloud instance')
          return false
        }

        try {
          const parsedUrl = new URL(url)
          const host = parsedUrl.hostname
          const isExactMatch = url === constants.GITHUB_CLOUD_API_URL
          const isGheComDomain = host.endsWith('.ghe.com')
          const isCloud = isExactMatch || isGheComDomain

          info(`URL parsing details:`)
          info(`  - Full URL: ${url}`)
          info(`  - Hostname: ${host}`)
          info(`  - Expected cloud URL: ${constants.GITHUB_CLOUD_API_URL}`)
          info(`  - Exact match: ${isExactMatch}`)
          info(`  - Ends with .ghe.com: ${isGheComDomain}`)
          info(`  - Final isCloud result: ${isCloud}`)

          return isCloud
        } catch (error) {
          info(`Error parsing GitHub API URL: ${error}. URL: ${url}`)
          return url === constants.GITHUB_CLOUD_API_URL
        }
      }

      const isCloudInstance = useCloudInstance(githubApiUrl)
      info(`Cloud instance check result: ${isCloudInstance}`)

      if (isCloudInstance) {
        info('Using GitHub client service Cloud instance')
        info('About to create GithubClientServiceCloud instance...')
        const cloudInstance = new GithubClientServiceCloud()
        info('Successfully created GithubClientServiceCloud instance')
        return cloudInstance
      }

      info(`Using GitHub Enterprise Server with API URL: ${githubApiUrl}`)
      const version = await this.fetchVersion(githubApiUrl)
      info(`Fetched version: ${version}`)
      info(`Version type: ${typeof version}`)

      // Safely handle version splitting
      let major = ''
      let minor = ''

      if (version && typeof version === 'string' && version.trim() !== '') {
        info(`[SPLIT DEBUG] About to split version: ${version}`)
        const versionParts = version.split('.').slice(0, 2)
        major = versionParts[0] || ''
        minor = versionParts[1] || ''
        info(`Version parts - major: ${major}, minor: ${minor}`)
      } else {
        info(`Invalid version returned: ${version}, using default version parts`)
        info(`[SPLIT DEBUG] About to split DEFAULT_VERSION: ${this.DEFAULT_VERSION}`)
        const defaultParts = this.DEFAULT_VERSION.split('.').slice(0, 2)
        major = defaultParts[0] || ''
        minor = defaultParts[1] || ''
      }

      const majorMinorVersion = major && minor ? `${major}.${minor}` : this.DEFAULT_VERSION
      info(`Final major.minor version: ${majorMinorVersion}`)

      if (this.SUPPORTED_VERSIONS_V1.includes(majorMinorVersion)) {
        info(`Using GitHub Enterprise Server API v1 for version ${version}`)
      } else {
        info(`GitHub Enterprise Server version ${version} is not supported, proceeding with default version ${this.DEFAULT_VERSION}`)
      }
      info('Using GitHub client service V1 instance')
      info('About to create GithubClientServiceV1 instance...')
      const v1Instance = new GithubClientServiceV1()
      info('Successfully created GithubClientServiceV1 instance')
      return v1Instance
    } catch (error) {
      info(`ERROR in getGitHubClientServiceInstance: ${error}`)
      info(`ERROR stack: ${error instanceof Error ? error.stack : 'No stack trace'}`)
      throw error
    }
  }
}
