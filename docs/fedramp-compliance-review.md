# FedRAMP Compliance Review — Black Duck Security Scan GitHub Action

**Repository:** `blackduck-inc/black-duck-security-scan`
**Branch:** `SIGINT-5886`
**Review Date:** August 10, 2026
**Reviewed Files:**
- `src/blackduck-security-action/ssl-utils.ts`
- `src/blackduck-security-action/utility.ts`

---

## Overview

This document captures all FedRAMP compliance concerns identified in the encryption and
cryptography-related logic of this GitHub Action plugin. No custom cryptographic algorithms
are implemented — all cryptography is delegated to Node.js built-in `https`, `tls`, and
`crypto` modules. The concerns below are specifically about **how TLS/SSL is configured and
used**.

---

## Concern Summary

| # | Concern | Severity | FedRAMP Control | File |
|---|---|---|---|---|
| 1 | `NETWORK_SSL_TRUST_ALL` disables TLS certificate validation | 🔴 HIGH | SC-8, SC-23 | `ssl-utils.ts` |
| 2 | No explicit TLS 1.2 minimum version enforced | 🟡 MEDIUM | SC-8(1) | `ssl-utils.ts` |
| 3 | `typed-rest-client` drops system CAs when using custom CA | 🟡 MEDIUM | SC-23, SI-7 | `utility.ts` |
| 4 | No FIPS 140-2/140-3 cryptographic module enforcement | 🟡 MEDIUM | SC-13 | `main.ts` / runtime |
| 5 | `getSSLConfigHash()` uses plain string instead of cryptographic hash | 🟢 LOW | SC-13 (informational) | `ssl-utils.ts` |

---

## Concern 1 — `NETWORK_SSL_TRUST_ALL` Disables TLS Certificate Validation

**Severity:** 🔴 HIGH
**FedRAMP Controls:** SC-8 (Transmission Confidentiality & Integrity), SC-23 (Session Authenticity)
**NIST Reference:** NIST SP 800-52 Rev 2 §3.4

### Problem

When the user sets `NETWORK_SSL_TRUST_ALL=true`, the plugin completely disables TLS certificate
validation by setting `rejectUnauthorized: false`. This allows connections to hosts with:
- Expired certificates
- Self-signed certificates
- Attacker-controlled / forged certificates (MITM)

FedRAMP **prohibits** disabling TLS certificate validation. All TLS connections must authenticate
the server via a validated certificate chain — there are no exceptions, even for dev/test convenience.

### Affected Code

**File:** `src/blackduck-security-action/ssl-utils.ts`

```typescript
// ─── getSSLConfig() — Lines 27–57 ───────────────────────────────────────────
export function getSSLConfig(): SSLConfig {
  const trustAllCerts = parseToBoolean(inputs.NETWORK_SSL_TRUST_ALL)

  if (trustAllCerts) {
    debug('SSL certificate verification disabled (NETWORK_SSL_TRUST_ALL=true)')
    return {trustAllCerts: true}   // ← returns trustAllCerts: true, triggers bypasses below
  }
  // ...
}

// ─── createHTTPSAgent() — Lines 63–87 ────────────────────────────────────────
export function createHTTPSAgent(sslConfig: SSLConfig, targetUrl: string): https.Agent {
  const sslOptions: https.AgentOptions = {}

  if (sslConfig.trustAllCerts) {
    sslOptions.rejectUnauthorized = false   // ← ❌ DISABLES ALL CERTIFICATE VALIDATION
    debug('SSL verification disabled for HTTPS agent')
  }
  // ...
}

// ─── createHTTPSRequestOptions() — Lines 90–117 ──────────────────────────────
export function createHTTPSRequestOptions(...): https.RequestOptions {
  // ...
  if (sslConfig.trustAllCerts) {
    requestOptions.rejectUnauthorized = false  // ← ❌ SAME BYPASS ON DIRECT REQUESTS
    debug('SSL certificate verification disabled for this request')
  }
  // ...
}
```

**File:** `src/blackduck-security-action/utility.ts`

```typescript
// ─── createSSLConfiguredHttpClient() — Lines 283–315 ────────────────────────
if (sslConfig.trustAllCerts) {
  debug('SSL certificate verification disabled for HttpClient (NETWORK_SSL_TRUST_ALL=true)')
  _httpClientCache = new HttpClient(userAgent, [], {ignoreSslError: true})  // ← ❌ BYPASS IN HTTP CLIENT
}
```

### Recommended Fix

