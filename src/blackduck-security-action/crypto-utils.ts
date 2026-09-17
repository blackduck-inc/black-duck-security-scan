/**
 * @file crypto-utils.ts
 * @description Cryptographic utility functions for the Black Duck Security Action.
 * Provides hashing and HMAC verification using Node.js built-in crypto module only.
 * No third-party cryptographic libraries are used. MD5 and SHA-1 are explicitly
 * excluded to enforce modern security standards.
 */

import * as crypto from 'crypto';
import { SUPPORTED_HASH_ALGORITHMS } from '../../application-constants';

/**
 * @description Supported hash algorithm type. Only SHA-256 and SHA-512 are permitted.
 */
export type HashAlgorithm = 'sha256' | 'sha512';

/**
 * @description Custom error for cryptographic operation failures.
 */
export class CryptoUtilsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoUtilsError';
  }
}

/**
 * @description Computes a cryptographic hash of the provided data string using
 * the specified algorithm. Only SHA-256 and SHA-512 are supported.
 * MD5 and SHA-1 are intentionally excluded due to known vulnerabilities.
 *
 * @param data - The input string to hash.
 * @param algorithm - The hash algorithm to use: 'sha256' or 'sha512'.
 * @returns The hex-encoded digest string.
 * @throws {CryptoUtilsError} If the data is empty or the algorithm is unsupported at runtime.
 */
export function hashData(data: string, algorithm: HashAlgorithm): string {
  if (!data || data.length === 0) {
    throw new CryptoUtilsError('Cannot hash empty data.');
  }

  // Runtime guard: verify the algorithm is in the supported list even if TypeScript
  // type narrowing is bypassed (e.g., via `as any` or dynamic input).
  if (!(SUPPORTED_HASH_ALGORITHMS as readonly string[]).includes(algorithm)) {
    throw new CryptoUtilsError(
      `Unsupported hash algorithm: "${algorithm}". ` +
        `Supported algorithms are: ${SUPPORTED_HASH_ALGORITHMS.join(', ')}.`
    );
  }

  return crypto.createHash(algorithm).update(data, 'utf8').digest('hex');
}

/**
 * @description Verifies an HMAC-SHA256 signature for the provided data and secret.
 * Uses `crypto.timingSafeEqual` to prevent timing-based side-channel attacks.
 *
 * @param data - The original data string that was signed.
 * @param secret - The shared secret used to generate the HMAC.
 * @param signature - The hex-encoded HMAC signature to verify against.
 * @returns `true` if the signature is valid; `false` otherwise.
 * @throws {CryptoUtilsError} If any argument is empty or null.
 */
export function verifyHmac(data: string, secret: string, signature: string): boolean {
  if (!data || data.length === 0) {
    throw new CryptoUtilsError('Cannot verify HMAC: data must not be empty.');
  }
  if (!secret || secret.length === 0) {
    throw new CryptoUtilsError('Cannot verify HMAC: secret must not be empty.');
  }
  if (!signature || signature.length === 0) {
    throw new CryptoUtilsError('Cannot verify HMAC: signature must not be empty.');
  }

  const expectedHmac = crypto
    .createHmac('sha256', secret)
    .update(data, 'utf8')
    .digest('hex');

  const expectedBuffer = Buffer.from(expectedHmac, 'hex');
  const signatureBuffer = Buffer.from(signature, 'hex');

  // Buffers must be the same length for timingSafeEqual; if lengths differ,
  // the signature is definitively invalid without needing a timing-safe comparison.
  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}
