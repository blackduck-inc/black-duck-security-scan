---
name: type-safety
description: Reviews TypeScript code for type safety issues including implicit any, missing return types, null safety violations, and improper type assertions. Ensures strict typing standards are followed.
---

# Type Safety Review

Reviews TypeScript code for type safety issues and ensures adherence to strict typing standards.

## Review Scope

### TypeScript Strict Mode Checks
- No implicit `any` types
- Strict null checks
- Explicit return types
- Proper type assertions
- Type guard usage
- Generic type safety

## Review Process

### Step 1: Compiler Checks

```bash
# Run TypeScript compiler
npm run build

# Look for type errors
tsc --noEmit
```

### Step 2: Code Analysis

Analyze for these type safety issues:

#### 1. Implicit Any

**Pattern to Find**:
```typescript
// ❌ VIOLATION
function process(data) { ... }
const value = JSON.parse(input)
```

**Fix**:
```typescript
// ✅ CORRECT
function process(data: unknown): void { ... }
const value: MyType = JSON.parse(input) as MyType
```

**Search Command**:
```bash
# Find functions without parameter types
grep -rn "function.*(" src/ | grep -v ": " | grep -v "//"
```

#### 2. Missing Return Types

**Pattern to Find**:
```typescript
// ❌ VIOLATION
function calculate(a: number, b: number) {
  return a + b
}

async function fetchData(url: string) {
  return await fetch(url)
}
```

**Fix**:
```typescript
// ✅ CORRECT
function calculate(a: number, b: number): number {
  return a + b
}

async function fetchData(url: string): Promise<Response> {
  return await fetch(url)
}
```

#### 3. Null Safety Violations

**Pattern to Find**:
```typescript
// ❌ VIOLATION
function process(input: string | null) {
  return input.toUpperCase() // Null pointer error
}

const value = obj.property.subProperty // Unsafe chaining
```

**Fix**:
```typescript
// ✅ CORRECT
function process(input: string | null): string {
  if (input == null) {
    return ''
  }
  return input.toUpperCase()
}

const value = obj.property?.subProperty ?? 'default'
```

#### 4. Unsafe Type Assertions

**Pattern to Find**:
```typescript
// ❌ VIOLATION
const data = apiResponse as MyType
const elem = document.getElementById('id') as HTMLElement
```

**Fix**:
```typescript
// ✅ CORRECT
function isMyType(obj: unknown): obj is MyType {
  return typeof obj === 'object' && obj !== null && 'field' in obj
}

const data = apiResponse
if (!isMyType(data)) {
  throw new TypeError('Invalid response')
}

const elem = document.getElementById('id')
if (elem == null) {
  throw new Error('Element not found')
}
```

#### 5. Missing Type Guards

**Pattern to Find**:
```typescript
// ❌ VIOLATION
function process(value: string | number) {
  return value.toUpperCase() // Error: toUpperCase doesn't exist on number
}
```

**Fix**:
```typescript
// ✅ CORRECT
function process(value: string | number): string {
  if (typeof value === 'string') {
    return value.toUpperCase()
  }
  return value.toString()
}
```

#### 6. Non-Null Assertions (!)

**Pattern to Find**:
```typescript
// ⚠️ USE SPARINGLY
const value = maybeNull!.property
const item = array.find(...)!
```

**Recommendation**:
```typescript
// ✅ PREFER
if (maybeNull != null) {
  const value = maybeNull.property
}

const item = array.find(...)
if (item == null) {
  throw new Error('Item not found')
}
```

### Step 3: Review Checklist

For each function/method, verify:

- [ ] All parameters have explicit types
- [ ] Return type is explicitly declared
- [ ] No implicit `any` types
- [ ] Null/undefined handled safely
- [ ] Type assertions are justified and safe
- [ ] Generic types are properly constrained
- [ ] Interfaces/types are used instead of inline types

For each class, verify:

- [ ] All properties have explicit types
- [ ] Constructor parameters are typed
- [ ] Methods have explicit return types
- [ ] Private/public modifiers are used appropriately
- [ ] Readonly used for immutable properties

## Review Report Format

```markdown
# Type Safety Review Report

**Files Reviewed**: [Count]
**Issues Found**: [Count]

## Critical Issues (Type Errors)

### 1. Implicit Any in Function Parameter
**File**: `src/utility.ts:89`
**Issue**: Parameter `data` has implicit any type
```typescript
// Current
function parseData(data) { ... }

// Fix Required
function parseData(data: unknown): ParsedData { ... }
```

### 2. Missing Return Type
**File**: `src/bridge-cli.ts:120`
**Issue**: Async function missing Promise return type
```typescript
// Current
async function download(url: string) { ... }

// Fix Required
async function download(url: string): Promise<string> { ... }
```

## High Priority Issues

### 1. Null Safety Violation
**File**: `src/utility.ts:145`
**Issue**: Possible null pointer access
```typescript
// Current
function process(input: string | null) {
  return input.toUpperCase()
}

// Fix Required
function process(input: string | null): string {
  if (input == null) return ''
  return input.toUpperCase()
}
```

### 2. Unsafe Type Assertion
**File**: `src/main.ts:67`
**Issue**: Type assertion without validation
```typescript
// Current
const data = response as MyType

// Fix Required
if (!isMyType(response)) {
  throw new TypeError('Invalid response')
}
const data = response
```

## Medium Priority Issues

### 1. Non-Null Assertion
**File**: `src/validators.ts:42`
**Issue**: Non-null assertion (!) should be replaced with explicit check
**Impact**: Runtime error if assumption is wrong

### 2. Generic Type Not Constrained
**File**: `src/retry-helper.ts:20`
**Issue**: Generic type T is not constrained
**Recommendation**: Add constraint if possible

## Statistics

- Total Functions Reviewed: [Count]
- Functions with Implicit Any: [Count]
- Functions Missing Return Types: [Count]
- Null Safety Issues: [Count]
- Unsafe Type Assertions: [Count]

## Type Safety Score: [X]/100

- Strict Mode Compliance: [Pass/Fail]
- No Implicit Any: [X]%
- Explicit Return Types: [X]%
- Null Safety: [X]%
- Type Guard Usage: [X]%
```

## Common Type Safety Patterns in This Codebase

### Pattern 1: Optional Chaining with Null Coalescing
```typescript
// inputs.ts:18-20
export const VALUE =
  getInput(constants.KEY)?.trim() ||
  getInput(constants.OLD_KEY)?.trim() ||
  ''
```

### Pattern 2: Type Narrowing with Conditionals
```typescript
// main.ts:136-141
export function getBridgeExitCode(error: Error): boolean {
  if (error.message !== undefined) {
    const lastChar = error.message.trim().slice(-1)
    const num = parseFloat(lastChar)
    return !isNaN(num)
  }
  return false
}
```

### Pattern 3: Validation Error Arrays
```typescript
// validators.ts
export function validateInputs(): string[] {
  const errors: string[] = []
  // Collect errors
  return errors
}
```

### Pattern 4: Generic Retry Helper
```typescript
// retry-helper.ts
async execute<T>(
  action: () => Promise<T>,
  isRetryable?: (e: Error) => boolean
): Promise<T>
```

## Recommendations

### High Priority
1. Add explicit return types to all public functions
2. Replace non-null assertions with proper checks
3. Add type guards for union type handling
4. Fix all implicit any warnings

### Medium Priority
1. Consider constraining generic types
2. Add JSDoc with type information
3. Use readonly for immutable properties
4. Add type definitions for external APIs

### Low Priority
1. Consider using branded types for IDs
2. Add utility type helpers for common patterns
3. Document type decisions in complex cases

## Fix Commands

```bash
# Check for type errors
npm run build

# Enable strict mode warnings
tsc --strict --noEmit

# Check for unused variables/types
tsc --noUnusedLocals --noUnusedParameters --noEmit
```
