---
name: error-handling
description: Reviews error handling patterns including try-catch usage, error propagation, error transformation, validation error collection, and retry logic. Ensures robust error handling throughout the codebase.
---

# Error Handling Review

Reviews error handling patterns and practices in the codebase.

## Review Areas

### 1. Try-Catch Usage

**Check for**:
- Missing try-catch in async operations
- Empty catch blocks
- Swallowed errors without logging
- Appropriate error boundaries

**Good Pattern** (main.ts:24-62):
```typescript
export async function run(): Promise<void> {
  let tempDir = ''
  try {
    // Main logic
  } catch (error) {
    if (error instanceof Error) {
      // Extract and log exit code
      // Upload diagnostics
      setFailed(error.message)
    }
  } finally {
    // Cleanup
    cleanupTempDir(tempDir)
  }
}
```

### 2. Error Transformation

**Pattern** (bridge-cli.ts:170-180):
```typescript
try {
  // Operation
} catch (error) {
  const errorObject = JSON.stringify(error)
  if (errorObject.includes('404')) {
    return Promise.reject(new Error(constants.BRIDGE_CLI_URL_NOT_VALID_OS_ERROR))
  }
  throw error
}
```

**Review For**:
- Context added to errors
- Error messages are descriptive
- Constants used for error messages
- Proper error types

### 3. Error Propagation

**Strategies in codebase**:

**Transparent Propagation**:
```typescript
catch (error) {
  throw error // Re-throw as-is
}
```

**With Context**:
```typescript
catch (error) {
  throw new Error(`Failed to download Bridge CLI: ${error}`)
}
```

**Silent with Logging**:
```typescript
catch (error) {
  info(`Optional operation failed: ${error}`)
  return defaultValue
}
```

### 4. Validation Error Collection

**Pattern** (validators.ts:35-51):
```typescript
export function validateInputs(): string[] {
  let errors: string[] = []

  if (inputs.URL) {
    const paramsMap = new Map()
    paramsMap.set(constants.TOKEN_KEY, inputs.TOKEN)
    errors = validateParameters(paramsMap, constants.PRODUCT_KEY)
  }

  return errors
}
```

**Review For**:
- Errors collected in array
- All validation errors returned together
- Caller decides whether to throw

### 5. Retry Logic

**Pattern** (retry-helper.ts:24-48):
```typescript
async execute<T>(
  action: () => Promise<T>,
  isRetryable?: (e: Error) => boolean
): Promise<T> {
  let attempt = 1
  while (attempt <= this.maxAttempts) {
    try {
      return await action()
    } catch (err) {
      if (attempt === this.maxAttempts ||
          (isRetryable && !isRetryable(err as Error))) {
        throw err
      }
      await this.sleep(this.retryDelay)
      this.retryDelay *= 2 // Exponential backoff
      attempt++
    }
  }
  throw new Error('Unreachable')
}
```

**Review For**:
- Retry count limits
- Exponential backoff
- Retryable vs non-retryable errors
- Timeout handling

## Review Checklist

For each error handling block:

- [ ] Try-catch wraps appropriate operations
- [ ] Catch block handles error (not empty)
- [ ] Error is logged or re-thrown
- [ ] Error messages are descriptive
- [ ] Finally block cleans up resources
- [ ] Async errors are handled
- [ ] Validation errors are collected
- [ ] Retry logic for network operations

## Common Issues

### Issue 1: Empty Catch Blocks
```typescript
// ❌ BAD
try {
  operation()
} catch (error) {
  // Silent failure
}

// ✅ GOOD
try {
  operation()
} catch (error) {
  warning(`Operation failed: ${error}`)
  return defaultValue
}
```

### Issue 2: Missing Finally Cleanup
```typescript
// ❌ BAD
try {
  const temp = createTemp()
  doWork(temp)
  cleanup(temp)
} catch (error) {
  throw error
}

// ✅ GOOD
let temp = ''
try {
  temp = createTemp()
  doWork(temp)
} finally {
  if (temp) cleanup(temp)
}
```

### Issue 3: Not Checking Error Type
```typescript
// ❌ BAD
catch (error) {
  error.message // May not exist
}

// ✅ GOOD
catch (error) {
  if (error instanceof Error) {
    setFailed(error.message)
  } else {
    setFailed('Unknown error occurred')
  }
}
```

### Issue 4: Missing Retry for Network Ops
```typescript
// ❌ BAD
async function download(url: string): Promise<void> {
  await fetch(url) // No retry
}

// ✅ GOOD
async function download(url: string): Promise<void> {
  await retryHelper.execute(async () => {
    return await fetch(url)
  }, isNetworkError)
}
```

## Review Report Format

```markdown
# Error Handling Review Report

## Summary
- Total Try-Catch Blocks: [Count]
- Issues Found: [Count]
  - Critical: [Count]
  - High: [Count]
  - Medium: [Count]

## Critical Issues

### 1. Empty Catch Block
**File**: `src/file.ts:line`
**Issue**: Error swallowed without logging
**Impact**: Silent failures, hard to debug

### 2. Missing Async Error Handling
**File**: `src/file.ts:line`
**Issue**: Async operation not wrapped in try-catch
**Impact**: Unhandled promise rejection

## Recommendations

1. Add error context in catch blocks
2. Implement retry logic for network operations
3. Use finally for resource cleanup
4. Collect validation errors before throwing
5. Check error types before accessing properties
```

## Best Practices from Codebase

✅ **Main try-catch-finally** pattern (main.ts)
✅ **Error transformation** with context (bridge-cli.ts)
✅ **Validation error collection** (validators.ts)
✅ **Retry helper** with backoff (retry-helper.ts)
✅ **Exit code mapping** (application-constants.ts)

## Fix Priority

1. **Critical**: Missing error handling in async operations
2. **High**: Empty catch blocks
3. **Medium**: Missing error context
4. **Low**: Inconsistent error message formatting
