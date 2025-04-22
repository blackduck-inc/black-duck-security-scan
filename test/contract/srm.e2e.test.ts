import {run} from '../../src/main'
import {error} from '@actions/core'
import * as inputs from '../../src/blackduck-security-action/inputs'
import * as configVariables from 'actions-artifact-v2/lib/internal/shared/config'
import * as validator from '../../src/blackduck-security-action/validators'
import * as toolCache from '@actions/tool-cache'
import * as toolCacheLocal from '../../src/blackduck-security-action/tool-cache-local'
import * as io from '@actions/io'
import * as utility from '../../src/blackduck-security-action/utility'
import {BRIDGE_CLI_DOWNLOAD_URL, SRM_ASSESSMENT_TYPES, SRM_URL} from '../../src/blackduck-security-action/inputs'
import fs from 'fs'

const srmParamsMap: Map<string, string> = new Map<string, string>()
srmParamsMap.set('SRM_URL', 'SRM_URL')
srmParamsMap.set('SRM_API_KEY', 'SRM_API_KEY')
srmParamsMap.set('SRM_ASSESSMENT_TYPES', 'SCA,SAST')

describe('Srm flow contract', () => {
  afterAll(() => {
    jest.clearAllMocks()
  })

  beforeEach(() => {
    jest.resetModules()
    resetMockSrmParams()
  })

  it('With all mandatory fields', async () => {
    mockBridgeDownloadUrlAndBridgePath()
    mockSrmParamsExcept('NONE')

    setAllMocks()

    const resp = await run()
    expect(resp).toBe(0)
  })

  it('With missing mandatory field srm.api.key', async () => {
    mockBridgeDownloadUrlAndBridgePath()
    mockSrmParamsExcept('SRM_API_KEY')

    setAllMocks()

    try {
      const resp = await run()
    } catch (err: any) {
      expect(err.message).toContain('failed with exit code 2')
      error(err)
    }
  })

  it('With missing mandatory field srm.assessment.type', async () => {
    mockBridgeDownloadUrlAndBridgePath()
    mockSrmParamsExcept('SRM_ASSESSMENT_TYPES')

    setAllMocks()

    try {
      const resp = await run()
    } catch (err: any) {
      expect(err.message).toContain('failed with exit code 2')
      error(err)
    }
  })

  it('With bridge.break set to true', async () => {
    mockBridgeDownloadUrlAndBridgePath()
    mockSrmParamsExcept('NONE')
    process.env['SRM_ISSUE_FAILURE'] = 'true'

    setAllMocks()

    try {
      const resp = await run()
    } catch (err: any) {
      expect(err.message).toContain('failed with exit code 8')
      error(err)
    } finally {
      process.env['SRM_ISSUE_FAILURE'] = undefined
    }
  })
})

export function mockSrmParamsExcept(srmConstant: string) {
  srmParamsMap.forEach((value, key) => {
    if (srmConstant != key) {
      Object.defineProperty(inputs, key, {value: value})
    }
  })
}

export function resetMockSrmParams() {
  srmParamsMap.forEach((value, key) => {
    Object.defineProperty(inputs, key, {value: null})
  })
}

export function setAllMocks() {
  let srm: string[] = []
  jest.spyOn(configVariables, 'getGitHubWorkspaceDir').mockReturnValue(__dirname)
  jest.spyOn(validator, 'validateSRMInputs').mockReturnValueOnce(srm)
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
}
