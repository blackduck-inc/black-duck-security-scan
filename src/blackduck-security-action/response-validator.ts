/**
 * @file response-validator.ts
 * @description API response validation utilities for the Black Duck Security Scan action.
 * Provides typed response validation and field sanitisation to prevent injection
 * or data corruption from malformed API responses.
 *
 * @module response-validator
 */

import { RESPONSE_MAX_SIZE_BYTES } from '../application-constants';

/**
 * Describes the expected shape of a single field in an API response.
 */
export interface FieldDescriptor {
  /** Whether this field must be present in the response. */
  required: boolean;
  /** The expected JavaScript typeof value for this field. */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
}

/**
 * Schema descriptor for validating an API response of type T.
 * Maps field names to their expected descriptors.
 */
export type ResponseSchema<T> = {
  [K in keyof T]?: FieldDescriptor;
} & {
  [key: string]: FieldDescriptor;
};

/**
 * Typed error thrown when API response validation fails.
 */
export class ValidationError extends Error {
  /** The field that caused the validation failure, if applicable. */
  public readonly field?: string;
  /** The validation rule that was violated. */
  public readonly rule: string;

  constructor(rule: string, message: string, field?: string) {
    super(message);
    this.name = 'ValidationError';
    this.rule = rule;
    this.field = field;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Validates a raw (unknown) API response against a provided schema descriptor.
 * Returns a typed object of type T if validation passes.
 *
 * Validation checks:
 * 1. Input is not null/undefined.
 * 2. Input is a plain object (not an array or primitive).
 * 3. Serialised size does not exceed RESPONSE_MAX_SIZE_BYTES.
 * 4. All required fields are present.
 * 5. All present fields match their expected types.
 *
 * @param raw - The raw response value from the API (typed as unknown).
 * @param schema - The schema descriptor defining expected fields and types.
 * @returns The validated and typed response object.
 * @throws {ValidationError} If any validation rule is violated.
 *
 * @example
 * ```typescript
 * interface ScanResult { id: string; status: string; }
 * const schema: ResponseSchema<ScanResult> = {
 *   id: { required: true, type: 'string' },
 *   status: { required: true, type: 'string' },
 * };
 * const result = validateApiResponse<ScanResult>(rawResponse, schema);
 * ```
 */
export function validateApiResponse<T extends Record<string, unknown>>(
  raw: unknown,
  schema: ResponseSchema<T>
): T {
  // Check for null/undefined
  if (raw === null || raw === undefined) {
    throw new ValidationError('null-check', 'API response is null or undefined.');
  }

  // Must be a plain object
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ValidationError(
      'type-check',
      `API response must be a plain object, got: ${Array.isArray(raw) ? 'array' : typeof raw}`
    );
  }

  // Check serialised size
  let serialised: string;
  try {
    serialised = JSON.stringify(raw);
  } catch {
    throw new ValidationError('serialisation', 'API response could not be serialised to JSON.');
  }

  const sizeBytes = Buffer.byteLength(serialised, 'utf8');
  if (sizeBytes > RESPONSE_MAX_SIZE_BYTES) {
    throw new ValidationError(
      'size-limit',
      `API response size (${sizeBytes} bytes) exceeds maximum allowed size (${RESPONSE_MAX_SIZE_BYTES} bytes).`
    );
  }

  const responseObj = raw as Record<string, unknown>;

  // Validate each field in the schema
  for (const [fieldName, descriptor] of Object.entries(schema)) {
    if (!descriptor) continue;

    const value = responseObj[fieldName];
    const isPresent = fieldName in responseObj && value !== undefined && value !== null;

    if (descriptor.required && !isPresent) {
      throw new ValidationError(
        'required-field',
        `Required field '${fieldName}' is missing from API response.`,
        fieldName
      );
    }

    if (isPresent) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== descriptor.type) {
        throw new ValidationError(
          'type-mismatch',
          `Field '${fieldName}' expected type '${descriptor.type}' but got '${actualType}'.`,
          fieldName
        );
      }
    }
  }

  return responseObj as T;
}

/**
 * Sanitises a string field from an API response by stripping HTML tags,
 * script content, and potentially dangerous HTML entities.
 * This is a defence-in-depth measure against injection attacks.
 *
 * @param value - The raw string value to sanitise.
 * @returns The sanitised string with HTML/script content removed.
 *
 * @example
 * ```typescript
 * sanitizeResponseField('<script>alert(1)</script>Hello'); // => 'Hello'
 * sanitizeResponseField('Clean string');                   // => 'Clean string'
 * ```
 */
export function sanitizeResponseField(value: string): string {
  if (!value || typeof value !== 'string') {
    return value;
  }

  let sanitised = value;

  // Remove <script>...</script> blocks (case-insensitive, multiline)
  sanitised = sanitised.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  // Remove all remaining HTML tags
  sanitised = sanitised.replace(/<[^>]+>/g, '');

  // Decode common HTML entities to their text equivalents
  sanitised = sanitised
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&apos;/g, "'");

  // Re-strip any tags that were hidden behind entities
  sanitised = sanitised.replace(/<[^>]+>/g, '');

  return sanitised;
}