Option A — **Block `NETWORK_SSL_TRUST_ALL` in FedRAMP mode** (preferred):
```typescript
// In ssl-utils.ts → getSSLConfig()
if (trustAllCerts) {
  if (process.env.FEDRAMP_MODE === 'true') {
    throw new Error(
      'NETWORK_SSL_TRUST_ALL is not permitted in FedRAMP mode. ' +
      'Use NETWORK_SSL_CERT_FILE to provide a custom CA certificate instead.'
    )
  }
  debug('SSL certificate verification disabled (NETWORK_SSL_TRUST_ALL=true)')
  return {trustAllCerts: true}
}
```

Option B — **Remove the `NETWORK_SSL_TRUST_ALL` input entirely** for FedRAMP-authorized deployments.
Customers with self-signed or internal CA certificates must use `NETWORK_SSL_CERT_FILE` instead.

---

## Concern 2 — No Explicit TLS 1.2 Minimum Version Enforced

**Severity:** 🟡 MEDIUM
**FedRAMP Controls:** SC-8(1) (Cryptographic Protection of Transmission)
**NIST Reference:** NIST SP 800-52 Rev 2 — mandates TLS 1.2 minimum; TLS 1.0 and 1.1 are **prohibited**

### Problem

No HTTPS agent or request options in the codebase explicitly sets `minVersion: 'TLSv1.2'`.
The code relies entirely on Node.js runtime defaults. While Node.js 18+ defaults to TLS 1.2+,
this is **implicit** — not enforced. If the action runs on:
- An older Node.js runtime (< 12)
- A misconfigured OpenSSL environment
- A custom runner with downgraded TLS defaults

...then TLS 1.0 or 1.1 connections could succeed, violating FedRAMP SC-8(1).

### Affected Code

**File:** `src/blackduck-security-action/ssl-utils.ts`

```typescript
// ─── createHTTPSAgent() — Lines 63–87 ────────────────────────────────────────
export function createHTTPSAgent(sslConfig: SSLConfig, targetUrl: string): https.Agent {
  const proxyConfig = getProxyConfig(targetUrl)
  const sslOptions: https.AgentOptions = {}  // ← ❌ No minVersion set here

  // ...

  return new https.Agent(sslOptions)           // ← ❌ No minVersion on agent
  // or
  return new httpsProxyAgent.HttpsProxyAgent(proxyConfig.proxyUrl, sslOptions)  // ← ❌ Same
}

// ─── createHTTPSRequestOptions() — Lines 90–117 ──────────────────────────────
export function createHTTPSRequestOptions(parsedUrl: URL, sslConfig: SSLConfig, ...): https.RequestOptions {
  const requestOptions: https.RequestOptions = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || 443,
    // ...
    // ← ❌ No minVersion or secureProtocol enforced
  }
  return requestOptions
}
```

### Recommended Fix

```typescript
// In ssl-utils.ts → createHTTPSAgent()
const sslOptions: https.AgentOptions = {
  minVersion: 'TLSv1.2'  // ← ✅ Explicit FedRAMP-required minimum
}

// Optionally, restrict to FedRAMP-approved cipher suites only:
// ciphers: 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256'
```

```typescript
// In ssl-utils.ts → createHTTPSRequestOptions()
const requestOptions: https.RequestOptions = {
  hostname: parsedUrl.hostname,
  port: parsedUrl.port || 443,
  minVersion: 'TLSv1.2',   // ← ✅ Add this
  // ...
}
```

---

## Concern 3 — `typed-rest-client` Drops System CAs When Using Custom CA

**Severity:** 🟡 MEDIUM
**FedRAMP Controls:** SC-23 (Session Authenticity), SI-7 (Software & Information Integrity)

### Problem

When a user provides a custom CA via `NETWORK_SSL_CERT_FILE`, the `HttpClient` (used for GitHub
API calls) is configured with only the custom CA via `caFile`. This **replaces** the system
trust store rather than **appending** to it.

By contrast, `createHTTPSAgent()` (used for file downloads) **correctly** combines the custom CA
with system CAs using `tls.rootCertificates`. The `HttpClient` path is inconsistent and weakens
the chain of trust for GitHub API operations.

The code itself acknowledges this limitation in a comment.

### Affected Code

**File:** `src/blackduck-security-action/utility.ts`

