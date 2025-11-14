import {debug, info, setFailed, setOutput} from '@actions/core'
import {basename} from 'path'
import {getGitHubWorkspaceDir as getGitHubWorkspaceDirV2} from 'actions-artifact-v2/lib/internal/shared/config'

import * as constants from './application-constants'
import * as inputs from './blackduck-security-action/inputs'
import * as util from './blackduck-security-action/utility'
import {uploadDiagnostics, uploadSarifReportAsArtifact} from './blackduck-security-action/artifacts'
import {isNullOrEmptyValue} from './blackduck-security-action/validators'
import {GitHubClientServiceFactory} from './blackduck-security-action/factory/github-client-service-factory'
import {createBridgeClient} from './blackduck-security-action/bridge/bridge-client-factory'

export async function run() {
  info('Black Duck Security Action started...')
  const tempDir = await util.createTempDir()
  let formattedCommand = ''
  let isBridgeExecuted = false
  let exitCode
  let bridgeVersion = ''
  let productInputFileName = ''
  let productInputFilPath = ''

  try {
    const sb = createBridgeClient()
    formattedCommand = await sb.prepareCommand(tempDir)

    // Download bridge
    await sb.downloadBridge(tempDir)
    // Get Bridge version from bridge Path
    bridgeVersion = await sb.getBridgeVersion()
    //Extract input.yml file and update sarif default file path based on bridge version
    productInputFilPath = util.extractInputJsonFilename(formattedCommand)
    // Extract product input file name from the path (cross-platform compatible)
    productInputFileName = basename(productInputFilPath)
    // Based on bridge version and productInputFileName get the sarif file path
    util.updateSarifFilePaths(productInputFileName, bridgeVersion, productInputFilPath)
    // Based on bridge version update Coverity configuration for backward compatibility
    util.updateCoverityConfigForBridgeVersion(productInputFileName, bridgeVersion, productInputFilPath)
    // Execute bridge command
    exitCode = await sb.executeBridgeCommand(formattedCommand, getGitHubWorkspaceDirV2())
    if (exitCode === 0) {
      info('Black Duck Security Action workflow execution completed successfully.')
      isBridgeExecuted = true
    }
    // The statement set the exit code in the 'status' variable which can be used in the YAML file
    if (util.parseToBoolean(inputs.RETURN_STATUS)) {
      debug(`Setting output variable ${constants.TASK_RETURN_STATUS} with exit code ${exitCode}`)
      setOutput(constants.TASK_RETURN_STATUS, exitCode)
    }
    return exitCode
  } catch (error) {
    exitCode = getBridgeExitCodeAsNumericValue(error as Error)
    isBridgeExecuted = getBridgeExitCode(error as Error)
    throw error
  } finally {
    const uploadSarifReportBasedOnExitCode = exitCode === 0 || exitCode === 8
    debug(`Bridge CLI execution completed: ${isBridgeExecuted}`)
    if (isBridgeExecuted) {
      if (util.parseToBoolean(inputs.INCLUDE_DIAGNOSTICS)) {
        await uploadDiagnostics()
      }
      if (!util.isPullRequestEvent() && uploadSarifReportBasedOnExitCode) {
        if (bridgeVersion < constants.VERSION) {
          // Upload Polaris sarif file as GitHub artifact (Deprecated Logic)
          if (inputs.BLACKDUCKSCA_URL && util.parseToBoolean(inputs.BLACKDUCKSCA_REPORTS_SARIF_CREATE)) {
            await uploadSarifReportAsArtifact(constants.BLACKDUCK_SARIF_GENERATOR_DIRECTORY, inputs.BLACKDUCKSCA_REPORTS_SARIF_FILE_PATH, constants.BLACKDUCK_SARIF_ARTIFACT_NAME.concat(util.getRealSystemTime()))
          }
          // Upload Polaris sarif file as GitHub artifact (Deprecated Logic)
          if (inputs.POLARIS_SERVER_URL && util.parseToBoolean(inputs.POLARIS_REPORTS_SARIF_CREATE)) {
            await uploadSarifReportAsArtifact(constants.POLARIS_SARIF_GENERATOR_DIRECTORY, inputs.POLARIS_REPORTS_SARIF_FILE_PATH, constants.POLARIS_SARIF_ARTIFACT_NAME.concat(util.getRealSystemTime()))
          }
        } else {
          // Upload Polaris sarif file as GitHub artifact (Deprecated Logic)
          if (inputs.BLACKDUCKSCA_URL && util.parseToBoolean(inputs.BLACKDUCKSCA_REPORTS_SARIF_CREATE)) {
            await uploadSarifReportAsArtifact(constants.INTEGRATIONS_BLACKDUCK_SARIF_GENERATOR_DIRECTORY, inputs.BLACKDUCKSCA_REPORTS_SARIF_FILE_PATH, constants.BLACKDUCK_SARIF_ARTIFACT_NAME.concat(util.getRealSystemTime()))
          }

          // Upload Polaris sarif file as GitHub artifact (Deprecated Logic)
          if (inputs.POLARIS_SERVER_URL && util.parseToBoolean(inputs.POLARIS_REPORTS_SARIF_CREATE)) {
            await uploadSarifReportAsArtifact(constants.INTEGRATIONS_POLARIS_SARIF_GENERATOR_DIRECTORY, inputs.POLARIS_REPORTS_SARIF_FILE_PATH, constants.POLARIS_SARIF_ARTIFACT_NAME.concat(util.getRealSystemTime()))
          }
        }
        if (!isNullOrEmptyValue(inputs.GITHUB_TOKEN)) {
          const gitHubClientService = await GitHubClientServiceFactory.getGitHubClientServiceInstance()
          if (bridgeVersion < constants.VERSION) {
            // Upload Black Duck SARIF Report to code scanning tab
            if (inputs.BLACKDUCKSCA_URL && util.parseToBoolean(inputs.BLACKDUCK_UPLOAD_SARIF_REPORT)) {
              await gitHubClientService.uploadSarifReport(constants.BLACKDUCK_SARIF_GENERATOR_DIRECTORY, inputs.BLACKDUCKSCA_REPORTS_SARIF_FILE_PATH)
            }

            // Upload Polaris SARIF Report to code scanning tab
            if (inputs.POLARIS_SERVER_URL && util.parseToBoolean(inputs.POLARIS_UPLOAD_SARIF_REPORT)) {
              await gitHubClientService.uploadSarifReport(constants.POLARIS_SARIF_GENERATOR_DIRECTORY, inputs.POLARIS_REPORTS_SARIF_FILE_PATH)
            }
          } else {
            // Upload Black Duck SARIF Report to code scanning tab
            if (inputs.BLACKDUCKSCA_URL && util.parseToBoolean(inputs.BLACKDUCK_UPLOAD_SARIF_REPORT)) {
              await gitHubClientService.uploadSarifReport(constants.INTEGRATIONS_BLACKDUCK_SARIF_GENERATOR_DIRECTORY, inputs.BLACKDUCKSCA_REPORTS_SARIF_FILE_PATH)
            }

            // Upload Polaris SARIF Report to code scanning tab
            if (inputs.POLARIS_SERVER_URL && util.parseToBoolean(inputs.POLARIS_UPLOAD_SARIF_REPORT)) {
              await gitHubClientService.uploadSarifReport(constants.INTEGRATIONS_POLARIS_SARIF_GENERATOR_DIRECTORY, inputs.POLARIS_REPORTS_SARIF_FILE_PATH)
            }
          }
        }
      }
    }
    await util.cleanupTempDir(tempDir)
  }
}

