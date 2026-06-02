---
name: test-generator
description: Generates comprehensive unit tests and contract tests following Black Duck Security Scan testing patterns. Uses Jest, creates mocks, stubs, and follows existing test structure and conventions.
---

# Test Generator

Generates unit tests and contract/e2e tests for the Black Duck Security Scan codebase using Jest.

## Usage

Run this skill when the user requests:
- "Generate tests for [component/file]"
- "Create unit tests for the new validator"
- "Add contract tests for [product] integration"
- "Write tests to cover [specific functionality]"

## Test Architecture

### Test Types

**Unit Tests** (`jest.config.js`)
- **Location**: `test/unit/**/*.test.ts`
- **Purpose**: Test individual functions/classes in isolation
- **Coverage**: Business logic, validation, transformations, utilities
- **Mocking**: Heavy use of mocks to isolate units

**Contract/E2E Tests** (`jest.config.e2e.js`)
- **Location**: `test/contract/**/*.e2e.test.ts`
- **Purpose**: Test integration scenarios end-to-end
- **Coverage**: Product workflows, Bridge CLI execution, error scenarios
- **Mocking**: Minimal mocking, test actual workflows

## Test Templates

### Template 1: Unit Test for Validator Function

**Use Case**: Testing validation logic

**File**: `test/unit/blackduck-security-action/validators.test.ts`

**Template**:
```typescript
import * as validators from '../../../src/blackduck-security-action/validators'
import * as inputs from '../../../src/blackduck-security-action/inputs'
import * as constants from '../../../src/application-constants'

// Mock inputs module
jest.mock('../../../src/blackduck-security-action/inputs')

describe('validate[ProductName]Inputs', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.resetAllMocks()
  })

  afterEach(() => {
    // Restore mocks after each test
    jest.restoreAllMocks()
  })

  test('should return empty array when all required inputs are provided', () => {
    // Arrange: Setup valid inputs
    Object.defineProperty(inputs, '[PRODUCT_URL_KEY]', {
      value: 'https://example.com',
      writable: true
    })
    Object.defineProperty(inputs, '[PRODUCT_TOKEN_KEY]', {
      value: 'test-token',
      writable: true
    })
    Object.defineProperty(inputs, '[PRODUCT_PARAM_KEY]', {
      value: 'test-value',
      writable: true
    })

    // Act: Call validator
    const errors = validators.validate[ProductName]Inputs()

    // Assert: No errors
    expect(errors).toEqual([])
    expect(errors.length).toBe(0)
  })

  test('should return error array when required input is missing', () => {
    // Arrange: Setup inputs with missing token
    Object.defineProperty(inputs, '[PRODUCT_URL_KEY]', {
      value: 'https://example.com',
      writable: true
    })
    Object.defineProperty(inputs, '[PRODUCT_TOKEN_KEY]', {
      value: '',
      writable: true
    })

    // Act
    const errors = validators.validate[ProductName]Inputs()

    // Assert: Contains error for missing token
    expect(errors.length).toBeGreaterThan(0)
    expect(errors).toContain(
      expect.stringContaining(constants.[PRODUCT_TOKEN_KEY])
    )
  })

  test('should return empty array when product URL is not provided', () => {
    // Arrange: Product not enabled
    Object.defineProperty(inputs, '[PRODUCT_URL_KEY]', {
      value: '',
      writable: true
    })

    // Act
    const errors = validators.validate[ProductName]Inputs()

    // Assert: No validation performed, no errors
    expect(errors).toEqual([])
  })

  test('should validate custom rules for product-specific parameters', () => {
    // Arrange: Setup with invalid custom parameter
    Object.defineProperty(inputs, '[PRODUCT_URL_KEY]', {
      value: 'https://example.com',
      writable: true
    })
    Object.defineProperty(inputs, '[PRODUCT_CUSTOM_PARAM]', {
      value: 'INVALID_VALUE',
      writable: true
    })

    // Act
    const errors = validators.validate[ProductName]Inputs()

    // Assert: Contains error for invalid custom param
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some(e => e.includes('[PRODUCT_CUSTOM_PARAM]'))).toBe(true)
  })
})
```

