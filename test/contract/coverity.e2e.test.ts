import {run} from '../../src/main'
import * as inputs from '../../src/synopsys-action/inputs'
import {error, info} from '@actions/core'
import * as configVariables from '@actions/artifact/lib/internal/config-variables'
import * as validator from '../../src/synopsys-action/validators'
import * as toolCache from '@actions/tool-cache'
import * as io from '@actions/io'
import * as utility from '../../src/synopsys-action/utility'

const coverityParamMap: Map<string, string> = new Map<string, string>()
coverityParamMap.set('COVERITY_URL', 'https://testing.coverity.synopsys.com')
coverityParamMap.set('COVERITY_USER', 'User1')
coverityParamMap.set('COVERITY_PASSPHRASE', 'passphrase')
coverityParamMap.set('COVERITY_PROJECT_NAME', 'Project')
coverityParamMap.set('COVERITY_STREAM_NAME', 'stream')
coverityParamMap.set('COVERITY_INSTALL_DIRECTORY', '/user/coverity')
coverityParamMap.set('COVERITY_POLICY_VIEW', 'policy')
coverityParamMap.set('COVERITY_REPOSITORY_NAME', 'repo')
coverityParamMap.set('COVERITY_BRANCH_NAME', 'branch')
coverityParamMap.set('COVERITY_AUTOMATION_PRCOMMENT', 'true')

describe('Coverity flow contract', () => {
  afterAll(() => {
    jest.clearAllMocks()
  })

  beforeEach(() => {
    jest.resetModules()
    resetMockCoverityParams()
  })

  it('With all mandatory fields', async () => {
    mockBridgeDownloadUrlAndSynopsysBridgePath()
    mockCoverityParamsExcept(['COVERITY_INSTALL_DIRECTORY', 'COVERITY_POLICY_VIEW', 'COVERITY_REPOSITORY_NAME', 'COVERITY_BRANCH_NAME'])

    setAllMocks()

    const resp = await run()
    expect(resp).toBe(0)
  })

  it('With missing mandatory fields coverity.connect.user.name', async () => {
    mockBridgeDownloadUrlAndSynopsysBridgePath()
    mockCoverityParamsExcept(['COVERITY_INSTALL_DIRECTORY', 'COVERITY_POLICY_VIEW', 'COVERITY_REPOSITORY_NAME', 'COVERITY_BRANCH_NAME', 'COVERITY_USER'])

    setAllMocks()

    try {
      const resp = await run()
    } catch (err: any) {
      expect(err.message).toContain('failed with exit code 2')
      error(err)
    }
  })

  it('With missing mandatory fields coverity.connect.user.password', async () => {
    mockBridgeDownloadUrlAndSynopsysBridgePath()
    mockCoverityParamsExcept(['COVERITY_INSTALL_DIRECTORY', 'COVERITY_POLICY_VIEW', 'COVERITY_REPOSITORY_NAME', 'COVERITY_BRANCH_NAME', 'COVERITY_PASSPHRASE'])

    setAllMocks()

    try {
      const resp = await run()
    } catch (err: any) {
      expect(err.message).toContain('failed with exit code 2')
      error(err)
    }
  })

  it('With missing mandatory fields coverity.connect.project.name', async () => {
    mockBridgeDownloadUrlAndSynopsysBridgePath()
    mockCoverityParamsExcept(['COVERITY_INSTALL_DIRECTORY', 'COVERITY_POLICY_VIEW', 'COVERITY_REPOSITORY_NAME', 'COVERITY_BRANCH_NAME', 'COVERITY_PROJECT_NAME'])

    setAllMocks()

    try {
      const resp = await run()
    } catch (err: any) {
      expect(err.message).toContain('failed with exit code 2')
      error(err)
    }
  })

  it('With missing mandatory fields coverity.connect.stream.name', async () => {
    mockBridgeDownloadUrlAndSynopsysBridgePath()
    mockCoverityParamsExcept(['COVERITY_INSTALL_DIRECTORY', 'COVERITY_POLICY_VIEW', 'COVERITY_REPOSITORY_NAME', 'COVERITY_BRANCH_NAME', 'COVERITY_STREAM_NAME'])

    setAllMocks()

    try {
      const resp = await run()
    } catch (err: any) {
      expect(err.message).toContain('failed with exit code 2')
      error(err)
    }
  })

  it('With all mandatory and optional fields', async () => {
    mockBridgeDownloadUrlAndSynopsysBridgePath()
    mockCoverityParamsExcept(['NONE'])

    setAllMocks()

    try {
      const resp = await run()
    } catch (err: any) {
      expect(err.message).toContain('failed with exit code 2')
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
  jest.spyOn(configVariables, 'getWorkSpaceDirectory').mockReturnValue(__dirname)
  jest.spyOn(validator, 'validateCoverityInputs').mockReturnValueOnce(coverity)
  jest.spyOn(toolCache, 'downloadTool').mockResolvedValueOnce(__dirname)
  jest.spyOn(io, 'rmRF').mockResolvedValue()
  jest.spyOn(toolCache, 'extractZip').mockResolvedValueOnce('Extracted')
  jest.spyOn(validator, 'validateBridgeUrl').mockReturnValue(true)
  jest.spyOn(utility, 'cleanupTempDir').mockResolvedValue()
  jest.spyOn(utility, 'createTempDir').mockResolvedValue(__dirname)
}

export function getBridgeDownloadUrl(): string {
  return 'https://sig-repo.synopsys.com/artifactory/bds-integrations-release/com/synopsys/integration/synopsys-bridge/0.1.222/synopsys-bridge-0.1.222-macosx.zip'
}

export function mockBridgeDownloadUrlAndSynopsysBridgePath() {
  Object.defineProperty(inputs, 'BRIDGE_DOWNLOAD_URL', {value: getBridgeDownloadUrl()})
  Object.defineProperty(inputs, 'SYNOPSYS_BRIDGE_PATH', {value: __dirname})
  Object.defineProperty(inputs, 'GITHUB_TOKEN', {value: 'token'})
  process.env['GITHUB_REPOSITORY'] = 'synopsys-action'
  process.env['GITHUB_HEAD_REF'] = 'branch-name'
  process.env['GITHUB_REF'] = 'refs/pull/1/merge'
  process.env['GITHUB_REPOSITORY_OWNER'] = 'synopsys-sig'
}
