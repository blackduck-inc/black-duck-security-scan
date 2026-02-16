import * as fs from 'fs'
import path from 'path'
import {debug, info} from '@actions/core'
import {isNullOrEmptyValue, validateBlackduckFailureSeverities, validateCoverityInstallDirectoryParam} from './validators'
import * as inputs from './inputs'
import {Polaris} from './input-data/polaris'
import {InputData} from './input-data/input-data'
import {Coverity, CoverityDetect} from './input-data/coverity'
import {BlackDuckSCA, BLACKDUCKSCA_SCAN_FAILURE_SEVERITIES, BlackDuckDetect, BlackDuckFixPrData} from './input-data/blackduck'
import {GithubData} from './input-data/github'
import * as constants from '../application-constants'
import {isBoolean, isPullRequestEvent, parseToBoolean, isGitHubCloud} from './utility'
import {SRM} from './input-data/srm'
import {Network} from './input-data/common'

export class BridgeToolsParameter {
  tempDir: string
  private static STAGE_OPTION = '--stage'
  static DIAGNOSTICS_OPTION = '--diagnostics'
  private static INPUT_OPTION = '--input'
  private static POLARIS_STAGE = 'polaris'
  private static POLARIS_STATE_FILE_NAME = 'polaris_input.json'
  private static COVERITY_STATE_FILE_NAME = 'coverity_input.json'
  private static BD_STATE_FILE_NAME = 'bd_input.json'
  private static SRM_STATE_FILE_NAME = 'srm_input.json'
  private static SRM_STAGE = 'srm'
  // Coverity parameters
  private static COVERITY_STAGE = 'connect'
  static SPACE = ' '
  // Blackduck parameters
  private static BLACKDUCK_STAGE = 'blackducksca'

