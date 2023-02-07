import {run} from '../../src/main'
import {error} from '@actions/core'
import * as inputs from '../../src/synopsys-action/inputs'
import * as configVariables from '@actions/artifact/lib/internal/config-variables'
import * as validator from '../../src/synopsys-action/validators'
import * as toolCache from '@actions/tool-cache'
import * as io from '@actions/io'
import * as utility from '../../src/synopsys-action/utility'
import {BRIDGE_DOWNLOAD_URL, POLARIS_APPLICATION_NAME, POLARIS_ASSESSMENT_TYPES, POLARIS_PROJECT_NAME, POLARIS_SERVER_URL} from '../../src/synopsys-action/inputs'

const polarisParamsMap: Map<string, string> = new Map<string, string>()
polarisParamsMap.set('POLARIS_SERVER_URL', 'POLARIS_SERVER_URL')
polarisParamsMap.set('POLARIS_ACCESS_TOKEN', 'POLARIS_ACCESS_TOKEN')
polarisParamsMap.set('POLARIS_APPLICATION_NAME', 'POLARIS_APPLICATION_NAME')
polarisParamsMap.set('POLARIS_PROJECT_NAME', 'POLARIS_PROJECT_NAME')
polarisParamsMap.set('POLARIS_ASSESSMENT_TYPES', "SCA,SAST")

describe('Polaris flow contract', () => {
  afterAll(() => {
    jest.clearAllMocks()
  })

  beforeEach(() => {
    jest.resetModules()
    resetMockPolarisParams()
  })

  it('With all mandatory fields', async () => {
    mockBridgeDownloadUrlAndSynopsysBridgePath()
    mockPolarisParamsExcept('NONE')

    setAllMocks()

    const resp = await run()
    expect(resp).toBe(0)
  })

  it('With missing mandatory field polaris.access.token', async () => {
    mockBridgeDownloadUrlAndSynopsysBridgePath()
    mockPolarisParamsExcept('POLARIS_ACCESS_TOKEN')

    setAllMocks()

    try {
      const resp = await run()
    } catch (err: any) {
      expect(err.message).toContain('failed with exit code 2')
      error(err)
    }
  })

  it('With missing mandatory field polaris.application.name', async () => {
    mockBridgeDownloadUrlAndSynopsysBridgePath()
    mockPolarisParamsExcept('POLARIS_APPLICATION_NAME')

    setAllMocks()

    try {
      const resp = await run()
    } catch (err: any) {
      expect(err.message).toContain('failed with exit code 2')
      error(err)
    }
  })

  it('With missing mandatory field polaris.project.name', async () => {
    mockBridgeDownloadUrlAndSynopsysBridgePath()
    mockPolarisParamsExcept('POLARIS_PROJECT_NAME')

    setAllMocks()

    try {
      const resp = await run()
    } catch (err: any) {
      expect(err.message).toContain('failed with exit code 2')
      error(err)
    }
  })

  it('With missing mandatory field polaris.assessment.type', async () => {
    mockBridgeDownloadUrlAndSynopsysBridgePath()
    mockPolarisParamsExcept('POLARIS_ASSESSMENT_TYPES')

    setAllMocks()

    try {
      const resp = await run()
    } catch (err: any) {
      expect(err.message).toContain('failed with exit code 2')
      error(err)
    }
  })

  it('With bridge.break set to true', async () => {
    mockBridgeDownloadUrlAndSynopsysBridgePath()
    mockPolarisParamsExcept('NONE')
    process.env['POLARIS_ISSUE_FAILURE'] = 'true'

    setAllMocks()

    try {
      const resp = await run()
    } catch (err: any) {
      expect(err.message).toContain('failed with exit code 8')
      error(err)
    } finally {
      process.env['POLARIS_ISSUE_FAILURE'] = undefined
    }
  })
})

export function mockPolarisParamsExcept(polarisConstant: string) {
  polarisParamsMap.forEach((value, key) => {
    if (polarisConstant != key) {
      Object.defineProperty(inputs, key, {value: value})
    }
  })
}

export function resetMockPolarisParams() {
  polarisParamsMap.forEach((value, key) => {
    Object.defineProperty(inputs, key, {value: null})
  })
}

export function setAllMocks() {
  jest.spyOn(configVariables, 'getWorkSpaceDirectory').mockReturnValue(__dirname)
  jest.spyOn(validator, 'validatePolarisInputs').mockReturnValueOnce(true)

  jest.spyOn(toolCache, 'downloadTool').mockResolvedValueOnce(__dirname)
  jest.spyOn(io, 'rmRF').mockResolvedValue()
  jest.spyOn(toolCache, 'extractZip').mockResolvedValueOnce('Extracted')
  jest.spyOn(validator, 'validateBridgeUrl').mockReturnValue(true)
  jest.spyOn(utility, 'cleanupTempDir').mockResolvedValue()
  jest.spyOn(utility, 'createTempDir').mockResolvedValue(__dirname)
}

export function getBridgeDownloadUrl(): string {
  return 'https://sig-repo.synopsys.com/artifactory/bds-integrations-release/com/synopsys/integration/synopsys-action/0.1.634/ci-package-0.1.61-macosx.zip'
}

export function mockBridgeDownloadUrlAndSynopsysBridgePath() {
  Object.defineProperty(inputs, 'BRIDGE_DOWNLOAD_URL', {value: getBridgeDownloadUrl()})
  Object.defineProperty(inputs, 'SYNOPSYS_BRIDGE_PATH', {value: __dirname})
}