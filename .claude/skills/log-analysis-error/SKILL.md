---
name: error-log-analyzer
description: Analyzes error logs from GitHub Actions runs, Bridge CLI execution, and application errors. Identifies patterns, categorizes errors, and suggests fixes. Use when investigating failures or debugging issues.
---

# Error Log Analyzer

Analyzes error logs to identify issues, patterns, and root causes.

## Usage

Run this skill when the user provides:
- GitHub Actions workflow logs
- Bridge CLI error output
- Application error messages
- Stack traces
- Diagnostic files

## Log Sources

### 1. GitHub Actions Logs

**Location**: GitHub Actions workflow run logs

**Error Patterns to Find**:

#### Build Failures
```
Error: TypeScript compilation failed
src/file.ts(42,15): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'
```

**Analysis**:
- Type error at src/file.ts:42
- Expected number, got string
- Fix: Add type conversion or fix type definition

#### Test Failures
```
FAIL test/unit/validators.test.ts
  ● validatePolarisInputs › should validate required fields

    expect(received).toEqual(expected)

    Expected: []
    Received: ["polaris_access_token is missing"]
```

**Analysis**:
- Test expecting no errors
- Validation correctly failing
- Fix: Update test expectation or fix code

#### Dependency Issues
```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
```

**Analysis**:
- Dependency conflict
- Check package.json for version incompatibilities
- Fix: Update dependencies or use --legacy-peer-deps

### 2. Bridge CLI Errors

**Common Error Patterns**:

#### Authentication Errors
```
Error: Bridge CLI failed with exit code 2
[ERROR] Authentication failed: Invalid access token
```

**Root Cause**: Invalid or expired token
**Fix**: Update POLARIS_ACCESS_TOKEN in GitHub Secrets

#### Network Errors
```
Error: Bridge CLI failed with exit code 1
[ERROR] Failed to connect to https://polaris.example.com
[ERROR] Connection timeout after 30000ms
```

**Root Cause**: Network connectivity or firewall issue
**Fix**:
- Check network connectivity
- Verify URL is correct
- Check proxy settings
- Increase timeout if needed

#### Configuration Errors
```
Error: Bridge CLI failed with exit code 2
[ERROR] Missing required parameter: project.name
```

**Root Cause**: Missing required input
**Fix**: Add POLARIS_PROJECT_NAME to workflow configuration

#### Version Incompatibility
```
Error: Bridge CLI failed with exit code 1
[ERROR] Unsupported Bridge CLI version: 1.5.0
[ERROR] Minimum required version: 2.0.0
```

**Root Cause**: Old Bridge CLI version
**Fix**: Update BRIDGE_CLI_DOWNLOAD_URL or remove local installation

### 3. Application Errors

**Error Categories**:

#### Validation Errors
```
Error: Validation failed: polaris_server_url,polaris_access_token
```

**Analysis**:
- Multiple validation failures
- Split by comma: polaris_server_url, polaris_access_token
- Fix: Provide missing required parameters

#### File System Errors
```
Error: ENOENT: no such file or directory, open '/path/to/file'
```

**Root Cause**: File not found
**Fix**:
- Check file path is correct
- Ensure file exists
- Check permissions

#### Permission Errors
```
Error: EACCES: permission denied, mkdir '/usr/local/bridge'
```

**Root Cause**: Insufficient permissions
**Fix**:
- Use different directory
- Run with appropriate permissions
- Check directory ownership

#### JSON Parsing Errors
```
Error: Unexpected token < in JSON at position 0
```

**Root Cause**: Received HTML instead of JSON (likely error page)
**Fix**:
- Check API endpoint URL
- Check authentication
- Review server response

## Analysis Process

### Step 1: Categorize Errors

```markdown
## Error Categories

### Critical Errors (Prevent Execution)
- Authentication failures
- Missing required parameters
- Invalid configuration

### High Priority Errors (Execution Fails)
- Network timeouts
- Bridge CLI failures
- File system errors

### Medium Priority Errors (Partial Failure)
- Optional feature failures
- Warning-level issues
- Deprecated parameter usage

### Low Priority Errors (Cosmetic)
- Formatting warnings
- Deprecation notices
- Info-level messages
```

