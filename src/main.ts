import {debug, info, setFailed, setOutput} from '@actions/core'
import {checkJobResult, cleanupTempDir, createTempDir, isPullRequestEvent, parseToBoolean, isVersionLess} from './blackduck-security-action/utility'
import {Bridge} from './blackduck-security-action/bridge-cli'
import {getGitHubWorkspaceDir as getGitHubWorkspaceDirV2} from 'actions-artifact-v2/lib/internal/shared/config'
import * as constants from './application-constants'
import * as inputs from './blackduck-security-action/inputs'
import {uploadDiagnostics, uploadSarifReportAsArtifact} from './blackduck-security-action/artifacts'
import * as util from './blackduck-security-action/utility'
import {readFileSync} from 'fs'
import {join, basename} from 'path'
import {isNullOrEmptyValue, validateFedRAMPCommand, validateFedRAMPMode} from './blackduck-security-action/validators'
import {GitHubClientServiceFactory} from './blackduck-security-action/factory/github-client-service-factory'

export async function run() {
  info('Black Duck Security Action started...')
  const tempDir = await createTempDir()
  let formattedCommand = ''
  let isBridgeExecuted = false
  let exitCode
  let bridgeVersion = ''
  let productInputFileName = ''
  let productInputFilPath = ''

  try {
    // FedRAMP fail-fast validation before anything else runs
    const fedRampErrors = validateFedRAMPMode()
    if (fedRampErrors.length > 0) {
      return Promise.reject(new Error(fedRampErrors.join(',')))
    }
    const sb = new Bridge()
    // Prepare bridge command
    formattedCommand = await sb.prepareCommand(tempDir)
    const commandErrors = validateFedRAMPCommand(formattedCommand)
    if (commandErrors.length > 0) {
      return Promise.reject(new Error(commandErrors.join(',')))
    }

    // Download bridge
    if (!inputs.ENABLE_NETWORK_AIR_GAP) {
      await sb.downloadBridge(tempDir)
    } else {
      info('Network air gap is enabled, skipping bridge CLI download.')
      await sb.validateBridgePath()
    }
    // Get Bridge version from bridge Path
    // FedRAMP: never execute a local, cached or downloaded Bridge CLI unless it is the FIPS bundle
    await sb.verifyFipsBridge()
    // FedRAMP CHECK 2: verify all Bridge CLI files against the manifest
    await sb.verifyBundleIntegrity()
    bridgeVersion = getBridgeVersion(sb.bridgePath)
    // FedRAMP: an unknown version must not silently select default SARIF paths or skip source upload validation
    if (parseToBoolean(inputs.FEDRAMP_MODE) && isNullOrEmptyValue(bridgeVersion)) {
      return Promise.reject(new Error(constants.FEDRAMP_BRIDGE_VERSION_NOT_FOUND_ERROR))
    }
    util.validateSourceUploadValue(bridgeVersion)
    //Extract input.json file and update sarif default file path based on bridge version
    productInputFilPath = util.extractInputJsonFilename(formattedCommand)
    // Extract product input file name from the path (cross-platform compatible)
    productInputFileName = basename(productInputFilPath)
    // Based on bridge version and productInputFileName get the sarif file path
    util.updateSarifFilePaths(productInputFileName, bridgeVersion, productInputFilPath)
    // Based on bridge version update Coverity configuration for backward compatibility
    util.updateCoverityConfigForBridgeVersion(productInputFileName, bridgeVersion, productInputFilPath)
    // FedRAMP CHECK 3: re-verify the binary immediately before execution
    await sb.verifyBinaryIntegrity()
    // Execute bridge command
    exitCode = await sb.executeBridgeCommand(formattedCommand, getGitHubWorkspaceDirV2())
    if (exitCode === 0) {
      info('Black Duck Security Action workflow execution completed successfully.')
      isBridgeExecuted = true
    }
    // The statement set the exit code in the 'status' variable which can be used in the YAML file
    if (parseToBoolean(inputs.RETURN_STATUS)) {
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
      if (parseToBoolean(inputs.INCLUDE_DIAGNOSTICS)) {
        await uploadDiagnostics()
      }
      if (!isPullRequestEvent() && uploadSarifReportBasedOnExitCode) {
        if (isVersionLess(bridgeVersion, constants.VERSION)) {
          // Upload Polaris sarif file as GitHub artifact (Deprecated Logic)
          if (inputs.BLACKDUCKSCA_URL && parseToBoolean(inputs.BLACKDUCKSCA_REPORTS_SARIF_CREATE)) {
            await uploadSarifReportAsArtifact(constants.BLACKDUCK_SARIF_GENERATOR_DIRECTORY, inputs.BLACKDUCKSCA_REPORTS_SARIF_FILE_PATH, constants.BLACKDUCK_SARIF_ARTIFACT_NAME.concat(util.getRealSystemTime()))
          }
          // Upload Polaris sarif file as GitHub artifact (Deprecated Logic)
          if (inputs.POLARIS_SERVER_URL && parseToBoolean(inputs.POLARIS_REPORTS_SARIF_CREATE)) {
            await uploadSarifReportAsArtifact(constants.POLARIS_SARIF_GENERATOR_DIRECTORY, inputs.POLARIS_REPORTS_SARIF_FILE_PATH, constants.POLARIS_SARIF_ARTIFACT_NAME.concat(util.getRealSystemTime()))
          }
        } else {
          // Upload Polaris sarif file as GitHub artifact (Deprecated Logic)
          if (inputs.BLACKDUCKSCA_URL && parseToBoolean(inputs.BLACKDUCKSCA_REPORTS_SARIF_CREATE)) {
            await uploadSarifReportAsArtifact(constants.INTEGRATIONS_BLACKDUCK_SARIF_GENERATOR_DIRECTORY, inputs.BLACKDUCKSCA_REPORTS_SARIF_FILE_PATH, constants.BLACKDUCK_SARIF_ARTIFACT_NAME.concat(util.getRealSystemTime()))
          }

          // Upload Polaris sarif file as GitHub artifact (Deprecated Logic)
          if (inputs.POLARIS_SERVER_URL && parseToBoolean(inputs.POLARIS_REPORTS_SARIF_CREATE)) {
            await uploadSarifReportAsArtifact(constants.INTEGRATIONS_POLARIS_SARIF_GENERATOR_DIRECTORY, inputs.POLARIS_REPORTS_SARIF_FILE_PATH, constants.POLARIS_SARIF_ARTIFACT_NAME.concat(util.getRealSystemTime()))
          }
        }
        if (!isNullOrEmptyValue(inputs.GITHUB_TOKEN)) {
          const gitHubClientService = await GitHubClientServiceFactory.getGitHubClientServiceInstance()
          if (isVersionLess(bridgeVersion, constants.VERSION)) {
            // Upload Black Duck SARIF Report to code scanning tab
            if (inputs.BLACKDUCKSCA_URL && parseToBoolean(inputs.BLACKDUCK_UPLOAD_SARIF_REPORT)) {
              await gitHubClientService.uploadSarifReport(constants.BLACKDUCK_SARIF_GENERATOR_DIRECTORY, inputs.BLACKDUCKSCA_REPORTS_SARIF_FILE_PATH)
            }

            // Upload Polaris SARIF Report to code scanning tab
            if (inputs.POLARIS_SERVER_URL && parseToBoolean(inputs.POLARIS_UPLOAD_SARIF_REPORT)) {
              await gitHubClientService.uploadSarifReport(constants.POLARIS_SARIF_GENERATOR_DIRECTORY, inputs.POLARIS_REPORTS_SARIF_FILE_PATH)
            }
          } else {
            // Upload Black Duck SARIF Report to code scanning tab
            if (inputs.BLACKDUCKSCA_URL && parseToBoolean(inputs.BLACKDUCK_UPLOAD_SARIF_REPORT)) {
              await gitHubClientService.uploadSarifReport(constants.INTEGRATIONS_BLACKDUCK_SARIF_GENERATOR_DIRECTORY, inputs.BLACKDUCKSCA_REPORTS_SARIF_FILE_PATH)
            }

            // Upload Polaris SARIF Report to code scanning tab
            if (inputs.POLARIS_SERVER_URL && parseToBoolean(inputs.POLARIS_UPLOAD_SARIF_REPORT)) {
              await gitHubClientService.uploadSarifReport(constants.INTEGRATIONS_POLARIS_SARIF_GENERATOR_DIRECTORY, inputs.POLARIS_REPORTS_SARIF_FILE_PATH)
            }
          }
        }
      }
    }
    await cleanupTempDir(tempDir)
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
// Extract version number from bridge path
function getBridgeVersion(bridgePath: string): string {
  try {
    const versionFilePath = join(bridgePath, 'versions.txt')
    const content = readFileSync(versionFilePath, 'utf-8')
    const bundleName = parseToBoolean(inputs.FEDRAMP_MODE) ? constants.BRIDGE_CLI_FIPS_BUNDLE_NAME : constants.BRIDGE_CLI_BUNDLE_NAME
    const match = content.match(new RegExp(`${bundleName}:\\s*([0-9.]+[a-zA-Z0-9]*)`))
    if (match && match[1]) {
      return match[1]
    }
    return ''
  } catch (error) {
    return ''
  }
}

run().catch(error => {
  if (error.message !== undefined) {
    const isReturnStatusEnabled = parseToBoolean(inputs.RETURN_STATUS)
    const exitCode = getBridgeExitCodeAsNumericValue(error)

    if (isReturnStatusEnabled) {
      debug(`Setting output variable ${constants.TASK_RETURN_STATUS} with exit code ${exitCode}`)
      setOutput(constants.TASK_RETURN_STATUS, exitCode)
    }

    const taskResult: string | undefined = checkJobResult(inputs.MARK_BUILD_STATUS)

    if (taskResult && taskResult !== constants.BUILD_STATUS.FAILURE) {
      markBuildStatusIfIssuesArePresent(exitCode, taskResult, error.message)
    } else {
      setFailed('Workflow failed! '.concat(logBridgeExitCodes(error.message)))
    }
  }
})
