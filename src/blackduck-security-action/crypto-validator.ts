/**
 * @file crypto-validator.ts
 * @description Cryptographic operation validation utilities for the Black Duck Security Scan action.
 * Provides hash algorithm validation, secure hash computation, and HMAC signature
 * verification using timing-safe comparison to prevent timing attacks.
 *
 * @module crypto-validator
 */

import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { ALLOWED_HASH_ALGORITHMS, HMAC_ALGORITHM } from '../application-constants';

/**
 * Error thrown when a disallowed or invalid cryptographic algorithm is specified.
 */
export class CryptoValidationError extends Error {
  /** The algorithm that was rejected. */
  public readonly algorithm: string;

  constructor(algorithm: string, message: string) {
    super(message);
    this.name = 'CryptoValidationError';
    this.algorithm = algorithm;
    // Maintain proper prototype chain in transpiled ES5
    Object.setPrototypeOf(this, CryptoValidationError.prototype);
  }
}

/**
 * Validates whether the given hash algorithm is in the project allowlist.
 * MD5 and SHA-1 are intentionally excluded due to known cryptographic weaknesses.
 *
 * @param algorithm - The algorithm name to validate (case-insensitive).
 * @returns `true` if the algorithm is allowed; `false` otherwise.
 *
 * @example
 * ```typescript
 * validateHashAlgorithm('sha256'); // true
 * validateHashAlgorithm('md5');    // false
 * ```
 */
export function validateHashAlgorithm(algorithm: string): boolean {
  if (!algorithm || typeof algorithm !== 'string') {
    return false;
  }
  return ALLOWED_HASH_ALGORITHMS.includes(algorithm.toLowerCase().trim());
}

/**
 * Computes a cryptographic hash of the given data using the specified algorithm.
 * Only algorithms present in ALLOWED_HASH_ALGORITHMS are permitted.
 *
 * @param data - The string data to hash.
 * @param algorithm - The hash algorithm to use (e.g. 'sha256', 'sha512').
 * @returns A Promise resolving to the lowercase hex digest string.
 * @throws {CryptoValidationError} If the algorithm is not in the allowlist.
 *
 * @example
 * ```typescript
 * const digest = await computeSecureHash('hello world', 'sha256');
 * // => 'b94d27b9934d3e08a52e52d7da7dabfac484efe04294e576f4a385908c547a65'
 * ```
 */
export async function computeSecureHash(data: string, algorithm: string): Promise<string> {
  const normalisedAlgorithm = algorithm.toLowerCase().trim();

  if (!validateHashAlgorithm(normalisedAlgorithm)) {
    throw new CryptoValidationError(
      algorithm,
      `Algorithm '${algorithm}' is not in the allowlist of permitted hash algorithms. ` +
        `Allowed: ${ALLOWED_HASH_ALGORITHMS.join(', ')}`
    );
  }

  return new Promise<string>((resolve, reject) => {
    try {
      const hash = createHash(normalisedAlgorithm);
      hash.update(data, 'utf8');
      resolve(hash.digest('hex'));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      reject(new CryptoValidationError(algorithm, `Hash computation failed: ${message}`));
    }
  });
}

/**
 * Validates an HMAC signature against a payload using timing-safe comparison.
 * Uses the HMAC_ALGORITHM constant (sha256) by default.
 *
 * Timing-safe comparison prevents timing oracle attacks where an attacker
 * could infer the correct signature by measuring response times.
 *
 * Note: If the expected and actual HMAC buffers differ in length, this function
 * returns `false` immediately (no timing information is leaked for length mismatches
 * because we compare fixed-length HMAC outputs of the same algorithm).
 *
 * @param payload - The original payload string that was signed.
 * @param signature - The hex-encoded HMAC signature to verify.
 * @param secret - The shared secret used to generate the HMAC.
 * @returns A Promise resolving to `true` if the signature is valid; `false` otherwise.
 *
 * @example
 * ```typescript
 * const isValid = await validateSignature('payload-data', 'abc123...', 'my-secret');
 * ```
 */
export async function validateSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  if (!payload || !signature || !secret) {
    return false;
  }

  return new Promise<boolean>((resolve) => {
    try {
      const hmac = createHmac(HMAC_ALGORITHM, secret);
      hmac.update(payload, 'utf8');
      const expectedHex = hmac.digest('hex');

      // Convert both to Buffers for timingSafeEqual
      const expectedBuffer = Buffer.from(expectedHex, 'hex');
      const actualBuffer = Buffer.from(signature, 'hex');

      // timingSafeEqual requires equal-length buffers.
      // Since both are HMAC outputs of the same algorithm, they should be equal length.
      // If lengths differ (e.g. malformed input), return false without timing leak.
      if (expectedBuffer.length !== actualBuffer.length) {
        resolve(false);
        return;
      }

      resolve(timingSafeEqual(expectedBuffer, actualBuffer));
    } catch {
      // Any error (e.g. invalid hex in signature) means validation failed.
      resolve(false);
    }
  });
}