  constructor(tempDir: string) {
    this.tempDir = tempDir
  }
  getFormattedCommandForPolaris(githubRepoName: string): string {
    let command = ''
    const customHeader = isGitHubCloud() ? constants.INTEGRATIONS_GITHUB_CLOUD : constants.INTEGRATIONS_GITHUB_EE
    const assessmentTypeArray: string[] = []
    if (inputs.POLARIS_ASSESSMENT_TYPES) {
      // converting provided assessmentTypes to uppercase
      const assessmentTypes = inputs.POLARIS_ASSESSMENT_TYPES.toUpperCase().split(',')
      for (const assessmentType of assessmentTypes) {
        const regEx = new RegExp('^[a-zA-Z]+$')
        if (assessmentType.trim() && regEx.test(assessmentType.trim())) {
          assessmentTypeArray.push(assessmentType.trim())
        } else {
          throw new Error(constants.INVALID_VALUE_ERROR.concat(constants.POLARIS_ASSESSMENT_TYPES_KEY))
        }
      }
    }

    let projectName = inputs.POLARIS_PROJECT_NAME
    if (isNullOrEmptyValue(projectName)) {
      projectName = githubRepoName
    }

    let applicationName = inputs.POLARIS_APPLICATION_NAME
    if (isNullOrEmptyValue(applicationName)) {
      applicationName = githubRepoName
    }
    debug(`Polaris application name: ${applicationName}`)
    debug(`Polaris project name: ${projectName}`)

    const polData: InputData<Polaris> = {
      data: {
        network: {},
        polaris: {
          accesstoken: inputs.POLARIS_ACCESS_TOKEN,
          serverUrl: inputs.POLARIS_SERVER_URL,
          application: {name: applicationName},
          project: {name: projectName},
          assessment: {
            types: assessmentTypeArray,
            ...(inputs.POLARIS_ASSESSMENT_MODE && {
              mode: inputs.POLARIS_ASSESSMENT_MODE
            })
          }
        },
        bridge: {
          invoked: {
            from: customHeader
          }
        }
      }
    }

    if (inputs.POLARIS_BRANCH_NAME) {
      polData.data.polaris.branch = {name: inputs.POLARIS_BRANCH_NAME}
    }

    if (inputs.POLARIS_TEST_SCA_TYPE || inputs.POLARIS_TEST_SAST_TYPE || inputs.POLARIS_TEST_SCA_LOCATION || inputs.POLARIS_TEST_SAST_LOCATION) {
      polData.data.polaris.test = {}

      if (inputs.POLARIS_TEST_SCA_TYPE || inputs.POLARIS_TEST_SCA_LOCATION) {
        polData.data.polaris.test.sca = {
          ...(inputs.POLARIS_TEST_SCA_TYPE && {type: inputs.POLARIS_TEST_SCA_TYPE}),
          ...(inputs.POLARIS_TEST_SCA_LOCATION && {location: inputs.POLARIS_TEST_SCA_LOCATION})
        }
      }

      if (inputs.POLARIS_TEST_SAST_TYPE || inputs.POLARIS_TEST_SAST_LOCATION) {
        polData.data.polaris.test.sast = {
          ...(inputs.POLARIS_TEST_SAST_TYPE && {
            type: inputs.POLARIS_TEST_SAST_TYPE.split(',').map(polarisTestSastType => polarisTestSastType.trim())
          }),
          ...(inputs.POLARIS_TEST_SAST_LOCATION && {location: inputs.POLARIS_TEST_SAST_LOCATION})
        }
      }
    }

    if (isBoolean(inputs.POLARIS_WAITFORSCAN)) {
      polData.data.polaris.waitForScan = parseToBoolean(inputs.POLARIS_WAITFORSCAN)
    }

    if (inputs.PROJECT_DIRECTORY || inputs.PROJECT_SOURCE_ARCHIVE || inputs.PROJECT_SOURCE_EXCLUDES || inputs.PROJECT_SOURCE_PRESERVESYMLINKS) {
      polData.data.project = {}

      if (inputs.PROJECT_DIRECTORY) {
        polData.data.project.directory = inputs.PROJECT_DIRECTORY
      }

      if (inputs.PROJECT_SOURCE_ARCHIVE || inputs.PROJECT_SOURCE_EXCLUDES || inputs.PROJECT_SOURCE_PRESERVESYMLINKS) {
        polData.data.project.source = {}

        if (inputs.PROJECT_SOURCE_ARCHIVE) {
          polData.data.project.source.archive = inputs.PROJECT_SOURCE_ARCHIVE
        }

        if (inputs.PROJECT_SOURCE_PRESERVESYMLINKS) {
          polData.data.project.source.preserveSymLinks = parseToBoolean(inputs.PROJECT_SOURCE_PRESERVESYMLINKS)
        }

        if (inputs.PROJECT_SOURCE_EXCLUDES) {
          const sourceExcludesList: string[] = inputs.PROJECT_SOURCE_EXCLUDES.split(',').map(sourceExclude => sourceExclude.trim())
          polData.data.project.source.excludes = sourceExcludesList
        }
      }
    }

    if (inputs.POLARIS_POLICY_BADGES_CREATE !== '' && parseToBoolean(inputs.POLARIS_POLICY_BADGES_CREATE)) {
      polData.data.polaris.policy = {
        badges: {
          create: true,
          ...(Number.isInteger(parseInt(inputs.POLARIS_POLICY_BADGES_MAX_COUNT)) && {
            maxCount: parseInt(inputs.POLARIS_POLICY_BADGES_MAX_COUNT)
          })
        }
      }
      // Additional null check has been added to support avoid duplicate call to getGithubRepoInfo() when fix pr is enabled
      if (polData.data.github == null) {
        polData.data.github = this.getGithubRepoInfo()
      }
    } else if (inputs.POLARIS_POLICY_BADGES_CREATE !== '') {
      polData.data.polaris.policy = {
        badges: {
          create: false
        }
      }
      // Additional null check has been added to support avoid duplicate call to getGithubRepoInfo() when fix pr is enabled
      if (polData.data.github == null) {
        polData.data.github = this.getGithubRepoInfo()
      }
    }

    const isPrEvent = isPullRequestEvent()
    if (parseToBoolean(inputs.POLARIS_PRCOMMENT_ENABLED)) {
      if (isPrEvent) {
        /** Set Polaris PR comment inputs in case of PR context */
        info('Polaris PR comment is enabled')
        if (inputs.POLARIS_PARENT_BRANCH_NAME) {
          polData.data.polaris.branch = {
            ...(inputs.POLARIS_BRANCH_NAME && {name: inputs.POLARIS_BRANCH_NAME}),
            parent: {
              name: inputs.POLARIS_PARENT_BRANCH_NAME
            }
          }
        }
        const prCommentSeverities: string[] = []
        const inputPrCommentSeverities = inputs.POLARIS_PRCOMMENT_SEVERITIES
        if (inputPrCommentSeverities != null && inputPrCommentSeverities.length > 0) {
          const severityValues = inputPrCommentSeverities.split(',')
          for (const severity of severityValues) {
            if (severity.trim()) {
              prCommentSeverities.push(severity.trim())
            }
          }
        }
        polData.data.polaris.prComment = {
          enabled: true,
          ...(prCommentSeverities.length > 0 && {severities: prCommentSeverities})
        }
        polData.data.github = this.getGithubRepoInfo()
      } else {
        /** Log info if Polaris PR comment is enabled in case of non PR context */
        info(constants.POLARIS_PR_COMMENT_LOG_INFO_FOR_NON_PR_SCANS)
      }
    }
    // Github Issues Input parameters
    if (inputs.POLARIS_EXTERNALISSUES_CREATE || inputs.POLARIS_EXTERNALISSUES_TYPES || inputs.POLARIS_EXTERNALISSUES_GROUPSCAISSUES || inputs.POLARIS_EXTERNALISSUES_SEVERITIES || inputs.POLARIS_EXTERNALISSUES_MAXCOUNT) {
      polData.data.polaris.externalIssues = {}
      if (inputs.POLARIS_EXTERNALISSUES_CREATE) {
        polData.data.polaris.externalIssues.create = inputs.POLARIS_EXTERNALISSUES_CREATE
      }
      if (inputs.POLARIS_EXTERNALISSUES_SEVERITIES) {
        const externalIssuesSeverities: string[] = []
        const inputExternalIssuesSeverities = inputs.POLARIS_EXTERNALISSUES_SEVERITIES
        if (inputExternalIssuesSeverities != null && inputExternalIssuesSeverities.length > 0) {
          const severityValues = inputExternalIssuesSeverities.split(',')
          for (const severity of severityValues) {
            if (severity.trim()) {
              externalIssuesSeverities.push(severity.trim())
            }
          }
        }
        polData.data.polaris.externalIssues.severities = externalIssuesSeverities
      }
      if (inputs.POLARIS_EXTERNALISSUES_TYPES) {
        const externalIssuesTypes: string[] = []
        const inputExternalIssuesTypes = inputs.POLARIS_EXTERNALISSUES_TYPES
        if (inputExternalIssuesTypes != null && inputExternalIssuesTypes.length > 0) {
          const typesValues = inputExternalIssuesTypes.split(',')
          for (const type of typesValues) {
            if (type.trim()) {
              externalIssuesTypes.push(type.trim())
            }
          }
        }
        polData.data.polaris.externalIssues.types = externalIssuesTypes
      }
      if (inputs.POLARIS_EXTERNALISSUES_GROUPSCAISSUES) {
        polData.data.polaris.externalIssues.groupSCAIssues = inputs.POLARIS_EXTERNALISSUES_GROUPSCAISSUES
      }
      if (inputs.POLARIS_EXTERNALISSUES_MAXCOUNT) {
        polData.data.polaris.externalIssues.maxCount = parseInt(inputs.POLARIS_EXTERNALISSUES_MAXCOUNT)
      }
    }
    if (!isPrEvent) {
      if (parseToBoolean(inputs.POLARIS_REPORTS_SARIF_CREATE)) {
        /** Set Polaris SARIF inputs in case of non PR context */
        const sarifReportFilterSeverities: string[] = []
        const sarifReportFilterAssessmentIssuesType: string[] = []
        if (inputs.POLARIS_REPORTS_SARIF_SEVERITIES) {
          const filterSeverities = inputs.POLARIS_REPORTS_SARIF_SEVERITIES.split(',')
          for (const sarifSeverity of filterSeverities) {
            if (sarifSeverity) {
              sarifReportFilterSeverities.push(sarifSeverity.trim())
            }
          }
        }

        if (inputs.POLARIS_REPORTS_SARIF_ISSUE_TYPES) {
          const filterIssueTypes = inputs.POLARIS_REPORTS_SARIF_ISSUE_TYPES.split(',')
          for (const issueType of filterIssueTypes) {
            if (issueType) {
              sarifReportFilterAssessmentIssuesType.push(issueType.trim())
            }
          }
        }
        polData.data.polaris.reports = {
          sarif: {
            create: true,
            ...(inputs.POLARIS_REPORTS_SARIF_SEVERITIES && {
              severities: sarifReportFilterSeverities
            }),
            ...(inputs.POLARIS_REPORTS_SARIF_FILE_PATH && {
              file: {
                path: inputs.POLARIS_REPORTS_SARIF_FILE_PATH.trim()
              }
            }),
            ...(inputs.POLARIS_REPORTS_SARIF_ISSUE_TYPES && {
              issue: {
                types: sarifReportFilterAssessmentIssuesType
              }
            }),
            groupSCAIssues: isBoolean(inputs.POLARIS_REPORTS_SARIF_GROUP_SCA_ISSUES) ? JSON.parse(inputs.POLARIS_REPORTS_SARIF_GROUP_SCA_ISSUES) : true
          }
        }
      }
      if (parseToBoolean(inputs.POLARIS_UPLOAD_SARIF_REPORT) && isNullOrEmptyValue(inputs.GITHUB_TOKEN)) {
        /** Throw error if SARIF upload is enabled but GitHub token is empty */
        throw new Error(constants.GITHUB_TOKEN_VALIDATION_SARIF_UPLOAD_ERROR)
      }
    } else {
      if (parseToBoolean(inputs.POLARIS_REPORTS_SARIF_CREATE) || parseToBoolean(inputs.POLARIS_UPLOAD_SARIF_REPORT)) {
        /** Log info if SARIF create is enabled in PR context */
        info(constants.SARIF_REPORT_LOG_INFO_FOR_PR_SCANS)
      }
    }

    // Set Coverity and Blackduck Detect Arguments
    const coverityArgs = this.setCoverityDetectArgs()
    const detectArgs = this.setDetectArgs()

    if (Object.keys(coverityArgs).length > 0) {
      polData.data.coverity = {...polData.data.coverity, ...coverityArgs}
    }

    // Set Coverity version if provided
    debug(`COVERITY_VERSION input value: '${inputs.COVERITY_VERSION}'`)
    if (inputs.COVERITY_VERSION) {
      if (!polData.data.coverity) {
        polData.data.coverity = {}
      }
      polData.data.coverity.version = inputs.COVERITY_VERSION
      debug(`Set coverity version to: ${inputs.COVERITY_VERSION}`)
    } else {
      debug('COVERITY_VERSION is empty, not setting version')
    }

    if (Object.keys(detectArgs).length > 0) {
      polData.data.detect = {...polData.data.detect, ...detectArgs}
    }

    polData.data.network = this.setNetworkObj()

    const inputJson = JSON.stringify(polData, null, 2)
    const stateFilePath = path.join(this.tempDir, BridgeToolsParameter.POLARIS_STATE_FILE_NAME)
    fs.writeFileSync(stateFilePath, inputJson)

    debug('Generated state json file at - '.concat(stateFilePath))

    command = BridgeToolsParameter.STAGE_OPTION.concat(BridgeToolsParameter.SPACE).concat(BridgeToolsParameter.POLARIS_STAGE).concat(BridgeToolsParameter.SPACE).concat(BridgeToolsParameter.INPUT_OPTION).concat(BridgeToolsParameter.SPACE).concat(stateFilePath).concat(BridgeToolsParameter.SPACE)
    return command
  }

