/**
 * @file response-validator.test.ts
 * @description Unit tests for the response-validator module.
 */

import {
  validateApiResponse,
  sanitizeResponseField,
  ValidationError,
  ResponseSchema,
} from '../../src/blackduck-security-action/response-validator';

interface TestResponse {
  id: string;
  status: string;
  count: number;
  active: boolean;
}

const testSchema: ResponseSchema<TestResponse> = {
  id: { required: true, type: 'string' },
  status: { required: true, type: 'string' },
  count: { required: false, type: 'number' },
  active: { required: false, type: 'boolean' },
};

describe('response-validator', () => {
  describe('validateApiResponse', () => {
    it('should return a typed object for a valid response matching the schema', () => {
      const raw: unknown = { id: 'scan-123', status: 'completed', count: 5, active: true };
      const result = validateApiResponse<TestResponse>(raw, testSchema);
      expect(result.id).toBe('scan-123');
      expect(result.status).toBe('completed');
      expect(result.count).toBe(5);
      expect(result.active).toBe(true);
    });

    it('should return typed object when optional fields are absent', () => {
      const raw: unknown = { id: 'scan-456', status: 'pending' };
      const result = validateApiResponse<TestResponse>(raw, testSchema);
      expect(result.id).toBe('scan-456');
      expect(result.status).toBe('pending');
    });

    it('should throw ValidationError for missing required field', () => {
      const raw: unknown = { status: 'completed' }; // missing 'id'
      expect(() => validateApiResponse<TestResponse>(raw, testSchema)).toThrow(ValidationError);
    });

    it('should throw ValidationError with correct rule for missing required field', () => {
      const raw: unknown = { status: 'completed' };
      expect(() => validateApiResponse<TestResponse>(raw, testSchema)).toThrow(
        expect.objectContaining({ rule: 'required-field', field: 'id' })
      );
    });

    it('should throw ValidationError for unexpected field type', () => {
      const raw: unknown = { id: 123, status: 'completed' }; // id should be string
      expect(() => validateApiResponse<TestResponse>(raw, testSchema)).toThrow(ValidationError);
    });

    it('should throw ValidationError with type-mismatch rule for wrong type', () => {
      const raw: unknown = { id: 123, status: 'completed' };
      expect(() => validateApiResponse<TestResponse>(raw, testSchema)).toThrow(
        expect.objectContaining({ rule: 'type-mismatch', field: 'id' })
      );
    });

    it('should throw ValidationError for null input', () => {
      expect(() => validateApiResponse<TestResponse>(null, testSchema)).toThrow(ValidationError);
    });

    it('should throw ValidationError for undefined input', () => {
      expect(() => validateApiResponse<TestResponse>(undefined, testSchema)).toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError for array input', () => {
      const raw: unknown = [{ id: 'scan-123', status: 'completed' }];
      expect(() => validateApiResponse<TestResponse>(raw, testSchema)).toThrow(ValidationError);
    });

    it('should throw ValidationError for primitive string input', () => {
      const raw: unknown = 'just a string';
      expect(() => validateApiResponse<TestResponse>(raw, testSchema)).toThrow(ValidationError);
    });

    it('should handle extra fields in the response without throwing', () => {
      const raw: unknown = { id: 'scan-789', status: 'running', extraField: 'extra' };
      const result = validateApiResponse<TestResponse>(raw, testSchema);
      expect(result.id).toBe('scan-789');
    });
  });

  describe('sanitizeResponseField', () => {
    it('should strip <script> tags and their content', () => {
      const result = sanitizeResponseField('<script>alert("xss")</script>Hello');
      expect(result).toBe('Hello');
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
    });

    it('should strip HTML tags', () => {
      const result = sanitizeResponseField('<b>Bold</b> text');
      expect(result).toBe('Bold text');
    });

    it('should be a no-op for a clean string', () => {
      const clean = 'This is a clean string with no HTML.';
      expect(sanitizeResponseField(clean)).toBe(clean);
    });

    it('should decode HTML entities', () => {
      const result = sanitizeResponseField('&lt;div&gt;test&lt;/div&gt;');
      // After decoding entities, the resulting tags should also be stripped
      expect(result).not.toContain('&lt;');
      expect(result).not.toContain('&gt;');
    });

    it('should handle empty string without throwing', () => {
      expect(sanitizeResponseField('')).toBe('');
    });

    it('should strip nested script tags', () => {
      const result = sanitizeResponseField('<SCRIPT>evil()</SCRIPT>safe');
      expect(result).toBe('safe');
      expect(result).not.toContain('evil');
    });

    it('should handle multiline script tags', () => {
      const result = sanitizeResponseField('<script>\nvar x = 1;\n</script>clean');
      expect(result).toBe('clean');
    });

    it('should strip img tags with onerror handlers', () => {
      const result = sanitizeResponseField('<img src=x onerror=alert(1)>text');
      expect(result).toBe('text');
      expect(result).not.toContain('<img');
    });
  });
});
