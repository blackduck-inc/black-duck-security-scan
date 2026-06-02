---
name: type-safe-generator
description: Generates type-safe TypeScript code following strict typing standards. Creates proper interfaces, type guards, null handling, and ensures no implicit any types. Use when generating new code or refactoring to improve type safety.
---

# Type-Safe Code Generator

Generates type-safe TypeScript code following the Black Duck Security Scan codebase's strict typing standards.

## Usage

Run this skill when the user requests:
- "Generate type-safe code for [feature]"
- "Create type definitions for [data structure]"
- "Add type guards for [validation]"
- "Make this code type-safe"
- "Refactor to improve type safety"

## Type Safety Principles

Based on `tsconfig.json` strict mode configuration:

```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "strictFunctionTypes": true,
  "strictPropertyInitialization": true
}
```

## Type-Safe Patterns

### Pattern 1: Interface Definitions

**Use interfaces for object shapes**:

```typescript
/**
 * [Description of what this interface represents]
 */
export interface ConfigurationData {
  /**
   * [Property description]
   */
  required​Property: string

  /**
   * [Optional property description]
   */
  optionalProperty?: number

  /**
   * [Nested object description]
   */
  nested: {
    subProperty: boolean
  }

  /**
   * [Union type description]
   */
  status: 'pending' | 'active' | 'complete'

  /**
   * [Array property description]
   */
  items: string[]
}
```

**Example from codebase** (`input-data/polaris.ts`):
```typescript
export interface PolarisData extends Common {
  accesstoken: string
  serverUrl: string
  application: {name: string}
  project: {name: string}
  assessment: {types: string[]}
  branch?: Branch
  prComment?: PrComment
  reports?: Reports
}
```

---

### Pattern 2: Type Aliases for Union Types

**Use type aliases for complex types**:

```typescript
// Status codes
export type HttpStatusCode = 200 | 201 | 400 | 401 | 403 | 404 | 500

// Product names
export type SecurityProduct = 'polaris' | 'coverity' | 'blackduck' | 'srm'

// Error severities
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'

// Function types
export type ValidationFunction = (input: string) => string[]
export type RetryPredicate = (error: Error) => boolean
```

---

### Pattern 3: Null Safety

**Handle null/undefined explicitly**:

```typescript
// Option 1: Optional chaining with nullish coalescing
const value = inputs.PARAMETER?.trim() || ''

// Option 2: Explicit null check
function processValue(input: string | null | undefined): string {
  if (input == null || input.length === 0) {
    return ''
  }
  return input.trim()
}

// Option 3: Optional parameters with defaults
function execute(
  required: string,
  optional?: string
): string {
  const value = optional ?? 'default'
  return `${required}: ${value}`
}

// Option 4: Type narrowing
function processOptional(input: string | null): string {
  if (input === null) {
    throw new Error('Input is required')
  }
  // TypeScript knows input is string here
  return input.toUpperCase()
}
```

**Example from codebase** (`inputs.ts:18-20`):
```typescript
export const BRIDGE_CLI_INSTALL_DIRECTORY_KEY =
  getInput(constants.BRIDGE_CLI_INSTALL_DIRECTORY_KEY)?.trim() ||
  getInput(constants.BRIDGE_INSTALL_DIRECTORY_KEY)?.trim() ||
  ''
```

---

### Pattern 4: Type Guards

**Create type guards for runtime type checking**:

```typescript
// Type predicate for custom types
function isError(value: unknown): value is Error {
  return value instanceof Error
}

// Type guard for interface
interface PolarisConfig {
  serverUrl: string
  accessToken: string
}

function isPolarisConfig(obj: unknown): obj is PolarisConfig {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'serverUrl' in obj &&
    'accessToken' in obj &&
    typeof (obj as PolarisConfig).serverUrl === 'string' &&
    typeof (obj as PolarisConfig).accessToken === 'string'
  )
}

// Type guard for discriminated unions
type SuccessResult = {status: 'success'; data: string}
type ErrorResult = {status: 'error'; error: Error}
type Result = SuccessResult | ErrorResult

function isSuccessResult(result: Result): result is SuccessResult {
  return result.status === 'success'
}

// Usage
function processResult(result: Result): string {
  if (isSuccessResult(result)) {
    return result.data // TypeScript knows this is SuccessResult
  } else {
    return result.error.message // TypeScript knows this is ErrorResult
  }
}
```

**Example from codebase** (`main.ts:136-141`):
```typescript
export function getBridgeExitCode(error: Error): boolean {
  if (error.message !== undefined) {
    const lastChar = error.message.trim().slice(-1)
    const num = parseFloat(lastChar)
    return !isNaN(num)
  }
  return false
}
```

---

### Pattern 5: Generic Functions

**Use generics for reusable type-safe functions**:

```typescript
// Generic retry helper
async function executeWithRetry<T>(
  action: () => Promise<T>,
  retryCount: number = 3
): Promise<T> {
  let lastError: Error

  for (let i = 0; i < retryCount; i++) {
    try {
      return await action()
    } catch (error) {
      lastError = error as Error
    }
  }

  throw lastError!
}

// Generic array validator
function validateArray<T>(
  items: T[],
  validator: (item: T) => boolean,
  errorMsg: string
): string[] {
  const errors: string[] = []

  for (const item of items) {
    if (!validator(item)) {
      errors.push(`${errorMsg}: ${item}`)
    }
  }

  return errors
}

// Generic factory
interface Creator<T> {
  create(config: unknown): T
}

function createInstance<T>(
  creator: Creator<T>,
  config: unknown
): T {
  return creator.create(config)
}
```

**Example from codebase** (`retry-helper.ts:20-48`):
```typescript
export class RetryHelper {
  async execute<T>(
    action: () => Promise<T>,
    isRetryable?: (e: Error) => boolean
  ): Promise<T> {
    // Implementation
  }
}
```

---

### Pattern 6: Explicit Return Types

**Always specify return types for functions**:

```typescript
// ✅ GOOD: Explicit return type
function parseInput(input: string): string[] {
  return input.split(',').map(s => s.trim())
}

// ✅ GOOD: Explicit async return type
async function fetchData(url: string): Promise<string> {
  const response = await fetch(url)
  return response.text()
}

// ✅ GOOD: Explicit void return
function logMessage(message: string): void {
  console.log(message)
}

// ❌ BAD: Implicit return type
function parseInput(input: string) {
  return input.split(',').map(s => s.trim())
}
```

---

### Pattern 7: Strict Parameter Types

**Avoid any, use specific types**:

```typescript
// ❌ BAD: Using any
function process(data: any): any {
  return data.value
}

// ✅ GOOD: Specific types
interface InputData {
  value: string
}

function process(data: InputData): string {
  return data.value
}

// ✅ GOOD: Unknown for truly unknown types
function process(data: unknown): string {
  if (isInputData(data)) {
    return data.value
  }
  throw new Error('Invalid data')
}

// ✅ GOOD: Generic for flexible types
function process<T extends {value: string}>(data: T): string {
  return data.value
}
```

---

### Pattern 8: Discriminated Unions

**Use discriminated unions for state management**:

```typescript
// Define states with discriminator field
type LoadingState = {
  status: 'loading'
}

type SuccessState = {
  status: 'success'
  data: string
}

type ErrorState = {
  status: 'error'
  error: Error
}

// Union type
type State = LoadingState | SuccessState | ErrorState

// Type-safe state handling
function handleState(state: State): string {
  switch (state.status) {
    case 'loading':
      return 'Loading...'
    case 'success':
      return state.data // TypeScript knows data exists
    case 'error':
      return state.error.message // TypeScript knows error exists
  }
}
```

**Example from codebase** (`application-constants.ts:335-338`):
```typescript
export enum BUILD_STATUS {
  SUCCESS = 'success',
  FAILURE = 'failure'
}
```

---

### Pattern 9: Const Assertions

**Use const assertions for literal types**:

```typescript
// Object with readonly properties
const CONFIG = {
  apiUrl: 'https://api.example.com',
  timeout: 3000,
  retries: 3
} as const

// Type: { readonly apiUrl: "https://api.example.com"; readonly timeout: 3000; ... }

// Array as tuple
const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const
// Type: readonly ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

// Extract type from const
type Severity = typeof SEVERITIES[number]
// Type: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

// Use in validation
function isValidSeverity(value: string): value is Severity {
  return (SEVERITIES as readonly string[]).includes(value)
}
```

---

### Pattern 10: Mapped Types

**Create derived types using mapped types**:

```typescript
// Make all properties optional
type Partial<T> = {
  [P in keyof T]?: T[P]
}

// Make all properties readonly
type Readonly<T> = {
  readonly [P in keyof T]: T[P]
}

// Pick specific properties
type Pick<T, K extends keyof T> = {
  [P in K]: T[P]
}

// Omit specific properties
type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>

// Example usage
interface User {
  id: string
  name: string
  email: string
  password: string
}

type UserProfile = Omit<User, 'password'>
// Type: { id: string; name: string; email: string }

type PartialUser = Partial<User>
// Type: { id?: string; name?: string; email?: string; password?: string }
```

**Example from codebase** (`input-data/polaris.ts:12`):
```typescript
detect?: Omit<BlackDuckDetect, 'install' | 'scan'>
```

---

## Type-Safe Code Generation Templates

### Template 1: Type-Safe Data Model