**Checklist**:
- ✅ Mock dependencies (inputs module)
- ✅ Reset/restore mocks in beforeEach/afterEach
- ✅ Test happy path (all valid inputs)
- ✅ Test missing required inputs
- ✅ Test conditional validation (product disabled)
- ✅ Test custom validation rules
- ✅ Use descriptive test names
- ✅ Arrange-Act-Assert pattern

---

### Template 2: Unit Test for Utility Function

**Use Case**: Testing pure functions and transformations

**File**: `test/unit/blackduck-security-action/utility.test.ts`

**Template**:
```typescript
import * as utility from '../../../src/blackduck-security-action/utility'

describe('[functionName]', () => {
  test('should [expected behavior] when [condition]', () => {
    // Arrange
    const input = [test data]

    // Act
    const result = utility.[functionName](input)

    // Assert
    expect(result).toBe([expected])
  })

  test('should handle null/undefined input', () => {
    // Arrange
    const input = null

    // Act & Assert
    expect(() => utility.[functionName](input)).toThrow([expected error])
    // OR
    expect(utility.[functionName](input)).toEqual([default value])
  })

  test('should handle empty input', () => {
    // Arrange
    const input = ''

    // Act
    const result = utility.[functionName](input)

    // Assert
    expect(result).toEqual([])
  })

  test('should transform input correctly', () => {
    // Arrange
    const input = 'value1,value2,value3'

    // Act
    const result = utility.[functionName](input)

    // Assert
    expect(result).toEqual(['value1', 'value2', 'value3'])
    expect(result.length).toBe(3)
  })

  test('should filter invalid values', () => {
    // Arrange
    const input = 'valid,,invalid, '

    // Act
    const result = utility.[functionName](input)

    // Assert
    expect(result).toContain('valid')
    expect(result).not.toContain('')
  })
})
```

---

### Template 3: Unit Test for Class Method

**Use Case**: Testing class methods with dependencies

**File**: `test/unit/blackduck-security-action/bridge-cli.test.ts`

**Template**:
```typescript
import {[ClassName]} from '../../../src/blackduck-security-action/[file-name]'
import * as inputs from '../../../src/blackduck-security-action/inputs'

jest.mock('../../../src/blackduck-security-action/inputs')
jest.mock('@actions/core')
jest.mock('fs')

describe('[ClassName]', () => {
  let instance: [ClassName]

  beforeEach(() => {
    // Setup mocks
    jest.resetAllMocks()

    // Create instance
    instance = new [ClassName]([constructor params])
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('[methodName]', () => {
    test('should [expected behavior] when [condition]', async () => {
      // Arrange
      jest.spyOn(instance, '[dependency method]').mockResolvedValue([mock value])

      // Act
      const result = await instance.[methodName]([params])

      // Assert
      expect(result).toBe([expected])
      expect(instance.[dependency method]).toHaveBeenCalledWith([expected args])
    })

    test('should throw error when [error condition]', async () => {
      // Arrange
      jest.spyOn(instance, '[dependency method]').mockRejectedValue(
        new Error('Mock error')
      )

      // Act & Assert
      await expect(instance.[methodName]([params])).rejects.toThrow('Mock error')
    })

    test('should call dependencies in correct order', async () => {
      // Arrange
      const spy1 = jest.spyOn(instance, '[method1]').mockResolvedValue([value])
      const spy2 = jest.spyOn(instance, '[method2]').mockResolvedValue([value])

      // Act
      await instance.[methodName]([params])

      // Assert
      expect(spy1).toHaveBeenCalledBefore(spy2)
    })
  })
})
```

---

### Template 4: Contract/E2E Test

**Use Case**: Testing end-to-end workflows

**File**: `test/contract/[product].e2e.test.ts`

