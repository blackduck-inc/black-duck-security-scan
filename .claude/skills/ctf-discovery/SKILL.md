---
name: ctf-discovery
description: Use after ctf-recon is confirmed. Runs the main CTF security sweep covering SAST, SCA, configuration, and authentication. Finds top 10 critical and high issues across injection, XSS, deserialization, hardcoded secrets, dependency vulnerabilities, and more.
---

# CTF Security Audit — Phase 2: Main Discovery

Run this after recon is confirmed. This is the primary security sweep.

## Main Discovery Prompt

Copy and send this prompt with the uploaded codebase zip:

---

We are working a CTF. Find the top 10 critical and high issues.

For each finding provide:
- Finding ID, severity (Critical / High / Medium / Low), score (0-10)
- Title and affected file with line reference
- CWE identifier(s)
- Summary: what is the vulnerability
- Potential impact: what can an attacker do
- Evidence: exact code snippet or config value
- Mitigation: specific, actionable steps

Cover ALL of the following categories:

**SAST:**
- Injection: SQL, command, template, SSRF, path traversal
- XSS: eval(), innerHTML, dangerouslySetInnerHTML, unencoded template output
- Deserialization: ObjectInputStream, readObject(), unsafe JSON parsing
- XXE: DocumentBuilderFactory, SAXParserFactory, XMLInputFactory
- Open redirect: window.location, location.replace, header injection
- Hardcoded secrets: passwords, tokens, API keys, internal hostnames
- Sensitive data in logs, PII in test fixtures

**SCA:**
- Known malicious packages (check exact versions against CVE databases)
- End-of-life / unmaintained frameworks
- Dependency integrity: lockfile pinning, mutable tags vs commit SHAs
- Private / SSH dependencies leaking internal infrastructure

**Configuration:**
- CSP headers: unsafe-inline, unsafe-eval, missing nonce
- TLS / SSL flags disabled by default (PostgreSQL, Redis, match engines)
- Default credentials (changeit, admin/admin, blank passwords)
- HSTS, frameOptions, security headers disabled
- Source maps in production builds
- Dev configs committed to repo

**Authentication:**
- CSRF protection: token presence, correct scoping, header vs cookie
- Token storage: localStorage vs sessionStorage vs HttpOnly cookie
- Weak crypto: MD5, DIGEST-MD5, deprecated algorithms
- Session handling: fixation, timeout, invalidation on logout

Document as an interactive HTML report. Each finding: expand/collapse. Show original vs severity clearly. Order by score descending.

---

## After Discovery

- Do NOT accept any Critical or High finding without running `ctf-verify-finding`
- Run `ctf-idor-authz` for a separate focused pass on IDOR and authorization bugs
- These require logic tracing, not just pattern matching — they hide deeper
