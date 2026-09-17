/**
 * @file application-constants.ts
 * @description Central constants module for the Black Duck Security Action.
 * All configuration constants, endpoint URLs, algorithm lists, and security
 * policy values are defined here. Use SCREAMING_SNAKE_CASE for all constants.
 * Add @deprecated JSDoc annotations for any legacy constants retained for
 * backward compatibility.
 */

/**
 * @description The endpoint used to revoke/invalidate authentication tokens
 * during post-run cleanup or user logout flows.
 * If the backend does not support token revocation, this endpoint will return
 * 404 and the action will fall back to local state clearing only.
 */
export const TOKEN_REVOCATION_ENDPOINT =
  'https://api.blackduck.synopsys.com/api/tokens/revoke';

/**
 * @description List of cryptographic hash algorithms supported by the
 * crypto-utils module. MD5 and SHA-1 are intentionally excluded.
 */
export const SUPPORTED_HASH_ALGORITHMS: readonly ('sha256' | 'sha512')[] = [
  'sha256',
  'sha512',
] as const;

/**
 * @description Regular expression used to detect script-injection-like patterns
 * in API response string values. Matches common XSS and injection vectors.
 */
export const SCRIPT_INJECTION_PATTERN =
  /<script[\s\S]*?>|javascript\s*:|on\w+\s*=|<\s*iframe|<\s*object|<\s*embed|<\s*link|<\s*meta/i;

/**
 * @description Base URL for the Black Duck Security Action GitHub repository.
 * Used for documentation links and update checks.
 */
export const BLACKDUCK_SECURITY_SCAN_REPO_URL =
  'https://github.com/blackduck-inc/black-duck-security-scan';

/**
 * @description Base URL for the Synopsys Bridge CLI download endpoint.
 */
export const BRIDGE_CLI_DOWNLOAD_URL =
  'https://sig-repo.synopsys.com/artifactory/bds-integrations-release/com/synopsys/integration/synopsys-bridge';

/**
 * @description Base URL for the Synopsys Bridge CLI download endpoint (alias).
 * @deprecated Use BRIDGE_CLI_DOWNLOAD_URL instead.
 */
export const SYNOPSYS_BRIDGE_URL = BRIDGE_CLI_DOWNLOAD_URL;

/**
 * @description The default name of the Black Duck Security Action.
 */
export const BLACKDUCK_SECURITY_ACTION_NAME = 'black-duck-security-scan';

/**
 * @description The default exit code used when the action fails due to
 * security policy violations.
 */
export const POLICY_VIOLATION_EXIT_CODE = 8;

/**
 * @description The default exit code used when the action fails due to
 * a bridge CLI error.
 */
export const BRIDGE_CLI_ERROR_EXIT_CODE = 1;

/**
 * @description Environment variable name for the Black Duck API token.
 */
export const BLACKDUCK_TOKEN_ENV_VAR = 'BLACKDUCK_TOKEN';

/**
 * @description Environment variable name for the Polaris access token.
 */
export const POLARIS_ACCESS_TOKEN_ENV_VAR = 'POLARIS_ACCESS_TOKEN';

/**
 * @description Environment variable name for the Coverity passphrase.
 */
export const COVERITY_PASSPHRASE_ENV_VAR = 'COVERITY_PASSPHRASE';

/**
 * @description The default Content-Security-Policy header name.
 */
export const CSP_HEADER_NAME = 'Content-Security-Policy';

/**
 * @description Maximum allowed length for API response string field values.
 * Responses with string fields exceeding this length are considered suspicious.
 */
export const MAX_API_RESPONSE_STRING_LENGTH = 65536;

/**
 * @description Timeout in milliseconds for token revocation HTTP requests.
 */
export const TOKEN_REVOCATION_TIMEOUT_MS = 5000;
