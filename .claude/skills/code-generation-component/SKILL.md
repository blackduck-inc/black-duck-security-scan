---
name: component-generator
description: Generates new TypeScript components, modules, services, and utilities following Black Duck Security Scan codebase patterns and best practices. Ensures type safety, proper error handling, and consistent code style.
---

# Component Generator

Generates new TypeScript code components following established patterns in the Black Duck Security Scan codebase.

## Usage

Run this skill when the user requests:
- "Generate a new validator for [product]"
- "Create a new service for [feature]"
- "Add a new input data model for [product]"
- "Generate a utility function for [task]"
- "Create a new GitHub service implementation"

## Code Generation Principles

Follow these principles from the existing codebase:

### 1. Type Safety
- **Strict TypeScript**: Enable all strict type checking
- **Explicit types**: Always define return types and parameter types
- **Interfaces over types**: Use interfaces for object shapes
- **No implicit any**: Avoid implicit `any` types
- **Null safety**: Handle null/undefined explicitly with `?` or `|| ''`

### 2. Error Handling
- **Try-catch blocks**: Wrap operations that can fail
- **Error transformation**: Convert generic errors to descriptive errors
- **Error propagation**: Re-throw with context when appropriate
- **Validation errors**: Collect errors in arrays, don't fail fast

### 3. Code Structure
- **Single responsibility**: One module, one purpose
- **Separation of concerns**: Keep validation, transformation, execution separate
- **Constants**: Extract magic strings/numbers to application-constants.ts
- **Exports**: Export only what's needed

### 4. Formatting & Style
- **Prettier configuration**:
  - No semicolons
  - Single quotes
  - 2-space indentation
  - No trailing commas
  - Arrow functions: omit parens for single params
- **Naming conventions**:
  - camelCase for variables and functions
  - PascalCase for classes and interfaces
  - UPPER_CASE for constants (in application-constants.ts)

## Component Templates

### Template 1: Input Data Model

**Use Case**: Adding a new security product or extending existing product configuration

**Location**: `src/blackduck-security-action/input-data/`

**Template**:
```typescript
import {Common} from './common'
import {Network} from './common'
import {Bridge} from './bridge'
import {GithubData} from './github'

/**
 * [Product Name] input data structure for Bridge CLI
 */
export interface [ProductName] {
  [productKey]: [ProductName]Data
  network: Network
  bridge: Bridge
  github?: GithubData
}

/**
 * [Product Name] specific configuration
 */
export interface [ProductName]Data extends Common {
  accesstoken: string
  serverUrl: string

  // Add product-specific fields
  [field]: {[subField]: string}
}

// Add sub-interfaces as needed
export interface [SubConfiguration] {
  [property]: string | boolean | string[]
}
```

**Example Usage**:
```typescript
// For a new product "Seeker"
export interface Seeker {
  seeker: SeekerData
  network: Network
  bridge: Bridge
}

export interface SeekerData extends Common {
  accesstoken: string
  serverUrl: string
  project: {name: string}
  scan: {type: 'DAST' | 'IAST'}
}
```

**Checklist**:
- ✅ Extends Common interface for shared fields
- ✅ Includes Network and Bridge for standard config
- ✅ Optional GitHub for integration features
- ✅ JSDoc comments for interfaces
- ✅ Descriptive property names matching Bridge CLI expectations
- ✅ Union types for enums (e.g., 'DAST' | 'IAST')

---

### Template 2: Validator Function

**Use Case**: Adding validation for new product or extending existing validation

**Location**: `src/blackduck-security-action/validators.ts`

**Template**:
```typescript
/**
 * Validates [Product Name] input parameters
 * @returns Array of error messages (empty if valid)
 */
export function validate[ProductName]Inputs(): string[] {
  let errors: string[] = []

  // Only validate if product is enabled
  if (inputs.[PRODUCT_URL_KEY]) {
    const paramsMap = new Map<string, string>()

    // Add required parameters
    paramsMap.set(constants.[PARAM1_KEY], inputs.[PARAM1])
    paramsMap.set(constants.[PARAM2_KEY], inputs.[PARAM2])

    // Validate parameters
    errors = validateParameters(paramsMap, constants.[PRODUCT_KEY])

    // Add custom validation logic if needed
    if (inputs.[CUSTOM_PARAM]) {
      if (![CONDITION]) {
        errors.push(`[${constants.[CUSTOM_PARAM_KEY]}] is invalid: [reason]`)
      }
    }
  }

  return errors
}
```

