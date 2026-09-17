/**
 * @file crypto-utils.test.ts
 * @description Unit tests for the crypto-utils module.
 * Tests cover SHA-256/SHA-512 hashing, HMAC verification, timing-safe comparison,
 * and rejection of unsupported algorithms.
 */

import * as crypto from 'crypto';
import {
  hashData,
  verifyHmac,
  CryptoUtilsError,
  type HashAlgorithm,
} from '../../src/blackduck-security-action/crypto-utils';

describe('crypto-utils', () => {
  describe('hashData', () => {
    describe('SHA-256', () => {
      it('should produce the correct SHA-256 digest for a known input', () => {
        const input = 'hello world';
        const expected = crypto.createHash('sha256').update(input, 'utf8').digest('hex');
        expect(hashData(input, 'sha256')).toBe(expected);
      });

      it('should produce a 64-character hex string for SHA-256', () => {
        const result = hashData('test-data', 'sha256');
        expect(result).toHaveLength(64);
        expect(result).toMatch(/^[0-9a-f]+$/);
      });

      it('should produce different hashes for different inputs', () => {
        const hash1 = hashData('input-one', 'sha256');
        const hash2 = hashData('input-two', 'sha256');
        expect(hash1).not.toBe(hash2);
      });
    });

    describe('SHA-512', () => {
      it('should produce the correct SHA-512 digest for a known input', () => {
        const input = 'hello world';
        const expected = crypto.createHash('sha512').update(input, 'utf8').digest('hex');
        expect(hashData(input, 'sha512')).toBe(expected);
      });

      it('should produce a 128-character hex string for SHA-512', () => {
        const result = hashData('test-data', 'sha512');
        expect(result).toHaveLength(128);
        expect(result).toMatch(/^[0-9a-f]+$/);
      });
    });

    describe('unsupported algorithms', () => {
      it('should throw CryptoUtilsError when an unsupported algorithm is passed at runtime', () => {
        // Bypass TypeScript type checking to simulate runtime bypass
        expect(() => hashData('data', 'md5' as HashAlgorithm)).toThrow(CryptoUtilsError);
        expect(() => hashData('data', 'md5' as HashAlgorithm)).toThrow(
          'Unsupported hash algorithm'
        );
      });

      it('should throw CryptoUtilsError for sha1 passed at runtime', () => {
        expect(() => hashData('data', 'sha1' as HashAlgorithm)).toThrow(CryptoUtilsError);
      });

      it('should throw CryptoUtilsError for empty algorithm string passed at runtime', () => {
        expect(() => hashData('data', '' as HashAlgorithm)).toThrow(CryptoUtilsError);
      });
    });

    describe('empty input', () => {
      it('should throw CryptoUtilsError for empty data string', () => {
        expect(() => hashData('', 'sha256')).toThrow(CryptoUtilsError);
        expect(() => hashData('', 'sha256')).toThrow('Cannot hash empty data.');
      });
    });
  });

  describe('verifyHmac', () => {
    const testData = 'payload-data';
    const testSecret = 'super-secret-key';

    function generateHmac(data: string, secret: string): string {
      return crypto.createHmac('sha256', secret).update(data, 'utf8').digest('hex');
    }

    describe('valid signatures', () => {
      it('should return true for a valid HMAC signature', () => {
        const signature = generateHmac(testData, testSecret);
        expect(verifyHmac(testData, testSecret, signature)).toBe(true);
      });

      it('should return true for different valid data/secret combinations', () => {
        const data = 'another-payload';
        const secret = 'another-secret';
        const signature = generateHmac(data, secret);
        expect(verifyHmac(data, secret, signature)).toBe(true);
      });
    });

    describe('invalid signatures', () => {
      it('should return false for a tampered data string', () => {
        const signature = generateHmac(testData, testSecret);
        expect(verifyHmac('tampered-data', testSecret, signature)).toBe(false);
      });

      it('should return false for a wrong secret', () => {
        const signature = generateHmac(testData, testSecret);
        expect(verifyHmac(testData, 'wrong-secret', signature)).toBe(false);
      });

      it('should return false for a tampered signature', () => {
        const signature = generateHmac(testData, testSecret);
        const tamperedSignature = signature.replace(signature[0], signature[0] === 'a' ? 'b' : 'a');
        expect(verifyHmac(testData, testSecret, tamperedSignature)).toBe(false);
      });

      it('should return false for a signature of different length', () => {
        expect(verifyHmac(testData, testSecret, 'short')).toBe(false);
      });
    });

    describe('timing-safe comparison', () => {
      it('should use crypto.timingSafeEqual internally (verified via implementation)', () => {
        // Verify that the implementation uses timingSafeEqual by spying on crypto module
        const timingSafeEqualSpy = jest.spyOn(crypto, 'timingSafeEqual');
        const signature = generateHmac(testData, testSecret);

        verifyHmac(testData, testSecret, signature);

        expect(timingSafeEqualSpy).toHaveBeenCalledTimes(1);
        timingSafeEqualSpy.mockRestore();
      });
    });

    describe('input validation', () => {
      it('should throw CryptoUtilsError for empty data', () => {
        const signature = generateHmac(testData, testSecret);
        expect(() => verifyHmac('', testSecret, signature)).toThrow(CryptoUtilsError);
        expect(() => verifyHmac('', testSecret, signature)).toThrow(
          'data must not be empty'
        );
      });

      it('should throw CryptoUtilsError for empty secret', () => {
        const signature = generateHmac(testData, testSecret);
        expect(() => verifyHmac(testData, '', signature)).toThrow(CryptoUtilsError);
        expect(() => verifyHmac(testData, '', signature)).toThrow(
          'secret must not be empty'
        );
      });

      it('should throw CryptoUtilsError for empty signature', () => {
        expect(() => verifyHmac(testData, testSecret, '')).toThrow(CryptoUtilsError);
        expect(() => verifyHmac(testData, testSecret, '')).toThrow(
          'signature must not be empty'
        );
      });
    });
  });
});
