---
name: testing-quality
description: Reviews test quality including coverage, test patterns, mock usage, assertions, test independence, and identifies missing tests. Ensures comprehensive and maintainable test suites.
---

# Testing Quality Review

Reviews test quality and coverage for the Black Duck Security Scan codebase.

## Review Areas

### 1. Test Coverage

```bash
# Run tests with coverage
npm test -- --coverage

# Review coverage report
open coverage/lcov-report/index.html
```

**Coverage Targets**:
- Validators: 100% (critical for security)
- Utilities: 90%+
- Services: 80%+
- Main flow: 80%+

### 2. Test Structure

**Good Pattern** (from test/unit/):
```typescript
describe('ModuleName', () => {
  beforeEach(() => {
    // Setup
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('functionName', () => {
    test('should [behavior] when [condition]', () => {
      // Arrange
      // Act
      // Assert
    })
  })
})
```

### 3. Test Quality Checklist

For each test file:

- [ ] Follows Arrange-Act-Assert pattern
- [ ] Descriptive test names ("should X when Y")
- [ ] Tests one thing per test case
- [ ] Independent tests (no shared state)
- [ ] Mocks external dependencies
- [ ] Restores mocks in afterEach
- [ ] Tests success and failure paths
- [ ] Tests edge cases (null, empty, boundary)

### 4. Mock Quality

**Good Mocking**:
```typescript
// Mock module
jest.mock('../../../src/module')

// Mock specific function
jest.spyOn(module, 'function').mockResolvedValue(value)

// Mock property
Object.defineProperty(inputs, 'PARAM', {value: 'test', writable: true})

// Restore mocks
afterEach(() => {
  jest.restoreAllMocks()
})
```

**Anti-Patterns**:
```typescript
// ❌ Over-mocking
jest.mock('everything')

// ❌ Not restoring mocks
// (Causes test pollution)

// ❌ Mocking what you're testing
jest.spyOn(moduleUnderTest, 'methodUnderTest').mockReturnValue(...)
```

### 5. Assertion Quality

**Good Assertions**:
```typescript
// Specific
expect(result).toBe(expected)
expect(result).toEqual({field: 'value'})
expect(errors).toContain('specific error')

// Multiple assertions for completeness
expect(result.length).toBe(3)
expect(result[0]).toBe('first')
expect(result).not.toContain('invalid')
```

**Weak Assertions**:
```typescript
// ❌ Too broad
expect(result).toBeTruthy()

// ❌ No assertion
const result = function()
// Missing expect()
```

### 6. Edge Case Coverage

**Must Test**:
- Null/undefined inputs
- Empty strings/arrays
- Boundary values
- Invalid input types
- Error conditions
- Async failures

**Example**:
```typescript
test('handles null input', () => {
  expect(parse(null)).toEqual([])
})

test('handles empty string', () => {
  expect(parse('')).toEqual([])
})

test('handles whitespace only', () => {
  expect(parse('   ')).toEqual([])
})
```

## Missing Tests Analysis

### Search for Untested Code

```bash
# Find functions without tests
grep -r "export function" src/ | while read line; do
  func=$(echo $line | grep -o "function [a-zA-Z]*" | cut -d' ' -f2)
  if ! grep -r "$func" test/ > /dev/null; then
    echo "Missing tests: $func in $line"
  fi
done
```

### Common Gaps

1. **Error handling paths**
   - Happy path tested
   - Error paths not tested

2. **Edge cases**
   - Normal inputs tested
   - Null/undefined not tested

3. **Integration scenarios**
   - Unit tests exist
   - Integration tests missing

4. **Async error handling**
   - Success case tested
   - Rejection not tested

## Test Quality Report

```markdown
# Testing Quality Review Report

## Coverage Summary
- Overall Coverage: [X]%
- Statements: [X]%
- Branches: [X]%
- Functions: [X]%
- Lines: [X]%

## Coverage by Module

| Module | Coverage | Status |
|--------|----------|--------|
| validators.ts | 95% | ✅ Good |
| utility.ts | 70% | ⚠️  Needs improvement |
| bridge-cli.ts | 65% | ⚠️  Needs improvement |

## Test Quality Issues

### Critical

1. **Missing error path tests**
   - File: test/unit/validators.test.ts
   - Missing: Error case for validatePolarisInputs

2. **No edge case tests**
   - File: test/unit/utility.test.ts
   - Missing: Null/undefined handling tests

### High Priority

1. **Tests not independent**
   - File: test/unit/main.test.ts
   - Issue: Shared state between tests
   - Fix: Add proper beforeEach setup

2. **Weak assertions**
   - File: test/unit/bridge-cli.test.ts:45
   - Current: expect(result).toBeTruthy()
   - Fix: Use specific assertion

## Missing Tests

- [ ] downloadBridge() error scenarios
- [ ] validateBridgePath() with invalid paths
- [ ] SARIF path update with v1.x Bridge
- [ ] Retry logic with non-retryable errors

## Recommendations

1. **Immediate**:
   - Add error path tests for validators
   - Test edge cases (null, empty, invalid)
   - Increase coverage for utility.ts to 90%

2. **Short-term**:
   - Add integration tests for multi-product scans
   - Test retry logic comprehensively
   - Add contract tests for new features

3. **Long-term**:
   - Automate coverage enforcement (>80%)
   - Add mutation testing
   - Visual regression tests for HTML output
```

## Best Practices

### Unit Tests

```typescript
// ✅ GOOD: Complete test
test('should parse comma-separated values', () => {
  // Arrange
  const input = 'value1, value2, value3'

  // Act
  const result = parse(input)

  // Assert
  expect(result).toEqual(['value1', 'value2', 'value3'])
  expect(result.length).toBe(3)
})

// ✅ GOOD: Error case
test('should throw for invalid input', () => {
  expect(() => parse(null)).toThrow('Input is required')
})

// ✅ GOOD: Async test
test('should download file', async () => {
  const result = await download('url')
  expect(result).toBeDefined()
})
```

### Contract Tests

```typescript
// ✅ GOOD: E2E scenario
test('should execute Polaris scan with all inputs', async () => {
  mockPolarisInputs()
  mockBridgeExecution()

  await run()

  expect(exec).toHaveBeenCalledWith('bridge', expect.arrayContaining([
    '--stage', 'polaris'
  ]))
})
```

## Tools

```bash
# Run tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test
npm test -- path/to/test.test.ts

# Run in watch mode
npm test -- --watch

# Run contract tests
npm run contract-test
```

## Fix Priority

1. **Critical**: Missing error handling tests
2. **High**: Edge case coverage
3. **Medium**: Integration test gaps
4. **Low**: Test organization improvements
