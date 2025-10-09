import {createBridgeClient} from '../../../../src/blackduck-security-action/bridge/bridge-client-factory'
import {BridgeThinClient} from '../../../../src/blackduck-security-action/bridge/bridge-thin-client'
import {BridgeCliBundle} from '../../../../src/blackduck-security-action/bridge/bridge-cli-bundle'

// Mock @actions/core
jest.mock(
  '@actions/core',
  () => ({
    getInput: jest.fn(() => ''),
    info: jest.fn(),
    debug: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
    setOutput: jest.fn(),
    setFailed: jest.fn(),
    exportVariable: jest.fn()
  }),
  {virtual: true}
)

jest.mock(
  '@actions/exec',
  () => ({
    exec: jest.fn()
  }),
  {virtual: true}
)

jest.mock(
  '@actions/io',
  () => ({
    cp: jest.fn(),
    mv: jest.fn(),
    rmRF: jest.fn(),
    mkdirP: jest.fn(),
    which: jest.fn(),
    find: jest.fn()
  }),
  {virtual: true}
)
// Mock the utility module with all required functions
jest.mock(
  '../../../../src/blackduck-security-action/utility',
  () => ({
    parseToBoolean: jest.fn(),
    getOSPlatform: jest.fn(() => 'linux64'),
    checkIfPathExists: jest.fn(() => true),
    createFolder: jest.fn(),
    deleteFolder: jest.fn(),
    getFileNameFromUrl: jest.fn(),
    validateURL: jest.fn(),
    executeWithRetry: jest.fn()
  }),
  {virtual: true}
)
// Mock inputs module to provide required values
jest.mock('../../../../src/blackduck-security-action/inputs', () => ({
  ENABLE_BRIDGE_THIN_CLIENT: 'false',
  ENABLE_NETWORK_AIR_GAP: 'false',
  BRIDGE_CLI_BASE_URL: 'https://test-bridge-url.com'
}))

describe('createBridgeClient', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns BridgeThinClient when ENABLE_BRIDGE_THIN_CLIENT is true', () => {
    const {parseToBoolean} = require('../../../../src/blackduck-security-action/utility')
    parseToBoolean.mockReturnValue(true)

    const client = createBridgeClient()
    expect(client).toBeInstanceOf(BridgeThinClient)
  })

  it('returns BridgeCliBundle when ENABLE_BRIDGE_THIN_CLIENT is false', () => {
    const {parseToBoolean} = require('../../../../src/blackduck-security-action/utility')
    parseToBoolean.mockReturnValue(false)

    const client = createBridgeClient()
    expect(client).toBeInstanceOf(BridgeCliBundle)
  })
})
