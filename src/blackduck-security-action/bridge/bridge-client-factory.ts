import {BridgeClientBase} from './bridge-client-base'
import {BridgeThinClient} from './bridge-thin-client'
import {BridgeCliBundle} from './bridge-cli-bundle'
import {THIN_CLIENT_ENABLED} from '../inputs'
import {parseToBoolean} from '../utility'
import {info} from '@actions/core'

/**
 * Factory functions to create appropriate Bridge client based on THIN_CLIENT_ENABLED configuration
 */

/**
 * Creates a Bridge client instance based on THIN_CLIENT_ENABLED setting
 * @returns BridgeThinClient if THIN_CLIENT_ENABLED is true, otherwise BridgeCliBundle
 */
export function createBridgeClient(): BridgeClientBase {
  const isThinClient = parseToBoolean(THIN_CLIENT_ENABLED)
  info(`Using Bridge ${isThinClient ? 'Thin Client' : 'CLI Bundle'}`)
  return isThinClient ? new BridgeThinClient() : new BridgeCliBundle()
}
