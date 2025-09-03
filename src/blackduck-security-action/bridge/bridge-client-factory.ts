import {BridgeClientBase} from './bridge-client-base'
import {BridgeThinClient} from './bridge-thin-client'
import {BridgeCliBundle} from './bridge-cli-bundle'
import {parseToBoolean} from '../utility'
import {info} from '@actions/core'
import {ENABLE_BRIDGE_THIN_CLIENT} from '../inputs'

/**
 * Factory functions to create appropriate Bridge client based on ENABLE_BRIDGE_THIN_CLIENT configuration
 */

/**
 * Creates a Bridge client instance based on ENABLE_BRIDGE_THIN_CLIENT setting
 * @returns BridgeThinClient if ENABLE_BRIDGE_THIN_CLIENT is true, otherwise BridgeCliBundle
 */
export function createBridgeClient(): BridgeClientBase {
  const isThinClient = parseToBoolean(ENABLE_BRIDGE_THIN_CLIENT)
  info(`Using Bridge ${isThinClient ? 'Thin Client' : 'CLI Bundle'}`)
  return isThinClient ? new BridgeThinClient() : new BridgeCliBundle()
}
