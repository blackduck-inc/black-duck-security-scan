---
name: code-documentation
description: Reviews code documentation quality including JSDoc comments, inline comments, README documentation, and API documentation. Ensures comprehensive and up-to-date documentation.
---

# Code Documentation Review

Reviews documentation quality across JSDoc, inline comments, and project documentation.

## Review Areas

### 1. JSDoc Coverage

**Check for**:
- All public functions have JSDoc
- All parameters documented with @param
- Return types documented with @returns
- Exceptions documented with @throws
- Examples for complex APIs with @example

**Good Example** (tool-cache-local.ts:29-36):
```typescript
/**
 * Download a tool from a bridge download URL and stream it into a file
 *
 * @param bridgeDownloadUrl       URL of the bridge tool to download
 * @param dest      path to download tool
 * @param auth      authorization header
 * @param headers   other headers
 * @returns         path to downloaded tool
 */
export async function downloadTool(...): Promise<string>
```

**Search for Missing JSDoc**:
```bash
# Find exported functions without JSDoc
grep -B2 "export function" src/**/*.ts | grep -v "/**" | grep -v "*/"
```

### 2. JSDoc Quality Review

**Complete JSDoc Checklist**:
- [ ] Brief summary (first line)
- [ ] Detailed description (if needed)
- [ ] @param for all parameters
- [ ] @returns for return value
- [ ] @throws for exceptions
- [ ] @example for complex APIs
- [ ] @deprecated for deprecated APIs

**Quality Issues to Find**:

❌ **Missing parameter descriptions**:
```typescript
/**
 * Process data
 * @param data
 */
```

✅ **Complete documentation**:
```typescript
/**
 * Process data
 * @param data Input data to be processed
 */
```

❌ **No return description**:
```typescript
/**
 * @returns result
 */
```

✅ **Descriptive return**:
```typescript
/**
 * @returns Processed data as string array
 */
```

### 3. Inline Comments Review

**When to Use Inline Comments**:
- ✅ Complex logic not self-evident
- ✅ Non-obvious algorithm implementations
- ✅ Workarounds or temporary solutions
- ✅ Important edge cases

**When NOT to Use**:
- ❌ Obvious code
- ❌ Redundant explanations
- ❌ Outdated comments

**Good Example** (main.ts):
```typescript
// Bridge CLI v2.0+ uses different SARIF output directory structure
if (isVersionLess(bridgeVersion, '2.0.0')) {
  sarifPath = oldPath
} else {
  sarifPath = newPath
}
```

**Bad Example**:
```typescript
// Set the value to 5
const value = 5
```

### 4. Deprecation Documentation

**Pattern** (application-constants.ts):
```typescript
/**
 * @deprecated Use BRIDGECLI_INSTALL_DIRECTORY_KEY instead. This can be removed in future release.
 */
export const BRIDGE_INSTALL_DIRECTORY_KEY = 'bridge_install_directory'
```

**Checklist**:
- [ ] @deprecated tag used
- [ ] Replacement specified
- [ ] Timeline mentioned if known

### 5. Interface Documentation

**Good Example** (input-data/polaris.ts):
```typescript
/**
 * Polaris input data structure for Bridge CLI
 */
export interface Polaris {
  /**
   * Polaris product-specific configuration
   */
  polaris: PolarisData

  /**
   * Optional project-level configuration
   */
  project?: ProjectData
}
```

**Review**:
- [ ] Interface has description
- [ ] All properties documented
- [ ] Optional properties marked
- [ ] Nested objects explained

### 6. README and Project Documentation

**Check**:
- [ ] CLAUDE.md up to date with architecture
- [ ] README has usage examples
- [ ] Build commands documented
- [ ] Testing instructions clear
- [ ] Environment variables listed
- [ ] Contribution guidelines exist

## Documentation Gaps Analysis

### Search Commands

**Find undocumented exports**:
```bash
# Functions without JSDoc
grep -A1 "export function" src/**/*.ts | grep -v "/**" -B1

# Classes without JSDoc
grep -A1 "export class" src/**/*.ts | grep -v "/**" -B1

# Interfaces without JSDoc
grep -A1 "export interface" src/**/*.ts | grep -v "/**" -B1
```

**Find TODO comments** (should be tracked):
```bash
grep -rn "TODO" src/
grep -rn "FIXME" src/
grep -rn "HACK" src/
```

## Documentation Quality Metrics

### Coverage Targets

