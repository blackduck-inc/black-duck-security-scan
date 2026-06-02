---
name: code-generation-documentation
description: Generates JSDoc documentation, README sections, and inline comments following Black Duck Security Scan documentation standards. Creates comprehensive API documentation with examples and type information.
---

# Documentation Generator

Generates comprehensive documentation following the Black Duck Security Scan codebase standards.

## Usage

Run this skill when the user requests:
- "Generate JSDoc for [function/class]"
- "Document this code"
- "Add documentation comments"
- "Create API documentation"
- "Generate README section for [feature]"

## Documentation Standards

### JSDoc Style

Based on analysis of existing code (e.g., `tool-cache-local.ts:29-36`):

```typescript
/**
 * [Brief one-line description of what the function does]
 *
 * @param paramName [Description of parameter]
 * @param anotherParam [Description of parameter]
 * @returns [Description of return value]
 * @throws [ErrorType] [When/why error is thrown]
 */
```

### Documentation Templates

#### Template 1: Function Documentation

```typescript
/**
 * [One-line summary of what the function does]
 *
 * [Optional: More detailed explanation if needed, including]
 * [- Algorithm description]
 * [- Important notes or warnings]
 * [- Usage examples if complex]
 *
 * @param param1 [Type] - [Description]
 * @param param2 [Type] - [Description]
 * @returns [ReturnType] - [Description of return value]
 * @throws {ErrorType} [When this error occurs]
 *
 * @example
 * ```typescript
 * const result = functionName('arg1', 'arg2')
 * ```
 */
export async function functionName(param1: string, param2: number): Promise<ReturnType> {
  // Implementation
}
```

**Example**:
```typescript
/**
 * Downloads Bridge CLI from artifactory and extracts to destination
 *
 * Handles platform-specific downloads (Windows, macOS, Linux) and validates
 * the downloaded archive before extraction. Implements retry logic for network failures.
 *
 * @param bridgeDownloadUrl URL to download Bridge CLI from artifactory
 * @param dest Destination path for extraction
 * @param auth Authorization header for private artifactory
 * @param headers Additional HTTP headers
 * @returns Path to the extracted Bridge CLI executable
 * @throws {Error} If download fails after retries
 * @throws {HTTPError} If server returns 4xx error code
 *
 * @example
 * ```typescript
 * const bridgePath = await downloadTool(
 *   'https://artifactory.com/bridge.zip',
 *   '/tmp/bridge',
 *   'Bearer token123'
 * )
 * ```
 */
export async function downloadTool(
  bridgeDownloadUrl: string,
  dest: string,
  auth?: string,
  headers?: Record<string, string>
): Promise<string> {
  // Implementation
}
```

---

#### Template 2: Class Documentation

```typescript
/**
 * [One-line description of class purpose]
 *
 * [Detailed description including:]
 * [- Responsibilities]
 * [- Design patterns used]
 * [- Key features]
 *
 * @example
 * ```typescript
 * const instance = new ClassName(param1, param2)
 * await instance.methodName()
 * ```
 */
export class ClassName {
  /**
   * [Property description]
   */
  private readonly propertyName: string

  /**
   * Creates an instance of ClassName
   *
   * @param param1 [Description]
   * @param param2 [Description]
   */
  constructor(param1: string, param2: number) {
    // Implementation
  }

  /**
   * [Method description]
   *
   * @param param [Description]
   * @returns [Description]
   */
  public async methodName(param: string): Promise<void> {
    // Implementation
  }
}
```

**Example**:
```typescript
/**
 * Manages Bridge CLI download, validation, and execution
 *
 * Orchestrates the following operations:
 * - Downloads Bridge CLI from artifactory or uses local installation
 * - Validates Bridge CLI version and platform compatibility
 * - Builds product-specific commands with JSON input files
 * - Executes Bridge CLI with appropriate arguments
 *
 * Supports multiple security products (Polaris, Coverity, Black Duck, SRM)
 * and handles both air-gap and online modes.
 *
 * @example
 * ```typescript
 * const bridge = new Bridge(tempDir)
 * await bridge.validateBridgePath()
 * const exitCode = await bridge.prepareCommand(githubRepoName)
 * ```
 */
export class Bridge {
  /**
   * Temporary directory for Bridge CLI and input files
   */
  private readonly tempDir: string

  /**
   * Bridge CLI executable path
   */
  private bridgePath: string

  /**
   * Creates Bridge CLI manager instance
   *
   * @param tempDir Temporary directory for Bridge artifacts
   */
  constructor(tempDir: string) {
    this.tempDir = tempDir
    this.bridgePath = ''
  }
}
```

