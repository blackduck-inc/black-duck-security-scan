/**
 * @file validators-endpoint.test.ts
 * @description Unit tests for the validateEndpointUrl function in the validators module.
 * Tests cover HTTPS enforcement, disallowed schemes, empty input, and character validation.
 */

import {
  validateEndpointUrl,
  SecurityError,
  InputValidationError,
} from '../../src/blackduck-security-action/validators';

describe('validators - validateEndpointUrl', () => {
  describe('valid HTTPS URLs', () => {
    it('should not throw for a simple HTTPS URL', () => {
      expect(() => validateEndpointUrl('https://api.example.com')).not.toThrow();
    });

    it('should not throw for an HTTPS URL with a path', () => {
      expect(() =>
        validateEndpointUrl('https://api.example.com/v1/tokens/revoke')
      ).not.toThrow();
    });

    it('should not throw for an HTTPS URL with query parameters', () => {
      expect(() =>
        validateEndpointUrl('https://api.example.com/search?q=test&page=1')
      ).not.toThrow();
    });

    it('should not throw for an HTTPS URL with a port number', () => {
      expect(() => validateEndpointUrl('https://api.example.com:8443/endpoint')).not.toThrow();
    });

    it('should not throw for an HTTPS URL with a subdomain', () => {
      expect(() =>
        validateEndpointUrl('https://sub.domain.example.com/api')
      ).not.toThrow();
    });

    it('should not throw for an HTTPS URL with a fragment', () => {
      expect(() =>
        validateEndpointUrl('https://api.example.com/page#section')
      ).not.toThrow();
    });
  });

  describe('HTTP URLs (insecure)', () => {
    it('should throw SecurityError for an HTTP URL', () => {
      expect(() => validateEndpointUrl('http://api.example.com')).toThrow(SecurityError);
    });

    it('should throw SecurityError with a message mentioning HTTPS', () => {
      expect(() => validateEndpointUrl('http://api.example.com')).toThrow(
        /HTTPS/i
      );
    });

    it('should throw SecurityError for HTTP URL with path', () => {
      expect(() =>
        validateEndpointUrl('http://api.example.com/v1/endpoint')
      ).toThrow(SecurityError);
    });
  });

  describe('empty and whitespace inputs', () => {
    it('should throw InputValidationError for an empty string', () => {
      expect(() => validateEndpointUrl('')).toThrow(InputValidationError);
    });

    it('should throw InputValidationError for a whitespace-only string', () => {
      expect(() => validateEndpointUrl('   ')).toThrow(InputValidationError);
    });

    it('should throw InputValidationError with a descriptive message for empty input', () => {
      expect(() => validateEndpointUrl('')).toThrow('must not be empty');
    });
  });

  describe('disallowed URL schemes', () => {
    it('should throw SecurityError for a javascript: URL', () => {
      expect(() => validateEndpointUrl('javascript:alert(1)')).toThrow(SecurityError);
    });

    it('should throw SecurityError for a data: URL', () => {
      expect(() =>
        validateEndpointUrl('data:text/html,<script>alert(1)</script>')
      ).toThrow(SecurityError);
    });

    it('should throw SecurityError for a vbscript: URL', () => {
      expect(() => validateEndpointUrl('vbscript:msgbox(1)')).toThrow(SecurityError);
    });

    it('should throw SecurityError for a file: URL', () => {
      expect(() => validateEndpointUrl('file:///etc/passwd')).toThrow(SecurityError);
    });

    it('should throw SecurityError for a ftp: URL', () => {
      expect(() => validateEndpointUrl('ftp://files.example.com')).toThrow(SecurityError);
    });

    it('should throw SecurityError for a JAVASCRIPT: URL (case-insensitive)', () => {
      expect(() => validateEndpointUrl('JAVASCRIPT:alert(1)')).toThrow(SecurityError);
    });
  });

  describe('URLs with disallowed characters', () => {
    it('should throw SecurityError for a URL containing angle brackets', () => {
      expect(() => validateEndpointUrl('https://api.example.com/<script>')).toThrow(
        SecurityError
      );
    });

    it('should throw SecurityError for a URL containing double quotes', () => {
      expect(() => validateEndpointUrl('https://api.example.com/path"value')).toThrow(
        SecurityError
      );
    });

    it('should throw SecurityError for a URL containing single quotes', () => {
      expect(() => validateEndpointUrl("https://api.example.com/path'value")).toThrow(
        SecurityError
      );
    });
  });

  describe('error types', () => {
    it('SecurityError should be an instance of Error', () => {
      try {
        validateEndpointUrl('http://example.com');
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect(err).toBeInstanceOf(SecurityError);
        expect((err as SecurityError).name).toBe('SecurityError');
      }
    });

    it('InputValidationError should be an instance of Error', () => {
      try {
        validateEndpointUrl('');
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect(err).toBeInstanceOf(InputValidationError);
        expect((err as InputValidationError).name).toBe('InputValidationError');
      }
    });
  });
});