### Step 2: Identify Patterns

**Look for**:
- Repeated errors (same error multiple times)
- Error sequences (cascade of related errors)
- Time-based patterns (errors at specific times)
- Environment-specific errors (Windows vs Linux vs macOS)

**Example Pattern**:
```
17:32:15 [ERROR] Connection timeout to https://polaris.example.com
17:32:30 [ERROR] Connection timeout to https://polaris.example.com
17:32:45 [ERROR] Connection timeout to https://polaris.example.com
```

**Analysis**: Network issue, not transient
**Recommendation**: Check network/firewall, not just retry

### Step 3: Extract Stack Traces

```
Error: Failed to download Bridge CLI
    at downloadBridge (src/blackduck-security-action/bridge-cli.ts:167)
    at validateBridgePath (src/blackduck-security-action/bridge-cli.ts:95)
    at Bridge.constructor (src/blackduck-security-action/bridge-cli.ts:52)
    at run (src/main.ts:35)
```

**Call Stack Analysis**:
1. run() called at main.ts:35
2. Bridge constructor at bridge-cli.ts:52
3. validateBridgePath() at bridge-cli.ts:95
4. downloadBridge() at bridge-cli.ts:167 (error origin)

**Root Cause Location**: bridge-cli.ts:167

### Step 4: Suggest Fixes

For each error, provide:
- Root cause analysis
- Specific fix steps
- Verification method
- Prevention measures

## Error Analysis Report Format

```markdown
# Error Log Analysis Report

**Date**: [Date]
**Log Source**: [GitHub Actions / Bridge CLI / Application]
**Total Errors**: [Count]

---

## Executive Summary

- **Critical Errors**: [Count]
- **High Priority**: [Count]
- **Medium Priority**: [Count]
- **Low Priority**: [Count]

**Primary Issue**: [Main error identified]
**Impact**: [Severity and scope]
**Recommended Action**: [What to do first]

---

## Error Breakdown

### Critical Errors

#### 1. Authentication Failure

**Error Message**:
```
Error: Bridge CLI failed with exit code 2
[ERROR] Authentication failed: Invalid access token
```

**Occurrence**: 1 time
**First Seen**: [Timestamp]
**Last Seen**: [Timestamp]

**Root Cause**:
Invalid or expired POLARIS_ACCESS_TOKEN

**Fix Steps**:
1. Generate new access token in Polaris UI
2. Update GitHub Secret: POLARIS_ACCESS_TOKEN
3. Re-run workflow

**Verification**:
```bash
# Test token manually
curl -H "Authorization: Bearer $TOKEN" https://polaris.example.com/api/auth/v1/authenticate
```

**Prevention**:
- Set token expiration reminders
- Use service accounts with longer validity
- Implement token rotation

---

#### 2. Missing Required Parameter

**Error Message**:
```
Error: Validation failed: polaris_project_name
```

**Occurrence**: 1 time

**Root Cause**:
POLARIS_PROJECT_NAME not provided in workflow

**Fix Steps**:
1. Add to workflow YAML:
```yaml
with:
  polaris_project_name: 'MyProject'
```
2. Commit and push
3. Re-run workflow

**Verification**:
Check workflow configuration includes all required parameters

**Prevention**:
- Use workflow templates with required fields
- Add validation in development environment

---

### High Priority Errors

#### 1. Network Timeout

**Error Message**:
```
[ERROR] Connection timeout to https://polaris.example.com after 30000ms
```

**Occurrence**: 3 times
**Pattern**: Repeated at 15-second intervals

**Root Cause**:
Network connectivity issue or firewall blocking access

**Fix Steps**:
1. Check network connectivity: `curl https://polaris.example.com`
2. Review firewall rules
3. Check proxy configuration
4. Increase timeout if needed:
```yaml
with:
  network_timeout: '60000'  # 60 seconds
```

