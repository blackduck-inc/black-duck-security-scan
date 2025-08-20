import {createBridgeClient} from '../../../../src/blackduck-security-action/bridge/bridge-client-factory'

describe('createBridgeClient', () => {
  afterEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('returns BridgeThinClient when ENABLE_BRIDGE_THIN_CLIENT is true', async () => {
    jest.mock('../../../../src/blackduck-security-action/inputs', () => ({
      ENABLE_BRIDGE_THIN_CLIENT: 'true'
    }))
    const {BridgeThinClient} = await import('../../../../src/blackduck-security-action/bridge/bridge-thin-client')
    const client = createBridgeClient()
    expect(client).toBeInstanceOf(BridgeThinClient)
  })

  it('returns BridgeCliBundle when ENABLE_BRIDGE_THIN_CLIENT is false', async () => {
    jest.mock('../../../../src/blackduck-security-action/inputs', () => ({
      ENABLE_BRIDGE_THIN_CLIENT: 'false'
    }))
    const {BridgeCliBundle} = await import('../../../../src/blackduck-security-action/bridge/bridge-cli-bundle')
    const client = createBridgeClient()
    expect(client).toBeInstanceOf(BridgeCliBundle)
  })
})
