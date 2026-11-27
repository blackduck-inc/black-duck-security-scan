import * as os from 'os'
import {validateFedRAMPCommand, validateFedRAMPMode} from '../../../src/blackduck-security-action/validators'
import * as constants from '../../../src/application-constants'
import * as inputs from '../../../src/blackduck-security-action/inputs'

jest.mock('os', () => ({
  ...jest.requireActual('os'),
  arch: jest.fn()
}))

const VALID_POLARIS_URL = `https://tenant.${constants.FEDRAMP_ALLOWED_POLARIS_DOMAIN_PATTERNS[0]}`
const VALID_BRIDGE_URL = `https://${constants.FEDRAMP_ALLOWED_BRIDGE_DOMAINS[0]}/some/path/${constants.FEDRAMP_BRIDGE_FIPS_BUNDLE_NAME}/3.9.0/${constants.FEDRAMP_BRIDGE_FIPS_BUNDLE_NAME}-3.9.0-linux64.zip`

const originalPlatform = process.platform

function setInput(name: string, value: string): void {
  Object.defineProperty(inputs, name, {value, writable: true, configurable: true})
}

function setPlatform(platform: string): void {
  Object.defineProperty(process, 'platform', {value: platform})
}

beforeEach(() => {
  setPlatform('linux')
  ;(os.arch as jest.Mock).mockReturnValue('x64')
  setInput('FEDRAMP_MODE', 'true')
  setInput('POLARIS_SERVER_URL', VALID_POLARIS_URL)
  setInput('BRIDGE_CLI_DOWNLOAD_URL', '')
})

afterAll(() => {
  setPlatform(originalPlatform)
})

describe('validateFedRAMPMode', () => {
  it('returns no errors when FedRAMP mode is unset', () => {
    setInput('FEDRAMP_MODE', '')
    setInput('POLARIS_SERVER_URL', 'http://not-fedramp.example.com')
    expect(validateFedRAMPMode()).toEqual([])
  })

  it('returns no errors when FedRAMP mode is false', () => {
    setInput('FEDRAMP_MODE', 'false')
    setInput('POLARIS_SERVER_URL', '')
    expect(validateFedRAMPMode()).toEqual([])
  })

  it('accepts a valid FedRAMP Polaris URL', () => {
    expect(validateFedRAMPMode()).toEqual([])
  })

  it('rejects a non-FedRAMP Polaris URL', () => {
    setInput('POLARIS_SERVER_URL', 'https://polaris.example.com')
    expect(validateFedRAMPMode()).toHaveLength(1)
    expect(validateFedRAMPMode()[0]).toContain('polaris_server_url')
  })

  it('rejects lookalike hosts', () => {
    const domain = constants.FEDRAMP_ALLOWED_POLARIS_DOMAIN_PATTERNS[0]
    for (const url of [`https://${domain}.evil.com`, `https://x.${domain}.evil.com`, `https://evil${domain}`, `https://evil.com/${domain}`, `https://${domain}@evil.com`]) {
      setInput('POLARIS_SERVER_URL', url)
      expect(validateFedRAMPMode()).toHaveLength(1)
    }
  })

  it('rejects a non-https Polaris URL', () => {
    setInput('POLARIS_SERVER_URL', VALID_POLARIS_URL.replace('https://', 'http://'))
    expect(validateFedRAMPMode()).toHaveLength(1)
  })

  it('rejects an unparsable Polaris URL', () => {
    setInput('POLARIS_SERVER_URL', 'not a url')
    expect(validateFedRAMPMode()).toHaveLength(1)
  })

  it('fails with a clear error when the Polaris URL is missing', () => {
    setInput('POLARIS_SERVER_URL', '')
    expect(validateFedRAMPMode()).toEqual([constants.FEDRAMP_POLARIS_URL_MISSING_ERROR])
  })

  it('does not include the URL in the error message', () => {
    setInput('POLARIS_SERVER_URL', 'https://user:secret@evil.com')
    expect(validateFedRAMPMode().join()).not.toContain('secret')
  })

  it('accepts a valid Bridge CLI download URL', () => {
    setInput('BRIDGE_CLI_DOWNLOAD_URL', VALID_BRIDGE_URL)
    expect(validateFedRAMPMode()).toEqual([])
  })

  it('rejects a Bridge URL on an unapproved host', () => {
    setInput('BRIDGE_CLI_DOWNLOAD_URL', VALID_BRIDGE_URL.replace(constants.FEDRAMP_ALLOWED_BRIDGE_DOMAINS[0], 'evil.com'))
    expect(validateFedRAMPMode()).toHaveLength(1)
  })

  it('rejects a Bridge URL without the FIPS bundle', () => {
    setInput('BRIDGE_CLI_DOWNLOAD_URL', `https://${constants.FEDRAMP_ALLOWED_BRIDGE_DOMAINS[0]}/path/bridge-cli-bundle/3.9.0/bridge-cli-bundle-3.9.0-linux64.zip`)
    expect(validateFedRAMPMode()).toHaveLength(1)
  })

  it('rejects a non-https Bridge URL', () => {
    setInput('BRIDGE_CLI_DOWNLOAD_URL', VALID_BRIDGE_URL.replace('https://', 'http://'))
    expect(validateFedRAMPMode()).toHaveLength(1)
  })

  it('rejects a Bridge URL pointing to the macosx FIPS zip', () => {
    setInput('BRIDGE_CLI_DOWNLOAD_URL', VALID_BRIDGE_URL.replace('linux64', 'macosx'))
    expect(validateFedRAMPMode()).toHaveLength(1)
  })

  it('rejects macOS Intel runners', () => {
    setPlatform('darwin')
    ;(os.arch as jest.Mock).mockReturnValue('x64')
    expect(validateFedRAMPMode()).toEqual([constants.FEDRAMP_MAC_INTEL_UNSUPPORTED_ERROR])
  })

  it('accepts macOS ARM runners', () => {
    setPlatform('darwin')
    ;(os.arch as jest.Mock).mockReturnValue('arm64')
    expect(validateFedRAMPMode()).toEqual([])
  })

  it('does not block macOS Intel when FedRAMP mode is off', () => {
    setInput('FEDRAMP_MODE', 'false')
    setPlatform('darwin')
    ;(os.arch as jest.Mock).mockReturnValue('x64')
    expect(validateFedRAMPMode()).toEqual([])
  })

  it('collects all errors together', () => {
    setPlatform('darwin')
    ;(os.arch as jest.Mock).mockReturnValue('x64')
    setInput('POLARIS_SERVER_URL', 'http://evil.com')
    setInput('BRIDGE_CLI_DOWNLOAD_URL', 'http://evil.com/bridge.zip')
    expect(validateFedRAMPMode()).toHaveLength(3)
  })
})

describe('validateFedRAMPCommand', () => {
  it('returns no errors when FedRAMP mode is off', () => {
    setInput('FEDRAMP_MODE', 'false')
    expect(validateFedRAMPCommand('--stage polaris --input /tmp/input.json --polaris.accesstoken abc')).toEqual([])
  })

  it('accepts the allowed flags only', () => {
    expect(validateFedRAMPCommand('--stage polaris --input /tmp/input.json --diagnostics')).toEqual([])
  })

  it('rejects token arguments', () => {
    expect(validateFedRAMPCommand('--stage polaris --input /tmp/input.json --polaris.accesstoken abc')).toEqual([constants.FEDRAMP_TOKEN_ARGUMENT_ERROR])
  })

  it('does not include the command in the error', () => {
    expect(validateFedRAMPCommand('--stage polaris --token supersecret').join()).not.toContain('supersecret')
  })
})
