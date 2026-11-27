import * as fs from 'fs'
import * as os from 'os'
import {error} from '@actions/core'
import * as constants from '../application-constants'
import * as inputs from './inputs'

export function validateCoverityInstallDirectoryParam(installDir: string): boolean {
  if (installDir == null || installDir.length === 0) {
    error(`[${constants.COVERITY_INSTALL_DIRECTORY_KEY}] parameter for Coverity is missing`)
    return false
  }
  if (!fs.existsSync(installDir)) {
    error(`[${constants.COVERITY_INSTALL_DIRECTORY_KEY}] parameter for Coverity is invalid`)
    return false
  }
  return true
}

export function validateBlackduckFailureSeverities(severities: string[]): boolean {
  if (severities == null || severities.length === 0) {
    error(constants.PROVIDED_BLACKDUCKSCA_FAILURE_SEVERITIES_ERROR)
    return false
  }
  return true
}

export function validateFedRAMPMode(): string[] {
  const errors: string[] = []
  if (inputs.FEDRAMP_MODE.toLowerCase() !== 'true') {
    return errors
  }
  // No macOS Intel support for the FIPS Bridge CLI
  if (process.platform === constants.MAC_PLATFORM_NAME && os.arch() !== 'arm64') {
    errors.push(constants.FEDRAMP_MAC_INTEL_UNSUPPORTED_ERROR)
  }
  const polarisUrl = inputs.POLARIS_SERVER_URL
  if (!polarisUrl) {
    errors.push(constants.FEDRAMP_POLARIS_URL_MISSING_ERROR)
  } else if (!isFedRAMPUrlValid(polarisUrl, constants.FEDRAMP_ALLOWED_POLARIS_DOMAIN_PATTERNS, false)) {
    errors.push(constants.FEDRAMP_POLARIS_URL_INVALID_ERROR.replace('{0}', constants.FEDRAMP_ALLOWED_POLARIS_DOMAIN_PATTERNS.join(', ')))
  }
  // Custom Bridge CLI download URL (optional): must be https, on an approved host, and point to the FIPS bundle
  const bridgeUrl = inputs.BRIDGE_CLI_DOWNLOAD_URL
  if (bridgeUrl && !isFedRAMPUrlValid(bridgeUrl, constants.FEDRAMP_ALLOWED_BRIDGE_DOMAINS, true)) {
    errors.push(constants.FEDRAMP_BRIDGE_URL_INVALID_ERROR.replace('{0}', constants.FEDRAMP_ALLOWED_BRIDGE_DOMAINS.join(', ')))
  }
  return errors
}