  getFormattedCommandForCoverity(githubRepoName: string): string {
    let command = ''
    const customHeader = isGitHubCloud() ? constants.INTEGRATIONS_GITHUB_CLOUD : constants.INTEGRATIONS_GITHUB_EE
    let coverityStreamName = inputs.COVERITY_STREAM_NAME
    const isPrEvent = isPullRequestEvent()

    if (isNullOrEmptyValue(coverityStreamName)) {
      const defaultStreamName = (isPrEvent ? process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_BASE_REF] : process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_REF_NAME]) || ''
      coverityStreamName = githubRepoName.concat('-').concat(defaultStreamName)
    }

    let coverityProjectName = inputs.COVERITY_PROJECT_NAME
    if (isNullOrEmptyValue(coverityProjectName)) {
      coverityProjectName = githubRepoName
    }
    debug(`Coverity project name: ${coverityProjectName}`)
    debug(`Coverity stream name: ${coverityStreamName}`)

    const covData: InputData<Coverity> = {
      data: {
        coverity: {
          connect: {
            user: {name: inputs.COVERITY_USER, password: inputs.COVERITY_PASSPHRASE},
            url: inputs.COVERITY_URL,
            project: {name: coverityProjectName},
            stream: {name: coverityStreamName}
          }
        },
        bridge: {
          invoked: {
            from: customHeader
          }
        }
      }
    }
    if (inputs.COVERITY_LOCAL) {
      covData.data.coverity.local = true
    }

    if (inputs.COVERITY_INSTALL_DIRECTORY) {
      if (validateCoverityInstallDirectoryParam(inputs.COVERITY_INSTALL_DIRECTORY)) {
        covData.data.coverity.install = {directory: inputs.COVERITY_INSTALL_DIRECTORY}
      }
    }

    if (inputs.COVERITY_POLICY_VIEW) {
      covData.data.coverity.connect.policy = {view: inputs.COVERITY_POLICY_VIEW}
    }

    if (isBoolean(inputs.COVERITY_WAITFORSCAN)) {
      covData.data.coverity.waitForScan = parseToBoolean(inputs.COVERITY_WAITFORSCAN)
    }

    if (inputs.PROJECT_DIRECTORY) {
      covData.data.project = {
        ...(inputs.PROJECT_DIRECTORY && {
          directory: inputs.PROJECT_DIRECTORY
        })
      }
    }

    if (inputs.COVERITY_VERSION) {
      covData.data.coverity.version = inputs.COVERITY_VERSION
    }

    if (parseToBoolean(inputs.COVERITY_PRCOMMENT_ENABLED)) {
      if (isPrEvent) {
        /** Set Coverity PR comment inputs in case of PR context */
        info('Coverity PR comment is enabled')
        covData.data.github = this.getGithubRepoInfo()

        // Always use new format initially - version detection will convert if needed
        const prCommentImpacts: string[] = []
        if (inputs.COVERITY_PRCOMMENT_IMPACTS && inputs.COVERITY_PRCOMMENT_IMPACTS.length > 0) {
          const impactValues = inputs.COVERITY_PRCOMMENT_IMPACTS.split(',')
          for (const impact of impactValues) {
            if (impact.trim()) {
              prCommentImpacts.push(impact.trim().toUpperCase())
            }
          }
        }

        covData.data.coverity.prcomment = {
          enabled: true,
          ...(prCommentImpacts.length > 0 && {impacts: prCommentImpacts})
        }
      } else {
        /** Log info if Coverity PR comment is enabled in case of non PR context */
        info(constants.COVERITY_PR_COMMENT_LOG_INFO_FOR_NON_PR_SCANS)
      }
    }

    covData.data.network = this.setNetworkObj()

    covData.data.coverity = Object.assign({}, this.setCoverityDetectArgs(), covData.data.coverity)

    const inputJson = JSON.stringify(covData)

    const stateFilePath = path.join(this.tempDir, BridgeToolsParameter.COVERITY_STATE_FILE_NAME)
    fs.writeFileSync(stateFilePath, inputJson)

    debug('Generated state json file at - '.concat(stateFilePath))

    command = BridgeToolsParameter.STAGE_OPTION.concat(BridgeToolsParameter.SPACE).concat(BridgeToolsParameter.COVERITY_STAGE).concat(BridgeToolsParameter.SPACE).concat(BridgeToolsParameter.INPUT_OPTION).concat(BridgeToolsParameter.SPACE).concat(stateFilePath).concat(BridgeToolsParameter.SPACE)
    return command
  }

  getFormattedCommandForBlackduck(): string {
    const failureSeverities: string[] = []
    const customHeader = isGitHubCloud() ? constants.INTEGRATIONS_GITHUB_CLOUD : constants.INTEGRATIONS_GITHUB_EE
    if (inputs.BLACKDUCKSCA_SCAN_FAILURE_SEVERITIES != null && inputs.BLACKDUCKSCA_SCAN_FAILURE_SEVERITIES.length > 0) {
      try {
        const failureSeveritiesInput = inputs.BLACKDUCKSCA_SCAN_FAILURE_SEVERITIES
        if (failureSeveritiesInput != null && failureSeveritiesInput.length > 0) {
          const failureSeveritiesArray = failureSeveritiesInput.toUpperCase().split(',')
          for (const failureSeverity of failureSeveritiesArray) {
            if (failureSeverity.trim().length > 0) {
              failureSeverities.push(failureSeverity.trim())
            }
          }
        }
      } catch (error) {
        throw new Error(constants.INVALID_VALUE_ERROR.concat(constants.BLACKDUCK_SCAN_FAILURE_SEVERITIES_KEY))
      }
    }
    let command = ''
    const blackduckData: InputData<BlackDuckSCA> = {
      data: {
        blackducksca: {
          url: inputs.BLACKDUCKSCA_URL,
          token: inputs.BLACKDUCKSCA_TOKEN
        },
        detect: {},
        bridge: {
          invoked: {
            from: customHeader
          }
        }
      }
    }

    if (inputs.DETECT_INSTALL_DIRECTORY) {
      blackduckData.data.detect = blackduckData.data.detect || {}
      blackduckData.data.detect.install = {directory: inputs.DETECT_INSTALL_DIRECTORY}
    }

    if (inputs.BLACKDUCKSCA_SCAN_FULL) {
      let scanFullValue = false
      if (inputs.BLACKDUCKSCA_SCAN_FULL.toLowerCase() === 'true' || inputs.BLACKDUCKSCA_SCAN_FULL.toLowerCase() === 'false') {
        scanFullValue = inputs.BLACKDUCKSCA_SCAN_FULL.toLowerCase() === 'true'
      } else {
        throw new Error(constants.MISSING_BOOLEAN_VALUE_ERROR.concat(constants.BLACKDUCK_SCAN_FULL_KEY))
      }
      blackduckData.data.blackducksca.scan = {full: scanFullValue}
    }

    if (failureSeverities && failureSeverities.length > 0) {
      validateBlackduckFailureSeverities(failureSeverities)
      const failureSeverityEnums: BLACKDUCKSCA_SCAN_FAILURE_SEVERITIES[] = []
      for (const failureSeverity of failureSeverities) {
        if (!Object.values(BLACKDUCKSCA_SCAN_FAILURE_SEVERITIES).includes(failureSeverity as BLACKDUCKSCA_SCAN_FAILURE_SEVERITIES)) {
          throw new Error(constants.INVALID_VALUE_ERROR.concat(constants.BLACKDUCK_SCAN_FAILURE_SEVERITIES_KEY))
        } else {
          failureSeverityEnums.push(BLACKDUCKSCA_SCAN_FAILURE_SEVERITIES[failureSeverity as keyof typeof BLACKDUCKSCA_SCAN_FAILURE_SEVERITIES])
        }
      }

      if (blackduckData.data.blackducksca.scan) {
        blackduckData.data.blackducksca.scan.failure = {severities: failureSeverityEnums}
      } else {
        blackduckData.data.blackducksca.scan = {failure: {severities: failureSeverityEnums}}
      }
    }

    if (isBoolean(inputs.BLACKDUCKSCA_WAITFORSCAN)) {
      blackduckData.data.blackducksca.waitForScan = parseToBoolean(inputs.BLACKDUCKSCA_WAITFORSCAN)
    }

    if (inputs.PROJECT_DIRECTORY) {
      blackduckData.data.project = {
        directory: inputs.PROJECT_DIRECTORY
      }
    }

    const isPrEvent = isPullRequestEvent()
    if (parseToBoolean(inputs.BLACKDUCKSCA_PRCOMMENT_ENABLED)) {
      if (isPrEvent) {
        /** Set Black Duck PR comment inputs in case of PR context */
        info('Black Duck PR comment is enabled')
        blackduckData.data.github = this.getGithubRepoInfo()
        blackduckData.data.blackducksca.automation = {prcomment: true}
      } else {
        info(constants.BLACKDUCK_PR_COMMENT_LOG_INFO_FOR_NON_PR_SCANS)
      }
    }
    if (parseToBoolean(inputs.BLACKDUCKSCA_FIXPR_ENABLED)) {
      if (!isPrEvent) {
        /** Set Black Duck Fix PR inputs in case of non PR context */
        info('Black Duck Fix PR is enabled')
        blackduckData.data.blackducksca.fixpr = this.setBlackDuckFixPrInputs()
        blackduckData.data.github = this.getGithubRepoInfo()
      } else {
        info(constants.BLACKDUCK_FIXPR_LOG_INFO_FOR_PR_SCANS)
      }
    }
    if (!isPrEvent) {
      if (parseToBoolean(inputs.BLACKDUCKSCA_REPORTS_SARIF_CREATE)) {
        /** Set Black Duck SARIF inputs in case of non PR context */
        const sarifReportFilterSeverities: string[] = []
        if (inputs.BLACKDUCKSCA_REPORTS_SARIF_SEVERITIES) {
          const filterSeverities = inputs.BLACKDUCKSCA_REPORTS_SARIF_SEVERITIES.split(',')
          for (const sarifSeverity of filterSeverities) {
            if (sarifSeverity) {
              sarifReportFilterSeverities.push(sarifSeverity.trim())
            }
          }
        }
        blackduckData.data.blackducksca.reports = {
          sarif: {
            create: true,
            ...(inputs.BLACKDUCKSCA_REPORTS_SARIF_SEVERITIES && {
              severities: sarifReportFilterSeverities
            }),
            ...(inputs.BLACKDUCKSCA_REPORTS_SARIF_FILE_PATH && {
              file: {
                path: inputs.BLACKDUCKSCA_REPORTS_SARIF_FILE_PATH.trim()
              }
            }),
            groupSCAIssues: isBoolean(inputs.BLACKDUCKSCA_REPORTS_SARIF_GROUP_SCA_ISSUES) ? JSON.parse(inputs.BLACKDUCKSCA_REPORTS_SARIF_GROUP_SCA_ISSUES) : true
          }
        }
      }
      if (parseToBoolean(inputs.BLACKDUCK_UPLOAD_SARIF_REPORT) && isNullOrEmptyValue(inputs.GITHUB_TOKEN)) {
        /** Throw error if SARIF upload is enabled but GitHub token is empty */
        throw new Error(constants.GITHUB_TOKEN_VALIDATION_SARIF_UPLOAD_ERROR)
      }
    } else {
      if (parseToBoolean(inputs.BLACKDUCKSCA_REPORTS_SARIF_CREATE) || parseToBoolean(inputs.BLACKDUCK_UPLOAD_SARIF_REPORT)) {
        /** Log info if SARIF create/upload is enabled in PR context */
        info(constants.SARIF_REPORT_LOG_INFO_FOR_PR_SCANS)
      }
    }

    if (inputs.BLACKDUCKSCA_POLICY_BADGES_CREATE !== '' && parseToBoolean(inputs.BLACKDUCKSCA_POLICY_BADGES_CREATE)) {
      blackduckData.data.blackducksca.policy = {
        badges: {
          create: true,
          ...(Number.isInteger(parseInt(inputs.BLACKDUCKSCA_POLICY_BADGES_MAX_COUNT)) && {
            maxCount: parseInt(inputs.BLACKDUCKSCA_POLICY_BADGES_MAX_COUNT)
          })
        }
      }
      // Additional null check has been added to support avoid duplicate call to getGithubRepoInfo() when fix pr is enabled
      if (blackduckData.data.github == null) {
        blackduckData.data.github = this.getGithubRepoInfo()
      }
    } else if (inputs.BLACKDUCKSCA_POLICY_BADGES_CREATE !== '') {
      blackduckData.data.blackducksca.policy = {
        badges: {
          create: false
        }
      }
      // Additional null check has been added to support avoid duplicate call to getGithubRepoInfo() when fix pr is enabled
      if (blackduckData.data.github == null) {
        blackduckData.data.github = this.getGithubRepoInfo()
      }
    }

    blackduckData.data.network = this.setNetworkObj()
    // Github Issues Input parameters
    if (inputs.BLACKDUCKSCA_EXTERNALISSUES_CREATE || inputs.BLACKDUCKSCA_EXTERNALISSUES_GROUPSCAISSUES || inputs.BLACKDUCKSCA_EXTERNALISSUES_SEVERITIES || inputs.BLACKDUCKSCA_EXTERNALISSUES_MAXCOUNT) {
      blackduckData.data.blackducksca.externalIssues = {}
      if (inputs.BLACKDUCKSCA_EXTERNALISSUES_CREATE) {
        blackduckData.data.blackducksca.externalIssues.create = inputs.BLACKDUCKSCA_EXTERNALISSUES_CREATE
      }
      if (inputs.BLACKDUCKSCA_EXTERNALISSUES_SEVERITIES) {
        const externalIssuesSeverities: string[] = []
        const inputExternalIssuesSeverities = inputs.BLACKDUCKSCA_EXTERNALISSUES_SEVERITIES
        if (inputExternalIssuesSeverities != null && inputExternalIssuesSeverities.length > 0) {
          const severityValues = inputExternalIssuesSeverities.split(',')
          for (const severity of severityValues) {
            if (severity.trim()) {
              externalIssuesSeverities.push(severity.trim())
            }
          }
        }
        blackduckData.data.blackducksca.externalIssues.severities = externalIssuesSeverities
      }
      if (inputs.BLACKDUCKSCA_EXTERNALISSUES_GROUPSCAISSUES) {
        blackduckData.data.blackducksca.externalIssues.groupSCAIssues = inputs.BLACKDUCKSCA_EXTERNALISSUES_GROUPSCAISSUES
      }
      if (inputs.BLACKDUCKSCA_EXTERNALISSUES_MAXCOUNT) {
        blackduckData.data.blackducksca.externalIssues.maxCount = parseInt(inputs.BLACKDUCKSCA_EXTERNALISSUES_MAXCOUNT)
      }
    }

    blackduckData.data.detect = Object.assign({}, this.setDetectArgs(), blackduckData.data.detect)

    const inputJson = JSON.stringify(blackduckData)

    const stateFilePath = path.join(this.tempDir, BridgeToolsParameter.BD_STATE_FILE_NAME)
    fs.writeFileSync(stateFilePath, inputJson)

    debug('Generated state json file at - '.concat(stateFilePath))

    command = BridgeToolsParameter.STAGE_OPTION.concat(BridgeToolsParameter.SPACE).concat(BridgeToolsParameter.BLACKDUCK_STAGE).concat(BridgeToolsParameter.SPACE).concat(BridgeToolsParameter.INPUT_OPTION).concat(BridgeToolsParameter.SPACE).concat(stateFilePath).concat(BridgeToolsParameter.SPACE)
    return command
  }

  getFormattedCommandForSRM(githubRepoName: string): string {
    let command = ''
    const customHeader = isGitHubCloud() ? constants.INTEGRATIONS_GITHUB_CLOUD : constants.INTEGRATIONS_GITHUB_EE
    let assessmentTypes: string[] = []
    if (inputs.SRM_ASSESSMENT_TYPES) {
      assessmentTypes = inputs.SRM_ASSESSMENT_TYPES.split(',')
    }

    const srmData: InputData<SRM> = {
      data: {
        srm: {
          url: inputs.SRM_URL,
          apikey: inputs.SRM_API_KEY,
          assessment: {types: assessmentTypes}
        },
        bridge: {
          invoked: {
            from: customHeader
          }
        }
      }
    }

    if (inputs.SRM_BRANCH_NAME || inputs.SRM_BRANCH_PARENT) {
      srmData.data.srm.branch = {
        ...(inputs.SRM_BRANCH_NAME && {name: inputs.SRM_BRANCH_NAME}),
        ...(inputs.SRM_BRANCH_PARENT && {parent: inputs.SRM_BRANCH_PARENT})
      }
    }

    if (inputs.SRM_PROJECT_NAME || inputs.SRM_PROJECT_ID) {
      srmData.data.srm.project = {
        ...(inputs.SRM_PROJECT_NAME && {name: inputs.SRM_PROJECT_NAME}),
        ...(inputs.SRM_PROJECT_ID && {id: inputs.SRM_PROJECT_ID})
      }
    } else {
      debug(`SRM project name: ${githubRepoName}`)
      srmData.data.srm.project = {
        name: githubRepoName
      }
    }

    if (inputs.DETECT_EXECUTION_PATH) {
      srmData.data.detect = {
        execution: {
          path: inputs.DETECT_EXECUTION_PATH
        }
      }
    }

    if (inputs.COVERITY_EXECUTION_PATH) {
      srmData.data.coverity = {
        execution: {
          path: inputs.COVERITY_EXECUTION_PATH
        }
      }
    }

    if (isBoolean(inputs.SRM_WAITFORSCAN)) {
      srmData.data.srm.waitForScan = parseToBoolean(inputs.SRM_WAITFORSCAN)
    }

    if (inputs.PROJECT_DIRECTORY) {
      srmData.data.project = {
        directory: inputs.PROJECT_DIRECTORY
      }
    }

    // Set Coverity and Blackduck Detect Arguments
    const coverityArgs = this.setCoverityDetectArgs()
    const detectArgs = this.setDetectArgs()

    if (Object.keys(coverityArgs).length > 0) {
      srmData.data.coverity = {...srmData.data.coverity, ...coverityArgs}
    }

    if (Object.keys(detectArgs).length > 0) {
      srmData.data.detect = {...srmData.data.detect, ...detectArgs}
    }

    const inputJson = JSON.stringify(srmData)

    const stateFilePath = path.join(this.tempDir, BridgeToolsParameter.SRM_STATE_FILE_NAME)
    fs.writeFileSync(stateFilePath, inputJson)

    debug('Generated state json file at - '.concat(stateFilePath))

    command = BridgeToolsParameter.STAGE_OPTION.concat(BridgeToolsParameter.SPACE).concat(BridgeToolsParameter.SRM_STAGE).concat(BridgeToolsParameter.SPACE).concat(BridgeToolsParameter.INPUT_OPTION).concat(BridgeToolsParameter.SPACE).concat(stateFilePath).concat(BridgeToolsParameter.SPACE)
    return command
  }

  private getGithubRepoInfo(): GithubData | undefined {
    const githubToken = inputs.GITHUB_TOKEN
    const githubRepo = process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_REPOSITORY]
    const githubRepoName = githubRepo !== undefined ? githubRepo.substring(githubRepo.indexOf('/') + 1, githubRepo.length).trim() : ''
    const githubBranchName = this.getGithubBranchName()
    const githubRef = process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_REF]
    const githubServerUrl = process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_SERVER_URL] || ''
    const githubHostUrl = githubServerUrl === constants.GITHUB_CLOUD_URL ? '' : githubServerUrl

    debug(`Github Repository: ${process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_REPOSITORY]}`)
    debug(`Github Ref Name: ${process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_REF_NAME]}`)
    debug(`Github Head Ref: ${process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_HEAD_REF]}`)
    debug(`Github Ref: ${process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_REF]}`)
    debug(`Github Server Url: ${process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_SERVER_URL]}`)

    // pr number will be part of "refs/pull/<pr_number>/merge"
    // if there is manual run without raising pr then GITHUB_REF will return refs/heads/branch_name
    const githubPrNumber = githubRef !== undefined ? githubRef.split('/')[2].trim() : ''
    const githubRepoOwner = process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_REPOSITORY_OWNER] || ''

    if (isNullOrEmptyValue(githubToken)) {
      throw new Error(constants.MISSING_GITHUB_TOKEN_FOR_FIX_PR_AND_PR_COMMENT_ERROR)
    }

    // This condition is required as per ts-lint as these fields may have undefined as well
    if (githubRepoName != null && githubBranchName != null && githubRepoOwner != null) {
      return this.setGithubData(githubToken, githubRepoName, githubRepoOwner, githubBranchName, githubPrNumber, githubHostUrl)
    }
    return undefined
  }

  private getGithubBranchName(): string {
    let branchName = ''
    if (parseToBoolean(inputs.POLARIS_PRCOMMENT_ENABLED)) {
      // Only polaris use case
      branchName = process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_HEAD_REF] || ''
    } else {
      // For pull requests, non-pull requests and manual trigger events
      if (process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_HEAD_REF] !== '') {
        branchName = process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_HEAD_REF] || ''
      } else {
        branchName = process.env[constants.GITHUB_ENVIRONMENT_VARIABLES.GITHUB_REF_NAME] || ''
      }
    }
    return branchName
  }

  private setGithubData(githubToken: string, githubRepoName: string, githubRepoOwner: string, githubBranchName: string, githubPrNumber: string, githubHostUrl: string): GithubData {
    const isPrEvent = isPullRequestEvent()
    const githubData: GithubData = {
      user: {
        token: githubToken
      },
      repository: {
        name: githubRepoName,
        owner: {
          name: githubRepoOwner
        },
        branch: {
          name: githubBranchName
        }
      }
    }
    if (isPrEvent && githubPrNumber != null) {
      githubData.repository.pull = {
        number: Number(githubPrNumber)
      }
    }
    if (githubHostUrl !== '') {
      githubData.host = {
        url: githubHostUrl
      }
    }
    debug(`Github repository name: ${githubData.repository.name}`)
    debug(`Github repository owner name: ${githubData.repository.owner.name}`)
    debug(`Github branch name: ${githubData.repository.branch.name}`)
    debug(`Github host url: ${githubData.host?.url}`)
    debug(`Github pull request number: ${githubData.repository.pull?.number}`)
    return githubData
  }

  private setBlackDuckFixPrInputs(): BlackDuckFixPrData | undefined {
    if (inputs.BLACKDUCKSCA_FIXPR_MAX_COUNT && isNaN(Number(inputs.BLACKDUCKSCA_FIXPR_MAX_COUNT))) {
      throw new Error(constants.INVALID_VALUE_ERROR.concat(constants.BLACKDUCK_FIXPR_MAXCOUNT_KEY))
    }
    const createSinglePr = parseToBoolean(inputs.BLACKDUCKSCA_FIXPR_CREATE_SINGLE_PR)
    if (createSinglePr && inputs.BLACKDUCKSCA_FIXPR_MAX_COUNT) {
      throw new Error(constants.BLACKDUCK_FIXPR_MAXCOUNT_KEY.concat(' is not applicable with ').concat(constants.BLACKDUCK_FIXPR_CREATE_SINGLE_PR_KEY))
    }
    const blackDuckFixPrData: BlackDuckFixPrData = {}
    blackDuckFixPrData.enabled = true
    if (isBoolean(inputs.BLACKDUCKSCA_FIXPR_CREATE_SINGLE_PR)) {
      blackDuckFixPrData.createSinglePR = parseToBoolean(inputs.BLACKDUCKSCA_FIXPR_CREATE_SINGLE_PR)
    }
    if (inputs.BLACKDUCKSCA_FIXPR_MAX_COUNT && !createSinglePr) {
      blackDuckFixPrData.maxCount = Number(inputs.BLACKDUCKSCA_FIXPR_MAX_COUNT)
    }

    const useUpgradeGuidance: string[] = []
    if (inputs.BLACKDUCKSCA_FIXPR_UPGRADE_GUIDANCE != null && inputs.BLACKDUCKSCA_FIXPR_UPGRADE_GUIDANCE.length > 0) {
      const useUpgradeGuidanceList = inputs.BLACKDUCKSCA_FIXPR_UPGRADE_GUIDANCE.split(',')
      for (const upgradeGuidance of useUpgradeGuidanceList) {
        if (upgradeGuidance != null && upgradeGuidance !== '') {
          useUpgradeGuidance.push(upgradeGuidance.trim())
        }
      }
      blackDuckFixPrData.useUpgradeGuidance = useUpgradeGuidance
    }
    const fixPRFilterSeverities: string[] = []
    if (inputs.BLACKDUCKSCA_FIXPR_FILTER_SEVERITIES != null && inputs.BLACKDUCKSCA_FIXPR_FILTER_SEVERITIES.length > 0) {
      const filterSeverities = inputs.BLACKDUCKSCA_FIXPR_FILTER_SEVERITIES.split(',')
      for (const fixPrSeverity of filterSeverities) {
        if (fixPrSeverity != null && fixPrSeverity !== '') {
          fixPRFilterSeverities.push(fixPrSeverity.trim())
        }
      }
    }
    if (fixPRFilterSeverities.length > 0) {
      blackDuckFixPrData.filter = {severities: fixPRFilterSeverities}
    }
    return blackDuckFixPrData
  }

  private setCoverityDetectArgs(): CoverityDetect {
    const covArbitraryData: CoverityDetect = {}
    if (inputs.COVERITY_BUILD_COMMAND) {
      covArbitraryData.build = {
        command: inputs.COVERITY_BUILD_COMMAND
      }
    }

    if (inputs.COVERITY_CLEAN_COMMAND) {
      covArbitraryData.clean = {
        command: inputs.COVERITY_CLEAN_COMMAND
      }
    }

    if (inputs.COVERITY_CONFIG_PATH) {
      covArbitraryData.config = {
        path: inputs.COVERITY_CONFIG_PATH
      }
    }

    if (inputs.COVERITY_ARGS) {
      covArbitraryData.args = inputs.COVERITY_ARGS
    }
    return covArbitraryData
  }

  private setDetectArgs(): BlackDuckDetect {
    const blackduckDetectData: BlackDuckDetect = {}
    if (inputs.DETECT_SEARCH_DEPTH && Number.isInteger(parseInt(inputs.DETECT_SEARCH_DEPTH))) {
      blackduckDetectData.search = {
        depth: parseInt(inputs.DETECT_SEARCH_DEPTH)
      }
    }

    if (inputs.DETECT_CONFIG_PATH) {
      blackduckDetectData.config = {
        path: inputs.DETECT_CONFIG_PATH
      }
    }

    if (inputs.DETECT_ARGS) {
      blackduckDetectData.args = inputs.DETECT_ARGS
    }
    return blackduckDetectData
  }

  private setNetworkObj(): Network {
    const network: Network = {}
    if (isBoolean(inputs.ENABLE_NETWORK_AIR_GAP)) {
      network.airGap = parseToBoolean(inputs.ENABLE_NETWORK_AIR_GAP)
    }

    if (!network.ssl) {
      network.ssl = {}
    }

    if (inputs.NETWORK_SSL_CERT_FILE) {
      network.ssl.cert = {file: inputs.NETWORK_SSL_CERT_FILE}
    }

    if (inputs.NETWORK_SSL_TRUST_ALL) {
      network.ssl.trustAll = parseToBoolean(inputs.NETWORK_SSL_TRUST_ALL)
    }
    return network
  }
}
