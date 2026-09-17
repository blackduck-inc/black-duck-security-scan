/**
 * @file crypto-validator.test.ts
 * @description Unit tests for the crypto-validator module.
 */

import { createHmac } from 'crypto';
import {
  validateHashAlgorithm,
  computeSecureHash,
  validateSignature,
  CryptoValidationError,
} from '../../src/blackduck-security-action/crypto-validator';

describe('crypto-validator', () => {
  describe('validateHashAlgorithm', () => {
    it('should return true for sha256', () => {
      expect(validateHashAlgorithm('sha256')).toBe(true);
    });

    it('should return true for sha384', () => {
      expect(validateHashAlgorithm('sha384')).toBe(true);
    });

    it('should return true for sha512', () => {
      expect(validateHashAlgorithm('sha512')).toBe(true);
    });

    it('should return true for uppercase SHA256 (case-insensitive)', () => {
      expect(validateHashAlgorithm('SHA256')).toBe(true);
    });

    it('should return false for md5', () => {
      expect(validateHashAlgorithm('md5')).toBe(false);
    });

    it('should return false for sha1', () => {
      expect(validateHashAlgorithm('sha1')).toBe(false);
    });

    it('should return false for an empty string', () => {
      expect(validateHashAlgorithm('')).toBe(false);
    });

    it('should return false for an unknown algorithm', () => {
      expect(validateHashAlgorithm('ripemd160')).toBe(false);
    });
  });

  describe('computeSecureHash', () => {
    it('should return the correct sha256 hex digest for a known input', async () => {
      // Known sha256 of empty string
      const result = await computeSecureHash('', 'sha256');
      expect(result).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('should return the correct sha256 hex digest for a non-empty input', async () => {
      // echo -n "hello" | sha256sum
      const result = await computeSecureHash('hello', 'sha256');
      expect(result).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
    });

    it('should return the correct sha512 hex digest for a known input', async () => {
      // Known sha512 of empty string
      const result = await computeSecureHash('', 'sha512');
      expect(result).toBe(
        'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e'
      );
    });

    it('should reject with CryptoValidationError for md5', async () => {
      await expect(computeSecureHash('data', 'md5')).rejects.toThrow(CryptoValidationError);
    });

    it('should reject with CryptoValidationError for sha1', async () => {
      await expect(computeSecureHash('data', 'sha1')).rejects.toThrow(CryptoValidationError);
    });

    it('should include the disallowed algorithm name in the error', async () => {
      await expect(computeSecureHash('data', 'md5')).rejects.toMatchObject({
        algorithm: 'md5',
      });
    });

    it('should handle uppercase algorithm names gracefully', async () => {
      await expect(computeSecureHash('hello', 'SHA256')).resolves.toBe(
        '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
      );
    });
  });

  describe('validateSignature', () => {
    const secret = 'test-secret-key';
    const payload = 'test-payload-data';

    function generateHmac(data: string, key: string): string {
      return createHmac('sha256', key).update(data, 'utf8').digest('hex');
    }

    it('should return true for a valid HMAC signature', async () => {
      const signature = generateHmac(payload, secret);
      const result = await validateSignature(payload, signature, secret);
      expect(result).toBe(true);
    });

    it('should return false for a tampered payload', async () => {
      const signature = generateHmac(payload, secret);
      const result = await validateSignature('tampered-payload', signature, secret);
      expect(result).toBe(false);
    });

    it('should return false for a wrong secret', async () => {
      const signature = generateHmac(payload, secret);
      const result = await validateSignature(payload, signature, 'wrong-secret');
      expect(result).toBe(false);
    });

    it('should return false for an empty payload', async () => {
      const result = await validateSignature('', 'somesig', secret);
      expect(result).toBe(false);
    });

    it('should return false for an empty signature', async () => {
      const result = await validateSignature(payload, '', secret);
      expect(result).toBe(false);
    });

    it('should return false for an empty secret', async () => {
      const signature = generateHmac(payload, secret);
      const result = await validateSignature(payload, signature, '');
      expect(result).toBe(false);
    });

    it('should return false for a malformed (non-hex) signature without throwing', async () => {
      const result = await validateSignature(payload, 'not-valid-hex!!!', secret);
      expect(result).toBe(false);
    });

    it('should return false for a signature of different length', async () => {
      const result = await validateSignature(payload, 'ab12', secret);
      expect(result).toBe(false);
    });
  });
});
