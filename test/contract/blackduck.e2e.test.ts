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

const blackduckParamMap: Map<string, string> = new Map<string, string>()
blackduckParamMap.set('BLACKDUCKSCA_URL', 'BLACKDUCKSCA_URL')
blackduckParamMap.set('BLACKDUCKSCA_TOKEN', 'BLACKDUCKSCA_TOKEN')
blackduckParamMap.set('BLACKDUCKSCA_SCAN_FULL', 'true')
blackduckParamMap.set('BLACKDUCKSCA_SCAN_FAILURE_SEVERITIES', 'ALL')
blackduckParamMap.set('DETECT_INSTALL_DIRECTORY', '/User/home')
blackduckParamMap.set('BLACKDUCKSCA_PRCOMMENT_ENABLED', 'true')
blackduckParamMap.set('BLACKDUCKSCA_FIXPR_ENABLED', 'true')

describe('Blackduck flow contract', () => {
  afterAll(() => {
    jest.clearAllMocks()
  })

  beforeEach(() => {
    jest.resetModules()
    resetMockBlackduckParams()
  })

  it('With all mandatory fields', async () => {
    mockBridgeDownloadUrlAndBridgePath()
    mockBlackduckParamsExcept(['DETECT_INSTALL_DIRECTORY', 'BLACKDUCKSCA_SCAN_FAILURE_SEVERITIES'])

    setAllMocks()

    const resp = await run()
    expect(resp).toBe(0)
  })

  it('With missing mandatory fields blackduck.api.token', async () => {
    mockBridgeDownloadUrlAndBridgePath()
    mockBlackduckParamsExcept(['DETECT_INSTALL_DIRECTORY', 'BLACKDUCKSCA_SCAN_FAILURE_SEVERITIES', 'BLACKDUCKSCA_TOKEN'])

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
    mockBlackduckParamsExcept(['NONE'])

    setAllMocks()

    const resp = await run()
    expect(resp).toBe(0)
  })

  it('With wrong optional field blackduck.install.directories', async () => {
    mockBridgeDownloadUrlAndBridgePath()
    mockBlackduckParamsExcept(['DETECT_INSTALL_DIRECTORY'])

    Object.defineProperty(inputs, 'DETECT_INSTALL_DIRECTORY', {value: '/something'})

    setAllMocks()

    try {
      const resp = await run()
    } catch (err: any) {
      expect(err.message).toContain('failed with exit code 2')
      error(err)
    }
  })

  it('With failure.severities set to true', async () => {
    mockBridgeDownloadUrlAndBridgePath()
    mockBlackduckParamsExcept(['NONE'])
    process.env['BLACKDUCK_ISSUE_FAILURE'] = 'true'

    setAllMocks()

    try {
      const resp = await run()
    } catch (err: any) {
      expect(err.message).toContain('failed with exit code 8')
      error(err)
    } finally {
      process.env['BLACKDUCK_ISSUE_FAILURE'] = undefined
    }
  })

  it('With blackducksca.automation.fixpr true and empty github token', async () => {
    mockBridgeDownloadUrlAndBridgePath()
    mockBlackduckParamsExcept(['NONE'])
    Object.defineProperty(inputs, 'GITHUB_TOKEN', {value: ''})
    jest.spyOn(validator, 'isNullOrEmptyValue').mockReturnValue(false)
    setAllMocks()

    try {
      const resp = await run()
    } catch (err: any) {
      expect(err.message).toContain('failed with exit code 1')
      error(err)
    }
  })

  it('With blackducksca.automation.fixpr true and empty github repo name', async () => {
    mockBridgeDownloadUrlAndBridgePath()
    mockBlackduckParamsExcept(['NONE'])
    process.env['GITHUB_REPOSITORY'] = ''
    setAllMocks()

    try {
      const resp = await run()
    } catch (err: any) {
      expect(err.message).toContain('failed with exit code 1')
      error(err)
    }
  })

  it('With blackducksca.automation.fixpr true and empty github branch name', async () => {
    mockBridgeDownloadUrlAndBridgePath()
    mockBlackduckParamsExcept(['NONE'])
    process.env['GITHUB_REF_NAME'] = ''
    setAllMocks()

    try {
      const resp = await run()
    } catch (err: any) {
      expect(err.message).toContain('failed with exit code 1')
      error(err)
    }
  })

  it('With blackducksca.automation.fixpr true and empty github owner name', async () => {
    mockBridgeDownloadUrlAndBridgePath()
    mockBlackduckParamsExcept(['NONE'])
    blackduckParamMap.set('BLACKDUCKSCA_SCAN_FULL', 'false') //rapid scan
    process.env['GITHUB_REPOSITORY_OWNER'] = ''
    setAllMocks()

    try {
      const resp = await run()
    } catch (err: any) {
      expect(err.message).toContain('failed with exit code 1')
      error(err)
    }
  })

  it('With blackduck.automation.prcomment true and empty github owner name', async () => {
    mockBridgeDownloadUrlAndBridgePath()
    mockBlackduckParamsExcept(['NONE'])
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

export function resetMockBlackduckParams() {
  blackduckParamMap.forEach((value, key) => {
    Object.defineProperty(inputs, key, {value: null})
  })
}

export function mockBlackduckParamsExcept(blackduckConstants: string[]) {
  blackduckParamMap.forEach((value, key) => {
    if (!blackduckConstants.includes(key)) {
      info(key)
      Object.defineProperty(inputs, key, {value: value})
    }
  })
}

export function setAllMocks() {
  let blackduck: string[] = []
  jest.spyOn(configVariables, 'getGitHubWorkspaceDir').mockReturnValue(__dirname)
  jest.spyOn(validator, 'validateBlackDuckInputs').mockReturnValueOnce(blackduck)
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
  Object.defineProperty(inputs, 'GITHUB_TOKEN', {value: 'token'})
  process.env['GITHUB_REPOSITORY'] = 'blackduck-security-action'
  process.env['GITHUB_HEAD_REF'] = 'branch-name'
  process.env['GITHUB_REF'] = 'refs/pull/1/merge'
  process.env['GITHUB_REPOSITORY_OWNER'] = 'blackduck-inc'
  process.env['GITHUB_REF_NAME'] = 'blackduck-inc'
  Object.defineProperty(inputs, 'include_diagnostics', {value: true})
  Object.defineProperty(inputs, 'diagnostics_retention_days', {value: 10})
}