**Template**:
```typescript
import {run} from '../../src/main'
import * as inputs from '../../src/blackduck-security-action/inputs'
import * as constants from '../../src/application-constants'

jest.mock('@actions/core')

describe('[Product] E2E Tests', () => {
  // Helper function to mock Bridge download
  function mockBridgeDownloadUrlAndBridgePath(): void {
    Object.defineProperty(inputs, 'BRIDGE_DOWNLOAD_URL', {
      value: 'https://mock-bridge-url.com/bridge.zip',
      writable: true
    })
    // Mock file system operations
    jest.spyOn(require('fs'), 'existsSync').mockReturnValue(true)
  }

  // Helper function to set all required inputs except specified ones
  function mock[Product]ParamsExcept(excludeField: string): void {
    if (excludeField !== 'SERVER_URL') {
      Object.defineProperty(inputs, '[PRODUCT]_SERVER_URL', {
        value: 'https://example.com',
        writable: true
      })
    }
    if (excludeField !== 'ACCESS_TOKEN') {
      Object.defineProperty(inputs, '[PRODUCT]_ACCESS_TOKEN', {
        value: 'mock-token',
        writable: true
      })
    }
    // Add other required fields
  }

  beforeEach(() => {
    jest.resetAllMocks()
    mockBridgeDownloadUrlAndBridgePath()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('should execute successfully with all mandatory fields', async () => {
    // Arrange
    mock[Product]ParamsExcept('')

    // Mock Bridge CLI execution
    jest.spyOn(require('@actions/exec'), 'exec').mockResolvedValue(0)

    // Act
    const result = await run()

    // Assert
    expect(result).toBeUndefined() // Success = no error thrown
  })

  test('should fail with missing mandatory field', async () => {
    // Arrange
    mock[Product]ParamsExcept('ACCESS_TOKEN')

    // Act & Assert
    try {
      await run()
      fail('Expected error to be thrown')
    } catch (err: any) {
      expect(err.message).toContain('[PRODUCT]_ACCESS_TOKEN')
      expect(err.message).toContain('failed with exit code 2')
    }
  })

  test('should handle Bridge CLI execution failure', async () => {
    // Arrange
    mock[Product]ParamsExcept('')

    // Mock Bridge CLI failure
    jest.spyOn(require('@actions/exec'), 'exec').mockRejectedValue(
      new Error('Bridge CLI failed with exit code 1')
    )

    // Act & Assert
    await expect(run()).rejects.toThrow('failed with exit code 1')
  })
})
```

---

## Test Generation Workflow

### Step 1: Identify What to Test

**For Functions**:
- Input validation
- Happy path (valid inputs)
- Edge cases (empty, null, undefined)
- Error cases (invalid inputs)
- Boundary conditions

**For Classes**:
- Constructor behavior
- Method return values
- Method side effects
- Error handling
- Dependency interactions

**For Workflows**:
- End-to-end success scenario
- Required field validation
- Optional field handling
- Error propagation

### Step 2: Choose Test Type

- **Unit Test**: Testing isolated function/method logic
- **Contract Test**: Testing integration between components
- **E2E Test**: Testing complete workflows

### Step 3: Set Up Test Structure

```typescript
// Import module under test
import {moduleToTest} from '../../../src/path/to/module'

// Import dependencies to mock
import * as dependency from '../../../src/path/to/dependency'

// Mock dependencies
jest.mock('../../../src/path/to/dependency')

// Describe block for module/class
describe('ModuleName or ClassName', () => {

  // Nested describe for specific method/function
  describe('methodName', () => {

    // Setup/teardown
    beforeEach(() => {})
    afterEach(() => {})

    // Individual tests
    test('should...', () => {})
  })
})
```

### Step 4: Write Test Cases

Follow **Arrange-Act-Assert** pattern:

```typescript
test('should return parsed array when given comma-separated string', () => {
  // Arrange: Set up test data
  const input = 'value1,value2,value3'

  // Act: Execute the code under test
  const result = parseCommaSeparated(input)

  // Assert: Verify the result
  expect(result).toEqual(['value1', 'value2', 'value3'])
  expect(result.length).toBe(3)
})
```

### Step 5: Add Mocking

**Mock entire modules**:
```typescript
jest.mock('../../../src/blackduck-security-action/inputs')
```

**Mock specific functions**:
```typescript
jest.spyOn(module, 'functionName').mockReturnValue(mockValue)
jest.spyOn(module, 'asyncFunction').mockResolvedValue(mockValue)
jest.spyOn(module, 'errorFunction').mockRejectedValue(new Error('Mock error'))
```

**Mock properties**:
```typescript
Object.defineProperty(inputs, 'POLARIS_SERVER_URL', {
  value: 'https://test.com',
  writable: true
})
```

**Mock file system**:
```typescript
jest.spyOn(fs, 'existsSync').mockReturnValue(true)
jest.spyOn(fs, 'readFileSync').mockReturnValue('file content')
```

