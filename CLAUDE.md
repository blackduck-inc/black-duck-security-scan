# CLAUDE.md - Black Duck GitHub Actions Security Scanning

This file provides comprehensive guidance to Claude Code when working with the Black Duck GitHub Actions security scanning integration. This is a TypeScript-based GitHub Action that integrates Bridge CLI to provide security scanning capabilities within GitHub workflows.

## Project Overview

### What is this GitHub Action?
This GitHub Action provides a unified interface for running Black Duck security scans within GitHub workflows. It leverages Bridge CLI as the underlying orchestration tool to execute various security scanning tools (Polaris, Coverity, Black Duck SCA, Software Risk Manager) and upload results to GitHub Security tab.

### Key Capabilities
- **GitHub Native Integration**: Seamless integration with GitHub workflows and security features
- **SARIF Upload**: Automatic upload of security findings to GitHub Security tab
- **PR Comments**: Automated security findings comments on pull requests
- **Fix PR Creation**: Automated fix pull request creation for security vulnerabilities
- **Multi-Tool Support**: Support for Polaris, Coverity, Black Duck SCA, and Software Risk Manager
- **Enterprise & Cloud**: Support for both GitHub Cloud and GitHub Enterprise Server

## Architecture

### Design Patterns
- **Factory Pattern**: GitHub API services (Cloud vs Enterprise)
- **Strategy Pattern**: Security tool selection and configuration
- **Singleton Pattern**: HTTP client caching for performance optimization

### Key Components
- **Bridge CLI Integration**: Downloads, installs, and executes Bridge CLI
- **GitHub API Services**: Handles GitHub Cloud vs Enterprise Server differences
- **SSL Configuration**: Comprehensive SSL certificate handling
- **Artifact Management**: Handles GitHub Actions artifacts (v1 and v2 APIs)
- **SARIF Processing**: Processes and uploads SARIF security reports

## Development Environment

### Prerequisites
- **Node.js**: v20.x
- **npm**: Latest version
- **TypeScript**: 4.7.4
- **Jest**: 29.7.0 for testing

### Key Dependencies
- `@actions/core`, `@actions/exec`, `@actions/github` - GitHub Actions integration
- `typed-rest-client` - HTTP operations with SSL support
- `@actions/tool-cache` - Caching Bridge CLI downloads
- `@vercel/ncc` - Single-file distribution bundling

### Development Commands
```bash
# Install dependencies
npm ci

# Development workflow (runs all tasks)
npm run all  # format, lint, build, package, test

# Individual commands
npm run build        # TypeScript compilation
npm run package      # Create distribution bundle
npm test            # Unit tests (80% coverage required)
npm run contract-test # E2E tests with actual Bridge CLI
npm run lint         # ESLint
npm run format       # Prettier formatting

# Run specific test
npx jest test/unit/validators.test.ts

# Debug specific functionality
npx jest test/unit/ssl-utils.test.ts --verbose
```

## Bridge CLI Integration

### Installation and Management
The action automatically downloads and installs Bridge CLI from:
- **Primary**: https://repo.blackduck.com/
- **Legacy**: sig-repo.synopsys.com (deprecated)

### Configuration Parameters
- `bridgecli_install_directory` / `BRIDGECLI_INSTALL_DIRECTORY` - Installation path
- `bridgecli_download_url` / `BRIDGECLI_DOWNLOAD_URL` - Custom download URL  
- `bridgecli_download_version` / `BRIDGECLI_DOWNLOAD_VERSION` - Specific version

### Air-Gapped Environment Support
- `network_airgap` / `BRIDGE_NETWORK_AIRGAP` - Enable air-gapped mode
- Bridge CLI must be pre-installed when air-gapped mode is enabled

## Security Tool Configuration

### Polaris (SAST/SCA)
**Required Parameters:**
- `BRIDGE_POLARIS_SERVER_URL` - Polaris server URL
- `BRIDGE_POLARIS_ACCESS_TOKEN` - Authentication token
- `BRIDGE_POLARIS_ASSESSMENT_TYPES` - Assessment types (SAST, SCA, or both)

**Optional Parameters:**
- `BRIDGE_POLARIS_APPLICATION_NAME` - Application name (defaults to repository name)
- `BRIDGE_POLARIS_PROJECT_NAME` - Project name (defaults to repository name)
- `BRIDGE_POLARIS_BRANCH_NAME` - Branch name for analysis

### Coverity Connect (SAST)
**Required Parameters:**
- `BRIDGE_COVERITY_URL` - Coverity server URL
- `BRIDGE_COVERITY_USER` - Username for authentication
- `BRIDGE_COVERITY_PASSPHRASE` - Password for authentication

**Optional Parameters:**
- `BRIDGE_COVERITY_PROJECT_NAME` - Project name (defaults to repository name)
- `BRIDGE_COVERITY_STREAM_NAME` - Stream name for analysis
- `coverity_build_command` - Build command for compilation
- `coverity_clean_command` - Clean command before build

