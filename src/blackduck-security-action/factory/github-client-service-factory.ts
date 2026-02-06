import * as constants from '../../application-constants'
import * as inputs from '../inputs'

import {debug, info} from '@actions/core'

import {GithubClientServiceCloud} from '../service/impl/cloud/github-client-service-cloud'
import {GithubClientServiceInterface} from '../service/github-client-service-interface'
import {GithubClientServiceV1} from '../service/impl/enterprise/v1/github-client-service-v1'
import {getSharedHttpClient} from '../utility'

export const GitHubClientServiceFactory = {
  DEFAULT_VERSION: '3.17',
  // V1 will have all currently supported versions
  // {V2, V3 ... Vn} will have breaking changes
  SUPPORTED_VERSIONS_V1: ['3.15', '3.16', '3.17'],
  // Add new version here

  async fetchVersion(githubApiUrl: string): Promise<string> {
    const githubEnterpriseMetaUrl = '/meta'
    const githubToken = inputs.GITHUB_TOKEN
    const endpoint = githubApiUrl.concat(githubEnterpriseMetaUrl)

    try {
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
    // Treat GitHub Cloud and GHEC (data residency) domains as cloud
    // Use regex to match api.github.com (cloud) and api.<subdomain>.ghe.com (data residency) domains as cloud
    const isCloud = constants.GITHUB_CLOUD_API_DOMAIN_REGEX.test(githubApiUrl)
    if (isCloud) {
      debug(`Using GitHub client service Cloud instance`)
      return new GithubClientServiceCloud()
    } else {
      const version = await this.fetchVersion(githubApiUrl)
      const [major, minor] = version.split('.').slice(0, 2)
      const majorMinorVersion = major.concat('.').concat(minor)
      info(`GitHub Enterprise version: ${version}, Supported versions: ${this.SUPPORTED_VERSIONS_V1}`)
      // When there is contract change use if-else/switch-case and handle v1/v2 based on supported versions
      if (this.SUPPORTED_VERSIONS_V1.includes(majorMinorVersion)) {
        info(`GitHub Enterprise Version is supported`)
      } else {
        info(`Proceeding with default REST API version`)
      }
      return new GithubClientServiceV1()
    }
  }
}
