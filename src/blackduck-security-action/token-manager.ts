/**
 * @file token-manager.ts
 * @description Provides token lifecycle management utilities including invalidation
 * and revocation for authentication tokens used by the Black Duck Security Action.
 * Centralises all token teardown logic to ensure tokens are properly invalidated
 * on logout or post-run cleanup.
 */

import * as core from '@actions/core';
import { HttpClient } from '@actions/http-client';
import { TOKEN_REVOCATION_ENDPOINT } from '../../application-constants';

/**
 * @description Custom error type for token management failures.
 */
export class TokenManagerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenManagerError';
  }
}

/**
 * @description Invalidates (revokes) the provided authentication token by calling
 * the configured revocation endpoint. If the endpoint is unavailable or returns
 * a non-success status, the error is logged and the local token state is cleared.
 * This function is safe to call in post-run cleanup hooks.
 *
 * @param token - The authentication token string to invalidate.
 * @returns A promise that resolves when invalidation is complete (or best-effort attempted).
 * @throws {TokenManagerError} If the token is empty or null/undefined.
 */
export async function invalidateToken(token: string): Promise<void> {
  if (!token || token.trim().length === 0) {
    throw new TokenManagerError('Cannot invalidate an empty or null token.');
  }

  core.debug(`[token-manager] Attempting to invalidate token at: ${TOKEN_REVOCATION_ENDPOINT}`);

  const client = new HttpClient('blackduck-security-action/token-manager');

  try {
    const response = await client.del(
      TOKEN_REVOCATION_ENDPOINT,
      {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    );

    const statusCode = response.message.statusCode ?? 0;

    if (statusCode >= 200 && statusCode < 300) {
      core.debug('[token-manager] Token successfully invalidated via revocation endpoint.');
    } else if (statusCode === 404) {
      // Revocation endpoint not available — fall back to local state clearing only.
      core.warning(
        `[token-manager] Token revocation endpoint returned 404. ` +
          `Falling back to local state clearing only. ` +
          `This is a known limitation if the backend does not support token revocation.`
      );
    } else {
      core.warning(
        `[token-manager] Token revocation endpoint returned unexpected status: ${statusCode}. ` +
          `Local token state will be cleared.`
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    core.error(
      `[token-manager] Failed to call token revocation endpoint: ${message}. ` +
        `Proceeding with local state clearing.`
    );
  } finally {
    // Always clear the token from environment state regardless of remote revocation outcome.
    clearLocalTokenState();
  }
}

/**
 * @description Clears any locally cached or environment-stored token state.
 * This is a best-effort cleanup that runs even if remote revocation fails.
 */
function clearLocalTokenState(): void {
  // Clear any environment variables that may hold token values.
  // The specific variable names should match those set during action setup.
  const tokenEnvVars = [
    'BLACKDUCK_TOKEN',
    'BRIDGE_BLACKDUCK_TOKEN',
    'POLARIS_ACCESS_TOKEN',
    'COVERITY_PASSPHRASE',
  ];

  for (const envVar of tokenEnvVars) {
    if (process.env[envVar]) {
      delete process.env[envVar];
      core.debug(`[token-manager] Cleared local environment variable: ${envVar}`);
    }
  }

  core.debug('[token-manager] Local token state cleared.');
}