---

#### Template 3: Interface Documentation

```typescript
/**
 * [Description of what the interface represents]
 *
 * [Context about when/why to use this interface]
 */
export interface InterfaceName {
  /**
   * [Property description]
   */
  propertyName: string

  /**
   * [Optional property description]
   */
  optionalProp?: number

  /**
   * [Nested object description]
   */
  nested: {
    /**
     * [Sub-property description]
     */
    subProp: boolean
  }
}
```

**Example**:
```typescript
/**
 * Polaris SAST/SCA product configuration for Bridge CLI
 *
 * Defines all parameters needed for Polaris security analysis including
 * project configuration, assessment types, branch information, and
 * GitHub integration settings.
 */
export interface Polaris {
  /**
   * Polaris product-specific configuration
   */
  polaris: PolarisData

  /**
   * Optional project-level configuration
   * Overrides application-level defaults
   */
  project?: ProjectData

  /**
   * Network configuration including proxy and SSL settings
   */
  network: Network

  /**
   * Bridge CLI configuration
   */
  bridge: Bridge

  /**
   * Optional GitHub integration for PR comments and badges
   */
  github?: GithubData
}
```

---

#### Template 4: Inline Comments

**When to use inline comments**:
- Complex logic that isn't self-evident
- Non-obvious algorithm implementations
- Workarounds or temporary solutions
- Important edge cases

**When NOT to use inline comments**:
- Obvious code (e.g., `// Set value to 5` before `x = 5`)
- Redundant explanations of what the code does
- Outdated comments that don't match current code

**Good inline comments**:
```typescript
// Extract exit code from error message format: "...failed with exit code N"
const lastChar = error.message.trim().slice(-1)
const num = parseFloat(lastChar)

// Bridge CLI v2.0+ uses different SARIF output directory structure
if (isVersionLess(bridgeVersion, '2.0.0')) {
  // Old path: root/Polaris SARIF Generator/
  sarifPath = path.join(workspace, 'Polaris SARIF Generator')
} else {
  // New path: root/integrations/polaris/sarif/
  sarifPath = path.join(workspace, 'integrations', 'polaris', 'sarif')
}

// Retry only for transient errors (5xx), not client errors (4xx)
const isRetryable = (error: Error) => {
  const status = extractHttpStatus(error)
  return status >= 500 && status < 600
}
```

**Bad inline comments**:
```typescript
// Set the URL
const url = inputs.POLARIS_SERVER_URL

// Call the function
await execute()

// Return the result
return result
```

---

#### Template 5: Module/File Header Comments

**Not commonly used in this codebase**, but can be added for context:

```typescript
/**
 * @module [module-name]
 * @description [High-level description of module purpose]
 *
 * [Additional context:]
 * [- Key exports]
 * [- Usage notes]
 * [- Related modules]
 */
```

---

## Documentation Generation Workflow

### Step 1: Analyze Code

Understand:
- What does the code do?
- What are the inputs and outputs?
- What errors can occur?
- Are there edge cases or special behaviors?
- Is there complex logic that needs explanation?

### Step 2: Write Summary

- **One-line summary**: What does this do? (imperative mood)
  - ✅ "Downloads Bridge CLI from artifactory"
  - ❌ "This function downloads Bridge CLI"

- **Detailed explanation** (if needed):
  - How does it work?
  - Why is it designed this way?
  - What are important considerations?

### Step 3: Document Parameters

For each parameter:
```typescript
@param paramName [Type] - [Description including purpose and constraints]
```

Examples:
```typescript
@param bridgeDownloadUrl URL of the Bridge CLI zip file to download
@param retryCount Number of retry attempts (1-10, default 3)
@param options Configuration options for download behavior
```

### Step 4: Document Return Value

```typescript
@returns [ReturnType] - [Description of what is returned and when]
```

Examples:
```typescript
@returns Promise<string> - Absolute path to extracted Bridge CLI executable
@returns string[] - Array of validation error messages (empty if valid)
@returns boolean - True if upload succeeded, false otherwise
```

### Step 5: Document Exceptions

```typescript
@throws {ErrorType} [When/why this error is thrown]
```

Examples:
```typescript
@throws {Error} If download fails after all retry attempts
@throws {HTTPError} If server returns 404 (URL not found)
@throws {TypeError} If required parameters are null or undefined
```

