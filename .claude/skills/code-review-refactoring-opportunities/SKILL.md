---
name: refactoring-opportunities
description: Identifies refactoring opportunities including large functions, deep nesting, code duplication, magic strings/numbers, missing abstractions, and violations of SOLID principles. Suggests improvements for maintainability.
---

# Refactoring Opportunities Review

Identifies code smells and refactoring opportunities based on codebase analysis.

## Code Smells to Identify

### 1. Large Functions (>50 lines)

**Critical Issues Found**:

**tools-parameter.ts**:
- `getFormattedCommandForPolaris()`: ~320 lines (36-355)
- `getFormattedCommandForBlackduck()`: ~200 lines (463-667)
- `getFormattedCommandForCoverity()`: ~100 lines (356-462)

**Recommendation**: Extract methods for each section (parsing, validation, JSON building)

### 2. Deep Nesting (>3 levels)

**Example** (tools-parameter.ts:225-265):
```typescript
if (condition1) {  // Level 1
  if (condition2) {  // Level 2
    if (condition3) {  // Level 3
      if (condition4) {  // Level 4
        for (item of items) {  // Level 5
          // Logic
        }
      }
    }
  }
}
```

**Refactoring**: Early returns, guard clauses, extract functions

### 3. Code Duplication

**Repeated Patterns Found**:

**Severity parsing** (4+ locations):
```typescript
// Duplicated in tools-parameter.ts multiple times
const severities: string[] = []
if (input != null && input.length > 0) {
  const values = input.split(',')
  for (const value of values) {
    if (value.trim()) {
      severities.push(value.trim())
    }
  }
}
```

**Refactoring**: Extract to utility function
```typescript
function parseSeverities(input: string): string[] {
  if (!input?.trim()) return []
  return input.split(',')
    .map(s => s.trim())
    .filter(Boolean)
}
```

**Product validation** (validators.ts):
- validatePolarisInputs()
- validateCoverityInputs()
- validateBlackDuckInputs()
- validateSRMInputs()

**Refactoring**: Generic validator
```typescript
function validateProductInputs<T>(
  config: ProductConfig<T>
): string[] {
  // Generic validation logic
}
```

### 4. God Objects

**tools-parameter.ts** (994 lines):
- Handles ALL products
- Mixed responsibilities
- Hard to test and maintain

**Refactoring**: Product-specific builders
```typescript
class PolarisCommandBuilder { ... }
class CoverityCommandBuilder { ... }
class BlackDuckCommandBuilder { ... }
```

**utility.ts** (353 lines, 35+ functions):
- Lacks cohesion
- Mixed concerns

**Refactoring**: Split into focused modules
```typescript
// path-utils.ts
// sarif-utils.ts
// version-utils.ts
```

### 5. Magic Strings/Numbers

**Issues Found**:
```typescript
// Platform detection (scattered)
if (process.platform === 'darwin') { ... }
if (process.platform === 'linux') { ... }
if (process.platform === 'win32') { ... }

// HTTP status codes
if (status === 503) { ... }
if (status === 200) { ... }

// Exit codes
if (exitCode === 8) { ... }
```

**Refactoring**: Extract constants
```typescript
const PLATFORM = {
  DARWIN: 'darwin' as const,
  LINUX: 'linux' as const,
  WINDOWS: 'win32' as const
}

const HTTP_STATUS = {
  OK: 200,
  SERVICE_UNAVAILABLE: 503
} as const
```

### 6. Missing Abstractions

**Pattern**: Similar command building for each product

**Current** (tools-parameter.ts):
```typescript
getFormattedCommandForPolaris() {
  // Parse inputs
  // Build data object
  // Write JSON
  // Return command
}

getFormattedCommandForCoverity() {
  // Same pattern, different product
}
```

**Refactoring**: Template method pattern
```typescript
abstract class ProductCommandBuilder {
  buildCommand(): string[] {
    const data = this.parseInputs()
    this.validateData(data)
    const jsonPath = this.writeJSON(data)
    return this.formatCommand(jsonPath)
  }

  protected abstract parseInputs(): ProductData
  protected abstract validateData(data: ProductData): void
}

class PolarisCommandBuilder extends ProductCommandBuilder {
  protected parseInputs(): PolarisData { ... }
}
```

### 7. Long Parameter Lists

**Issue**: Functions with 5+ parameters

**Example**:
```typescript
function downloadTool(
  url: string,
  dest: string,
  auth?: string,
  headers?: Record<string, string>
): Promise<string>
```

**Refactoring**: Parameter object
```typescript
interface DownloadOptions {
  url: string
  dest: string
  auth?: string
  headers?: Record<string, string>
}

function downloadTool(options: DownloadOptions): Promise<string>
```

