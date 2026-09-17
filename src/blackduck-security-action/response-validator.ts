/**
 * @file response-validator.ts
 * @description Provides runtime validation of API responses before they are
 * processed by the Black Duck Security Action. Prevents injection attacks and
 * data corruption by rejecting responses with unexpected shapes, missing required
 * fields, or suspicious string values.
 */

import { SCRIPT_INJECTION_PATTERN } from '../../application-constants';

/**
 * @description Interface for a response schema validator. Compatible with
 * manual validators and schema libraries that expose a `parse` method.
 *
 * @template T - The expected shape of the validated response.
 */
export interface ResponseSchema<T> {
  /**
   * @description Parses and validates the raw unknown data, returning a typed value
   * or throwing a ValidationError if the data does not conform to the schema.
   *
   * @param data - The raw unknown response data to validate.
   * @returns The validated and typed response value.
   * @throws {ValidationError} If validation fails.
   */
  parse(data: unknown): T;
}

/**
 * @description Custom error type for API response validation failures.
 */
export class ValidationError extends Error {
  public readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * @description Validates an API response against the provided schema.
 * Rejects null/undefined responses, responses with script-injection-like
 * string values, and responses that do not match the expected schema shape.
 *
 * @template T - The expected response type.
 * @param response - The raw unknown response data from an API call.
 * @param schema - A ResponseSchema instance that defines the expected shape.
 * @returns The validated and typed response value.
 * @throws {ValidationError} If the response is null, undefined, contains
 *   suspicious values, or does not match the schema.
 */
export function validateApiResponse<T>(response: unknown, schema: ResponseSchema<T>): T {
  if (response === null || response === undefined) {
    throw new ValidationError('API response is null or undefined.');
  }

  // Pre-validate string values in the response for injection patterns.
  checkForInjectionPatterns(response);

  return schema.parse(response);
}

/**
 * @description Recursively checks all string values in the response object
 * for patterns that resemble script injection or XSS payloads.
 *
 * @param value - The value to inspect (may be nested objects/arrays).
 * @param path - The current JSON path for error reporting.
 * @throws {ValidationError} If a suspicious string value is found.
 */
function checkForInjectionPatterns(value: unknown, path = 'root'): void {
  if (typeof value === 'string') {
    if (SCRIPT_INJECTION_PATTERN.test(value)) {
      throw new ValidationError(
        `API response contains a potentially unsafe string value at path "${path}". ` +
          `Response rejected to prevent injection attacks.`,
        path
      );
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      checkForInjectionPatterns(item, `${path}[${index}]`);
    });
    return;
  }

  if (typeof value === 'object' && value !== null) {
    for (const [key, val] of Object.entries(value)) {
      checkForInjectionPatterns(val, `${path}.${key}`);
    }
  }
}

/**
 * @description Creates a simple field-presence schema for validating that
 * a response object contains all required fields with non-null values.
 *
 * @param requiredFields - Array of field names that must be present and non-null.
 * @returns A ResponseSchema instance that validates field presence.
 */
export function createRequiredFieldsSchema<T extends Record<string, unknown>>(
  requiredFields: (keyof T)[]
): ResponseSchema<T> {
  return {
    parse(data: unknown): T {
      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        throw new ValidationError(
          `Expected an object response but received: ${Array.isArray(data) ? 'array' : typeof data}`
        );
      }

      const record = data as Record<string, unknown>;

      for (const field of requiredFields) {
        const fieldKey = field as string;
        if (!(fieldKey in record) || record[fieldKey] === null || record[fieldKey] === undefined) {
          throw new ValidationError(
            `Required field "${fieldKey}" is missing or null in API response.`,
            fieldKey
          );
        }
      }

      return data as T;
    },
  };
}