// Hostname-only match (exact or subdomain), https required; never logs the URL
function isFedRAMPUrlValid(url: string, allowedDomains: string[], requireFipsBundlePath: boolean): boolean {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()
    const hostAllowed = allowedDomains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`))
    if (parsed.protocol !== 'https:' || !hostAllowed) {
      return false
    }
    if (requireFipsBundlePath) {
      const lastSegment = parsed.pathname.split('/').pop() || ''
      const hasFipsSegment = parsed.pathname.split('/').some(segment => segment === constants.FEDRAMP_BRIDGE_FIPS_BUNDLE_NAME || segment.startsWith(`${constants.FEDRAMP_BRIDGE_FIPS_BUNDLE_NAME}-`))
      // No macOS Intel build exists for the FIPS bundle
      return hasFipsSegment && !lastSegment.includes('-macosx.')
    }
    return true
  } catch {
    return false
  }
}

// In FedRAMP mode the Bridge command may only contain non-secret flags; tokens must go via the input JSON file
export function validateFedRAMPCommand(command: string): string[] {
  const errors: string[] = []
  if (inputs.FEDRAMP_MODE.toLowerCase() !== 'true') {
    return errors
  }
  const flags = command.match(/(?:^|\s)--[A-Za-z0-9_-]+/g) || []
  const hasDisallowedFlag = flags.some(flag => !constants.FEDRAMP_ALLOWED_COMMAND_FLAGS.includes(flag.trim()))
  if (hasDisallowedFlag) {
    errors.push(constants.FEDRAMP_TOKEN_ARGUMENT_ERROR)
  }
  return errors
}

export function validateScanTypes(): string[] {
  const paramsMap = new Map()
  paramsMap.set(constants.POLARIS_SERVER_URL_KEY, inputs.POLARIS_SERVER_URL)
  paramsMap.set(constants.COVERITY_URL_KEY, inputs.COVERITY_URL)
  paramsMap.set(constants.BLACKDUCKSCA_URL_KEY, inputs.BLACKDUCKSCA_URL)
  paramsMap.set(constants.SRM_URL_KEY, inputs.SRM_URL)
  return isNullOrEmpty(paramsMap)
}

export function validatePolarisInputs(): string[] {
  let errors: string[] = []
  if (inputs.POLARIS_SERVER_URL) {
    const paramsMap = new Map()
    paramsMap.set(constants.POLARIS_ACCESS_TOKEN_KEY, inputs.POLARIS_ACCESS_TOKEN)
    paramsMap.set(constants.POLARIS_SERVER_URL_KEY, inputs.POLARIS_SERVER_URL)
    paramsMap.set(constants.POLARIS_ASSESSMENT_TYPES_KEY, inputs.POLARIS_ASSESSMENT_TYPES)
    errors = validateParameters(paramsMap, constants.POLARIS_KEY)
  }
  return errors
}

export function validateCoverityInputs(): string[] {
  let errors: string[] = []
  if (inputs.COVERITY_URL) {
    const paramsMap = new Map()
    paramsMap.set(constants.COVERITY_USER_KEY, inputs.COVERITY_USER)
    paramsMap.set(constants.COVERITY_PASSWORD_KEY, inputs.COVERITY_PASSPHRASE)
    paramsMap.set(constants.COVERITY_URL_KEY, inputs.COVERITY_URL)
    errors = validateParameters(paramsMap, constants.COVERITY_KEY)
  }
  return errors
}

export function validateBlackDuckInputs(): string[] {
  let errors: string[] = []
  if (inputs.BLACKDUCKSCA_URL) {
    const paramsMap = new Map()
    paramsMap.set(constants.BLACKDUCKSCA_URL_KEY, inputs.BLACKDUCKSCA_URL)
    paramsMap.set(constants.BLACKDUCKSCA_TOKEN_KEY, inputs.BLACKDUCKSCA_TOKEN)
    errors = validateParameters(paramsMap, constants.BLACKDUCKSCA_KEY)
  }
  return errors
}

export function validateSRMInputs(): string[] {
  let errors: string[] = []
  if (inputs.SRM_URL) {
    const paramsMap = new Map()
    paramsMap.set(constants.SRM_URL_KEY, inputs.SRM_URL)
    paramsMap.set(constants.SRM_API_KEY, inputs.SRM_API_KEY)
    paramsMap.set(constants.SRM_ASSESSMENT_TYPES_KEY, inputs.SRM_ASSESSMENT_TYPES)
    errors = validateParameters(paramsMap, constants.SRM_KEY)
  }
  return errors
}

export function validateParameters(params: Map<string, string>, toolName: string): string[] {
  const invalidParams: string[] = isNullOrEmpty(params)
  const errors: string[] = []
  if (invalidParams.length > 0) {
    errors.push(`[${invalidParams.join()}] - required parameters for ${toolName} is missing`)
  }
  return errors
}

export function isNullOrEmpty(params: Map<string, string>): string[] {
  const invalidParams: string[] = []
  for (const param of params.entries()) {
    if (param[1] == null || param[1].length === 0) {
      invalidParams.push(param[0])
    }
  }
  return invalidParams
}

export function isNullOrEmptyValue(param: string): boolean {
  return param == null || param.length === 0
}

export function validateBridgeUrl(url: string): boolean {
  if (!url.match('.*\\.(zip|ZIP)$')) {
    return false
  }
  const osName = process.platform
  const fileNameComponent = url.substring(url.lastIndexOf('/'), url.length)
  if (osName === 'darwin') {
    return fileNameComponent.toLowerCase().includes('mac')
  } else if (osName === 'linux') {
    return fileNameComponent.toLowerCase().includes('linux')
  } else if (osName === 'win32') {
    return fileNameComponent.toLowerCase().includes('win')
  } else {
    return false
  }
}
