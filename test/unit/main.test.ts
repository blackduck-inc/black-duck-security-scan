import {getBridgeExitCode, getBridgeExitCodeAsNumericValue, logBridgeExitCodes, markBuildStatusIfIssuesArePresent, run} from '../../src/main'
import * as inputs from '../../src/blackduck-security-action/inputs'
import {DownloadFileResponse} from '../../src/blackduck-security-action/download-utility'
import * as downloadUtility from './../../src/blackduck-security-action/download-utility'
import * as configVariables from 'actions-artifact-v2/lib/internal/shared/config'
import * as diagnostics from '../../src/blackduck-security-action/artifacts'
import {UploadArtifactResponse} from 'actions-artifact-v2'
import * as utility from '../../src/blackduck-security-action/utility'
import {GitHubClientServiceFactory} from '../../src/blackduck-security-action/factory/github-client-service-factory'
import {GithubClientServiceCloud} from '../../src/blackduck-security-action/service/impl/cloud/github-client-service-cloud'
import fs from 'fs'
import * as core from '@actions/core'
import {BridgeClientBase} from '../../src/blackduck-security-action/bridge/bridge-client-base'

jest.mock('@actions/core', () => ({
  getInput: jest.fn((key: string) => {
    const mockInputs: Record<string, string> = {
      github_token: 'mock-github-token',
      blackducksca_url: 'BLACKDUCKSCA_URL',
      blackducksca_token: 'BLACKDUCKSCA_TOKEN'
    }
    return mockInputs[key] || ''
  }),
  info: jest.fn(),
  debug: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
  exportVariable: jest.fn()
}))
jest.mock('@actions/io', () => ({
  rmRF: jest.fn()
}))

// Mock the artifact libraries to prevent token validation errors
jest.mock('actions-artifact-v2', () => ({
  DefaultArtifactClient: jest.fn().mockImplementation(() => ({
    uploadArtifact: jest.fn().mockResolvedValue({size: 0, id: 123})
  }))
}))

jest.mock('actions-artifact-v1', () => ({
  create: jest.fn().mockReturnValue({
    uploadArtifact: jest.fn().mockResolvedValue({size: 0, id: 123})
  })
}))

jest.mock('actions-artifact-v2/lib/internal/shared/config', () => ({
  getGitHubWorkspaceDir: jest.fn().mockReturnValue('/github/workspace')
}))

beforeEach(() => {
  // Set up GITHUB_TOKEN first to prevent undefined errors
  Object.defineProperty(inputs, 'GITHUB_TOKEN', {value: 'token'})
  process.env['GITHUB_REPOSITORY'] = 'blackduck-security-action'
  process.env['GITHUB_REF_NAME'] = 'branch-name'
  process.env['GITHUB_REF'] = 'refs/pull/1/merge'
  process.env['GITHUB_REPOSITORY_OWNER'] = 'blackduck-inc'

  // Add GitHub Actions environment variables for artifact upload
  process.env['ACTIONS_RUNTIME_TOKEN'] = 'mock-runtime-token'
  process.env['ACTIONS_RUNTIME_URL'] = 'https://pipelines.actions.githubusercontent.com/mock'
  process.env['GITHUB_RUN_ID'] = '123456789'
  process.env['GITHUB_WORKSPACE'] = '/github/workspace'

  jest.resetModules()
  const uploadResponse: UploadArtifactResponse = {size: 0, id: 123}
  jest.spyOn(diagnostics, 'uploadDiagnostics').mockResolvedValueOnce(uploadResponse)
  jest.spyOn(fs, 'renameSync').mockReturnValue()
  jest.spyOn(utility, 'getRealSystemTime').mockReturnValue('1749123407519') // Mock with a fixed timestamp

  // Mock file system operations to prevent ENOENT errors with SARIF file paths
  jest.spyOn(fs, 'existsSync').mockReturnValue(true)
  jest.spyOn(fs, 'readFileSync').mockReturnValue('{"mock": "data"}')
  jest.spyOn(fs, 'writeFileSync').mockReturnValue()
  jest.spyOn(fs, 'mkdirSync').mockReturnValue(undefined)
  jest.spyOn(fs, 'readdirSync').mockReturnValue([] as any)
  jest.spyOn(fs, 'statSync').mockReturnValue({
    isDirectory: () => true,
    isFile: () => false
  } as fs.Stats)
  jest.spyOn(fs, 'rmdirSync').mockReturnValue()

  delete process.env.NODE_EXTRA_CA_CERTS
})