### Step 6: Assert Results

**Value assertions**:
```typescript
expect(result).toBe(expected)
expect(result).toEqual(expectedObject)
expect(result).toContain(item)
expect(result).toHaveLength(3)
```

**Error assertions**:
```typescript
expect(() => functionCall()).toThrow('error message')
await expect(asyncFunction()).rejects.toThrow('error')
```

**Mock call assertions**:
```typescript
expect(mockFunction).toHaveBeenCalled()
expect(mockFunction).toHaveBeenCalledTimes(2)
expect(mockFunction).toHaveBeenCalledWith(expectedArg)
expect(spy1).toHaveBeenCalledBefore(spy2)
```

## Test Coverage Guidelines

### Minimum Coverage

- **Validators**: 100% (critical for security)
- **Utilities**: 90%+ (widely used functions)
- **Services**: 80%+ (core business logic)
- **Main flow**: 80%+ (entry points)

### What to Test

**High Priority**:
- ✅ Input validation logic
- ✅ Error handling paths
- ✅ Data transformation functions
- ✅ Command building logic
- ✅ Version compatibility checks

**Medium Priority**:
- ✅ Service implementations
- ✅ Factory pattern selection
- ✅ Retry logic
- ✅ File operations

**Low Priority** (often mocked):
- External API calls (GitHub, Bridge CLI)
- File system operations (covered by integration tests)
- Logging statements

### What NOT to Test

- ❌ Third-party library internals
- ❌ Simple getters/setters
- ❌ Constants/configuration
- ❌ Type definitions

## Best Practices

### DO:
- ✅ Use descriptive test names: "should [behavior] when [condition]"
- ✅ Follow Arrange-Act-Assert pattern
- ✅ Test one thing per test case
- ✅ Mock external dependencies
- ✅ Reset/restore mocks in beforeEach/afterEach
- ✅ Test both success and failure paths
- ✅ Test edge cases (null, undefined, empty)
- ✅ Use helper functions to reduce duplication
- ✅ Keep tests independent (no shared state)

### DON'T:
- ❌ Test implementation details (test behavior, not internals)
- ❌ Share state between tests
- ❌ Make tests dependent on execution order
- ❌ Test multiple behaviors in one test
- ❌ Mock everything (over-mocking makes tests brittle)
- ❌ Duplicate test logic (use helper functions)
- ❌ Ignore TypeScript errors in tests
- ❌ Skip cleanup (memory leaks in test suite)

## Example Test Generation

**Request**: "Generate tests for parseSeverities utility function"

**Response**:
```typescript
import {parseSeverities} from '../../../src/blackduck-security-action/utility'

describe('parseSeverities', () => {
  test('should parse comma-separated severities', () => {
    const input = 'CRITICAL,HIGH,MEDIUM'
    const result = parseSeverities(input, 'test-param')
    expect(result).toEqual(['CRITICAL', 'HIGH', 'MEDIUM'])
  })

  test('should trim whitespace from values', () => {
    const input = ' CRITICAL , HIGH , MEDIUM '
    const result = parseSeverities(input, 'test-param')
    expect(result).toEqual(['CRITICAL', 'HIGH', 'MEDIUM'])
  })

  test('should filter empty values', () => {
    const input = 'CRITICAL,,HIGH,,MEDIUM'
    const result = parseSeverities(input, 'test-param')
    expect(result).toEqual(['CRITICAL', 'HIGH', 'MEDIUM'])
  })

  test('should return empty array for empty input', () => {
    const input = ''
    const result = parseSeverities(input, 'test-param')
    expect(result).toEqual([])
  })

  test('should return empty array for null input', () => {
    const input = null as any
    const result = parseSeverities(input, 'test-param')
    expect(result).toEqual([])
  })

  test('should handle single value', () => {
    const input = 'CRITICAL'
    const result = parseSeverities(input, 'test-param')
    expect(result).toEqual(['CRITICAL'])
  })
})
```

## Running Tests

```bash
# Run all unit tests
npm test

# Run specific test file
npm test -- path/to/test.test.ts

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch

# Run contract/e2e tests
npm run contract-test

# Run with verbose output
npm test -- --verbose
```
