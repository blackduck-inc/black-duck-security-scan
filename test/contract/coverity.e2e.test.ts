import {run} from '../../src/main'
import * as inputs from '../../src/blackduck-security-action/inputs'
import {error, info} from '@actions/core'
import * as configVariables from 'actions-artifact-v2/lib/internal/shared/config'
import * as validator from '../../src/blackduck-security-action/validators'
import * as toolCache from '@actions/tool-cache'
import * as toolCacheLocal from '../../src/blackduck-security-action/tool-cache-local'
import * as io from '@actions/io'
import * as utility from '../../src/blackduck-security-action/utility'
import fs from 'fs'

const coverityParamMap: Map<string, string> = new Map<string, string>()
coverityParamMap.set('COVERITY_URL', 'https://testing.coverity.synopsys.com')
coverityParamMap.set('COVERITY_USER', 'admin')
coverityParamMap.set('COVERITY_PASSPHRASE', 'coverity')
coverityParamMap.set('COVERITY_INSTALL_DIRECTORY', '/')
coverityParamMap.set('COVERITY_POLICY_VIEW', 'policy')
coverityParamMap.set('COVERITY_PRCOMMENT_ENABLED', 'true')

describe('Coverity flow contract', () => {
  afterAll(() => {
    jest.clearAllMocks()
  })

  beforeEach(() => {
    jest.resetModules()
    resetMockCoverityParams()
  })

  it('With all mandatory fields', async () => {
    mockBridgeDownloadUrlAndBridgePath()
    mockCoverityParamsExcept(['COVERITY_INSTALL_DIRECTORY', 'COVERITY_POLICY_VIEW', 'COVERITY_PRCOMMENT_ENABLED'])

    setAllMocks()

    const resp = await run()
    expect(resp).toBe(0)
  })

  it('With missing mandatory fields coverity.connect.user.name', async () => {
    mockBridgeDownloadUrlAndBridgePath()
    mockCoverityParamsExcept(['COVERITY_INSTALL_DIRECTORY', 'COVERITY_POLICY_VIEW', 'COVERITY_USER'])

    setAllMocks()

    try {
      const resp = await run()
    } catch (err: any) {
      expect(err.message).toContain('failed with exit code 2')
      error(err)
    }
  })

  it('With missing mandatory fields coverity.connect.user.password', async () => {
    mockBridgeDownloadUrlAndBridgePath()
    mockCoverityParamsExcept(['COVERITY_INSTALL_DIRECTORY', 'COVERITY_POLICY_VIEW', 'COVERITY_PASSPHRASE'])

    setAllMocks()

    try {
      const resp = await run()
    } catch (err: any) {
      expect(err.message).toContain('failed with exit code 2')
      error(err)
    }
  })

  it('With all mandatory and optional fields', async () => {
    mockBridgeDownloadUrlAndBridgePath()
    mockCoverityParamsExcept(['NONE'])

    setAllMocks()

    try {
      const resp = await run()
    } catch (err: any) {
      expect(err.message).toContain('failed with exit code 1')
      error(err)
    }
  })

  it('With coverity.automation.prcomment true and empty github token', async () => {
    mockBridgeDownloadUrlAndBridgePath()
    mockCoverityParamsExcept(['NONE'])
    Object.defineProperty(inputs, 'GITHUB_TOKEN', {value: ''})
    setAllMocks()

    try {
      const resp = await run()
    } catch (err: any) {
      expect(err).toContain('Missing required github token for fix pull request')
      error(err)
    }
  })

  it('With coverity.automation.prcomment true and empty github repo name', async () => {
    mockBridgeDownloadUrlAndBridgePath()
    mockCoverityParamsExcept(['NONE'])
    process.env['GITHUB_REPOSITORY'] = ''
    setAllMocks()

    try {
      const resp = await run()
    } catch (err: any) {
      expect(err.message).toContain('failed with exit code 1')
      error(err)
    }
  })

  it('With coverity.automation.prcomment true and empty github branch name', async () => {
    mockBridgeDownloadUrlAndBridgePath()
    mockCoverityParamsExcept(['NONE'])
    process.env['GITHUB_REF_NAME'] = ''
    setAllMocks()

    try {
      const resp = await run()
    } catch (err: any) {
      expect(err.message).toContain('failed with exit code 1')
      error(err)
    }
  })

  it('With coverity.automation.prcomment true and empty github owner name', async () => {
    mockBridgeDownloadUrlAndBridgePath()
    mockCoverityParamsExcept(['NONE'])
    process.env['GITHUB_REPOSITORY_OWNER'] = ''
    setAllMocks()

    try {
      const resp = await run()
    } catch (err: any) {
      expect(err.message).toContain('failed with exit code 1')
      error(err)
    }
  })
})

