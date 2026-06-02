---
name: security-practices
description: Reviews code for security best practices including input validation, avoiding unsafe operations (eval, innerHTML), data sanitization, secret handling, path traversal prevention, and injection vulnerabilities.
---

# Security Practices Review

Reviews code for security vulnerabilities and best practices.

## Security Review Areas

### 1. Input Validation

**Check**:
- All user inputs validated
- Type checking for external data
- Range/length validation
- Regex validation for patterns

**Pattern from validators.ts**:
```typescript
export function validateInputs(): string[] {
  const errors: string[] = []
  // Validate all required fields
  // Check format/pattern
  return errors
}
```

**Search for**:
- Unvalidated user input
- Missing null checks
- Direct use of environment variables without validation

### 2. Injection Vulnerabilities

#### Command Injection
```typescript
// ❌ DANGEROUS
exec(`bridge-cli ${userInput}`)

// ✅ SAFE
exec('bridge-cli', [arg1, arg2]) // Parameterized
```

#### Path Traversal
```typescript
// ❌ DANGEROUS
fs.readFile(userProvidedPath)

// ✅ SAFE
const safePath = path.join(baseDir, path.normalize(userPath))
if (!safePath.startsWith(baseDir)) {
  throw new Error('Invalid path')
}
```

#### SQL Injection (if applicable)
- Use parameterized queries
- Never concatenate user input into SQL

### 3. Unsafe Operations

**Never Use**:
```typescript
// ❌ NEVER
eval(userInput)
new Function(userInput)()
```

**Avoid in Production**:
```typescript
// ⚠️ AVOID
element.innerHTML = userContent
dangerouslySetInnerHTML={{__html: userContent}}
```

### 4. Secret Handling

**Check for**:
- Hardcoded secrets (passwords, tokens, API keys)
- Secrets in logs
- Secrets in error messages
- Secrets in version control

**Good Pattern** (inputs.ts):
```typescript
// Use GitHub Secrets
export const POLARIS_ACCESS_TOKEN = getInput(
  constants.POLARIS_ACCESS_TOKEN_KEY
)
```

**Bad Patterns to Find**:
```typescript
// ❌ NEVER
const apiKey = 'sk_live_abc123...'
const password = 'admin123'
const token = process.env.SECRET // Not masked
```

### 5. Data Sanitization

**For File Paths**:
```typescript
// ✅ SANITIZE
const safePath = path.normalize(userPath)
  .replace(/^(\.\.(\/|\\|$))+/, '')
```

**For URLs**:
```typescript
// ✅ VALIDATE
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:'
  } catch {
    return false
  }
}
```

**For File Names**:
```typescript
// ✅ SANITIZE
const safeName = fileName
  .replace(/[^a-zA-Z0-9.-]/g, '_')
  .slice(0, 255)
```

### 6. Authentication & Authorization

**Review**:
- Token storage (not in localStorage for sensitive data)
- Token transmission (HTTPS only)
- Token expiration handling
- Proper authentication headers

**Pattern from codebase**:
```typescript
// GitHub token from secrets
const octokit = github.getOctokit(token)
```

### 7. Network Security

**Check for**:
- HTTPS enforcement
- SSL certificate validation
- Proxy configuration
- Network timeout settings

**Pattern** (ssl-utils.ts):
```typescript
// SSL trust configuration
if (inputs.NETWORK_AIRGAP_KEY === 'true') {
  // Disable SSL verification only in air-gap mode
} else {
  // Use proper SSL verification
}
```

### 8. File System Security

**Review**:
- Temp file cleanup
- File permissions
- Directory traversal prevention
- Secure file deletion

**Good Pattern** (main.ts):
```typescript
try {
  tempDir = createTempDir()
  // Use temp directory
} finally {
  // Always cleanup
  cleanupTempDir(tempDir)
}
```

## Common Vulnerabilities to Check

### OWASP Top 10 Checklist

1. **Injection**
   - [ ] Command injection prevented
   - [ ] Path traversal prevented
   - [ ] No string concatenation in commands

2. **Broken Authentication**
   - [ ] Secrets from environment/GitHub Secrets
   - [ ] No hardcoded credentials
   - [ ] Tokens not logged

3. **Sensitive Data Exposure**
   - [ ] Secrets masked in logs
   - [ ] No secrets in error messages
   - [ ] SSL/TLS enforced