### Step 6: Add Examples (for complex APIs)

```typescript
@example
```typescript
[Code example showing typical usage]
```
```

---

## Special Documentation Cases

### Deprecated APIs

Follow existing pattern from `application-constants.ts`:

```typescript
/**
 * @deprecated Use BRIDGECLI_INSTALL_DIRECTORY_KEY instead. This will be removed in future release.
 */
export const BRIDGE_INSTALL_DIRECTORY_KEY = 'bridge_install_directory'
```

### Generic/Template Functions

```typescript
/**
 * Executes action with retry logic for transient failures
 *
 * @template T Return type of the action
 * @param action Async function to execute with retries
 * @param isRetryable Optional function to determine if error is retryable
 * @returns Promise resolving to action's return value
 * @throws Last error if all retries are exhausted
 */
async execute<T>(
  action: () => Promise<T>,
  isRetryable?: (e: Error) => boolean
): Promise<T>
```

### Callback Parameters

```typescript
/**
 * @param callback Function called on completion
 * @param callback.error Error object if operation failed, null otherwise
 * @param callback.result Result object if operation succeeded
 */
function asyncOperation(callback: (error: Error | null, result: any) => void): void
```

---

## Best Practices

### DO:
- ✅ Document all public APIs (exported functions, classes, interfaces)
- ✅ Use imperative mood for summaries ("Downloads...", not "This downloads...")
- ✅ Specify units for numeric parameters (seconds, milliseconds, bytes)
- ✅ Include default values in parameter descriptions
- ✅ Explain non-obvious return values
- ✅ Document all exceptions that can be thrown
- ✅ Provide examples for complex APIs
- ✅ Update docs when code changes
- ✅ Use `@deprecated` tag for deprecated APIs
- ✅ Link to related types and functions when helpful

### DON'T:
- ❌ Document private implementation details
- ❌ Write obvious comments that duplicate code
- ❌ Leave TODO comments in production code
- ❌ Use outdated or incorrect documentation
- ❌ Over-document simple getters/setters
- ❌ Include implementation details in API docs
- ❌ Write comments that will become stale

---

## README Documentation

When generating README sections:

### Feature Documentation Template

```markdown
## [Feature Name]

[Brief description of feature and its purpose]

### Configuration

Configure the following inputs in your workflow:

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `input_name` | [Description] | Yes/No | `default_value` |

### Example

```yaml
- name: [Action Step Name]
  uses: blackduck-inc/black-duck-security-scan@v1
  with:
    input_name: 'value'
    another_input: 'value'
```

### Supported [Feature Aspect]

- [Item 1]
- [Item 2]
- [Item 3]

### Notes

- [Important note 1]
- [Important note 2]
```

---

## Example Documentation Generation

**Request**: "Generate JSDoc for the validatePolarisInputs function"

**Generated**:
```typescript
/**
 * Validates Polaris-specific input parameters
 *
 * Checks that all required Polaris configuration inputs are provided when
 * Polaris scanning is enabled (POLARIS_SERVER_URL is set). Returns array
 * of error messages for missing or invalid parameters.
 *
 * Validated parameters:
 * - POLARIS_ACCESS_TOKEN: Authentication token
 * - POLARIS_SERVER_URL: Polaris server URL
 * - POLARIS_ASSESSMENT_TYPES: Assessment types (SAST, SCA)
 *
 * @returns Array of validation error messages. Empty array if all inputs are valid
 *          or if Polaris is not enabled (POLARIS_SERVER_URL is empty).
 *
 * @example
 * ```typescript
 * const errors = validatePolarisInputs()
 * if (errors.length > 0) {
 *   console.error('Validation failed:', errors.join(', '))
 * }
 * ```
 */
export function validatePolarisInputs(): string[] {
  let errors: string[] = []

  if (inputs.POLARIS_SERVER_URL) {
    const paramsMap = new Map<string, string>()
    paramsMap.set(constants.POLARIS_ACCESS_TOKEN_KEY, inputs.POLARIS_ACCESS_TOKEN)
    paramsMap.set(constants.POLARIS_SERVER_URL_KEY, inputs.POLARIS_SERVER_URL)
    paramsMap.set(constants.POLARIS_ASSESSMENT_TYPES_KEY, inputs.POLARIS_ASSESSMENT_TYPES)

    errors = validateParameters(paramsMap, constants.POLARIS_KEY)
  }

  return errors
}
```