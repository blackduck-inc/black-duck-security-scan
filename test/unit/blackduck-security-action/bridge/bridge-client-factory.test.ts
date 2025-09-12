// Mock @actions/core before other imports
jest.mock('@actions/core', () => ({
  getInput: jest.fn(() => ''),
  info: jest.fn(),
  debug: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  setOutput: jest.fn(),
  setFailed: jest.fn()
}))

// Mock the utility module with all required functions
jest.mock('../../../../src/blackduck-security-action/utility', () => ({
  parseToBoolean: jest.fn(),
  getOSPlatform: jest.fn(() => 'linux64'),
  checkIfPathExists: jest.fn(() => true),
  cleanUrl: jest.fn(url => url),
  createTempDir: jest.fn(() => Promise.resolve('/tmp/test')),
  cleanupTempDir: jest.fn(() => Promise.resolve())
}))

// Mock download-utility
jest.mock('../../../../src/blackduck-security-action/download-utility', () => ({
  extractZipped: jest.fn()
}))

// Mock child_process
jest.mock('node:child_process', () => ({
  execSync: jest.fn()
}))

import {createBridgeClient} from '../../../../src/blackduck-security-action/bridge/bridge-client-factory'
import {BridgeThinClient} from '../../../../src/blackduck-security-action/bridge/bridge-thin-client'
import {BridgeCliBundle} from '../../../../src/blackduck-security-action/bridge/bridge-cli-bundle'

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