```typescript
// ─── createSSLConfiguredHttpClient() — Lines 283–315 ────────────────────────
} else if (sslConfig.customCA) {
  debug(`Using custom CA certificate for HttpClient: ${inputs.NETWORK_SSL_CERT_FILE}`)
  try {
    // Note: typed-rest-client has limitations with combining system CAs + custom CAs  ← ⚠️ Known issue
    // For downloads, use createSSLConfiguredHttpsAgent() which properly combines CAs
    // For API operations, this fallback to caFile option (custom CA only) is acceptable
    _httpClientCache = new HttpClient(userAgent, [], {
      allowRetries: true,
      maxRetries: 3,
      cert: {
        caFile: inputs.NETWORK_SSL_CERT_FILE  // ← ❌ REPLACES system CAs — does NOT combine
      }
    })
  }
  // ...
}
```

**Contrast — correct approach already used for downloads in `ssl-utils.ts`:**

```typescript
// ─── getSSLConfig() — Lines 27–57 ───────────────────────────────────────────
// ✅ This correctly combines custom CA + system CAs
const systemCAs = tls.rootCertificates || []
const combinedCAs = [customCA, ...systemCAs]
return {
  trustAllCerts: false,
  customCA,
  combinedCAs    // ← ✅ Both custom AND system CAs preserved
}
```

### Recommended Fix

Bypass `typed-rest-client`'s CA limitation by injecting a properly combined HTTPS agent:

```typescript
} else if (sslConfig.customCA && sslConfig.combinedCAs) {
  // Use a direct https.Agent with combined CAs to overcome typed-rest-client limitation
  const agent = new https.Agent({
    ca: sslConfig.combinedCAs,    // ← ✅ Custom CA + system CAs combined
    minVersion: 'TLSv1.2'
  })
  // Pass agent via requestOptions or switch to node-fetch / undici for API calls
  _httpClientCache = new HttpClient(userAgent, [new BearerCredentialHandler(token)], {
    allowRetries: true,
    maxRetries: 3
  })
  // Note: Injecting the agent directly requires extending typed-rest-client or
  // switching the GitHub API client to use the shared https agent.
}
```

---

## Concern 4 — No FIPS 140-2 / 140-3 Cryptographic Module Enforcement

**Severity:** 🟡 MEDIUM
**FedRAMP Control:** SC-13 (Cryptographic Protection)
**NIST Reference:** FIPS PUB 140-2 / 140-3, NIST SP 800-175B Rev 1

### Problem

FedRAMP requires that **all cryptographic operations** — including TLS handshakes, key derivation,
hashing, and random number generation — use **FIPS 140-2 or FIPS 140-3 validated cryptographic
modules**.

Node.js supports FIPS mode via OpenSSL (compiled with FIPS provider), but this action:
1. Does **not** check whether the runtime is operating in FIPS mode
2. Does **not** document FIPS requirements for self-hosted runners
3. Does **not** fail fast if FIPS mode is required but not active

### Affected Code

**File:** `src/main.ts` (no FIPS check currently exists)

```typescript
// ─── run() — Entry point ─────────────────────────────────────────────────────
export async function run() {
  // ← ❌ No FIPS mode check at startup
  // All subsequent TLS operations proceed without validating FIPS compliance
  const tempDir = await createTempDir()
  // ...
}
```

### Recommended Fix

Add a FIPS mode startup check in `src/main.ts`:

```typescript
import { getFips } from 'crypto'

export async function run() {
  // FedRAMP FIPS 140-2/140-3 enforcement check
  if (process.env.FEDRAMP_MODE === 'true') {
    if (getFips() !== 1) {
      setFailed(
        'FedRAMP mode requires Node.js to run with a FIPS 140-2/140-3 validated ' +
        'cryptographic module. Start the Node.js runtime with --enable-fips or ' +
        'configure OpenSSL with a FIPS provider. See NIST SP 800-175B Rev 1.'
      )
      return
    }
    info('FIPS 140-2/140-3 validated cryptographic module confirmed.')
  }
  // ... rest of run()
}
```

**Runner configuration requirement (must be documented):**
```bash
# GitHub Actions self-hosted runner must use a FIPS-validated Node.js build
# Option 1: OpenSSL FIPS provider (Node.js 17+)
node --enable-fips your-script.js

# Option 2: Use a FIPS-compliant Node.js distribution
# e.g., Red Hat Enterprise Linux with FIPS mode enabled at OS level
```

---

## Concern 5 — `getSSLConfigHash()` Uses Plain String Instead of Cryptographic Hash

**Severity:** 🟢 LOW (Informational)
**FedRAMP Control:** SC-13 (informational — not a direct violation)

