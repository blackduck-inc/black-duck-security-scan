# Black Duck Security Scan

**NOTE:** If you are currently using the old Synopsys Action, please follow these <a href="https://community.blackduck.com/s/article/integrations-black-duck-migration-instructions">instructions</a> to migrate from Synopsys Action to this new Black Duck Security Scan Action. 

![GitHub tag (latest SemVer)](https://img.shields.io/github/v/tag/blackduck-inc/black-duck-security-scan?color=blue&label=Latest%20Version&sort=semver)

Black Duck Security Action allows you to integrate Static Analysis Security Testing (SAST) and Software Composition Analysis (SCA) into your CI/CD pipelines. Black Duck Security Action leverages Bridge-CLI, a foundational piece of technology that has built-in knowledge of how to run all major black duck security testing solutions, plus common workflows for platforms like GitHub.

To use Black Duck Security Action, please follow the steps below:

1. Configure GitHub as described in the [GitHub Prerequisites](https://docs.blackduck.com/r/bridge/latest/bridge-cli-guide/github-prerequisites.html) page.
  
2. Install and configure Black Duck Security Action for the Black Duck product you are using. <br/>
[Polaris](https://docs.blackduck.com/r/bridge/latest/bridge-cli-guide/using-the-black-duck-security-scan-action-with-polaris.html) <br/>
[Black Duck SCA](https://docs.blackduck.com/r/bridge/latest/bridge-cli-guide/using-the-black-duck-security-scan-action-with-black-duck-sca.html)  <br/>
[Coverity](https://docs.blackduck.com/r/bridge/latest/bridge-cli-guide/using-the-black-duck-security-scan-action-with-coverity.html) <br/>
[SRM](https://docs.blackduck.com/r/bridge/latest/bridge-cli-guide/using-the-black-duck-security-scan-action-with-software-risk-manager.html) <br/>

3. For additional configuration options, visit the [Additional GitHub Configuration](https://docs.blackduck.com/r/bridge/latest/bridge-cli-guide/additional-github-configuration.html) page.

As an alternative to Black Duck Security Action, you also have the option to use Bridge CLI. <br/>
Detailed documentation for Bridge CLI can be found [here](https://docs.blackduck.com/r/bridge/latest/bridge-cli-guide/bridge-product-overview.html).

## FedRAMP mode (Polaris)

Set `fedramp_mode: true` to run the action in a FedRAMP environment. When the input is unset or `false`, the action behaves exactly as before.

```yaml
- uses: blackduck-inc/black-duck-security-scan@<version>
  with:
    fedramp_mode: true
    polaris_server_url: ${{ vars.POLARIS_SERVER_URL }}
    polaris_access_token: ${{ secrets.POLARIS_ACCESS_TOKEN }}
    polaris_assessment_types: "SCA"
```

When FedRAMP mode is enabled, the action validates the inputs first, before generating input files, downloading Bridge CLI or running it. All validation errors are reported together and the job fails without running Bridge CLI.

### Validations

| Input / condition | Requirement |
|-------------------|-------------|
| `polaris_server_url` | Required. Must be an `https` URL whose **hostname** is, or is a subdomain of, an approved FedRAMP Polaris domain. Only the hostname is checked, so lookalike hosts such as `polaris.blackduck-fedramp.com.evil.com` are rejected. |
| `bridgecli_download_url` | Optional. If provided, it must use `https`, be on an approved host, and point to the FIPS bundle (`bridge-cli-fips-bundle`). |
| Runner | macOS Intel runners are not supported. Use Linux, Windows or macOS ARM runners. |
| Tokens | Tokens are never passed as Bridge CLI command-line arguments. Only `--stage`, `--input` and `--diagnostics` are allowed. |

Error messages state the expected endpoint and never include secrets or the provided URL values.

When `fedramp_mode` is `false` or unset, none of these validations apply.

### FIPS Bridge CLI, air-gap and pre-installed Bridge CLI

In FedRAMP mode the action uses the FIPS-compliant Bridge CLI bundle (`bridge-cli-fips-bundle`) instead of the standard bundle (`bridge-cli-bundle`), including for download URLs, default install paths and `versions.txt` lookups.

Before Bridge CLI runs, the action verifies that the Bridge CLI it resolved is the FIPS bundle, meaning its `versions.txt` contains a `bridge-cli-fips-bundle` entry. If it is not, the action fails and Bridge CLI is not executed. This applies to:

- **Network air-gap** (`network_airgap: true`): no download is performed. Bridge CLI is resolved from the FedRAMP default install path (`<home>/bridge-cli-fips-bundle/bridge-cli-fips-bundle-<platform>`), so the FIPS bundle must already be installed there.
- **Pre-installed Bridge CLI** (`bridgecli_install_directory`): the same FIPS verification applies to the pre-installed Bridge CLI.
- **Cached or previously downloaded Bridge CLI**: a standard (non-FIPS) bundle of the same version is not treated as a match, so the FIPS bundle is downloaded instead.
- **Unknown version**: if the FIPS bundle version cannot be read from `versions.txt`, the action fails.

When `fedramp_mode` is `false` or unset, Bridge CLI selection and execution are unchanged.

### Bridge CLI integrity checks

In FedRAMP mode the action verifies the Bridge CLI at three stages and fails closed on any failure. There is no option to skip or override these checks, and there is no fallback to unsigned bundles.

| Check | When | What is verified |
|-------|------|------------------|
| **CHECK 1** | After download, before extraction | The `<bundle>.zip.sig` signature file is downloaded and the ZIP's ECDSA P-256 / SHA-256 signature is verified with the embedded Black Duck public key |
| **CHECK 2** | After the Bridge CLI is resolved (downloaded, cached, air-gap or pre-installed) | Every file is compared with the SHA-256 values in `manifest.json`, including the executable bit, and no extra files may exist |
| **CHECK 3** | Immediately before Bridge CLI runs | The `bridge-cli` binary is hashed again and compared with `manifest.json` |

Each check writes an audit log line prefixed with `[FedRAMP integrity]`, and failures are reported as errors. Logs never contain key material.

For air-gap and `bridgecli_install_directory`, CHECK 1 does not apply (no download), so CHECK 2 and CHECK 3 rely on the `manifest.json` shipped with the pre-installed FIPS bundle.