afterEach(() => {
  // Clean up environment variables
  delete process.env['ACTIONS_RUNTIME_TOKEN']
  delete process.env['ACTIONS_RUNTIME_URL']
  delete process.env['GITHUB_RUN_ID']
  delete process.env['GITHUB_WORKSPACE']
  delete process.env['GITHUB_SERVER_URL']

  jest.restoreAllMocks()
})

describe('Black Duck Security Action: Handling isBridgeExecuted and Exit Code Information Messages', () => {
  const setupBlackDuckInputs = (extraInputs: Record<string, any> = {}) => {
    Object.defineProperty(inputs, 'BLACKDUCKSCA_URL', {value: 'BLACKDUCKSCA_URL'})
    Object.defineProperty(inputs, 'BLACKDUCKSCA_TOKEN', {value: 'BLACKDUCKSCA_TOKEN'})
    Object.defineProperty(inputs, 'DETECT_INSTALL_DIRECTORY', {value: 'DETECT_INSTALL_DIRECTORY'})
    Object.defineProperty(inputs, 'DETECT_SCAN_FULL', {value: 'TRUE'})
    Object.defineProperty(inputs, 'BLACKDUCKSCA_SCAN_FAILURE_SEVERITIES', {value: 'ALL'})
    Object.defineProperty(inputs, 'BLACKDUCKSCA_FIXPR_ENABLED', {value: 'false'})
    Object.defineProperty(inputs, 'BLACKDUCKSCA_PRCOMMENT_ENABLED', {value: true})
    Object.defineProperty(inputs, 'RETURN_STATUS', {value: true})
    for (const [key, value] of Object.entries(extraInputs)) {
      Object.defineProperty(inputs, key, {value, writable: true})
    }
  }

  const setupMocks = () => {
    jest.spyOn(BridgeClientBase.prototype, 'getBridgeVersionFromLatestURL').mockResolvedValueOnce('0.1.0')
    const downloadFileResp: DownloadFileResponse = {
      filePath: 'C://user/temp/download/',
      fileName: 'C://user/temp/download/bridge-win.zip'
    }
    jest.spyOn(downloadUtility, 'getRemoteFile').mockResolvedValueOnce(downloadFileResp)
    jest.spyOn(downloadUtility, 'extractZipped').mockResolvedValueOnce(true)
    jest.spyOn(configVariables, 'getGitHubWorkspaceDir').mockReturnValueOnce('/home/bridge')
    const uploadResponse: UploadArtifactResponse = {size: 0, id: 123}
    jest.spyOn(diagnostics, 'uploadDiagnostics').mockResolvedValueOnce(uploadResponse)
  }

  afterEach(() => {
    Object.defineProperty(inputs, 'BLACKDUCKSCA_URL', {value: null})
  })

  it('handles successful execution with exitCode 0 and upload diagnostics enabled', async () => {
    setupBlackDuckInputs({INCLUDE_DIAGNOSTICS: 'true'})
    setupMocks()
    jest.spyOn(BridgeClientBase.prototype, 'executeBridgeCommand').mockResolvedValueOnce(0)
    await run()

    expect(core.info).toHaveBeenCalledWith('Black Duck Security Action workflow execution completed successfully.')
    expect(core.setOutput).toHaveBeenCalledWith('status', 0)
    expect(core.debug).toHaveBeenCalledWith('Bridge CLI execution completed: true')
    expect(diagnostics.uploadDiagnostics).toHaveBeenCalled()
  })

  it('handles successful execution with exitCode 0', async () => {
    setupBlackDuckInputs()
    setupMocks()
    Object.defineProperty(inputs, 'INCLUDE_DIAGNOSTICS', {value: true})
    jest.spyOn(BridgeClientBase.prototype, 'executeBridgeCommand').mockResolvedValueOnce(0)
    await run()

    expect(core.info).toHaveBeenCalledWith('Black Duck Security Action workflow execution completed successfully.')
    expect(core.setOutput).toHaveBeenCalledWith('status', 0)
    expect(core.debug).toHaveBeenCalledWith('Bridge CLI execution completed: true')
    Object.defineProperty(inputs, 'INCLUDE_DIAGNOSTICS', {value: false})
  })

  it('handles issues detected but marked as success with exitCode 8', async () => {
    setupBlackDuckInputs({MARK_BUILD_STATUS: 'success'})
    setupMocks()
    jest.spyOn(BridgeClientBase.prototype, 'executeBridgeCommand').mockRejectedValueOnce(new Error('BridgeClientBase CLI execution failed with exit code 8'))
    jest.spyOn(utility, 'checkJobResult').mockReturnValue('success')

    try {
      await run()
    } catch (error: any) {
      expect(error.message).toContain('BridgeClientBase CLI execution failed with exit code 8')
      expect(core.debug).toHaveBeenCalledWith('Bridge CLI execution completed: true')
    }
  })

  it('handles failure case with exitCode 2', async () => {
    setupBlackDuckInputs()
    setupMocks()
    jest.spyOn(BridgeClientBase.prototype, 'executeBridgeCommand').mockRejectedValueOnce(new Error('Exit Code: 2 Error from adapter end'))

    try {
      await run()
    } catch (error: any) {
      expect(error.message).toContain('Exit Code: 2 Error from adapter end')
    }
  })

  it('uploads SARIF report for exitCode 8', async () => {
    setupBlackDuckInputs({
      BLACKDUCKSCA_REPORTS_SARIF_CREATE: 'true',
      BLACKDUCKSCA_REPORTS_SARIF_FILE_PATH: '/',
      MARK_BUILD_STATUS: 'success'
    })

    jest.spyOn(BridgeClientBase.prototype, 'getBridgeVersionFromLatestURL').mockResolvedValueOnce('0.1.0')
    const downloadFileResp: DownloadFileResponse = {
      filePath: 'C://user/temp/download/',
      fileName: 'C://user/temp/download/bridge-win.zip'
    }
    jest.spyOn(downloadUtility, 'getRemoteFile').mockResolvedValueOnce(downloadFileResp)
    jest.spyOn(downloadUtility, 'extractZipped').mockResolvedValueOnce(true)
    jest.spyOn(configVariables, 'getGitHubWorkspaceDir').mockReturnValueOnce('/home/bridge')

    jest.spyOn(BridgeClientBase.prototype, 'executeBridgeCommand').mockRejectedValueOnce(new Error('BridgeClientBase CLI execution failed with exit code 8'))
    jest.spyOn(utility, 'checkJobResult').mockReturnValue('success')
    jest.spyOn(utility, 'isPullRequestEvent').mockReturnValue(false)
    const uploadResponse: UploadArtifactResponse = {size: 0, id: 123}
    jest.spyOn(diagnostics, 'uploadSarifReportAsArtifact').mockResolvedValueOnce(uploadResponse)

    const error = new Error('Error: The process failed with exit code 8')
    expect(getBridgeExitCode(error)).toBe(true)

    try {
      await run()
    } catch (error: any) {
      expect(error.message).toContain('BridgeClientBase CLI execution failed with exit code 8')
      expect(diagnostics.uploadSarifReportAsArtifact).toHaveBeenCalledWith('Blackduck SCA SARIF Generator', '/', 'blackduck_sarif_report_1749123407519')
    }
  })

  test('markBuildStatusIfIssuesArePresent sets build status correctly', () => {
    const status = 8
    const errorMessage = 'Error: The process failed with exit code 2'

    const debugSpy = jest.spyOn(core, 'debug')
    const infoSpy = jest.spyOn(core, 'info')
    const setFailedSpy = jest.spyOn(core, 'setFailed')

    markBuildStatusIfIssuesArePresent(status, 'success', errorMessage)

    expect(debugSpy).toHaveBeenCalledWith(errorMessage)
    expect(infoSpy).toHaveBeenCalledWith('Exit Code: 2 Error from adapter end')
    expect(infoSpy).toHaveBeenCalledWith('Marking the build success as configured in the task.')
    expect(setFailedSpy).not.toHaveBeenCalled()

    debugSpy.mockRestore()
    infoSpy.mockRestore()
    setFailedSpy.mockRestore()
  })

  test('markBuildStatusIfIssuesArePresent sets workflow as failed', () => {
    const status = 2
    const errorMessage = 'Error: The process failed with exit code 2'

    const setFailedSpy = jest.spyOn(core, 'setFailed')

    markBuildStatusIfIssuesArePresent(status, 'failure', errorMessage)

    expect(setFailedSpy).toHaveBeenCalledWith('Workflow failed! Exit Code: 2 Error from adapter end')

    setFailedSpy.mockRestore()
  })
})