4. **XML External Entities** (if parsing XML)
   - [ ] XML parser configured securely

5. **Broken Access Control**
   - [ ] File access validated
   - [ ] Path traversal prevented

6. **Security Misconfiguration**
   - [ ] Defaults are secure
   - [ ] Development configs not in production

7. **Cross-Site Scripting** (if generating HTML)
   - [ ] User input sanitized
   - [ ] No innerHTML with user data

8. **Insecure Deserialization**
   - [ ] JSON.parse() validated
   - [ ] Type checking after parsing

9. **Using Components with Known Vulnerabilities**
   - [ ] Dependencies up to date
   - [ ] No known vulnerable versions

10. **Insufficient Logging & Monitoring**
    - [ ] Security events logged
    - [ ] Errors properly logged

## Security Scanning

```bash
# Check dependencies for vulnerabilities
npm audit

# Fix auto-fixable vulnerabilities
npm audit fix

# Check for outdated packages
npm outdated

# Specific security scan (if available)
npm run security-scan
```

## Search Patterns

**Find potential secrets**:
```bash
grep -r "password.*=.*['\"]" src/
grep -r "api[-_]key.*=.*['\"]" src/
grep -r "secret.*=.*['\"]" src/
grep -r "token.*=.*['\"]" src/
```

**Find unsafe operations**:
```bash
grep -r "eval(" src/
grep -r "new Function(" src/
grep -r "innerHTML" src/
grep -r "dangerouslySetInnerHTML" src/
```

**Find command execution**:
```bash
grep -r "exec(" src/
grep -r "spawn(" src/
grep -r "child_process" src/
```

## Review Report Format

```markdown
# Security Practices Review Report

## Summary
- Critical Issues: [Count]
- High Priority: [Count]
- Medium Priority: [Count]
- Low Priority: [Count]

## Critical Issues

### 1. Hardcoded Secret Found
**File**: `src/file.ts:line`
**Issue**: API key hardcoded in source
**Risk**: Credential exposure
**Fix**: Use GitHub Secrets

### 2. Command Injection Risk
**File**: `src/file.ts:line`
**Issue**: User input concatenated into command
**Risk**: Arbitrary command execution
**Fix**: Use parameterized commands

## High Priority Issues

### 1. Path Traversal Vulnerability
**File**: `src/file.ts:line`
**Issue**: User path not validated
**Risk**: Unauthorized file access
**Fix**: Validate and normalize paths

### 2. Missing Input Validation
**File**: `src/file.ts:line`
**Issue**: External input used without validation
**Risk**: Injection attacks
**Fix**: Add validation

## Medium Priority Issues

### 1. Insecure SSL Configuration
**File**: `src/file.ts:line`
**Issue**: SSL verification disabled globally
**Risk**: Man-in-the-middle attacks
**Fix**: Only disable in specific air-gap scenarios

## Recommendations

1. **Immediate**:
   - Remove hardcoded secrets
   - Fix command injection risks
   - Add input validation

2. **Short-term**:
   - Review all file operations for path traversal
   - Implement content security policy
   - Add security headers

3. **Long-term**:
   - Automated security scanning in CI/CD
   - Regular dependency audits
   - Security training for team
```

## Best Practices from Codebase

✅ **Secrets from inputs** (inputs.ts)
✅ **Parameterized commands** (@actions/exec)
✅ **Path normalization** (path.join, path.normalize)
✅ **Temp file cleanup** (main.ts finally block)
✅ **SSL configuration** (ssl-utils.ts)
✅ **Input validation** (validators.ts)

## Security Anti-Patterns to Avoid

❌ **Hardcoded secrets**
❌ **String concatenation in commands**
❌ **Unvalidated user input**
❌ **Path traversal vulnerabilities**
❌ **eval() or new Function()**
❌ **Logging sensitive data**
❌ **Insecure defaults**

## Compliance Considerations

- GDPR: Handle user data appropriately
- SOC 2: Audit logging, access controls
- PCI DSS: If handling payment data
- HIPAA: If handling health data

## Fix Priority

1. **Critical**: Hardcoded secrets, injection vulnerabilities
2. **High**: Missing validation, path traversal
3. **Medium**: Insecure configurations
4. **Low**: Security headers, additional hardening
