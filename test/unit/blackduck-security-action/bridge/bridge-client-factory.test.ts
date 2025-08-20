import {createBridgeClient} from '../../../../src/blackduck-security-action/bridge/bridge-client-factory'

describe('createBridgeClient', () => {
  afterEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('returns BridgeThinClient when THIN_CLIENT_ENABLED is true', async () => {
    jest.mock('../../../../src/blackduck-security-action/inputs', () => ({
      THIN_CLIENT_ENABLED: 'true'
    }))
    const {BridgeThinClient} = await import('../../../../src/blackduck-security-action/bridge/bridge-thin-client')
    const client = createBridgeClient()
    expect(client).toBeInstanceOf(BridgeThinClient)
  })

  it('returns BridgeCliBundle when THIN_CLIENT_ENABLED is false', async () => {
    jest.mock('../../../../src/blackduck-security-action/inputs', () => ({
      THIN_CLIENT_ENABLED: 'false'
    }))
    const {BridgeCliBundle} = await import('../../../../src/blackduck-security-action/bridge/bridge-cli-bundle')
    const client = createBridgeClient()
    expect(client).toBeInstanceOf(BridgeCliBundle)
  })
})