### Black Duck SCA
**Required Parameters:**
- `BRIDGE_BLACKDUCKSCA_URL` - Black Duck server URL
- `BRIDGE_BLACKDUCKSCA_TOKEN` - API token for authentication

**Optional Parameters:**
- `BRIDGE_BLACKDUCKSCA_SCAN_FULL` - Full scan vs rapid scan
- `BRIDGE_BLACKDUCKSCA_SCAN_FAILURE_SEVERITIES` - Severities that fail the build
- `detect_search_depth` - Search depth in source directory

### Software Risk Manager (SRM)
**Required Parameters:**
- `BRIDGE_SRM_URL` - SRM server URL
- `BRIDGE_SRM_APIKEY` - API key for authentication
- `BRIDGE_SRM_ASSESSMENT_TYPES` - Assessment types to run

## GitHub Integration Features

### SARIF Integration
- **Automatic Upload**: SARIF reports uploaded to GitHub Security tab
- **Security Alerts**: Integration with GitHub security alerts
- **Code Scanning**: Results appear in GitHub Code Scanning interface

### Pull Request Integration
- **PR Comments**: Automated comments with security findings
- **Status Checks**: Build status integration
- **Fix PRs**: Automated fix pull request creation

### GitHub API Handling
- **Cloud vs Enterprise**: Factory pattern handles API differences
- **Authentication**: GitHub token with appropriate scopes
- **Rate Limiting**: Intelligent rate limiting and retry logic

## SSL Configuration Architecture

### SSL Parameters
- `NETWORK_SSL_TRUST_ALL` - Boolean flag to disable SSL verification
- `NETWORK_SSL_CERT_FILE` - Path to custom CA certificate file (PEM format)

### Implementation Features
- **Centralized Configuration**: Shared SSL utility functions
- **Custom CA Support**: Combine custom certificates with system certificates  
- **Debug Logging**: Comprehensive SSL configuration logging
- **Graceful Fallback**: Fallback to disabled SSL with warnings

### HTTP Client Optimization
- **Singleton Pattern**: Single HTTP client instance per SSL configuration
- **Smart Caching**: Configuration change detection with hash-based invalidation
- **Connection Reuse**: Better HTTP performance through connection pooling

## Testing Strategy

### Unit Testing (80%+ Coverage Required)
- **Jest Configuration**: jest.config.js with comprehensive coverage
- **Mocking Strategy**: Extensive mocking of external dependencies
- **Parameter Validation**: Comprehensive input validation testing
- **Error Scenarios**: Testing of all error conditions

### Integration Testing
- **Bridge CLI Integration**: E2E tests with actual Bridge CLI binaries
- **GitHub API Testing**: Contract tests for GitHub API interactions
- **SSL Testing**: Real SSL certificate and connection testing

### Test Organization
```
test/
├── unit/                    # Unit tests
│   ├── blackduck-security-action/
│   │   ├── validators.test.ts
│   │   ├── ssl-utils.test.ts
│   │   ├── utility.test.ts
│   │   └── ...
│   └── main.test.ts
└── contract/                # Integration tests
    ├── bridge-cli-bundle-linux64/
    ├── bridge-cli-bundle-macosx/
    ├── polaris.e2e.test.ts
    └── ...
```

## Error Handling

### Error Categories
- **Network/Connectivity**: HTTP errors, SSL certificate issues
- **Authentication**: Invalid GitHub tokens, expired credentials
- **Configuration**: Invalid parameters, missing required values
- **Bridge CLI**: Execution errors, version compatibility issues
- **GitHub API**: Rate limiting, permission issues

### Error Handling Patterns
- **Structured Logging**: Comprehensive error context collection
- **Retry Logic**: Exponential backoff for transient failures
- **Graceful Degradation**: Continue operation when non-critical features fail
- **User Feedback**: Clear error messages with actionable guidance

## File Structure and Key Components

### Source Code Structure
```
src/
├── application-constants.ts          # Application-wide constants
├── main.ts                          # Entry point
└── blackduck-security-action/
    ├── bridge-cli.ts                # Bridge CLI management
    ├── inputs.ts                    # Input parameter handling
    ├── validators.ts                # Parameter validation
    ├── utility.ts                   # SSL and HTTP utilities
    ├── ssl-utils.ts                 # SSL configuration
    ├── artifacts.ts                 # GitHub artifacts handling
    ├── factory/
    │   └── github-client-service-factory.ts
    ├── service/
    │   ├── github-client-service-interface.ts
    │   └── impl/
    │       ├── github-client-service-base.ts
    │       ├── cloud/
    │       │   └── github-client-service-cloud.ts
    │       └── enterprise/
    │           └── v1/
    │               └── github-client-service-v1.ts
    └── input-data/
        ├── input-data.ts            # Input data models
        ├── blackduck.ts            # Black Duck SCA inputs
        ├── polaris.ts              # Polaris inputs
        ├── coverity.ts             # Coverity inputs
        └── srm.ts                  # SRM inputs
```

