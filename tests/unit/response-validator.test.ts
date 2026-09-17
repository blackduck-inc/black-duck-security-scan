/**
 * @file response-validator.test.ts
 * @description Unit tests for the response-validator module.
 * Tests cover valid response pass-through, missing required fields, injection
 * pattern rejection, null/undefined rejection, and generic type inference.
 */

import {
  validateApiResponse,
  createRequiredFieldsSchema,
  ValidationError,
  type ResponseSchema,
} from '../../src/blackduck-security-action/response-validator';

describe('response-validator', () => {
  describe('validateApiResponse', () => {
    describe('null and undefined responses', () => {
      it('should throw ValidationError for a null response', () => {
        const schema = createRequiredFieldsSchema<{ id: string }>(['id']);
        expect(() => validateApiResponse(null, schema)).toThrow(ValidationError);
        expect(() => validateApiResponse(null, schema)).toThrow(
          'null or undefined'
        );
      });

      it('should throw ValidationError for an undefined response', () => {
        const schema = createRequiredFieldsSchema<{ id: string }>(['id']);
        expect(() => validateApiResponse(undefined, schema)).toThrow(ValidationError);
      });
    });

    describe('valid responses', () => {
      it('should return the typed value when the response matches the schema', () => {
        interface UserResponse {
          id: string;
          name: string;
        }
        const schema = createRequiredFieldsSchema<UserResponse>(['id', 'name']);
        const response = { id: '123', name: 'Test User' };

        const result = validateApiResponse<UserResponse>(response, schema);

        expect(result).toEqual(response);
        expect(result.id).toBe('123');
        expect(result.name).toBe('Test User');
      });

      it('should pass responses with additional unknown fields', () => {
        interface MinimalResponse {
          status: string;
        }
        const schema = createRequiredFieldsSchema<MinimalResponse>(['status']);
        const response = { status: 'ok', extraField: 'extra', anotherField: 42 };

        expect(() => validateApiResponse(response, schema)).not.toThrow();
      });

      it('should work with numeric field values', () => {
        interface CountResponse {
          count: number;
        }
        const schema = createRequiredFieldsSchema<CountResponse>(['count']);
        const response = { count: 42 };

        const result = validateApiResponse<CountResponse>(response, schema);
        expect(result.count).toBe(42);
      });
    });

    describe('missing required fields', () => {
      it('should throw ValidationError when a required field is missing', () => {
        interface TokenResponse {
          token: string;
          expiresAt: string;
        }
        const schema = createRequiredFieldsSchema<TokenResponse>(['token', 'expiresAt']);
        const response = { token: 'abc123' }; // missing expiresAt

        expect(() => validateApiResponse(response, schema)).toThrow(ValidationError);
        expect(() => validateApiResponse(response, schema)).toThrow('expiresAt');
      });

      it('should throw ValidationError when a required field is null', () => {
        interface StatusResponse {
          status: string;
        }
        const schema = createRequiredFieldsSchema<StatusResponse>(['status']);
        const response = { status: null };

        expect(() => validateApiResponse(response, schema)).toThrow(ValidationError);
      });

      it('should throw ValidationError when a required field is undefined', () => {
        interface StatusResponse {
          status: string;
        }
        const schema = createRequiredFieldsSchema<StatusResponse>(['status']);
        const response = { status: undefined };

        expect(() => validateApiResponse(response, schema)).toThrow(ValidationError);
      });
    });

    describe('script injection pattern rejection', () => {
      it('should throw ValidationError for a response containing a <script> tag', () => {
        const schema = createRequiredFieldsSchema<{ message: string }>(['message']);
        const response = { message: '<script>alert("xss")</script>' };

        expect(() => validateApiResponse(response, schema)).toThrow(ValidationError);
        expect(() => validateApiResponse(response, schema)).toThrow(
          'potentially unsafe string'
        );
      });

      it('should throw ValidationError for a response containing javascript: scheme', () => {
        const schema = createRequiredFieldsSchema<{ url: string }>(['url']);
        const response = { url: 'javascript:alert(1)' };

        expect(() => validateApiResponse(response, schema)).toThrow(ValidationError);
      });

      it('should throw ValidationError for a response containing an inline event handler', () => {
        const schema = createRequiredFieldsSchema<{ content: string }>(['content']);
        const response = { content: '<img onload=alert(1)>' };

        expect(() => validateApiResponse(response, schema)).toThrow(ValidationError);
      });

      it('should throw ValidationError for injection patterns in nested objects', () => {
        const schema = createRequiredFieldsSchema<{ data: unknown }>(['data']);
        const response = {
          data: {
            nested: {
              value: '<script>evil()</script>',
            },
          },
        };

        expect(() => validateApiResponse(response, schema)).toThrow(ValidationError);
      });

      it('should throw ValidationError for injection patterns in array values', () => {
        const schema = createRequiredFieldsSchema<{ items: unknown }>(['items']);
        const response = {
          items: ['safe-value', '<script>alert(1)</script>', 'another-safe-value'],
        };

        expect(() => validateApiResponse(response, schema)).toThrow(ValidationError);
      });

      it('should not throw for safe string values', () => {
        const schema = createRequiredFieldsSchema<{ message: string }>(['message']);
        const response = { message: 'This is a safe message with no injection.' };

        expect(() => validateApiResponse(response, schema)).not.toThrow();
      });
    });

    describe('custom schema', () => {
      it('should use the custom schema parse method for validation', () => {
        const customSchema: ResponseSchema<{ value: number }> = {
          parse(data: unknown): { value: number } {
            if (typeof data !== 'object' || data === null) {
              throw new ValidationError('Expected object');
            }
            const record = data as Record<string, unknown>;
            if (typeof record['value'] !== 'number') {
              throw new ValidationError('value must be a number');
            }
            return { value: record['value'] as number };
          },
        };

        const validResponse = { value: 42 };
        expect(validateApiResponse(validResponse, customSchema)).toEqual({ value: 42 });

        const invalidResponse = { value: 'not-a-number' };
        expect(() => validateApiResponse(invalidResponse, customSchema)).toThrow(
          ValidationError
        );
      });
    });

    describe('generic type inference', () => {
      it('should correctly infer the return type for different response shapes', () => {
        interface ScanResult {
          scanId: string;
          status: string;
          issueCount: number;
        }

        const schema = createRequiredFieldsSchema<ScanResult>([
          'scanId',
          'status',
          'issueCount',
        ]);

        const response: unknown = {
          scanId: 'scan-001',
          status: 'completed',
          issueCount: 5,
        };

        const result = validateApiResponse<ScanResult>(response, schema);

        // TypeScript should infer result as ScanResult
        expect(result.scanId).toBe('scan-001');
        expect(result.status).toBe('completed');
        expect(result.issueCount).toBe(5);
      });
    });
  });

  describe('createRequiredFieldsSchema', () => {
    it('should throw ValidationError when data is not an object', () => {
      const schema = createRequiredFieldsSchema<{ id: string }>(['id']);
      expect(() => schema.parse('string-value')).toThrow(ValidationError);
      expect(() => schema.parse(42)).toThrow(ValidationError);
      expect(() => schema.parse([])).toThrow(ValidationError);
    });

    it('should return the data as-is when all required fields are present', () => {
      const schema = createRequiredFieldsSchema<{ a: string; b: number }>(['a', 'b']);
      const data = { a: 'hello', b: 42 };
      expect(schema.parse(data)).toEqual(data);
    });
  });

  describe('ValidationError', () => {
    it('should be an instance of Error', () => {
      const err = new ValidationError('test error');
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('ValidationError');
    });

    it('should store the optional field name', () => {
      const err = new ValidationError('field error', 'myField');
      expect(err.field).toBe('myField');
    });

    it('should have undefined field when not provided', () => {
      const err = new ValidationError('error without field');
      expect(err.field).toBeUndefined();
    });
  });
});