**Verification**:
Successful connection from GitHub Actions runner

**Prevention**:
- Allow outbound HTTPS in firewall
- Use air-gap mode if network restricted
- Configure proxy settings

---

## Error Patterns

### Pattern 1: Cascading Failures

```
[ERROR] Failed to download Bridge CLI
[ERROR] Bridge path validation failed
[ERROR] Command preparation failed
```

**Analysis**: Single root cause (download failure) causing cascade
**Fix**: Address root cause (download) resolves all errors

### Pattern 2: Intermittent Failures

```
Run 1: Success
Run 2: Network timeout
Run 3: Success
Run 4: Network timeout
```

**Analysis**: Network instability or rate limiting
**Fix**: Implement retry logic, check rate limits

### Pattern 3: Environment-Specific

```
Windows: PASS
Linux: PASS
macOS: Error: EACCES permission denied
```

**Analysis**: macOS-specific permission issue
**Fix**: Adjust file permissions or use different path

---

## Stack Trace Analysis

### Most Common Error Origins

1. **bridge-cli.ts:167** (5 occurrences)
   - Download failures
   - Network errors

2. **validators.ts:42** (3 occurrences)
   - Missing parameter validation
   - Invalid input format

3. **main.ts:89** (2 occurrences)
   - SARIF upload failures
   - GitHub API errors

---

## Recommendations

### Immediate Actions

1. **Fix authentication**: Update POLARIS_ACCESS_TOKEN
2. **Add missing parameters**: POLARIS_PROJECT_NAME
3. **Check network**: Verify connectivity to Polaris server

### Short-term Actions

1. Increase network timeout to 60s
2. Add retry logic for network operations
3. Validate all required parameters in development

### Long-term Actions

1. Implement comprehensive error logging
2. Add health check for external services
3. Create runbook for common errors
4. Set up monitoring and alerting

---

## Error Resolution Checklist

- [ ] Critical errors addressed
- [ ] High priority errors fixed
- [ ] Configuration validated
- [ ] Workflow re-run successful
- [ ] Monitoring configured
- [ ] Documentation updated

---

## Related Logs

- GitHub Actions Run: [Link]
- Diagnostics ZIP: [Link if uploaded]
- SARIF Report: [Link if available]

---

**Analysis Duration**: [Time]
**Next Review**: [When to check again]
```

## Common Error Patterns

### Pattern 1: Exit Code 2

```
Error: Bridge CLI failed with exit code 2
```

**Meaning**: Configuration or validation error
**Common Causes**:
- Missing required parameter
- Invalid parameter value
- Authentication failure

### Pattern 2: Exit Code 8

```
Error: Bridge CLI failed with exit code 8
```

**Meaning**: Policy violation (may be expected)
**Behavior**: Scan completed, but policy thresholds exceeded
**Action**: Review scan results, may not need fix

### Pattern 3: Exit Code 1

```
Error: Bridge CLI failed with exit code 1
```

**Meaning**: Execution error
**Common Causes**:
- Network timeout
- File system error
- Bridge CLI bug

## Tools for Log Analysis

```bash
# Extract errors from GitHub Actions log
grep -i "error" workflow.log

# Find exit codes
grep "exit code" workflow.log

# Extract stack traces
grep -A 10 "Error:" workflow.log

# Count error occurrences
grep -c "specific error" workflow.log

# Find errors by timestamp
grep "2024-01-15" workflow.log | grep -i "error"
```

## Best Practices

### DO:
- ✅ Analyze full log context, not just error message
- ✅ Look for patterns and repetitions
- ✅ Check related logs (diagnostics, SARIF)
- ✅ Verify fixes before closing
- ✅ Document common errors and fixes

### DON'T:
- ❌ Focus only on last error
- ❌ Ignore warnings (may lead to errors)
- ❌ Skip stack trace analysis
- ❌ Assume transient without verification
- ❌ Fix symptoms without addressing root cause