### Key Utility Functions
```typescript
// SSL configuration and HTTP client management
createSSLConfiguredHttpClient(userAgent?: string): HttpClient
getSharedHttpClient(): HttpClient
clearHttpClientCache(): void

// Bridge CLI management
downloadBridgeCli(): Promise<string>
executeBridgeCommand(command: string): Promise<void>

// GitHub integration
uploadSarifReport(sarifPath: string): Promise<void>
createPullRequestComment(findings: SecurityFinding[]): Promise<void>
```

## Performance Optimization

### Caching Strategy
- **Bridge CLI Caching**: Tool cache for Bridge CLI binaries
- **HTTP Client Caching**: Singleton HTTP clients with configuration-based caching
- **SSL Configuration**: Cached SSL configuration to avoid repeated processing

### Memory Management
- **Efficient Object Creation**: Minimize object instantiation overhead
- **Connection Pooling**: Reuse HTTP connections for better performance
- **Resource Cleanup**: Proper cleanup of temporary files and resources

## Security Best Practices

### Credential Management
- **GitHub Token**: Secure handling of GitHub authentication tokens
- **Secret Masking**: Automatic masking of sensitive information in logs
- **Transient Fields**: Sensitive data marked as transient
- **Token Scopes**: Minimal required permissions for GitHub token

### SSL Security
- **Certificate Validation**: Proper SSL certificate validation
- **Custom CA Support**: Support for custom certificate authorities
- **Security Warnings**: Warnings when SSL verification is disabled

## Debugging and Diagnostics

### Debug Output
- **Verbose Logging**: Comprehensive debug information when enabled
- **SSL Debug**: Detailed SSL configuration and connection information
- **HTTP Client Debug**: HTTP client reuse and configuration logging
- **Bridge CLI Debug**: Bridge CLI execution and parameter logging

### Diagnostic Collection
- **Environment Information**: System and runtime environment details
- **Configuration Dump**: Complete configuration state (with secrets masked)
- **Network Diagnostics**: Network connectivity and SSL configuration
- **GitHub API Diagnostics**: GitHub API interaction details

## Common Development Tasks

### Adding New Security Tool Support
1. Create input data model in `input-data/` directory
2. Add validation logic in `validators.ts`
3. Update Bridge CLI parameter generation in `tools-parameter.ts`
4. Add comprehensive unit tests
5. Update documentation and examples

### Extending GitHub Integration
1. Extend GitHub client service interface
2. Implement in both Cloud and Enterprise service classes
3. Add factory method for service selection
4. Test with both GitHub Cloud and Enterprise Server

### SSL Configuration Updates
1. Update SSL utility functions in `ssl-utils.ts`
2. Update HTTP client caching logic in `utility.ts`
3. Add comprehensive SSL testing
4. Update debug logging

## Troubleshooting Guide

### Common Issues and Solutions

#### Bridge CLI Download Failures
- Check network connectivity and repository access
- Verify `bridgecli_download_url` parameter if using custom URL
- Check proxy configuration and SSL certificates

#### Authentication Issues
- Verify GitHub token has required permissions
- Check token scope for repository and security permissions
- Ensure token is not expired

#### SSL Certificate Problems
- Use `NETWORK_SSL_CERT_FILE` for custom CA certificates
- Enable `NETWORK_SSL_TRUST_ALL` for testing (not recommended for production)
- Check SSL debug logs for certificate validation details

#### SARIF Upload Issues  
- Verify GitHub token has `security_events:write` permission
- Check SARIF file format and validation
- Review GitHub API rate limits

### Debug Information Collection
When reporting issues, collect:
- GitHub Actions workflow logs with debug enabled
- Environment variables (with secrets masked)
- SSL configuration and certificate details
- Bridge CLI version and execution logs
- GitHub API response details

## Future Development Considerations

### Architecture Evolution
- Maintain factory pattern for GitHub service abstraction
- Keep SSL configuration centralized and reusable
- Preserve singleton HTTP client pattern for performance
- Maintain high test coverage (80%+)

### New Feature Integration
- Follow established architectural patterns
- Add comprehensive unit and integration tests  
- Update parameter validation and error handling
- Maintain backward compatibility

### Maintenance Strategy
- Regular dependency updates with security scanning
- Monitor GitHub API changes and deprecations
- Update Bridge CLI compatibility as new versions are released
- Maintain documentation and examples

This GitHub Actions integration provides a robust, scalable foundation for Black Duck security scanning within GitHub workflows, with comprehensive error handling, performance optimization, and security best practices.