### Problem

`getSSLConfigHash()` uses plain string concatenation for a cache key. It is **not** used for any
security purpose — only for cache invalidation of the HTTPS agent singleton. However:

1. It is **not** a cryptographic hash, which could mislead future developers.
2. If `NETWORK_SSL_CERT_FILE` contains the `|` character in its path, the string could collide
   with a different configuration, causing a stale agent to be reused with wrong SSL settings.

### Affected Code

**File:** `src/blackduck-security-action/ssl-utils.ts`

```typescript
// ─── getSSLConfigHash() — Lines 119–122 ─────────────────────────────────────
export function getSSLConfigHash(): string {
  const trustAll = parseToBoolean(inputs.NETWORK_SSL_TRUST_ALL)
  const certFile = inputs.NETWORK_SSL_CERT_FILE?.trim() || ''
  return `trustAll:${trustAll}|certFile:${certFile}`  // ← ❌ Plain string, not a hash
  //                            ↑ pipe character delimiter could collide with file paths
}
```

### Recommended Fix

```typescript
import { createHash } from 'crypto'

export function getSSLConfigHash(): string {
  const trustAll = parseToBoolean(inputs.NETWORK_SSL_TRUST_ALL)
  const certFile = inputs.NETWORK_SSL_CERT_FILE?.trim() || ''
  // Use SHA-256 to produce a collision-resistant cache key
  return createHash('sha256')
    .update(`trustAll:${trustAll}`)
    .update(`certFile:${certFile}`)
    .digest('hex')
}
```

---

## What Is Already FedRAMP Aligned ✅

The following patterns in the codebase are **correct** and should be preserved:

| What | File | Why It's Correct |
|---|---|---|
| `rejectUnauthorized` is **not set** by default | `ssl-utils.ts` | Node.js secure default — cert validation enabled |
| Custom CA is **combined** with system CAs via `tls.rootCertificates` | `ssl-utils.ts` → `getSSLConfig()` | Correct additive trust chain (SC-23) |
| `NODE_TLS_REJECT_UNAUTHORIZED` is **never set** anywhere | entire codebase | No global TLS bypass |
| All external connections default to **HTTPS / port 443** | `ssl-utils.ts` → `createHTTPSRequestOptions()` | Transmission protection (SC-8) |
| **No custom cryptographic algorithms** implemented | entire codebase | Correctly delegates to platform crypto (SC-13) |
| **No hardcoded secrets, passwords, or keys** anywhere | entire codebase | Compliant with IA-5, SC-12 |
| `rejectUnauthorized: true` explicitly set when using `combinedCAs` | `ssl-utils.ts` → `createHTTPSAgent()` | Prevents accidental bypass when CAs provided |

---

## Recommended Action Items (Prioritized)

| Priority | Action | File(s) to Change |
|---|---|---|
| **P1** | Add `FEDRAMP_MODE` guard to block `NETWORK_SSL_TRUST_ALL=true` | `ssl-utils.ts` |
| **P2** | Add `minVersion: 'TLSv1.2'` to all `https.AgentOptions` and `RequestOptions` | `ssl-utils.ts` |
| **P3** | Fix `HttpClient` to use `combinedCAs` (not `caFile`) for custom CA | `utility.ts` |
| **P4** | Add FIPS startup check in `run()` when `FEDRAMP_MODE=true` | `main.ts` |
| **P5** | Replace plain string in `getSSLConfigHash()` with `crypto.createHash('sha256')` | `ssl-utils.ts` |
| **P6** | Document FedRAMP runner requirements (FIPS-validated Node.js build) | `README.md` / `docs/` |

---

## References

- [NIST SP 800-52 Rev 2 — Guidelines for TLS Implementations](https://csrc.nist.gov/publications/detail/sp/800-52/rev-2/final)
- [NIST SP 800-175B Rev 1 — Guideline for Using Cryptographic Standards](https://csrc.nist.gov/publications/detail/sp/800-175b/rev-1/final)
- [FIPS PUB 140-3 — Security Requirements for Cryptographic Modules](https://csrc.nist.gov/publications/detail/fips/140/3/final)
- [FedRAMP Security Controls — SC-8, SC-13, SC-23, SI-7](https://www.fedramp.gov/documents/)
- [Node.js FIPS Mode Documentation](https://nodejs.org/en/docs/guides/security)
- [Node.js TLS Defaults — `minVersion`](https://nodejs.org/api/tls.html#tlscreatesecurecontextoptions)
