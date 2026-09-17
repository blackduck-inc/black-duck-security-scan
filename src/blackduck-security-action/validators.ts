/**
 * @file validators.ts
 * @description Validation utilities for the Black Duck Security Action.
 * Provides functions to validate inputs, API endpoint URLs, and other
 * configuration values before they are used in the action.
 */

/**
 * @description Custom error type for security-related validation failures.
 */
export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

/**
 * @description Custom error type for general input validation failures.
 */
export class InputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InputValidationError';
  }
}

/**
 * @description Set of URL schemes that are explicitly disallowed in endpoint URLs.
 * These schemes can be used for injection attacks or unintended code execution.
 */
const DISALLOWED_URL_SCHEMES: readonly string[] = [
  'javascript:',
  'data:',
  'vbscript:',
  'file:',
  'ftp:',
];

/**
 * @description Regular expression matching characters that are not permitted
 * in a well-formed HTTPS endpoint URL. Allows alphanumeric characters,
 * common URL punctuation, and percent-encoded sequences.
 */
const DISALLOWED_URL_CHARS_PATTERN = /[<>"'\\{}|^`]/;

/**
 * @description Validates that the provided URL is a well-formed HTTPS endpoint.
 * Throws a SecurityError if the URL:
 * - Is empty or whitespace-only
 * - Does not use the HTTPS scheme
 * - Uses a disallowed scheme (javascript:, data:, etc.)
 * - Contains disallowed characters
 *
 * @param url - The endpoint URL string to validate.
 * @throws {SecurityError} If the URL fails any security validation check.
 * @throws {InputValidationError} If the URL is empty.
 */
export function validateEndpointUrl(url: string): void {
  if (!url || url.trim().length === 0) {
    throw new InputValidationError('Endpoint URL must not be empty.');
  }

  const trimmedUrl = url.trim();
  const lowerUrl = trimmedUrl.toLowerCase();

  // Check for explicitly disallowed schemes.
  for (const scheme of DISALLOWED_URL_SCHEMES) {
    if (lowerUrl.startsWith(scheme)) {
      throw new SecurityError(
        `Endpoint URL uses a disallowed scheme "${scheme}". Only HTTPS URLs are permitted.`
      );
    }
  }

  // Enforce HTTPS scheme.
  if (!lowerUrl.startsWith('https://')) {
    throw new SecurityError(
      `Endpoint URL "${trimmedUrl}" does not use HTTPS. ` +
        `Only HTTPS endpoints are permitted for security reasons.`
    );
  }

  // Check for disallowed characters.
  if (DISALLOWED_URL_CHARS_PATTERN.test(trimmedUrl)) {
    throw new SecurityError(
      `Endpoint URL "${trimmedUrl}" contains disallowed characters. ` +
        `URLs must not contain: < > " ' \\ { } | ^ \``
    );
  }

  // Attempt to parse the URL to ensure it is structurally valid.
  try {
    new URL(trimmedUrl);
  } catch {
    throw new SecurityError(
      `Endpoint URL "${trimmedUrl}" is not a valid URL structure.`
    );
  }
}

/**
 * @description Validates that a string value is non-empty and does not exceed
 * the specified maximum length.
 *
 * @param value - The string value to validate.
 * @param fieldName - The name of the field (used in error messages).
 * @param maxLength - Optional maximum allowed length (default: 1024).
 * @throws {InputValidationError} If the value is empty or exceeds maxLength.
 */
export function validateNonEmptyString(
  value: string,
  fieldName: string,
  maxLength = 1024
): void {
  if (!value || value.trim().length === 0) {
    throw new InputValidationError(`Field "${fieldName}" must not be empty.`);
  }
  if (value.length > maxLength) {
    throw new InputValidationError(
      `Field "${fieldName}" exceeds maximum length of ${maxLength} characters.`
    );
  }
}