- Public functions: 100%
- Public classes: 100%
- Public interfaces: 100%
- Complex algorithms: 100% (inline)
- Private functions: 50%+ (as needed)

### Quality Checklist

For each documented item:

**Level 1 - Minimum** (Required):
- [ ] Has JSDoc block
- [ ] Summary line present

**Level 2 - Good** (Expected):
- [ ] All parameters documented
- [ ] Return value documented
- [ ] Types are accurate

**Level 3 - Excellent** (Desired):
- [ ] Examples provided for complex APIs
- [ ] Edge cases mentioned
- [ ] Related functions linked

## Review Report Format

```markdown
# Code Documentation Review Report

## Summary

- Total Exports: [Count]
- Documented Exports: [Count]
- Documentation Coverage: [X]%

## Missing Documentation

### Critical (Public APIs)

1. **Undocumented Function**
   - File: `src/utility.ts:145`
   - Function: `updateSarifPath()`
   - Priority: High

2. **Undocumented Class**
   - File: `src/bridge-cli.ts:47`
   - Class: `Bridge`
   - Priority: Critical

### High Priority

1. **Missing Parameter Descriptions**
   - File: `src/validators.ts:35`
   - Function: `validatePolarisInputs()`
   - Issue: No @param tags

2. **Missing Return Documentation**
   - File: `src/utility.ts:89`
   - Function: `parseSeverities()`
   - Issue: No @returns tag

### Medium Priority

1. **Missing Examples**
   - File: `src/tools-parameter.ts:36`
   - Method: `getFormattedCommandForPolaris()`
   - Complex API needs example

2. **Incomplete Interface Docs**
   - File: `src/input-data/polaris.ts:8`
   - Interface: `Polaris`
   - Some properties not documented

## Documentation Quality Issues

### Outdated Documentation

1. **File: src/bridge-cli.ts:120**
   - Comment references old API
   - Needs update

### Misleading Comments

1. **File: src/utility.ts:200**
   - Comment doesn't match implementation
   - Fix or remove

### TODO/FIXME Items

1. **File: src/main.ts:89**
   - TODO: Implement diagnostics upload
   - Create issue or implement

## Recommendations

### Immediate Actions

1. Document all public APIs (15 functions)
2. Add missing @param tags (23 functions)
3. Add missing @returns tags (18 functions)
4. Update outdated comments (5 locations)

### Short-term

1. Add examples for complex APIs (10 functions)
2. Document all interfaces completely
3. Review and update CLAUDE.md
4. Convert TODOs to GitHub issues

### Long-term

1. Automated documentation coverage checks
2. Documentation linting (eslint-plugin-jsdoc)
3. API documentation generation
4. Keep documentation in sync with code

## Best Practices Compliance

✅ **Following**:
- JSDoc format for public APIs
- Deprecation documentation
- Parameter documentation

⚠️ **Needs Improvement**:
- Example coverage for complex APIs
- Inline comment consistency
- Return value documentation

❌ **Missing**:
- Automated doc generation
- Documentation testing
- API reference generation
```

## Best Practices

### JSDoc

✅ **DO**:
```typescript
/**
 * Parse comma-separated severity values
 *
 * Splits input by comma, trims whitespace, filters empty values.
 *
 * @param input Comma-separated severity string (e.g., "HIGH,MEDIUM,LOW")
 * @param paramName Parameter name for warning messages
 * @returns Array of trimmed severity values, empty array if input is null/empty
 *
 * @example
 * ```typescript
 * const severities = parseSeverities('HIGH, MEDIUM, LOW', 'severities')
 * // Returns: ['HIGH', 'MEDIUM', 'LOW']
 * ```
 */
export function parseSeverities(input: string, paramName: string): string[]
```

❌ **DON'T**:
```typescript
/**
 * Parse severities
 */
export function parseSeverities(input: string, paramName: string): string[]
```

### Inline Comments

✅ **DO**:
```typescript
// Extract exit code from error message format: "...failed with exit code N"
const lastChar = error.message.trim().slice(-1)
```

❌ **DON'T**:
```typescript
// Get last character
const lastChar = error.message.trim().slice(-1)
```

## Tools for Documentation

```bash
# Generate API docs (if configured)
npm run docs

# Lint documentation
npx eslint --plugin jsdoc

# Check JSDoc coverage
npx jsdoc-coverage src/
```

## Fix Priority

1. **Critical**: Public API without JSDoc
2. **High**: Missing parameter/return docs
3. **Medium**: Outdated/incorrect comments
4. **Low**: Missing examples for simple APIs