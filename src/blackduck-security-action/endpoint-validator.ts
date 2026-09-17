/**
 * @file endpoint-validator.ts
 * @description API endpoint URL validation utilities for the Black Duck Security Scan action.
 * Validates endpoint URLs against an allowlist of patterns and enforces HTTPS.
 * All functions are synchronous, pure, and have no implicit any.
 *
 * @module endpoint-validator
 */

import { ALLOWED_ENDPOINT_PATTERNS, ALLOWED_REPO_HOSTNAMES } from '../application-constants';

/**
 * Validates an API endpoint URL for use in HTTP requests.
 *
 * Validation rules:
 * 1. Must be a parseable URL (WHATWG URL API).
 * 2. Must use the HTTPS protocol.
 * 3. Must match at least one pattern in ALLOWED_ENDPOINT_PATTERNS.
 *
 * @param url - The URL string to validate.
 * @returns `true` if the URL is valid and permitted; `false` otherwise.
 *          Never throws — malformed URLs return `false`.
 *
 * @example
 * ```typescript
 * validateEndpointUrl('https://api.blackduck.com/api/v1/scan'); // true
 * validateEndpointUrl('http://api.blackduck.com/api/v1/scan');  // false (HTTP)
 * validateEndpointUrl('not-a-url');                              // false
 * ```
 */
export function validateEndpointUrl(url: string): boolean {
  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    return false;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url.trim());
  } catch {
    // URL parsing failed — not a valid URL
    return false;
  }

  // Enforce HTTPS protocol
  if (parsedUrl.protocol !== 'https:') {
    return false;
  }

  // Check against allowlist patterns
  const normalised = url.trim();
  return ALLOWED_ENDPOINT_PATTERNS.some((pattern) => pattern.test(normalised));
}

/**
 * Validates a repository URL against known SCM (Source Control Management) hostnames.
 *
 * Validation rules:
 * 1. Must be a parseable URL.
 * 2. Must use HTTPS or SSH protocol.
 * 3. Hostname must match one of the entries in ALLOWED_REPO_HOSTNAMES.
 *
 * @param url - The repository URL string to validate.
 * @returns `true` if the URL is a recognised SCM repository URL; `false` otherwise.
 *          Never throws — malformed URLs return `false`.
 *
 * @example
 * ```typescript
 * validateRepositoryUrl('https://github.com/org/repo');        // true
 * validateRepositoryUrl('https://gitlab.com/org/repo');        // true
 * validateRepositoryUrl('https://unknown-scm.example.com/r'); // false
 * ```
 */
export function validateRepositoryUrl(url: string): boolean {
  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    return false;
  }

  const trimmed = url.trim();

  // Handle SSH URLs (git@github.com:org/repo.git) by normalising to https for parsing
  let parsedUrl: URL;
  try {
    // Try direct parse first
    parsedUrl = new URL(trimmed);
  } catch {
    // Try to handle SSH-style URLs: git@host:path
    const sshMatch = trimmed.match(/^git@([^:]+):(.+)$/);
    if (sshMatch) {
      try {
        parsedUrl = new URL(`https://${sshMatch[1]}/${sshMatch[2]}`);
      } catch {
        return false;
      }
    } else {
      return false;
    }
  }

  // Allow https: and ssh: protocols (ssh: is used by some git clients)
  const allowedProtocols = ['https:', 'ssh:', 'git+https:', 'git:'];
  if (!allowedProtocols.includes(parsedUrl.protocol)) {
    return false;
  }

  // Normalise hostname (remove port if present)
  const hostname = parsedUrl.hostname.toLowerCase();

  return ALLOWED_REPO_HOSTNAMES.some(
    (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`)
  );
}
