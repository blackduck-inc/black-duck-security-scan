/**
 * @file token-manager.test.ts
 * @description Unit tests for the token-manager module.
 * Tests cover successful invalidation, failure handling, and input validation.
 */

import { invalidateToken, TokenManagerError } from '../../src/blackduck-security-action/token-manager';

// Mock @actions/core
jest.mock('@actions/core', () => ({
  debug: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
}));

// Mock @actions/http-client
const mockDel = jest.fn();
jest.mock('@actions/http-client', () => ({
  HttpClient: jest.fn().mockImplementation(() => ({
    del: mockDel,
  })),
}));

import * as core from '@actions/core';

describe('token-manager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables before each test
    delete process.env['BLACKDUCK_TOKEN'];
    delete process.env['BRIDGE_BLACKDUCK_TOKEN'];
    delete process.env['POLARIS_ACCESS_TOKEN'];
    delete process.env['COVERITY_PASSPHRASE'];
  });

  describe('invalidateToken', () => {
    describe('successful invalidation', () => {
      it('should call the revocation endpoint with the correct Authorization header', async () => {
        mockDel.mockResolvedValueOnce({
          message: { statusCode: 200 },
        });

        await invalidateToken('valid-test-token-abc123');

        expect(mockDel).toHaveBeenCalledTimes(1);
        const [url, headers] = mockDel.mock.calls[0] as [string, Record<string, string>];
        expect(url).toContain('https://');
        expect(headers['Authorization']).toBe('Bearer valid-test-token-abc123');
      });

      it('should log a debug message on successful invalidation (2xx status)', async () => {
        mockDel.mockResolvedValueOnce({
          message: { statusCode: 204 },
        });

        await invalidateToken('valid-test-token-abc123');

        expect(core.debug).toHaveBeenCalledWith(
          expect.stringContaining('Token successfully invalidated')
        );
      });

      it('should clear local environment token variables after successful invalidation', async () => {
        process.env['BLACKDUCK_TOKEN'] = 'some-token';
        process.env['POLARIS_ACCESS_TOKEN'] = 'polaris-token';

        mockDel.mockResolvedValueOnce({
          message: { statusCode: 200 },
        });

        await invalidateToken('valid-test-token-abc123');

        expect(process.env['BLACKDUCK_TOKEN']).toBeUndefined();
        expect(process.env['POLARIS_ACCESS_TOKEN']).toBeUndefined();
      });
    });

    describe('failed invalidation', () => {
      it('should log a warning and not throw when the revocation endpoint returns 404', async () => {
        mockDel.mockResolvedValueOnce({
          message: { statusCode: 404 },
        });

        await expect(invalidateToken('valid-test-token-abc123')).resolves.toBeUndefined();
        expect(core.warning).toHaveBeenCalledWith(
          expect.stringContaining('404')
        );
      });

      it('should log a warning for unexpected non-2xx status codes', async () => {
        mockDel.mockResolvedValueOnce({
          message: { statusCode: 500 },
        });

        await expect(invalidateToken('valid-test-token-abc123')).resolves.toBeUndefined();
        expect(core.warning).toHaveBeenCalledWith(
          expect.stringContaining('500')
        );
      });

      it('should log an error and not throw when the HTTP call throws a network error', async () => {
        mockDel.mockRejectedValueOnce(new Error('Network timeout'));

        await expect(invalidateToken('valid-test-token-abc123')).resolves.toBeUndefined();
        expect(core.error).toHaveBeenCalledWith(
          expect.stringContaining('Network timeout')
        );
      });

      it('should still clear local token state even when the HTTP call fails', async () => {
        process.env['BLACKDUCK_TOKEN'] = 'some-token';
        mockDel.mockRejectedValueOnce(new Error('Connection refused'));

        await invalidateToken('valid-test-token-abc123');

        expect(process.env['BLACKDUCK_TOKEN']).toBeUndefined();
      });
    });

    describe('input validation', () => {
      it('should throw TokenManagerError for an empty string token', async () => {
        await expect(invalidateToken('')).rejects.toThrow(TokenManagerError);
        await expect(invalidateToken('')).rejects.toThrow(
          'Cannot invalidate an empty or null token.'
        );
      });

      it('should throw TokenManagerError for a whitespace-only token', async () => {
        await expect(invalidateToken('   ')).rejects.toThrow(TokenManagerError);
      });

      it('should not call the HTTP client when the token is invalid', async () => {
        await expect(invalidateToken('')).rejects.toThrow(TokenManagerError);
        expect(mockDel).not.toHaveBeenCalled();
      });
    });
  });
});