export function resetMockCoverityParams() {
  coverityParamMap.forEach((value, key) => {
    Object.defineProperty(inputs, key, {value: null})
  })
}

export function mockCoverityParamsExcept(coverityConstants: string[]) {
  coverityParamMap.forEach((value, key) => {
    if (!coverityConstants.includes(key)) {
      info(key)
      Object.defineProperty(inputs, key, {value: value})
    }
  })
}

export function setAllMocks() {
  let coverity: string[] = []
  jest.spyOn(configVariables, 'getGitHubWorkspaceDir').mockReturnValue(__dirname)
  jest.spyOn(validator, 'validateCoverityInputs').mockReturnValueOnce(coverity)
  jest.spyOn(toolCacheLocal, 'downloadTool').mockResolvedValueOnce(__dirname)
  jest.spyOn(io, 'rmRF').mockResolvedValue()
  jest.spyOn(toolCache, 'extractZip').mockResolvedValueOnce('Extracted')
  jest.spyOn(validator, 'validateBridgeUrl').mockReturnValue(true)
  jest.spyOn(utility, 'cleanupTempDir').mockResolvedValue()
  jest.spyOn(utility, 'createTempDir').mockResolvedValue(__dirname)
  jest.spyOn(fs, 'renameSync').mockReturnValue()
}

export function getBridgeDownloadUrl(): string {
  const WINDOWS_PLATFORM = 'win64'
  const LINUX_PLATFORM = 'linux64'
  const LINUX_ARM_PLATFORM = 'linux_arm'
  const MAC_PLATFORM = 'macosx'
  const osName = process.platform
  let platform = ''
  if (osName === 'darwin') {
    platform = MAC_PLATFORM
  } else if (osName === 'linux') {
    platform = /^(arm.*|aarch.*)$/.test(process.arch) ? LINUX_ARM_PLATFORM : LINUX_PLATFORM
  } else if (osName === 'win32') {
    platform = WINDOWS_PLATFORM
  }
  return 'https://repo.blackduck.com/bds-integrations-release/com/blackduck/integration/bridge/binaries/bridge-cli-bundle/latest/bridge-cli-bundle-'.concat(platform).concat('.zip')
}

export function mockBridgeDownloadUrlAndBridgePath() {
  Object.defineProperty(inputs, 'BRIDGE_CLI_DOWNLOAD_URL', {value: getBridgeDownloadUrl()})
  Object.defineProperty(inputs, 'BRIDGE_CLI_INSTALL_DIRECTORY_KEY', {value: __dirname})
  Object.defineProperty(inputs, 'include_diagnostics', {value: true})
  Object.defineProperty(inputs, 'diagnostics_retention_days', {value: 10})
  Object.defineProperty(inputs, 'GITHUB_TOKEN', {value: 'token'})
  Object.defineProperty(inputs, 'BRIDGE_NETWORK_AIRGAP', {value: true})
  process.env['GITHUB_REPOSITORY'] = 'blackduck-inc/blackduck-security-action'
  process.env['GITHUB_HEAD_REF'] = 'branch-name'
  process.env['GITHUB_REF'] = 'refs/pull/1/merge'
  process.env['GITHUB_REPOSITORY_OWNER'] = 'blackduck-inc'
  process.env['GITHUB_REF_NAME'] = 'blackduck-security-action'
  process.env['GITHUB_EVENT_NAME'] = 'pull_request'
  process.env['GITHUB_BASE_REF'] = 'current-branch'
  process.env['GITHUB_SERVER_URL'] = 'https://github.com'
}
