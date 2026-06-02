# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Black Duck Security Scan is a GitHub Action that integrates Static Analysis Security Testing (SAST) and Software Composition Analysis (SCA) into CI/CD pipelines. It supports multiple Black Duck security products:
- **Polaris** - SAST/SCA analysis
- **Black Duck SCA** - Software Composition Analysis
- **Coverity** - Static analysis
- **SRM** - Security Risk Management

The action leverages Bridge CLI, which orchestrates all Black Duck security testing solutions.

## Build Commands

```bash
# Build TypeScript code
npm run build

# Package for distribution (creates dist/index.js)
npm run package

# Complete build pipeline (format, lint, build, package, test)
npm run all

# Run unit tests
npm test

# Run contract/e2e tests
npm run contract-test

# Format code
npm run format

# Check formatting
npm run format-check

# Run linter
npm run lint

# Auto-fix linting issues
npm run lint-fix
```

## Testing

The project uses Jest with two separate configurations:

- **Unit tests**: `jest.config.js` - Tests in `test/unit/**/*.test.ts`
- **Contract tests**: `jest.config.e2e.js` - Tests in `test/contract/**/*.e2e.test.ts`

Run specific test suites:
```bash
# Single test file
npm test -- path/to/test.test.ts

# Watch mode
npm test -- --watch

# With coverage
npm test -- --coverage
```

## Architecture

### Entry Point and Main Flow

The action starts in `src/main.ts`:
1. Creates a temporary directory for Bridge CLI artifacts
2. Instantiates the `Bridge` class to download and execute Bridge CLI
3. Validates inputs for the selected security product(s)
4. Builds Bridge CLI command with product-specific JSON input files
5. Executes Bridge CLI and captures exit code
6. Uploads diagnostics and SARIF reports if configured
7. Cleans up temporary files

### Core Components

**Bridge CLI Manager** (`src/blackduck-security-action/bridge-cli.ts`)
- Downloads Bridge CLI from artifactory or uses local installation
- Manages version compatibility and platform-specific paths (Windows, macOS, Linux ARM support)
- Constructs and executes Bridge commands
- Handles retry logic for network operations

**Input Data Layer** (`src/blackduck-security-action/input-data/`)
- Each security product has its own input data module (polaris.ts, blackduck.ts, coverity.ts, srm.ts)
- Modules define TypeScript interfaces for product-specific configuration
- Generates JSON input files consumed by Bridge CLI
- Handles backward compatibility for deprecated parameters

**Tools Parameter Builder** (`src/blackduck-security-action/tools-parameter.ts`)
- Central orchestrator for building Bridge CLI commands
- Generates product-specific JSON configuration files in temp directory
- Supports multi-product scanning in a single action run
- Manages GitHub-specific integrations (PR comments, SARIF uploads, fix PRs, badges)

**GitHub Client Services** (`src/blackduck-security-action/service/`)
- Factory pattern to support GitHub Cloud and Enterprise Server
- Separate implementations for different GitHub Enterprise API versions
- Handles SARIF report uploads to Code Scanning
- Base class provides common artifact upload functionality

**Validators** (`src/blackduck-security-action/validators.ts`)
- Input validation for each security product
- Ensures required fields are present and valid
- Validates severity levels, scan types, and configuration paths

**Inputs** (`src/blackduck-security-action/inputs.ts`)
- Centralizes reading GitHub Action inputs from `action.yml`
- Handles deprecated parameter names for backward compatibility

**Artifacts Manager** (`src/blackduck-security-action/artifacts.ts`)
- Uploads diagnostics ZIP files when `include_diagnostics` is enabled
- Uploads SARIF reports as artifacts
- Supports both v1 and v2 GitHub artifact APIs

### Key Patterns

**Exit Code Handling**: Bridge CLI uses numeric exit codes mapped in `application-constants.ts`. Exit code 8 indicates policy violations but allows workflow to continue based on `mark_build_status` input.

**Version Compatibility**: The codebase handles different Bridge CLI versions with conditional logic. Version 2.0.0+ changed SARIF file output paths (from root to `integrations/` subdirectory).

**Network Air Gap Mode**: When `network_airgap` is enabled, Bridge CLI is not downloaded. Instead, it must be pre-installed at the path specified by `bridgecli_install_directory`.

**Platform Support**: Bridge CLI has different binaries for:
- Windows (win64)
- Linux (linux64, linux_arm)
- macOS (macosx, macos_arm)

Minimum versions for ARM support are defined in constants.

**Input File Generation**: Each product generates a JSON input file (e.g., `polaris_input.json`, `bd_input.json`) in the temp directory. Bridge CLI consumes these via `--input` flags.

**GitHub Integration Features**:
- **PR Comments**: Automated comments on pull requests with scan results
- **Fix PRs**: Automatic pull requests to fix vulnerable dependencies
- **SARIF Upload**: Integration with GitHub Advanced Security Code Scanning
- **Badges**: Security policy badges on repository README
- **External Issues**: Create GitHub issues for security findings

## Development Notes

**Compiled Distribution**: The action runs `dist/index.js` (compiled with @vercel/ncc). Always run `npm run package` after code changes and commit the updated `dist/` directory.

**Sensitive Data**: Never commit secrets. The validators check for common secret files but rely on proper GitHub Secrets configuration.

**Constants**: All string constants, API keys, parameter names are centralized in `src/application-constants.ts` to avoid magic strings.

**Retry Logic**: Network operations use `retry-helper.ts` with configurable retry count and delay. Non-retryable HTTP codes (400, 401, 403, 416, 422) are defined in constants.

**SSL/Proxy Support**:
- `ssl-utils.ts` handles custom certificates and trust-all-certificates mode
- `proxy-utils.ts` configures HTTP/HTTPS proxy from environment variables

**Temporary Files**: All temporary directories are created in OS temp dir and cleaned up in the finally block of `main.ts`, even on failure.

## Common Workflows

**Adding a New Input Parameter**:
1. Add to `action.yml` inputs section
2. Add constant key in `src/application-constants.ts`
3. Read input in `src/blackduck-security-action/inputs.ts`
4. Update relevant input data interface in `src/blackduck-security-action/input-data/`
5. Update parameter builder in `tools-parameter.ts`
6. Add validation if needed in `validators.ts`
7. Add unit tests

**Supporting a New Security Product**:
1. Create input data interface in `src/blackduck-security-action/input-data/{product}.ts`
2. Add validator function in `validators.ts`
3. Add stage name constant in `application-constants.ts`
4. Implement command builder in `tools-parameter.ts`
5. Update `bridge-cli.ts` to include new product in command building
6. Add inputs to `action.yml`
7. Add contract tests in `test/contract/`

## Configuration Files

- `tsconfig.json` - TypeScript compiler targeting ES6, CommonJS modules, output to `lib/`
- `jest.config.js` - Unit tests with ts-jest transform
- `jest.config.e2e.js` - Contract tests for integration scenarios
- `eslint.config.mjs` - ESLint configuration (modern flat config format)
- `action.yml` - GitHub Action metadata defining all inputs and outputs

## Environment Variables

The action uses several GitHub-provided environment variables:
- `GITHUB_TOKEN` - For GitHub API operations
- `GITHUB_WORKSPACE` - Repository checkout directory
- `GITHUB_REPOSITORY` - Owner/repo name
- `GITHUB_EVENT_NAME` - Type of event (push, pull_request, etc.)

HTTP proxy environment variables are read and applied to Bridge CLI execution.
