---
name: code-explainer-flow
description: Traces execution flow, data flow, and control flow through the codebase. Shows step-by-step what happens when the action runs, how data transforms, and how errors propagate. Use when users ask "how does this work", "trace the execution", or "what happens when...".
---

# Flow Explainer

Traces and explains execution flow, data flow, and control flow through the Black Duck Security Scan GitHub Action.

## Usage

Run this skill when the user asks:
- "What happens when the action runs?"
- "Trace the execution flow"
- "How does data flow through the system?"
- "What happens when I configure Polaris?"
- "Show me the call stack for SARIF upload"
- "How are errors handled end-to-end?"

## Analysis Steps

### Step 1 — Main Execution Flow

Trace the complete execution from start to finish:

#### High-Level Flow

```
GitHub Action Triggered
  ↓
main.ts:run()
  ↓
1. Create temp directory
  ↓
2. Download/validate Bridge CLI
  ↓
3. Validate inputs for enabled products
  ↓
4. Build Bridge CLI commands
  ↓
5. Execute Bridge CLI
  ↓
6. Process exit code
  ↓
7. Upload SARIF reports
  ↓
8. Upload diagnostics
  ↓
9. Cleanup temp files
```

#### Detailed Flow with File References

**Step 1: Entry Point** (`main.ts:24`)
```typescript
export async function run(): Promise<void>
```
- Creates temporary directory: `main.ts:25-30`
- Instantiates Bridge: `main.ts:35-37`

**Step 2: Bridge CLI Setup** (`bridge-cli.ts:47-76`)
```
Bridge constructor
  ↓
validateBridgePath() (line 78-106)
  ├─ Check network air-gap mode
  ├─ Download from artifactory if needed
  └─ Validate local installation
```

**Step 3: Input Validation** (`bridge-cli.ts:200-240`)
```
For each enabled product:
  ├─ validatePolarisInputs() → string[]
  ├─ validateCoverityInputs() → string[]
  ├─ validateBlackDuckInputs() → string[]
  └─ validateSRMInputs() → string[]
     ↓
Accumulate all validation errors
     ↓
Reject if any errors found
```

**Step 4: Command Building** (`tools-parameter.ts`)
```
For each valid product:
  ├─ getFormattedCommandForPolaris() (line 36-355)
  │   ├─ Parse inputs
  │   ├─ Build JSON data object
  │   ├─ Write polaris_input.json
  │   └─ Return CLI arguments
  │
  ├─ getFormattedCommandForCoverity() (line 356-462)
  ├─ getFormattedCommandForBlackduck() (line 463-667)
  └─ getFormattedCommandForSRM() (line 668-761)
```

**Step 5: Execution** (`bridge-cli.ts:249-278`)
```
prepareCommand() → formattedCommand
  ↓
executeBridgeCommand(formattedCommand, tempDir)
  ↓
exec.exec('bridge-cli', args, options)
  ↓
Capture exit code
```

**Step 6: Result Processing** (`main.ts:39-90`)
```
Check exit code
  ├─ 0: Success
  ├─ 8: Policy violation (continue if mark_build_status allows)
  └─ Other: Failure
     ↓
Upload SARIF reports (if exitCode === 0 || exitCode === 8)
     ↓
Upload diagnostics (if include_diagnostics === true)
     ↓
Set build status
```

### Step 2 — Data Flow Analysis

Trace how data transforms through the system:

#### Input → Configuration → Execution → Output

**Phase 1: Input Collection** (`inputs.ts`)
```
action.yml inputs
  ↓
core.getInput('parameter_name')
  ↓
Exported constants (e.g., POLARIS_SERVER_URL)
  ↓
Used throughout codebase
```

**Phase 2: Input Transformation** (`tools-parameter.ts:36-355`)
```
Input Constants
  ↓
Parse & Validate
  ├─ Split comma-separated values
  ├─ Parse booleans
  ├─ Resolve file paths
  └─ Apply defaults
  ↓
Build JSON Structure
{
  polaris: {
    accesstoken: '***',
    serverUrl: 'https://...',
    application: {name: '...'},
    project: {name: '...'},
    assessment: {types: ['SAST', 'SCA']}
  }
}
  ↓
Write to temp directory
  ├─ polaris_input.json
  ├─ bd_input.json
  ├─ coverity_input.json
  └─ srm_input.json
```

