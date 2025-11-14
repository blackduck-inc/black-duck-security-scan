import {BridgeClientBase} from './bridge-client-base'
import {BridgeCliThinClient} from './bridge-cli-thin-client'
import {BridgeCliBundle} from './bridge-cli-bundle'
import {parseToBoolean} from '../utility'
import {info} from '@actions/core'
import {ENABLE_BRIDGE_CLI_THIN_CLIENT} from '../inputs'

/**
 * Factory functions to create appropriate Bridge client based on ENABLE_BRIDGE_CLI_THIN_CLIENT configuration
 */

/**
 * Creates a Bridge client instance based on ENABLE_BRIDGE_CLI_THIN_CLIENT setting
 * @returns BridgeCliThinClient if ENABLE_BRIDGE_CLI_THIN_CLIENT is true, otherwise BridgeCliBundle
 */
export function createBridgeClient(): BridgeClientBase {
  const isThinClient = parseToBoolean(ENABLE_BRIDGE_CLI_THIN_CLIENT)
  info(`Using Bridge CLI ${isThinClient ? 'Thin Client' : 'Bundle'}`)
  return isThinClient ? new BridgeCliThinClient() : new BridgeCliBundle()
}
