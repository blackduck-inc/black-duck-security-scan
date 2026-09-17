/**
 * @file application-constants.ts
 * @description Centralised application constants for the Black Duck Security Scan action.
 * All exported constants use SCREAMING_SNAKE_CASE per project conventions.
 * Deprecated constants are annotated with @deprecated JSDoc tags.
 */

// ---------------------------------------------------------------------------
// Token / Authentication Constants
// ---------------------------------------------------------------------------

/**
 * Whether token invalidation (revocation) is enabled.
 * When false, invalidateToken() will skip the revocation API call but will
 * still mask the token via core.setSecret().
 */
export const TOKEN_INVALIDATION_ENABLED = true;

/**
 * Buffer time in milliseconds before a token's stated expiry at which the
 * action should proactively refresh or invalidate the token.
 */
export const TOKEN_EXPIRY_BUFFER_MS = 60_000; // 1 minute

/**
 * Maximum number of token invalidation retry attempts before giving up.
 */
export const TOKEN_INVALIDATION_MAX_RETRIES = 3;

// ---------------------------------------------------------------------------
// Cryptographic Constants
// ---------------------------------------------------------------------------

/**
 * Allowlist of hash algorithms considered cryptographically acceptable.
 * MD5 and SHA-1 are intentionally excluded due to known weaknesses.
 */
export const ALLOWED_HASH_ALGORITHMS: ReadonlyArray<string> = ['sha256', 'sha384', 'sha512'];

/**
 * Default HMAC algorithm used for signature validation.
 */
export const HMAC_ALGORITHM = 'sha256';

// ---------------------------------------------------------------------------
// API Endpoint Validation Constants
// ---------------------------------------------------------------------------

/**
 * Allowlist of RegExp patterns that a validated endpoint URL must match.
 * Only HTTPS endpoints matching at least one pattern are considered valid.
 */
export const ALLOWED_ENDPOINT_PATTERNS: ReadonlyArray<RegExp> = [
  /^https:\/\/[a-zA-Z0-9.-]+\.blackduck\.com(:\/|\/)?.*/,
  /^https:\/\/[a-zA-Z0-9.-]+\.synopsys\.com(:\/|\/)?.*/,
  /^https:\/\/[a-zA-Z0-9.-]+\.polaris\.blackduck\.com(:\/|\/)?.*/,
  /^https:\/\/[a-zA-Z0-9.-]+\.coverity\.synopsys\.com(:\/|\/)?.*/,
  // Allow any HTTPS host for flexibility in self-hosted / on-prem deployments
  // while still enforcing HTTPS protocol
  /^https:\/\/.+/,
];

/**
 * Allowlist of known SCM (Source Control Management) hostnames for repository
 * URL validation.
 */
export const ALLOWED_REPO_HOSTNAMES: ReadonlyArray<string> = [
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'dev.azure.com',
  'ssh.dev.azure.com',
  'vs-ssh.visualstudio.com',
];

// ---------------------------------------------------------------------------
// API Response Validation Constants
// ---------------------------------------------------------------------------

/**
 * Maximum allowed size of an API response body in bytes.
 * Responses exceeding this limit will be rejected by validateApiResponse().
 */
export const RESPONSE_MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// ---------------------------------------------------------------------------
// Content Security Policy Constants
// ---------------------------------------------------------------------------

/**
 * CSP directives applied to generated HTML report artifacts.
 * These are rendered as a <meta http-equiv="Content-Security-Policy"> tag.
 */
export const CSP_POLICY_DIRECTIVES: Readonly<Record<string, string[]>> = {
  'default-src': ["'none'"],
  'script-src': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:'],
  'font-src': ["'self'"],
  'connect-src': ["'self'"],
  'frame-ancestors': ["'none'"],
  'form-action': ["'self'"],
  'base-uri': ["'self'"],
  'object-src': ["'none'"],
};

/**
 * Directives that MUST be present in any CSP string for it to be considered
 * compliant by validateCspHeader().
 */
export const REQUIRED_CSP_DIRECTIVES: ReadonlyArray<string> = [
  'default-src',
  'script-src',
  'object-src',
  'frame-ancestors',
];

// ---------------------------------------------------------------------------
// Legacy / Deprecated Constants
// ---------------------------------------------------------------------------

/**
 * @deprecated Use TOKEN_INVALIDATION_ENABLED instead.
 * Retained for backwards compatibility only.
 */
export const ENABLE_TOKEN_CLEANUP = TOKEN_INVALIDATION_ENABLED;