**Phase 3: Command Generation**
```
JSON input files
  ↓
Build CLI arguments
[
  '--stage', 'polaris',
  '--input', '/tmp/polaris_input.json',
  '--stage', 'blackducksca',
  '--input', '/tmp/bd_input.json'
]
  ↓
Execute Bridge CLI
```

**Phase 4: Output Processing**
```
Bridge CLI execution
  ↓
Generates SARIF files
  ├─ Polaris SARIF Generator/results.sarif.json (v1.x)
  │   OR
  ├─ integrations/polaris/sarif/results.sarif.json (v2.0+)
  ↓
Update SARIF paths (if diagnostics enabled)
  ├─ utility.ts:updatePolarisSarifPath()
  └─ utility.ts:updateBlackDuckSarifPath()
  ↓
Upload to GitHub
  ├─ Code Scanning (SARIF)
  └─ Artifacts (diagnostics ZIP)
```

### Step 3 — Control Flow Analysis

Trace decision points and conditional logic:

#### Product Selection Flow

```
User configures inputs
  ↓
Check: POLARIS_SERVER_URL set?
  ├─ YES → Validate Polaris inputs
  │         ├─ Valid → Build Polaris command
  │         └─ Invalid → Add to errors array
  └─ NO → Skip Polaris
  ↓
Check: COVERITY_URL set?
  ├─ YES → Validate Coverity inputs
  │         └─ ...
  └─ NO → Skip Coverity
  ↓
[Repeat for Black Duck and SRM]
  ↓
Any commands built?
  ├─ YES → Execute Bridge CLI
  └─ NO → Throw validation error
```

#### Version Compatibility Flow

```
Detect Bridge CLI version
  ↓
Compare with threshold (2.0.0)
  ↓
Version < 2.0.0?
  ├─ YES → Use old SARIF path
  │         'Polaris SARIF Generator/results.sarif.json'
  └─ NO → Use new SARIF path
            'integrations/polaris/sarif/results.sarif.json'
```

#### GitHub Service Selection Flow

```
Get GITHUB_SERVER_URL
  ↓
Is GitHub Cloud (github.com)?
  ├─ YES → Return GithubClientServiceCloud
  │         (main.ts:92-113)
  └─ NO → Detect Enterprise version
            ├─ Query /api/v3/meta
            ├─ Parse installed_version
            └─ Return GithubClientServiceV1
```

#### Error Handling Flow

```
Try executing Bridge CLI
  ↓
Execution succeeds?
  ├─ YES → Check exit code
  │         ├─ 0 → SUCCESS
  │         ├─ 8 → POLICY_VIOLATION (conditional fail)
  │         └─ Other → FAILURE
  │
  └─ NO → Catch error
            ├─ Extract exit code from message
            ├─ Log mapped exit code message
            ├─ Upload diagnostics if enabled
            └─ Re-throw error
```

### Step 4 — Error Propagation Flow

Trace how errors flow through the system:

#### Validation Errors

```
validators.ts:validatePolarisInputs()
  ↓
Returns: string[] of missing/invalid params
  ↓
bridge-cli.ts:prepareCommand()
  ↓
Accumulates errors from all products
  ↓
if (formattedCommand.length === 0)
  ↓
throw new Error(validationErrors.join(','))
  ↓
main.ts:catch block
  ↓
Log error → Set build status → Upload diagnostics
```

#### Execution Errors

```
exec.exec('bridge-cli', args)
  ↓
Bridge CLI exits with non-zero code
  ↓
Throws error with message: "... failed with exit code N"
  ↓
main.ts:catch block
  ↓
getBridgeExitCode(error) → Extract N
  ↓
logBridgeExitCodes(error.message) → Map to message
  ↓
Set build status based on exit code
  ↓
Upload diagnostics if configured
  ↓
setFailed(error.message)
```

#### Network Errors (with Retry)

```
download-utility.ts:downloadFile()
  ↓
Wrap in retry-helper.ts:execute()
  ↓
HTTP request fails (e.g., 503 Service Unavailable)
  ↓
isRetryable(error)? → Check HTTP status code
  ├─ Retryable (503, 408, 429, 500, 502, 504)
  │   ├─ Wait exponentially (15s → 30s → 60s)
  │   └─ Retry up to 3 times
  │
  └─ Non-retryable (400, 401, 403, 404, 416, 422)
      └─ Throw immediately
```