```typescript
/**
 * [Description]
 */
export interface [ModelName] {
  /**
   * [Required field description]
   */
  requiredField: string

  /**
   * [Optional field description]
   */
  optionalField?: number

  /**
   * [Union type field description]
   */
  status: 'active' | 'inactive' | 'pending'

  /**
   * [Nested object description]
   */
  config: {
    enabled: boolean
    options: string[]
  }
}

/**
 * Type guard for [ModelName]
 */
export function is[ModelName](obj: unknown): obj is [ModelName] {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'requiredField' in obj &&
    typeof (obj as [ModelName]).requiredField === 'string'
  )
}

/**
 * Creates default [ModelName] instance
 */
export function createDefault[ModelName](): [ModelName] {
  return {
    requiredField: '',
    status: 'pending',
    config: {
      enabled: false,
      options: []
    }
  }
}
```

---

### Template 2: Type-Safe Function

```typescript
/**
 * [Function description]
 *
 * @param param1 [Description]
 * @param param2 [Description]
 * @returns [Description]
 * @throws {TypeError} If parameters are invalid
 */
export function functionName(
  param1: string,
  param2: number | null
): string[] {
  // Input validation with type narrowing
  if (param1 == null || param1.length === 0) {
    throw new TypeError('param1 is required')
  }

  // Null safety
  const value = param2 ?? 0

  // Type-safe operations
  const results: string[] = []

  // Implementation
  for (let i = 0; i < value; i++) {
    results.push(`${param1}-${i}`)
  }

  return results
}
```

---

### Template 3: Type-Safe Class

```typescript
/**
 * [Class description]
 */
export class ClassName<T extends Record<string, unknown>> {
  /**
   * [Private readonly property]
   */
  private readonly config: T

  /**
   * [Private mutable property with explicit type]
   */
  private state: 'idle' | 'running' | 'complete' = 'idle'

  /**
   * Constructor
   *
   * @param config [Description]
   */
  constructor(config: T) {
    this.config = config
  }

  /**
   * [Method description]
   *
   * @param key [Description]
   * @returns [Description]
   */
  public getValue<K extends keyof T>(key: K): T[K] {
    return this.config[key]
  }

  /**
   * [Async method description]
   *
   * @returns [Description]
   */
  public async execute(): Promise<void> {
    this.state = 'running'

    try {
      // Implementation
      this.state = 'complete'
    } catch (error) {
      this.state = 'idle'
      throw error
    }
  }
}
```

---

## Type Safety Checklist

When generating type-safe code, ensure:

### Types
- ✅ All parameters have explicit types
- ✅ All return types are explicit
- ✅ No `any` types (use `unknown` if truly unknown)
- ✅ Interfaces for object shapes
- ✅ Type aliases for unions and complex types
- ✅ Generics for reusable components

### Null Safety
- ✅ Optional parameters marked with `?`
- ✅ Null/undefined handled explicitly
- ✅ Use `??` for null coalescing
- ✅ Use `?.` for optional chaining
- ✅ Type narrowing for null checks

### Validation
- ✅ Input validation with type guards
- ✅ Runtime type checking where needed
- ✅ Explicit error throwing with types

### Best Practices
- ✅ Readonly properties where appropriate
- ✅ Const assertions for literal types
- ✅ Discriminated unions for state
- ✅ Mapped types for transformations

## Example: Making Code Type-Safe

**Before** (not type-safe):
```typescript
function process(data) {
  const value = data.value || ''
  return value.split(',')
}
```

**After** (type-safe):
```typescript
interface InputData {
  value: string | null | undefined
}

function process(data: InputData): string[] {
  // Null safety with type narrowing
  const value = data.value?.trim() ?? ''

  // Early return for empty input
  if (value.length === 0) {
    return []
  }

  // Type-safe operations
  return value.split(',').map(s => s.trim())
}
```

## Common Type Safety Issues

### Issue 1: Implicit Any

```typescript
// ❌ BAD
function parse(input) {
  return JSON.parse(input)
}

// ✅ GOOD
function parse<T>(input: string): T {
  return JSON.parse(input) as T
}
```

### Issue 2: Unsafe Type Assertions

```typescript
// ❌ BAD
const data = apiResponse as MyType

// ✅ GOOD
function isMyType(obj: unknown): obj is MyType {
  // Validate structure
  return typeof obj === 'object' && obj !== null && 'field' in obj
}

const data = apiResponse
if (!isMyType(data)) {
  throw new TypeError('Invalid response')
}
// Now data is safely typed as MyType
```

### Issue 3: Missing Null Checks

```typescript
// ❌ BAD
function process(input: string | null) {
  return input.toUpperCase() // Error if null
}

// ✅ GOOD
function process(input: string | null): string {
  if (input == null) {
    return ''
  }
  return input.toUpperCase()
}
```

## Benefits of Type Safety

- **Catch errors at compile time**, not runtime
- **Better IDE autocomplete** and IntelliSense
- **Self-documenting code** through types
- **Safer refactoring** with compiler assistance
- **Reduced bugs** from type mismatches
