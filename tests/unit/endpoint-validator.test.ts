/**
 * @file endpoint-validator.test.ts
 * @description Unit tests for the endpoint-validator module.
 */

import {
  validateEndpointUrl,
  validateRepositoryUrl,
} from '../../src/blackduck-security-action/endpoint-validator';

describe('endpoint-validator', () => {
  describe('validateEndpointUrl', () => {
    it('should return true for a valid HTTPS URL matching the allowlist', () => {
      expect(validateEndpointUrl('https://api.blackduck.com/api/v1/scan')).toBe(true);
    });

    it('should return true for a valid HTTPS URL with path and query', () => {
      expect(validateEndpointUrl('https://synopsys.com/api/v2/results?page=1')).toBe(true);
    });

    it('should return false for an HTTP URL', () => {
      expect(validateEndpointUrl('http://api.blackduck.com/api/v1/scan')).toBe(false);
    });

    it('should return false for an FTP URL', () => {
      expect(validateEndpointUrl('ftp://files.blackduck.com/data')).toBe(false);
    });

    it('should return false for a malformed URL (does not throw)', () => {
      expect(validateEndpointUrl('not-a-valid-url')).toBe(false);
    });

    it('should return false for an empty string', () => {
      expect(validateEndpointUrl('')).toBe(false);
    });

    it('should return false for a whitespace-only string', () => {
      expect(validateEndpointUrl('   ')).toBe(false);
    });

    it('should handle URLs with ports correctly', () => {
      expect(validateEndpointUrl('https://api.blackduck.com:8443/api')).toBe(true);
    });

    it('should return false for javascript: protocol', () => {
      expect(validateEndpointUrl('javascript:alert(1)')).toBe(false);
    });

    it('should return false for data: URI', () => {
      expect(validateEndpointUrl('data:text/html,<h1>test</h1>')).toBe(false);
    });

    it('should handle URLs with trailing slashes', () => {
      expect(validateEndpointUrl('https://api.blackduck.com/')).toBe(true);
    });
  });

  describe('validateRepositoryUrl', () => {
    it('should return true for a GitHub HTTPS URL', () => {
      expect(validateRepositoryUrl('https://github.com/org/repo')).toBe(true);
    });

    it('should return true for a GitLab HTTPS URL', () => {
      expect(validateRepositoryUrl('https://gitlab.com/org/repo')).toBe(true);
    });

    it('should return true for a Bitbucket HTTPS URL', () => {
      expect(validateRepositoryUrl('https://bitbucket.org/org/repo')).toBe(true);
    });

    it('should return true for an Azure DevOps HTTPS URL', () => {
      expect(validateRepositoryUrl('https://dev.azure.com/org/project/_git/repo')).toBe(true);
    });

    it('should return true for a GitHub SSH URL', () => {
      expect(validateRepositoryUrl('git@github.com:org/repo.git')).toBe(true);
    });

    it('should return false for an unknown SCM hostname', () => {
      expect(validateRepositoryUrl('https://unknown-scm.example.com/org/repo')).toBe(false);
    });

    it('should return false for an empty string', () => {
      expect(validateRepositoryUrl('')).toBe(false);
    });

    it('should return false for a malformed URL', () => {
      expect(validateRepositoryUrl('not-a-url')).toBe(false);
    });

    it('should return false for an HTTP GitHub URL', () => {
      // HTTP is not in the allowed protocols for repo URLs
      expect(validateRepositoryUrl('http://github.com/org/repo')).toBe(false);
    });

    it('should handle whitespace-only input without throwing', () => {
      expect(validateRepositoryUrl('   ')).toBe(false);
    });

    it('should return true for GitHub with .git suffix', () => {
      expect(validateRepositoryUrl('https://github.com/org/repo.git')).toBe(true);
    });
  });
});