### Step 5 — Specific Flow Scenarios

Provide detailed traces for common scenarios:

#### Scenario 1: Polaris-Only Scan

```
1. User sets: POLARIS_SERVER_URL, POLARIS_ACCESS_TOKEN
2. main.ts:run() starts (line 24)
3. Create temp dir: /var/folders/.../black_duck_action_temp_XXX
4. Bridge constructor called (bridge-cli.ts:47)
5. validateBridgePath() (line 78)
   - network_airgap = false
   - Download Bridge CLI from artifactory
   - Extract to temp directory
6. validateBridgePath() returns
7. bridge.prepareCommand() called (line 184)
8. validateScanTypes() → ['POLARIS_SERVER_URL'] (not empty)
9. validatePolarisInputs() (validators.ts:35)
   - Check POLARIS_ACCESS_TOKEN → ✓
   - Check POLARIS_ASSESSMENT_TYPES → ✓
   - Return [] (no errors)
10. BridgeToolsParameter.getFormattedCommandForPolaris() (line 36)
    - Build polaris_input.json
    - Return ['--stage', 'polaris', '--input', '/tmp/polaris_input.json']
11. validateCoverityInputs() → Skip (no COVERITY_URL)
12. validateBlackDuckInputs() → Skip (no BLACKDUCKSCA_URL)
13. validateSRMInputs() → Skip (no SRM_URL)
14. formattedCommand = ['--stage', 'polaris', '--input', ...]
15. executeBridgeCommand() (line 252)
    - Run: bridge-cli --stage polaris --input ...
    - Exit code: 0
16. main.ts receives exitCode = 0
17. Upload SARIF: integrations/polaris/sarif/results.sarif.json
18. GitHubClientServiceFactory.getGitHubClientServiceInstance()
19. Upload to Code Scanning
20. Cleanup temp directory
21. setOutput('scan_status', 'success')
```

#### Scenario 2: Multi-Product Scan (Polaris + Black Duck)

[Similar detailed trace for multi-product]

#### Scenario 3: Validation Failure

[Trace showing early exit on validation error]

#### Scenario 4: Air-Gap Mode

[Trace showing local Bridge CLI usage]

## Output Format

```markdown
# Execution Flow Analysis

## High-Level Flow
[Diagram or numbered steps]

## Detailed Flow Trace

### Phase 1: [Phase Name]
**Entry Point**: `file.ts:line`
**Steps**:
1. [Step description] (`file.ts:line`)
2. [Next step] (`file.ts:line`)
   - Sub-step if needed

**Data State**:
- Input: [What data looks like at start]
- Output: [What data looks like at end]

[Continue for each phase]

## Control Flow Decisions

### Decision Point: [Description]
**Location**: `file.ts:line`
**Condition**: [What is checked]
**Paths**:
- ✅ True path: [What happens]
- ❌ False path: [What happens]

## Error Flow

### Error Type: [Name]
**Origin**: `file.ts:line`
**Propagation**:
1. Thrown at [location]
2. Caught at [location]
3. Transformed at [location]
4. Re-thrown at [location]
5. Final handler at [location]

## Scenario Walkthroughs

### Scenario: [Description]
**Configuration**: [User inputs]
**Flow**:
1. [Step-by-step execution]
```

## Best Practices

- **Use exact file:line references** for every step
- **Show data transformations** at each phase
- **Explain decision points** and why branches are taken
- **Trace errors completely** from origin to final handler
- **Provide realistic scenarios** based on actual usage
- **Keep flows focused** - one scenario per trace
- **Use visual aids** - diagrams, flowcharts, decision trees

## Example Queries Answered

**Q: "What happens when I run a Polaris scan?"**
A: Trace from main.ts through Polaris validation, command building, execution, SARIF upload

**Q: "How does error handling work?"**
A: Show error propagation from validators → bridge-cli → main.ts with retry logic

**Q: "How is SARIF uploaded to GitHub?"**
A: Trace factory pattern selection → service implementation → API call with retries

**Q: "What happens in air-gap mode?"**
A: Show conditional flow bypassing download, using local Bridge CLI installation