## Refactoring Recommendations by Priority

### Critical (High Impact, Medium Effort)

1. **Extract Product Builders** from tools-parameter.ts
   - Impact: Better testability, maintainability
   - Effort: 2-3 days
   - Files: tools-parameter.ts (994 lines → 4 files of ~250 lines)

2. **Extract Severity Parser** utility
   - Impact: Eliminate 4+ code duplications
   - Effort: 1 hour
   - Files: tools-parameter.ts

3. **Break Down Large Functions**
   - Impact: Improved readability
   - Effort: 1-2 days
   - Files: tools-parameter.ts, bridge-cli.ts

### High Priority (Medium Impact, Low Effort)

4. **Split utility.ts** into focused modules
   - Impact: Better organization
   - Effort: 1 day
   - Files: utility.ts → 3-4 smaller files

5. **Extract Magic Strings** to constants
   - Impact: Consistency, maintainability
   - Effort: 2-3 hours
   - Files: Multiple files

6. **Add Guard Clauses** to reduce nesting
   - Impact: Readability
   - Effort: 1-2 hours per function

### Medium Priority (Low Impact, Low Effort)

7. **Use Parameter Objects** for long parameter lists
   - Impact: API clarity
   - Effort: 1 hour per function

8. **Extract Repeated Validation** logic
   - Impact: DRY principle
   - Effort: 2-3 hours

## Refactoring Patterns to Apply

### Pattern 1: Extract Method

**Before**:
```typescript
function process() {
  // 50 lines of setup
  // 50 lines of validation
  // 50 lines of execution
  // 50 lines of cleanup
}
```

**After**:
```typescript
function process() {
  setup()
  validate()
  execute()
  cleanup()
}
```

### Pattern 2: Replace Conditional with Polymorphism

**Before**:
```typescript
if (product === 'polaris') {
  // Polaris logic
} else if (product === 'coverity') {
  // Coverity logic
}
```

**After**:
```typescript
const builder = productBuilderFactory.create(product)
builder.build()
```

### Pattern 3: Introduce Parameter Object

**Before**:
```typescript
function create(name: string, url: string, token: string, opts: object)
```

**After**:
```typescript
function create(config: ProductConfig)
```

### Pattern 4: Replace Magic Number with Named Constant

**Before**:
```typescript
if (exitCode === 8) {  // What does 8 mean?
```

**After**:
```typescript
const POLICY_VIOLATION_EXIT_CODE = 8
if (exitCode === POLICY_VIOLATION_EXIT_CODE) {
```

## Metrics to Track

- **Cyclomatic Complexity**: Target < 10 per function
- **Function Length**: Target < 50 lines
- **File Length**: Target < 300 lines
- **Nesting Depth**: Target < 3 levels
- **Code Duplication**: Target < 5% duplicate code

## Tools for Refactoring Analysis

```bash
# Static analysis
npm run lint

# Code complexity
npx ts-complexity src/**/*.ts

# Find duplicate code
npx jscpd src/

# Check file sizes
find src -name "*.ts" -exec wc -l {} \; | sort -rn | head -10
```

## Review Report Format

```markdown
# Refactoring Opportunities Report

## Critical Issues

### 1. God Object: tools-parameter.ts (994 lines)
**Impact**: High
**Effort**: Medium
**Recommendation**: Extract product-specific builders
**Priority**: Critical

### 2. Code Duplication: Severity parsing (4 locations)
**Impact**: Medium
**Effort**: Low
**Recommendation**: Extract utility function
**Priority**: High

## Metrics

- Average Function Length: [X] lines
- Functions >50 lines: [Count]
- Files >300 lines: [Count]
- Maximum Nesting Depth: [X] levels
- Code Duplication: [X]%

## Recommendations Summary

**Do First**:
1. Extract product builders from tools-parameter.ts
2. Create severity parser utility
3. Break down functions >100 lines

**Do Soon**:
4. Split utility.ts into focused modules
5. Extract magic strings to constants
6. Reduce nesting with guard clauses

**Do Eventually**:
7. Apply parameter objects for long parameter lists
8. Extract repeated validation patterns
```

## Best Practices

### DO:
- ✅ Follow Single Responsibility Principle
- ✅ Keep functions under 50 lines
- ✅ Limit nesting to 3 levels
- ✅ Extract repeated code
- ✅ Use descriptive names over comments

### DON'T:
- ❌ Create God objects
- ❌ Duplicate code
- ❌ Use magic strings/numbers
- ❌ Mix concerns in one module
- ❌ Write functions >100 lines