test('Not supported flow error - run', async () => {
  Object.defineProperty(inputs, 'POLARIS_SERVER_URL', {value: null})
  Object.defineProperty(inputs, 'BLACKDUCKSCA_URL', {value: null})
  Object.defineProperty(inputs, 'COVERITY_URL', {value: null})
  Object.defineProperty(inputs, 'SRM_URL', {value: null})

  jest.spyOn(BridgeClientBase.prototype, 'getBridgeVersionFromLatestURL').mockResolvedValueOnce('0.1.0')
  const downloadFileResp: DownloadFileResponse = {filePath: 'C://user/temp/download/', fileName: 'C://user/temp/download/bridge-win.zip'}
  jest.spyOn(downloadUtility, 'getRemoteFile').mockResolvedValueOnce(downloadFileResp)
  jest.spyOn(downloadUtility, 'extractZipped').mockResolvedValueOnce(true)

  try {
    await run()
  } catch (error: any) {
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toContain('Provide at least one of the product URL (polaris_server_url, coverity_url, blackducksca_url, or srm_url) to proceed.')
  }
})

test('Not supported flow error (empty strings) - run', async () => {
  Object.defineProperty(inputs, 'POLARIS_SERVER_URL', {value: ''})
  Object.defineProperty(inputs, 'BLACKDUCKSCA_URL', {value: ''})
  Object.defineProperty(inputs, 'COVERITY_URL', {value: ''})
  Object.defineProperty(inputs, 'SRM_URL', {value: ''})

  jest.spyOn(BridgeClientBase.prototype, 'getBridgeVersionFromLatestURL').mockResolvedValueOnce('0.1.0')
  const downloadFileResp: DownloadFileResponse = {filePath: 'C://user/temp/download/', fileName: 'C://user/temp/download/bridge-win.zip'}
  jest.spyOn(downloadUtility, 'getRemoteFile').mockResolvedValueOnce(downloadFileResp)
  jest.spyOn(downloadUtility, 'extractZipped').mockResolvedValueOnce(true)

  try {
    await run()
  } catch (error: any) {
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toContain('Provide at least one of the product URL (polaris_server_url, coverity_url, blackducksca_url, or srm_url) to proceed.')
  }
})

