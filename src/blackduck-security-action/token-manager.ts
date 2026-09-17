/**
 * @file token-manager.ts
 * @description Centralised token lifecycle management for the Black Duck Security Scan action.
 * Provides utilities for masking tokens in logs and invalidating (revoking) tokens
 * via API endpoints where supported.
 *
 * @module token-manager
 */

import * as core from '@actions/core';
import { TOKEN_INVALIDATION_ENABLED, TOKEN_INVALIDATION_MAX_RETRIES } from '../application-constants';

/**
 * Options for token invalidation behaviour.
 */
export interface InvalidateTokenOptions {
  /** The URL of the revocation endpoint. If omitted, only masking is performed. */
  revocationEndpoint?: string;
  /** Additional HTTP headers to include in the revocation request. */
  additionalHeaders?: Record<string, string>;
  /** Number of retry attempts on transient failure. Defaults to TOKEN_INVALIDATION_MAX_RETRIES. */
  maxRetries?: number;
}

/**
 * Masks a token value in all future GitHub Actions log output.
 * This is a synchronous, side-effect-only operation.
 *
 * @param token - The token string to mask. Must be non-empty.
 */
export function maskToken(token: string): void {
  if (token && token.trim().length > 0) {
    core.setSecret(token);
  }
}

/**
 * Invalidates (revokes) a token by:
 * 1. Masking it from all future log output via core.setSecret().
 * 2. Optionally calling a revocation endpoint if TOKEN_INVALIDATION_ENABLED is true
 *    and a revocationEndpoint is provided.
 *
 * This function NEVER throws. On revocation failure it logs a warning and resolves.
 * Token values are never included in log messages or error objects.
 *
 * @param token - The token to invalidate. Must be a non-empty string.
 * @param options - Optional configuration for the invalidation behaviour.
 * @returns A Promise that resolves when invalidation is complete (or has been
 *          gracefully skipped/failed).
 *
 * @example
 * ```typescript
 * try {
 *   await runAction();
 * } finally {
 *   await invalidateToken(myToken, { revocationEndpoint: 'https://api.example.com/logout' });
 * }
 * ```
 */
export async function invalidateToken(
  token: string,
  options: InvalidateTokenOptions = {}
): Promise<void> {
  // Step 1: Always mask the token immediately, regardless of other settings.
  maskToken(token);

  if (!token || token.trim().length === 0) {
    core.debug('[token-manager] invalidateToken called with empty token; skipping.');
    return;
  }

  if (!TOKEN_INVALIDATION_ENABLED) {
    core.debug('[token-manager] Token invalidation is disabled via TOKEN_INVALIDATION_ENABLED.');
    return;
  }

  if (!options.revocationEndpoint) {
    core.debug('[token-manager] No revocation endpoint provided; token masked but not revoked via API.');
    return;
  }

  const maxRetries = options.maxRetries ?? TOKEN_INVALIDATION_MAX_RETRIES;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await callRevocationEndpoint(options.revocationEndpoint, token, options.additionalHeaders);
      core.debug(`[token-manager] Token successfully revoked on attempt ${attempt}.`);
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Sanitise error message to ensure token value is not leaked.
      const safeMessage = sanitiseErrorMessage(lastError.message);
      core.warning(
        `[token-manager] Token revocation attempt ${attempt}/${maxRetries} failed: ${safeMessage}`
      );
    }
  }

  // All retries exhausted — log warning but do not throw.
  const safeMessage = lastError ? sanitiseErrorMessage(lastError.message) : 'unknown error';
  core.warning(
    `[token-manager] Token revocation failed after ${maxRetries} attempts: ${safeMessage}. ` +
      'The token has been masked in logs. Manual revocation may be required.'
  );
}

/**
 * Performs the HTTP POST to the revocation endpoint.
 * Uses the native https module to avoid circular dependencies with typed-rest-client.
 *
 * @param endpoint - The fully-qualified HTTPS revocation URL.
 * @param token - The token to revoke (sent as Bearer token in Authorization header).
 * @param additionalHeaders - Optional extra headers.
 * @returns A Promise that resolves on HTTP 2xx or rejects on error/non-2xx.
 */
async function callRevocationEndpoint(
  endpoint: string,
  token: string,
  additionalHeaders?: Record<string, string>
): Promise<void> {
  const https = await import('https');
  const url = new URL(endpoint);

  if (url.protocol !== 'https:') {
    throw new Error(`[token-manager] Revocation endpoint must use HTTPS. Protocol: ${url.protocol}`);
  }

  return new Promise<void>((resolve, reject) => {
    const headers: Record<string, string> = {
      Authorization: `Bearer [REDACTED]`,
      'Content-Type': 'application/json',
      'Content-Length': '0',
      ...additionalHeaders,
    };

    // Build the actual request with the real token but never log it.
    const requestHeaders: Record<string, string> = {
      ...headers,
      Authorization: `Bearer ${token}`,
    };

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: requestHeaders,
    };

    const req = https.request(options, (res) => {
      const statusCode = res.statusCode ?? 0;
      // Consume response body to free socket.
      res.resume();
      if (statusCode >= 200 && statusCode < 300) {
        resolve();
      } else {
        reject(new Error(`Revocation endpoint returned HTTP ${statusCode}`));
      }
    });

    req.on('error', (err: Error) => {
      reject(new Error(`Revocation request failed: ${sanitiseErrorMessage(err.message)}`));
    });

    req.end();
  });
}

/**
 * Removes any occurrence of token-like strings (long alphanumeric sequences)
 * from an error message to prevent accidental token leakage in logs.
 *
 * @param message - The raw error message string.
 * @returns A sanitised version of the message.
 */
function sanitiseErrorMessage(message: string): string {
  // Replace sequences that look like tokens (20+ alphanumeric/special chars)
  return message.replace(/[A-Za-z0-9+/=_-]{20,}/g, '[REDACTED]');
}