export function logBridgeExitCodes(message: string): string {
  const exitCode = message.trim().slice(-1)
  return constants.EXIT_CODE_MAP.has(exitCode) ? `Exit Code: ${exitCode} ${constants.EXIT_CODE_MAP.get(exitCode)}` : message
}

export function getBridgeExitCodeAsNumericValue(error: Error): number {
  if (error.message !== undefined) {
    const lastChar = error.message.trim().slice(-1)
    const exitCode = parseInt(lastChar)
    return isNaN(exitCode) ? -1 : exitCode
  }
  return -1
}

export function getBridgeExitCode(error: Error): boolean {
  if (error.message !== undefined) {
    const lastChar = error.message.trim().slice(-1)
    const num = parseFloat(lastChar)
    return !isNaN(num)
  }
  return false
}

export function markBuildStatusIfIssuesArePresent(status: number, taskResult: string, errorMessage: string): void {
  const exitMessage = logBridgeExitCodes(errorMessage)

  if (status === constants.BRIDGE_BREAK_EXIT_CODE) {
    debug(errorMessage)
    if (taskResult === constants.BUILD_STATUS.SUCCESS) {
      info(exitMessage)
    }
    info(`Marking the build ${taskResult} as configured in the task.`)
  } else {
    setFailed('Workflow failed! '.concat(logBridgeExitCodes(exitMessage)))
  }
}

run().catch(error => {
  if (error.message !== undefined) {
    const isReturnStatusEnabled = util.parseToBoolean(inputs.RETURN_STATUS)
    const exitCode = getBridgeExitCodeAsNumericValue(error)

    if (isReturnStatusEnabled) {
      debug(`Setting output variable ${constants.TASK_RETURN_STATUS} with exit code ${exitCode}`)
      setOutput(constants.TASK_RETURN_STATUS, exitCode)
    }

    const taskResult: string | undefined = util.checkJobResult(inputs.MARK_BUILD_STATUS)

    if (taskResult && taskResult !== constants.BUILD_STATUS.FAILURE) {
      markBuildStatusIfIssuesArePresent(exitCode, taskResult, error.message)
    } else {
      setFailed('Workflow failed! '.concat(logBridgeExitCodes(error.message)))
    }
  }
})