**Example**:
```typescript
export function validateSeekerInputs(): string[] {
  let errors: string[] = []

  if (inputs.SEEKER_SERVER_URL) {
    const paramsMap = new Map<string, string>()
    paramsMap.set(constants.SEEKER_ACCESS_TOKEN_KEY, inputs.SEEKER_ACCESS_TOKEN)
    paramsMap.set(constants.SEEKER_SERVER_URL_KEY, inputs.SEEKER_SERVER_URL)
    paramsMap.set(constants.SEEKER_PROJECT_NAME_KEY, inputs.SEEKER_PROJECT_NAME)

    errors = validateParameters(paramsMap, constants.SEEKER_KEY)

    // Custom validation for scan type
    if (inputs.SEEKER_SCAN_TYPE) {
      const validTypes = ['DAST', 'IAST']
      if (!validTypes.includes(inputs.SEEKER_SCAN_TYPE)) {
        errors.push(`[${constants.SEEKER_SCAN_TYPE_KEY}] must be one of: ${validTypes.join(', ')}`)
      }
    }
  }

  return errors
}
```

**Checklist**:
- ✅ Return type: `string[]`
- ✅ Conditional validation (only if product enabled)
- ✅ Use validateParameters() for standard checks
- ✅ Custom validation for product-specific rules
- ✅ Error messages reference constant keys
- ✅ JSDoc comment explaining purpose

---

### Template 3: Service Implementation

**Use Case**: Adding new service or extending GitHub client services

**Location**: `src/blackduck-security-action/service/impl/`

**Template**:
```typescript
import {[BaseService]} from './[base-service]'
import {I[Service]} from '../[service-interface]'

/**
 * [Service description]
 * Handles [specific responsibility]
 */
export class [ServiceName] extends [BaseService] implements I[Service] {
  /**
   * Constructor
   * @param [param] [description]
   */
  constructor([params]) {
    super()
    // Initialize service-specific properties
  }

  /**
   * [Method description]
   * @param [param] [description]
   * @returns [description]
   */
  async [methodName]([params]): Promise<[ReturnType]> {
    try {
      // Implementation

      // Use parent class methods if available
      await this.[baseMethod]([args])

      return [result]
    } catch (error) {
      // Transform error with context
      throw new Error(`Failed to [action]: ${error}`)
    }
  }
}
```

**Example**:
```typescript
import {GithubClientServiceBase} from './github-client-service-base'
import {IGithubClientService} from '../github-client-service-interface'

/**
 * GitHub Enterprise Server v2 client service
 * Handles SARIF upload for GitHub Enterprise Server version 2.x
 */
export class GithubClientServiceV2 extends GithubClientServiceBase implements IGithubClientService {
  private readonly version: string

  constructor(version: string) {
    super()
    this.version = version
  }

  /**
   * Uploads SARIF report to GitHub Code Scanning
   * @param sarifPath Path to SARIF file
   * @returns Upload success status
   */
  async uploadSarifReport(sarifPath: string): Promise<boolean> {
    try {
      info(`Uploading SARIF for GitHub Enterprise Server v${this.version}`)

      // Use base class retry logic
      return await this.uploadWithRetry(sarifPath, async () => {
        // V2-specific upload logic
        const octokit = this.getOctokitClient()
        await octokit.rest.codeScanning.uploadSarif({
          owner: this.getRepoOwner(),
          repo: this.getRepoName(),
          sarif: this.readSarifFile(sarifPath),
          ref: this.getBranchRef()
        })
        return true
      })
    } catch (error) {
      throw new Error(`Failed to upload SARIF to GitHub Enterprise v${this.version}: ${error}`)
    }
  }
}
```

**Checklist**:
- ✅ Extends appropriate base class
- ✅ Implements interface
- ✅ JSDoc for class and all public methods
- ✅ Async/await for async operations
- ✅ Try-catch with descriptive errors
- ✅ Use base class methods when available
- ✅ Explicit return types

---

### Template 4: Utility Function

**Use Case**: Adding reusable helper functions

**Location**: `src/blackduck-security-action/utility.ts` or new utility file

**Template**:
```typescript
/**
 * [Function description]
 *
 * @param [param1] [description]
 * @param [param2] [description]
 * @returns [description]
 * @throws [Error type] [when it throws]
 */
export function [functionName]([params]): [ReturnType] {
  // Input validation
  if (![validation]) {
    throw new Error(`[param] is required for [operation]`)
  }

  try {
    // Implementation

    return [result]
  } catch (error) {
    // Handle error appropriately
    // Option 1: Log and return default
    info(`[Operation] failed: ${error}`)
    return [default]

    // Option 2: Transform and re-throw
    throw new Error(`Failed to [operation]: ${error}`)
  }
}
```

**Example**:
```typescript
/**
 * Parses comma-separated severity values into array
 *
 * @param severityInput Comma-separated string (e.g., "CRITICAL,HIGH,MEDIUM")
 * @param paramName Parameter name for error messages
 * @returns Array of trimmed severity values
 */
export function parseSeverities(severityInput: string, paramName: string): string[] {
  if (!severityInput || severityInput.trim().length === 0) {
    return []
  }

  const severities: string[] = []
  const values = severityInput.split(',')

  for (const value of values) {
    const trimmed = value.trim()
    if (trimmed) {
      severities.push(trimmed)
    }
  }

  if (severities.length === 0) {
    warning(`[${paramName}] contains no valid values`)
  }

  return severities
}
```

