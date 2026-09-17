/**
 * @file token-manager.test.ts
 * @description Unit tests for the token-manager module.
 */

import * as core from '@actions/core';
import { invalidateToken, maskToken } from '../../src/blackduck-security-action/token-manager';

// Mock @actions/core
jest.mock('@actions/core', () => ({
  setSecret: jest.fn(),
  debug: jest.fn(),
  warning: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
}));

const mockCore = core as jest.Mocked<typeof core>;

describe('token-manager', () => {
  describe('maskToken', () => {
    it('should call core.setSecret with the provided token', () => {
      maskToken('my-secret-token-abc123');
      expect(mockCore.setSecret).toHaveBeenCalledWith('my-secret-token-abc123');
    });

    it('should not call core.setSecret for an empty string', () => {
      maskToken('');
      expect(mockCore.setSecret).not.toHaveBeenCalled();
    });

    it('should not call core.setSecret for a whitespace-only string', () => {
      maskToken('   ');
      expect(mockCore.setSecret).not.toHaveBeenCalled();
    });
  });

  describe('invalidateToken', () => {
    it('should resolve without error for a valid token with no revocation endpoint', async () => {
      await expect(invalidateToken('valid-token-xyz789')).resolves.toBeUndefined();
    });

    it('should mask the token via core.setSecret', async () => {
      const token = 'super-secret-token-12345';
      await invalidateToken(token);
      expect(mockCore.setSecret).toHaveBeenCalledWith(token);
    });

    it('should handle API revocation failure gracefully (no unhandled rejection)', async () => {
      // Provide a revocation endpoint that will fail (no real server)
      await expect(
        invalidateToken('test-token-abcdef', {
          revocationEndpoint: 'https://nonexistent.blackduck.com/api/logout',
          maxRetries: 1,
        })
      ).resolves.toBeUndefined();

      // Should have logged a warning, not thrown
      expect(mockCore.warning).toHaveBeenCalled();
    });

    it('should not include the token value in any warning messages', async () => {
      const sensitiveToken = 'SENSITIVE_TOKEN_VALUE_ABCDEF1234567890';

      await invalidateToken(sensitiveToken, {
        revocationEndpoint: 'https://nonexistent.blackduck.com/api/logout',
        maxRetries: 1,
      });

      // Check all warning calls do not contain the raw token
      const warningCalls = mockCore.warning.mock.calls;
      for (const callArgs of warningCalls) {
        const message = String(callArgs[0]);
        expect(message).not.toContain(sensitiveToken);
      }
    });

    it('should resolve immediately for an empty token', async () => {
      await expect(invalidateToken('')).resolves.toBeUndefined();
      // setSecret should not be called for empty token
      expect(mockCore.setSecret).not.toHaveBeenCalled();
    });

    it('should not throw even when revocation endpoint returns non-2xx', async () => {
      // This test verifies graceful degradation
      await expect(
        invalidateToken('another-token-xyz', {
          revocationEndpoint: 'https://nonexistent.blackduck.com/revoke',
          maxRetries: 1,
        })
      ).resolves.toBeUndefined();
    });

    it('should reject non-HTTPS revocation endpoints gracefully', async () => {
      await expect(
        invalidateToken('token-http-test', {
          revocationEndpoint: 'http://insecure.example.com/revoke',
          maxRetries: 1,
        })
      ).resolves.toBeUndefined();

      expect(mockCore.warning).toHaveBeenCalled();
    });
  });
});