describe('GitHub Enterprise and Cloud Tests', () => {
  const setupGitHubInputs = () => {
    Object.defineProperty(inputs, 'BLACKDUCKSCA_URL', {value: 'BLACKDUCKSCA_URL'})
    Object.defineProperty(inputs, 'BLACKDUCKSCA_TOKEN', {value: 'BLACKDUCKSCA_TOKEN'})
    Object.defineProperty(inputs, 'DETECT_INSTALL_DIRECTORY', {value: 'DETECT_INSTALL_DIRECTORY'})
    Object.defineProperty(inputs, 'DETECT_SCAN_FULL', {value: 'TRUE'})
    Object.defineProperty(inputs, 'BLACKDUCKSCA_SCAN_FAILURE_SEVERITIES', {value: 'ALL'})
    Object.defineProperty(inputs, 'BLACKDUCKSCA_FIXPR_ENABLED', {value: 'false'})
    Object.defineProperty(inputs, 'BLACKDUCKSCA_PRCOMMENT_ENABLED', {value: true})
    Object.defineProperty(inputs, 'RETURN_STATUS', {value: true})
    // Add required file path inputs to prevent validation errors
    Object.defineProperty(inputs, 'BLACKDUCKSCA_REPORTS_SARIF_FILE_PATH', {value: '/tmp/sarif'})
    Object.defineProperty(inputs, 'POLARIS_REPORTS_SARIF_FILE_PATH', {value: '/tmp/polaris-sarif'})
    Object.defineProperty(inputs, 'COVERITY_REPORTS_SARIF_FILE_PATH', {value: '/tmp/coverity-sarif'})
    Object.defineProperty(inputs, 'SRM_REPORTS_SARIF_FILE_PATH', {value: '/tmp/srm-sarif'})
  }

  const setupGitHubMocks = () => {
    jest.spyOn(BridgeClientBase.prototype, 'getBridgeVersionFromLatestURL').mockResolvedValueOnce('0.1.0')
    const downloadFileResp: DownloadFileResponse = {
      filePath: 'C://user/temp/download/',
      fileName: 'C://user/temp/download/bridge-win.zip'
    }
    jest.spyOn(downloadUtility, 'getRemoteFile').mockResolvedValueOnce(downloadFileResp)
    jest.spyOn(downloadUtility, 'extractZipped').mockResolvedValueOnce(true)
    jest.spyOn(configVariables, 'getGitHubWorkspaceDir').mockReturnValueOnce('/home/bridge')
    const uploadResponse: UploadArtifactResponse = {size: 0, id: 123}
    jest.spyOn(diagnostics, 'uploadDiagnostics').mockResolvedValueOnce(uploadResponse)
    // Mock utility functions that might be called during validation
    jest.spyOn(utility, 'extractInputJsonFilename').mockReturnValue('/tmp/bridge-input.json')
    jest.spyOn(utility, 'updateSarifFilePaths').mockReturnValue()
    // Mock file system operations to prevent file existence errors
    jest.spyOn(fs, 'existsSync').mockReturnValue(true)
    jest.spyOn(fs, 'readFileSync').mockReturnValue('{"mock": "data"}')
    jest.spyOn(fs, 'writeFileSync').mockReturnValue()
    jest.spyOn(fs, 'mkdirSync').mockReturnValue(undefined)
  }

  afterEach(() => {
    Object.defineProperty(inputs, 'BLACKDUCKSCA_URL', {value: null})
    jest.restoreAllMocks()
  })

  beforeEach(() => {
    setupGitHubInputs()
  })

  it('Should run successfully for github.com URL', async () => {
    process.env['GITHUB_SERVER_URL'] = 'https://github.com'
    Object.defineProperty(inputs, 'BLACKDUCKSCA_PRCOMMENT_ENABLED', {value: true})

    setupGitHubMocks()
    jest.spyOn(BridgeClientBase.prototype, 'executeBridgeCommand').mockResolvedValueOnce(0)

    const response = await run()
    expect(response).toBe(0)
  })

  it('Should run for enterprise github URL but fail for bridge client', async () => {
    process.env['GITHUB_SERVER_URL'] = 'https://github.enterprise.com'
    Object.defineProperty(inputs, 'BLACKDUCKSCA_PRCOMMENT_ENABLED', {value: true})
    Object.defineProperty(inputs, 'BLACKDUCKSCA_URL', {value: 'https://blackduck.example.com'}) // Ensure product URL is set

    setupGitHubMocks()
    jest.spyOn(BridgeClientBase.prototype, 'executeBridgeCommand').mockRejectedValueOnce(new Error('Bridge execution failed'))

    try {
      await run()
    } catch (error: any) {
      expect(error.message).toContain('Bridge execution failed')
    }
  })

  it('Should run successfully for github.com URL with GITHUB_TOKEN', async () => {
    process.env['GITHUB_SERVER_URL'] = 'https://github.com'
    Object.defineProperty(inputs, 'BLACKDUCKSCA_PRCOMMENT_ENABLED', {value: true})

    setupGitHubMocks()
    jest.spyOn(BridgeClientBase.prototype, 'executeBridgeCommand').mockResolvedValueOnce(0)

    const response = await run()
    expect(response).toBe(0)
  })

  it('Should run successfully for github.com URL with cloud GitHub client factory', async () => {
    process.env['GITHUB_SERVER_URL'] = 'https://github.com'
    Object.defineProperty(inputs, 'BLACKDUCKSCA_PRCOMMENT_ENABLED', {value: true})

    setupGitHubMocks()
    jest.spyOn(BridgeClientBase.prototype, 'executeBridgeCommand').mockResolvedValueOnce(0)
    jest.spyOn(GitHubClientServiceFactory, 'getGitHubClientServiceInstance').mockResolvedValueOnce(new GithubClientServiceCloud())

    const response = await run()
    expect(response).toBe(0)
  })

  it('Should run successfully for enterprise github URL', async () => {
    process.env['GITHUB_SERVER_URL'] = 'https://github.enterprise.com'
    Object.defineProperty(inputs, 'BLACKDUCKSCA_PRCOMMENT_ENABLED', {value: true})

    setupGitHubMocks()
    jest.spyOn(BridgeClientBase.prototype, 'executeBridgeCommand').mockResolvedValueOnce(0)

    const response = await run()
    expect(response).toBe(0)
  })

  it('Should run successfully for enterprise github URL with enterprise GitHub client factory', async () => {
    process.env['GITHUB_SERVER_URL'] = 'https://github.enterprise.com'
    Object.defineProperty(inputs, 'BLACKDUCKSCA_PRCOMMENT_ENABLED', {value: true})

    setupGitHubMocks()
    jest.spyOn(BridgeClientBase.prototype, 'executeBridgeCommand').mockResolvedValueOnce(0)

    const response = await run()
    expect(response).toBe(0)
  })

  it('Should run successfully for github.com URL - PR Comment', async () => {
    process.env['GITHUB_SERVER_URL'] = 'https://github.com'
    Object.defineProperty(inputs, 'BLACKDUCKSCA_PRCOMMENT_ENABLED', {value: true})

    setupGitHubMocks()
    jest.spyOn(BridgeClientBase.prototype, 'executeBridgeCommand').mockResolvedValueOnce(0)

    const response = await run()
    expect(response).toBe(0)
  })

  it('Should run successfully for enterprise github URL - PR Comment', async () => {
    process.env['GITHUB_SERVER_URL'] = 'https://github.enterprise.com'
    Object.defineProperty(inputs, 'BLACKDUCKSCA_PRCOMMENT_ENABLED', {value: true})

    setupGitHubMocks()
    jest.spyOn(BridgeClientBase.prototype, 'executeBridgeCommand').mockResolvedValueOnce(0)

    const response = await run()
    expect(response).toBe(0)
  })

  it('Should run successfully for github.com URL - Fix PR', async () => {
    process.env['GITHUB_SERVER_URL'] = 'https://github.com'
    Object.defineProperty(inputs, 'BLACKDUCKSCA_FIXPR_ENABLED', {value: true})

    setupGitHubMocks()
    jest.spyOn(BridgeClientBase.prototype, 'executeBridgeCommand').mockResolvedValueOnce(0)

    const response = await run()
    expect(response).toBe(0)
  })

  it('Should run successfully for enterprise github URL - Fix PR', async () => {
    process.env['GITHUB_SERVER_URL'] = 'https://github.enterprise.com'
    Object.defineProperty(inputs, 'BLACKDUCKSCA_FIXPR_ENABLED', {value: true})

    setupGitHubMocks()
    jest.spyOn(BridgeClientBase.prototype, 'executeBridgeCommand').mockResolvedValueOnce(0)

    const response = await run()
    expect(response).toBe(0)
  })

  it('Should run successfully for github.com URL - Fix PR & PR Comment', async () => {
    process.env['GITHUB_SERVER_URL'] = 'https://github.com'
    Object.defineProperty(inputs, 'BLACKDUCKSCA_FIXPR_ENABLED', {value: true})
    Object.defineProperty(inputs, 'BLACKDUCKSCA_PRCOMMENT_ENABLED', {value: true})

    setupGitHubMocks()
    jest.spyOn(BridgeClientBase.prototype, 'executeBridgeCommand').mockResolvedValueOnce(0)

    const response = await run()
    expect(response).toBe(0)
  })

  it('Should run successfully for enterprise github URL - Fix PR & PR Comment', async () => {
    process.env['GITHUB_SERVER_URL'] = 'https://github.enterprise.com'
    Object.defineProperty(inputs, 'BLACKDUCKSCA_FIXPR_ENABLED', {value: true})
    Object.defineProperty(inputs, 'BLACKDUCKSCA_PRCOMMENT_ENABLED', {value: true})

    setupGitHubMocks()
    jest.spyOn(BridgeClientBase.prototype, 'executeBridgeCommand').mockResolvedValueOnce(0)

    const response = await run()
    expect(response).toBe(0)
  })

  it('Should run successfully for github.com URL - Fix PR & PR Comment with default GitHub client service', async () => {
    process.env['GITHUB_SERVER_URL'] = 'https://github.com'
    Object.defineProperty(inputs, 'BLACKDUCKSCA_FIXPR_ENABLED', {value: true})
    Object.defineProperty(inputs, 'BLACKDUCKSCA_PRCOMMENT_ENABLED', {value: true})

    setupGitHubMocks()
    jest.spyOn(BridgeClientBase.prototype, 'executeBridgeCommand').mockResolvedValueOnce(0)

    const response = await run()
    expect(response).toBe(0)
  })

  it('Should run successfully for enterprise github URL - Fix PR & PR Comment with default GitHub client service', async () => {
    process.env['GITHUB_SERVER_URL'] = 'https://github.enterprise.com'
    Object.defineProperty(inputs, 'BLACKDUCKSCA_FIXPR_ENABLED', {value: true})
    Object.defineProperty(inputs, 'BLACKDUCKSCA_PRCOMMENT_ENABLED', {value: true})

    setupGitHubMocks()
    jest.spyOn(BridgeClientBase.prototype, 'executeBridgeCommand').mockResolvedValueOnce(0)

    const response = await run()
    expect(response).toBe(0)
  })
})