**Checklist**:
- ✅ JSDoc with @param, @returns, @throws
- ✅ Input validation
- ✅ Explicit return type
- ✅ Error handling (try-catch or validation)
- ✅ Meaningful variable names
- ✅ Single responsibility

---

### Template 5: Command Builder Method

**Use Case**: Adding command building for new product in tools-parameter.ts

**Location**: `src/blackduck-security-action/tools-parameter.ts`

**Template**:
```typescript
/**
 * Builds Bridge CLI command for [Product Name]
 * @param [params] [description]
 * @returns Array of CLI arguments
 */
public getFormattedCommandFor[ProductName]([params]): string[] {
  const [productKey]Data: InputData<[ProductName]> = {
    data: {
      [productKey]: this.get[ProductName]Data(),
      network: this.getNetworkData(),
      bridge: this.getBridgeData()
    }
  }

  // Add optional sections
  if ([condition]) {
    [productKey]Data.data.github = this.getGithubRepoInfo()
  }

  // Write JSON input file
  const inputFileName = `${constants.[PRODUCT_INPUT_FILE]}`
  const inputFilePath = path.join(this.tempDir, inputFileName)
  fs.writeFileSync(inputFilePath, JSON.stringify([productKey]Data))

  // Build command arguments
  const formattedCommand: string[] = []
  formattedCommand.push(constants.SPACE)
  formattedCommand.push(constants.STAGE_OPTION)
  formattedCommand.push(constants.[PRODUCT_STAGE_NAME])
  formattedCommand.push(constants.SPACE)
  formattedCommand.push(constants.INPUT_OPTION)
  formattedCommand.push(inputFilePath)

  return formattedCommand
}

/**
 * Builds [Product Name] data object from inputs
 * @returns [ProductName]Data object
 */
private get[ProductName]Data(): [ProductName]Data {
  const [productKey]Data: [ProductName]Data = {
    accesstoken: inputs.[PRODUCT_ACCESS_TOKEN],
    serverUrl: inputs.[PRODUCT_SERVER_URL],
    // Add required fields
  }

  // Add optional fields
  if (inputs.[OPTIONAL_FIELD]) {
    [productKey]Data.[optionalField] = {
      [property]: inputs.[OPTIONAL_FIELD]
    }
  }

  return [productKey]Data
}
```

**Checklist**:
- ✅ Follows naming pattern: getFormattedCommandFor[Product]
- ✅ Writes JSON to temp directory
- ✅ Uses constants for all strings
- ✅ Separates data building into private method
- ✅ Handles optional configurations
- ✅ Returns string[] for CLI arguments

---

## Generation Workflow

When generating a new component:

### Step 1: Understand Requirements
- What is the component's purpose?
- What inputs does it need?
- What outputs does it produce?
- What errors can it throw?

### Step 2: Identify Pattern
- Is this a data model? → Use Template 1
- Is this validation? → Use Template 2
- Is this a service? → Use Template 3
- Is this a utility? → Use Template 4
- Is this command building? → Use Template 5

### Step 3: Generate Code
- Follow appropriate template
- Use descriptive names
- Add JSDoc comments
- Include error handling
- Apply proper types

### Step 4: Add Constants
- Add new constant keys to `application-constants.ts`
- Follow naming convention: `[PRODUCT]_[PARAMETER]_KEY`

### Step 5: Register Component
- Add exports to appropriate index files if needed
- Update validators if adding new product
- Update bridge-cli.ts if adding new product
- Update action.yml if adding new inputs

### Step 6: Generate Tests
- Use test-generator skill to create unit tests
- Follow existing test patterns from test/unit/

## Best Practices

### DO:
- ✅ Use strict TypeScript types
- ✅ Add JSDoc comments for all public APIs
- ✅ Handle errors explicitly
- ✅ Extract constants to application-constants.ts
- ✅ Follow existing naming conventions
- ✅ Keep functions focused and small (<50 lines)
- ✅ Validate inputs early
- ✅ Use interfaces for object shapes
- ✅ Return arrays for validation errors
- ✅ Use async/await for async code

### DON'T:
- ❌ Use `any` type
- ❌ Hard-code strings or magic numbers
- ❌ Create large functions (>100 lines)
- ❌ Mix concerns (validation + execution + transformation)
- ❌ Use synchronous file operations in async contexts
- ❌ Swallow errors without logging
- ❌ Use semicolons (Prettier config)
- ❌ Use double quotes for strings
- ❌ Use tabs for indentation

## Example Generation Request

**User**: "Generate a validator for the new Seeker product"

**Response**:
1. Create validator function in validators.ts
2. Add constant keys to application-constants.ts
3. Add input definitions to inputs.ts
4. Update action.yml with new inputs
5. Generate unit test in test/unit/validators.test.ts

[Then provide generated code for each file]