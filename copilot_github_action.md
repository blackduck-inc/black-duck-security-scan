# Copilot GitHub Action - Developer Overview

This document provides a high-level overview of the architecture, variables, and execution flow for the Black Duck Security Scan GitHub Action. It is intended to help developers and contributors understand the key components and how to make changes or extend the action.

## Main Execution Flow
- **Entry Point:** `src/main.ts` contains the main `run()` function, which orchestrates the action's lifecycle.
- **Steps:**
  1. Prepare a temporary directory for execution.
  2. Instantiate the `Bridge` class to manage the Bridge CLI.
  3. Prepare the Bridge CLI command using tool-specific parameters.
  4. Download or validate the Bridge CLI binary (supports air-gapped mode).
  5. Execute the Bridge CLI command.
  6. Handle outputs, including SARIF and diagnostic artifacts.
  7. Set GitHub Action outputs and handle errors.

## Key Classes and Files
- **`src/blackduck-security-action/bridge-cli.ts`:**
  - The `Bridge` class manages downloading, validating, and executing the Bridge CLI, with platform-specific logic.
  - Handles SSL, air-gap, and custom installation directory logic.
- **`src/blackduck-security-action/tools-parameter.ts`:**
  - The `BridgeToolsParameter` class builds command-line arguments for each supported tool (Coverity, Polaris, Black Duck SCA, SRM).
- **`src/application-constants.ts`:**
  - Central location for all constant values, including input keys, default paths, and URLs.
- **`src/blackduck-security-action/inputs.ts`:**
  - (Not yet read) Handles parsing and validation of all GitHub Action inputs.

## Supported Tools
- **Coverity (SAST)**
- **Polaris (SAST/SCA)**
- **Black Duck SCA**
- **SRM**

Each tool is supported via a plugin-like architecture, with tool-specific input handling and command construction.

## Key Variables and Patterns
- **Inputs:** All user-provided configuration is accessed via the `inputs` module and referenced using constants.
- **Constants:** All input keys, URLs, and default values are defined in `application-constants.ts`.
- **Artifacts:** SARIF and diagnostic files are uploaded as GitHub Action artifacts based on scan results and configuration.
- **Error Handling:** Errors are caught and processed to set appropriate exit codes and outputs for downstream steps.

## SSL and Air-Gap Support
- SSL certificate and trust options are supported via inputs (`network_ssl_cert_file`, `network_ssl_trustAll`).
- Air-gapped mode disables network downloads and requires a pre-installed Bridge CLI.

## Inputs Reference

### Bridge-Related Inputs
- `bridgecli_install_directory`
- `bridgecli_download_url`
- `bridgecli_download_version`
- `enable_network_air_gap`
- `network_ssl_cert_file`
- `network_ssl_trustAll`

### Coverity (SAST) Inputs
- `coverity_url`
- `coverity_user`
- `coverity_passphrase`
- `coverity_project_name`
- `coverity_stream_name`
- `coverity_install_directory`
- `coverity_policy_view`
- `coverity_prComment_enabled`
- `coverity_local`
- `coverity_version`
- `coverity_waitForScan`
- `coverity_build_command`
- `coverity_clean_command`
- `coverity_config_path`
- `coverity_args`
- `coverity_execution_path`

### Polaris (SAST/SCA) Inputs
- `polaris_server_url`
- `polaris_access_token`
- `polaris_application_name`
- `polaris_project_name`
- `polaris_assessment_types`
- `polaris_prComment_enabled`
- `polaris_prComment_severities`
- `polaris_branch_name`
- `polaris_branch_parent_name`
- `polaris_test_sca_type`
- `polaris_reports_sarif_create`
- `polaris_reports_sarif_file_path`
- `polaris_reports_sarif_severities`
- `polaris_reports_sarif_groupSCAIssues`
- `polaris_reports_sarif_issue_types`
- `polaris_upload_sarif_report`
- `polaris_waitForScan`
- `polaris_assessment_mode`
- `polaris_policy_badges_create`
- `polaris_policy_badges_maxCount`

### Black Duck SCA Inputs
- `blackducksca_url`
- `blackducksca_token`
- `detect_install_directory`
- `blackducksca_scan_full`
- `blackducksca_scan_failure_severities`
- `blackducksca_fixpr_enabled`
- `blackducksca_prComment_enabled`
- `blackducksca_fixpr_maxCount`
- `blackducksca_fixpr_create_single_pr`
- `blackducksca_fixpr_filter_severities`
- `blackducksca_fixpr_useUpgradeGuidance`
- `blackducksca_reports_sarif_create`
- `blackducksca_reports_sarif_file_path`
- `blackducksca_reports_sarif_severities`
- `blackducksca_reports_sarif_groupSCAIssues`
- `blackducksca_upload_sarif_report`
- `blackducksca_waitForScan`
- `detect_search_depth`
- `detect_config_path`
- `detect_args`
- `blackducksca_policy_badges_create`
- `blackducksca_policy_badges_maxCount`

### SRM Inputs
- `srm_url`
- `srm_apikey`
- `srm_assessment_types`
- `srm_project_name`
- `srm_project_id`
- `srm_branch_name`
- `srm_branch_parent`
- `srm_waitForScan`

### Common/Other Inputs
- `github_token`
- `project_directory`
- `project_source_archive`
- `project_source_preserveSymLinks`
- `project_source_excludes`
- `include_diagnostics`
- `diagnostics_retention_days`
- `mark_build_status`
- `return_status`

## Best Practices for Contributions
- Use constants for all input keys and configuration values.
- Add new tool support by extending the parameter builder and input handler modules.
- Ensure new features are covered by unit and E2E tests.
- Validate all user inputs and provide clear error messages.

---
This document should be updated as the action evolves or new features are added.
