---
name: linting-formatting
description: Reviews code for linting and formatting issues based on ESLint and Prettier configurations. Checks code style, formatting consistency, and identifies violations of coding standards.
---

# Linting & Formatting Review

Reviews TypeScript code for linting and formatting issues following the Black Duck Security Scan project standards.

## What This Skill Reviews

### ESLint Configuration (`eslint.config.mjs`)
- TypeScript-specific linting rules
- Code quality issues
- Potential bugs from linting perspective

### Prettier Configuration (`.prettierrc.json`)
```json
{
  "printWidth": 999,
  "tabWidth": 2,
  "useTabs": false,
  "semi": false,
  "singleQuote": true,
  "trailingComma": "none",
  "bracketSpacing": false,
  "arrowParens": "avoid",
  "endOfLine": "auto"
}
```

## Review Process

### Step 1: Run Linting Commands

```bash
# Check linting
npm run lint

# Auto-fix linting issues
npm run lint-fix

# Check formatting
npm run format-check

# Auto-format code
npm run format
```

### Step 2: Review Specific Issues

#### Formatting Issues

**Single vs Double Quotes**:
- ✅ CORRECT: `const message = 'Hello world'`
- ❌ INCORRECT: `const message = "Hello world"`

**Semicolons**:
- ✅ CORRECT: `const value = 123` (no semicolon)
- ❌ INCORRECT: `const value = 123;`

**Indentation**:
- ✅ CORRECT: 2 spaces
- ❌ INCORRECT: 4 spaces or tabs

**Trailing Commas**:
- ✅ CORRECT: `{name: 'test', value: 123}`
- ❌ INCORRECT: `{name: 'test', value: 123,}`

**Bracket Spacing**:
- ✅ CORRECT: `{name: 'test'}`
- ❌ INCORRECT: `{ name: 'test' }`

**Arrow Function Parens**:
- ✅ CORRECT: `items.map(item => item.name)`
- ❌ INCORRECT: `items.map((item) => item.name)`

#### Linting Issues

**Unused Variables**:
```typescript
// ❌ INCORRECT
function process(input: string, unused: number) {
  return input.trim()
}

// ✅ CORRECT
function process(input: string) {
  return input.trim()
}
```

**Console Statements** (production code):
```typescript
// ❌ INCORRECT in src/ files
console.log('Debug message')

// ✅ CORRECT - use @actions/core
import {info, debug, warning, error} from '@actions/core'
info('Message')
```

**Implicit Any**:
```typescript
// ❌ INCORRECT
function process(data) {
  return data
}

// ✅ CORRECT
function process(data: unknown): unknown {
  return data
}
```

**Non-Null Assertions** (use sparingly):
```typescript
// ⚠️ USE WITH CAUTION
const value = maybeNull!.property

// ✅ PREFER
if (maybeNull != null) {
  const value = maybeNull.property
}
```

## Automated Review Report

Generate a report with the following sections:

### Formatting Violations

```markdown
## Formatting Issues Found

### Critical Issues (Auto-Fixable)

1. **Double quotes used instead of single quotes**
   - File: `src/file.ts:42`
   - Current: `const msg = "test"`
   - Fix: Run `npm run format`

2. **Semicolons present**
   - Files: Multiple files (15 instances)
   - Fix: Run `npm run format`

### Inconsistencies

1. **Mixed indentation**
   - File: `src/utility.ts:120-145`
   - Some lines use 4 spaces instead of 2
   - Fix: Run `npm run format`
```

### Linting Violations

```markdown
## Linting Issues Found

### Errors (Must Fix)

1. **Unused variable 'tempVar'**
   - File: `src/bridge-cli.ts:234`
   - Severity: Error
   - Fix: Remove unused variable or prefix with `_` if intentionally unused

2. **Implicit any type**
   - File: `src/utility.ts:89`
   - Severity: Error
   - Fix: Add explicit type annotation

### Warnings (Should Fix)

1. **Console.log in production code**
   - File: `src/main.ts:56`
   - Severity: Warning
   - Fix: Replace with `info()` from @actions/core
```

## Common Issues in This Codebase

Based on analysis, watch for:

### Issue 1: Long Line Lengths
**Config**: `printWidth: 999` (very permissive)
**Problem**: Some lines are unnecessarily long and hard to read
**Recommendation**: Consider reducing to 120 or 140

### Issue 2: Minimal ESLint Rules
**Current**: Empty rules object in eslint.config.mjs
**Problem**: Missing common TypeScript best practices
**Recommendation**: Add recommended rules

### Issue 3: Console Statements in Tests
**Location**: Test files may have console.log
**Status**: Acceptable in tests, not in src/
**Action**: No fix needed for tests

## Best Practices

### DO:
- ✅ Run `npm run format` before committing
- ✅ Run `npm run lint-fix` to auto-fix issues
- ✅ Use Prettier extension in VS Code for auto-format on save
- ✅ Follow existing patterns in the codebase
- ✅ Use `info()`, `debug()`, `warning()`, `error()` instead of console

### DON'T:
- ❌ Commit code without formatting
- ❌ Ignore linting errors
- ❌ Mix formatting styles
- ❌ Disable linting rules without good reason
- ❌ Use console.log in production code

## Fix Priority

1. **Critical**: Linting errors (breaks build)
2. **High**: Unused variables, implicit any
3. **Medium**: Formatting inconsistencies
4. **Low**: Long lines (within config limits)

## Running Review

```bash
# Full quality check
npm run all

# This runs (in order):
# 1. npm run format
# 2. npm run lint
# 3. npm run build
# 4. npm run package
# 5. npm test
```

## Output Format

```markdown
# Linting & Formatting Review Report

**Date**: [Date]
**Files Reviewed**: [Count]

## Summary

- ✅ Formatting: [Pass/Fail]
- ✅ Linting: [Pass/Fail]
- Total Issues: [Count]
  - Errors: [Count]
  - Warnings: [Count]

## Issues by File

### src/file1.ts
- Line 42: Double quotes instead of single
- Line 89: Unused variable 'temp'

### src/file2.ts
- Line 120: Implicit any type

## Auto-Fix Commands

```bash
npm run format      # Fix all formatting issues
npm run lint-fix    # Fix auto-fixable linting issues
```

## Manual Fixes Required

[List issues that cannot be auto-fixed]
```
