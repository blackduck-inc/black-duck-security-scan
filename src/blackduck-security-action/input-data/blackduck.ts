import {Reports} from './reports'
import {AsyncMode} from './async-mode'
import {NetworkConfiguration} from './common'

export enum BLACKDUCKSCA_SCAN_FAILURE_SEVERITIES {
  ALL = 'ALL',
  NONE = 'NONE',
  BLOCKER = 'BLOCKER',
  CRITICAL = 'CRITICAL',
  MAJOR = 'MAJOR',
  MINOR = 'MINOR',
  OK = 'OK',
  TRIVIAL = 'TRIVIAL',
  UNSPECIFIED = 'UNSPECIFIED'
}

export interface BlackDuckSCA {
  blackducksca: BlackDuckSCAData
  detect?: BlackDuckDetect
  project?: {
    directory?: string
  }
  github?: GithubData
  network?: NetworkConfiguration
}

export interface BlackDuckSCAData extends AsyncMode {
  url: string
  token: string
  scan?: {full?: boolean; failure?: {severities: BLACKDUCKSCA_SCAN_FAILURE_SEVERITIES[]}}
  automation?: AutomationData
  fixpr?: BlackDuckFixPrData
  reports?: Reports
  policy?: Policy
}

export interface Policy {
  badges?: Badges
}

export interface Badges {
  create?: boolean
  maxCount?: number
}

export interface BlackDuckDetect {
  install?: {directory?: string}
  scan?: {full?: boolean}
  search?: Search
  config?: Config
  args?: string
}

export interface Search {
  depth: number
}

export interface Config {
  path: string
}

export interface AutomationData {
  prcomment?: boolean
  fixpr?: boolean
}

export interface GithubData {}

export interface BlackDuckFixPrData {
  enabled?: boolean
  maxCount?: number
  createSinglePR?: boolean
  useUpgradeGuidance?: string[]
  filter?: BlackDuckFixPrFilerData
}

export interface BlackDuckFixPrFilerData {
  severities?: string[]
}
