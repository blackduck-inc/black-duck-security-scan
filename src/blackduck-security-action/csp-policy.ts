/**
 * @file csp-policy.ts
 * @description Content Security Policy (CSP) utilities for the Black Duck Security Action.
 * Provides functions to build CSP header strings, define default secure directives,
 * and log CSP violation reports via @actions/core. This module is relevant when the
 * action renders HTML output or interacts with web UI components.
 */

import * as core from '@actions/core';

/**
 * @description Represents a set of CSP directives. Each key is a directive name
 * (e.g., 'default-src') and each value is an array of allowed sources.
 */
export interface CspDirectives {
  'default-src'?: string[];
  'script-src'?: string[];
  'style-src'?: string[];
  'img-src'?: string[];
  'connect-src'?: string[];
  'font-src'?: string[];
  'object-src'?: string[];
  'media-src'?: string[];
  'frame-src'?: string[];
  'child-src'?: string[];
  'worker-src'?: string[];
  'form-action'?: string[];
  'frame-ancestors'?: string[];
  'base-uri'?: string[];
  'manifest-src'?: string[];
  'upgrade-insecure-requests'?: string[];
  [key: string]: string[] | undefined;
}

/**
 * @description Represents a CSP violation report payload as sent by browsers
 * or reported via the Reporting API.
 */
export interface CspViolationReport {
  /** The URI of the document where the violation occurred. */
  documentUri?: string;
  /** The directive that was violated. */
  violatedDirective?: string;
  /** The effective directive that was violated. */
  effectiveDirective?: string;
  /** The URI of the blocked resource. */
  blockedUri?: string;
  /** The original policy string. */
  originalPolicy?: string;
  /** The source file where the violation occurred. */
  sourceFile?: string;
  /** The line number in the source file. */
  lineNumber?: number;
  /** The column number in the source file. */
  columnNumber?: number;
}

/**
 * @description Default secure CSP directives for the Black Duck Security Action.
 * Follows the principle of least privilege: only 'self' is allowed by default,
 * and object-src is set to 'none' to prevent plugin-based attacks.
 */
export const DEFAULT_CSP_DIRECTIVES: CspDirectives = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'"],
  'img-src': ["'self'", 'data:'],
  'connect-src': ["'self'"],
  'font-src': ["'self'"],
  'object-src': ["'none'"],
  'media-src': ["'none'"],
  'frame-src': ["'none'"],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
};

/**
 * @description Serializes a CspDirectives object into a valid
 * Content-Security-Policy header string.
 *
 * Each directive is rendered as `directive-name source1 source2 ...`
 * and directives are separated by semicolons.
 *
 * @param directives - The CSP directives to serialize.
 * @returns A valid Content-Security-Policy header value string.
 * @throws {Error} If the directives object is empty.
 */
export function buildCspHeader(directives: CspDirectives): string {
  const entries = Object.entries(directives).filter(
    ([, values]) => values !== undefined && values.length > 0
  );

  if (entries.length === 0) {
    throw new Error('Cannot build CSP header: no directives provided.');
  }

  const parts = entries.map(([directive, values]) => {
    const sources = (values as string[]).join(' ');
    return `${directive} ${sources}`;
  });

  return parts.join('; ');
}

/**
 * @description Logs a CSP violation report as a warning via @actions/core.
 * This function is intended to be called when a CSP violation report is
 * received, providing visibility into potential security issues.
 *
 * @param violation - The CSP violation report to log.
 */
export function logCspViolation(violation: CspViolationReport): void {
  const details = [
    violation.violatedDirective ? `directive=${violation.violatedDirective}` : null,
    violation.blockedUri ? `blocked-uri=${violation.blockedUri}` : null,
    violation.documentUri ? `document-uri=${violation.documentUri}` : null,
    violation.sourceFile ? `source=${violation.sourceFile}:${violation.lineNumber ?? 0}:${violation.columnNumber ?? 0}` : null,
    violation.originalPolicy ? `policy=${violation.originalPolicy}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  core.warning(`[csp-policy] CSP Violation detected: ${details || 'No details provided.'}`);
}