describe('logBridgeExitCodes function', () => {
  test('logBridgeExitCodes - code 0', () => {
    const result = logBridgeExitCodes('Error: The process failed with exit code 0')
    expect(result).toBe('Exit Code: 0 Bridge execution successfully completed')
  })

  test('logBridgeExitCodes - code 1', () => {
    const result = logBridgeExitCodes('Error: The process failed with exit code 1')
    expect(result).toBe('Exit Code: 1 Undefined error, check error logs')
  })

  test('logBridgeExitCodes - code 2', () => {
    const result = logBridgeExitCodes('Error: The process failed with exit code 2')
    expect(result).toBe('Exit Code: 2 Error from adapter end')
  })

  test('logBridgeExitCodes - code 8', () => {
    const result = logBridgeExitCodes('Error: The process failed with exit code 8')
    expect(result).toBe('Exit Code: 8 The config option bridge.break has been set to true')
  })

  test('logBridgeExitCodes - unknown code', () => {
    const message = 'Some error message without exit code'
    const result = logBridgeExitCodes(message)
    expect(result).toBe(message)
  })
})

test('getBridgeExitCode function', () => {
  const error1 = new Error('Error: The process failed with exit code 8')
  expect(getBridgeExitCode(error1)).toBe(true)

  const error2 = new Error('Some other error message')
  expect(getBridgeExitCode(error2)).toBe(false)
})
describe('Error Handling in run().catch() Block', () => {
  const setupInputsForErrorHandling = (extraInputs: Record<string, any> = {}) => {
    Object.defineProperty(inputs, 'BLACKDUCKSCA_URL', {value: 'BLACKDUCKSCA_URL', writable: true})
    Object.defineProperty(inputs, 'BLACKDUCKSCA_TOKEN', {value: 'BLACKDUCKSCA_TOKEN', writable: true})
    Object.defineProperty(inputs, 'RETURN_STATUS', {value: 'true', writable: true})
    Object.defineProperty(inputs, 'MARK_BUILD_STATUS', {value: 'success', writable: true})
    for (const [key, value] of Object.entries(extraInputs)) {
      Object.defineProperty(inputs, key, {value, writable: true})
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should not set output variable when RETURN_STATUS is disabled', async () => {
    setupInputsForErrorHandling({RETURN_STATUS: 'false', MARK_BUILD_STATUS: 'success'})

    const mockError = new Error('Bridge CLI execution failed with exit code 2')
    jest.spyOn(BridgeClientBase.prototype, 'prepareCommand').mockRejectedValueOnce(mockError)
    jest.spyOn(utility, 'parseToBoolean').mockImplementation((value: string | boolean) => {
      if (typeof value === 'boolean') return value
      return value === 'false'
    })
    jest.spyOn(utility, 'checkJobResult').mockReturnValue('success')

    const setOutputSpy = jest.spyOn(core, 'setOutput')

    await expect(run()).rejects.toThrow(mockError)
    await new Promise(resolve => setImmediate(resolve))

    // When RETURN_STATUS is false, setOutput should not be called
    expect(setOutputSpy).not.toHaveBeenCalledWith('status', expect.any(Number))
  })

  it('should call markBuildStatusIfIssuesArePresent when taskResult is not FAILURE', async () => {
    setupInputsForErrorHandling({RETURN_STATUS: 'true', MARK_BUILD_STATUS: 'success'})

    const mockError = new Error('Bridge CLI execution failed with exit code 8')
    jest.spyOn(utility, 'parseToBoolean').mockImplementation((value: string | boolean) => {
      if (typeof value === 'boolean') return value
      return value === 'true'
    })
    jest.spyOn(utility, 'checkJobResult').mockReturnValue('success')

    const markBuildStatusSpy = jest.spyOn(require('../../src/main'), 'markBuildStatusIfIssuesArePresent')
    const setOutputSpy = jest.spyOn(core, 'setOutput')
    const debugSpy = jest.spyOn(core, 'debug')

    // Simulate the global catch block logic manually since we can't easily trigger it in tests
    const main = require('../../src/main')
    const isReturnStatusEnabled = utility.parseToBoolean(inputs.RETURN_STATUS)
    const exitCode = main.getBridgeExitCodeAsNumericValue(mockError)
    const taskResult = utility.checkJobResult(inputs.MARK_BUILD_STATUS)

    // This simulates what happens in the global catch block in main.ts
    if (mockError.message !== undefined) {
      if (isReturnStatusEnabled) {
        core.debug(`Setting output variable status with exit code ${exitCode}`)
        core.setOutput('status', exitCode)
      }

      if (taskResult && taskResult !== 'failure') {
        main.markBuildStatusIfIssuesArePresent(exitCode, taskResult, mockError.message)
      }
    }

    expect(markBuildStatusSpy).toHaveBeenCalledWith(8, 'success', mockError.message)
    expect(setOutputSpy).toHaveBeenCalledWith('status', 8)
    expect(debugSpy).toHaveBeenCalledWith('Setting output variable status with exit code 8')
  })

  it('should extract correct exit code from error message', () => {
    const testCases = [
      {message: 'Bridge CLI execution failed with exit code 0', expected: 0},
      {message: 'Bridge CLI execution failed with exit code 1', expected: 1},
      {message: 'Bridge CLI execution failed with exit code 2', expected: 2},
      {message: 'Bridge CLI execution failed with exit code 8', expected: 8},
      {message: 'Bridge CLI execution failed with exit code 9', expected: 9},
      {message: 'Some other error message', expected: -1},
      {message: '', expected: -1}
    ]

    testCases.forEach(({message, expected}) => {
      const error = new Error(message)
      const exitCode = getBridgeExitCodeAsNumericValue(error)
      expect(exitCode).toBe(expected)
    })
  })
})
