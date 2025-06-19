# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Key Commands

### Build and Development
```bash
# Install dependencies
npm ci

# Build TypeScript
npm run build

# Package for distribution (creates single JS file with dependencies)
npm run package

# Run all checks (format, lint, build, package, test)
npm run all
```

### Testing
```bash
# Run unit tests
npm test

# Run E2E/contract tests
npm run contract-test

# Run specific test file
npx jest test/unit/validators.test.ts
```

### Code Quality
```bash
# Run linter
npm run lint

# Fix linting issues
npm run lint-fix

# Check formatting
npm run format-check

# Format code
npm run format
```

## Architecture Overview

This is a GitHub Action that provides security scanning capabilities using Black Duck tools (Polaris, Coverity, SRM, Black Duck SCA) through the Bridge CLI abstraction layer.

### Core Components

1. **Bridge CLI Module** (`src/blackduck-security-action/bridge-cli.ts`): Central component that manages Bridge CLI download, validation, and execution across platforms.

2. **Input Data Modules** (`src/blackduck-security-action/input-data/`): Tool-specific configuration handlers for Coverity, Polaris, Black Duck SCA, and SRM.

3. **Service Layer** (`src/blackduck-security-action/service/`): Factory-based GitHub API abstraction supporting both Cloud and Enterprise environments.

4. **Main Orchestrator** (`src/main.ts`): Coordinates the entire workflow - Bridge CLI execution, SARIF report generation, and artifact uploads.

### Key Patterns

- **Factory Pattern**: Creates appropriate GitHub service instances based on environment
- **Strategy Pattern**: Different handlers for each security tool with common interface
- **Plugin Architecture**: Each security tool is a plugin with tool-specific configurations

### Testing Structure

- Unit tests require 80% coverage threshold
- E2E tests include actual Bridge CLI binaries for integration testing
- Tests located in `test/unit/` and `test/contract/`

### Important Notes

- Always validate inputs using the validators in `src/blackduck-security-action/validators.ts`
- Bridge CLI parameters are constructed in `src/blackduck-security-action/tools-parameter.ts`
- The action supports air-gapped environments and self-signed certificates
- GitHub artifacts are managed through `src/blackduck-security-action/artifacts.ts`

## Action Inputs by Tool

### Coverity (SAST)
**Mandatory Parameters:**
- `coverity_url` - Coverity server URL
- `coverity_user` - Username for authentication
- `coverity_passphrase` - Password for authentication

**Optional Parameters:**
- `coverity_project_name` - Project name in Coverity
- `coverity_stream_name` - Stream name for analysis
- `coverity_install_directory` - Local installation directory (required if using local mode)
- `coverity_policy_view` - Policy view for issue filtering
- `coverity_local` - Enable/disable local scan mode
- `coverity_version` - Specific Coverity version to download
- `coverity_prComment_enabled` - Enable PR comments (requires `github_token`)
- `coverity_waitForScan` - Wait for analysis completion (default: true)
- `coverity_build_command` - Build command for compilation
- `coverity_clean_command` - Clean command before build
- `coverity_config_path` - Config file path (.yaml/.yml/.json)
- `coverity_args` - Additional arguments (space-separated)
- `coverity_execution_path` - Execution path for Coverity

### Polaris (SAST/SCA)
**Mandatory Parameters:**
- `polaris_server_url` - Polaris server URL
- `polaris_access_token` - Authentication token
- `polaris_assessment_types` - SAST/SCA assessment types

**Optional Parameters:**
- `polaris_application_name` - Application name
- `polaris_project_name` - Project name
- `polaris_branch_name` - Branch name for analysis
- `polaris_branch_parent_name` - Parent branch name
- `polaris_prComment_enabled` - Enable PR comments (requires `github_token`)
- `polaris_prComment_severities` - Severities for PR comments
- `polaris_waitForScan` - Wait for analysis completion (default: true)
- `polaris_assessment_mode` - Test mode type
- `polaris_triage` - Triage configuration
- `polaris_test_sca_type` - Signature or package manager scan
- `polaris_reports_sarif_create` - Enable SARIF report generation
- `polaris_reports_sarif_file_path` - SARIF report file path
- `polaris_reports_sarif_severities` - Severities to include in SARIF
- `polaris_reports_sarif_groupSCAIssues` - Group SCA issues by component
- `polaris_reports_sarif_issue_types` - Issue types for SARIF report
- `polaris_upload_sarif_report` - Upload SARIF to GitHub Advanced Security (requires `github_token`)
- `polaris_policy_badges_create` - Enable badge creation
- `polaris_policy_badges_maxCount` - Maximum number of badges

### Black Duck SCA
**Mandatory Parameters:**
- `blackducksca_url` - Black Duck server URL
- `blackducksca_token` - API token for authentication

**Optional Parameters:**
- `blackducksca_scan_full` - Intelligent scan (true) or rapid scan (false)
- `blackducksca_scan_failure_severities` - Break build on these severities
- `blackducksca_prComment_enabled` - Enable PR comments (requires `github_token`)
- `blackducksca_waitForScan` - Wait for analysis completion (default: true)
- `blackducksca_fixpr_enabled` - Create Fix PRs for vulnerabilities (requires `github_token`)
- `blackducksca_fixpr_maxCount` - Maximum Fix PRs to create
- `blackducksca_fixpr_filter_severities` - Severities for Fix PRs
- `blackducksca_fixpr_useUpgradeGuidance` - Enable long-term upgrade guidance
- `blackducksca_reports_sarif_create` - Enable SARIF report generation
- `blackducksca_reports_sarif_file_path` - SARIF report file path
- `blackducksca_reports_sarif_severities` - Severities to include in SARIF
- `blackducksca_reports_sarif_groupSCAIssues` - Group SCA issues by component
- `blackducksca_upload_sarif_report` - Upload SARIF to GitHub Advanced Security (requires `github_token`)
- `blackducksca_policy_badges_create` - Enable badge creation
- `blackducksca_policy_badges_maxCount` - Maximum number of badges
- `detect_install_directory` - Detect installation directory
- `detect_search_depth` - Search depth for scanning
- `detect_args` - Additional Detect arguments (space-separated)
- `detect_config_path` - Detect config file path (.properties/.yml)
- `detect_execution_path` - Execution path for Detect

### Bridge CLI Configuration
- `bridgecli_install_directory` - Local Bridge CLI installation directory (use existing installation)
- `bridgecli_download_url` - Custom URL to download Bridge CLI from
- `bridgecli_download_version` - Specific Bridge CLI version to download

### SSL/TLS Configuration
- `network_ssl_cert_file` - Path to a self-signed or custom SSL certificate file to trust for secure connections (PEM format recommended)
- `network_ssl_trustAll` - Set to `true` to trust all SSL certificates (not recommended for production)

### Common Inputs
- `github_token` - GitHub token (required when PR comment or Fix PR is enabled)
- `project_directory` - Project source directory (default: repo root)
- `project_source_archive` - Zipped source file path
- `project_source_preserveSymLinks` - Preserve symlinks in source zip
- `project_source_excludes` - Git ignore patterns for exclusion
- `include_diagnostics` - Include diagnostic information
- `diagnostics_retention_days` - Days to retain diagnostics
- `network_airgap` - Enable air-gapped mode
- `network_ssl_cert_file` - Self-signed certificate file path
- `network_ssl_trustAll` - Trust all certificates
- `mark_build_status` - Build status on policy violations (default: failure)