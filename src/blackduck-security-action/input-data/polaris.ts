import {BlackDuckDetect} from './blackduck'
import {Command, Config} from './coverity'
import {GithubData} from './github'
import {Reports} from './reports'
import {Common, Network} from './common'
import {Bridge} from './bridge'

export interface Polaris {
  polaris: PolarisData
  project?: ProjectData
  github?: GithubData
  coverity?: CoverityArbitrary
  detect?: Omit<BlackDuckDetect, 'install' | 'scan'>
  network: Network
  bridge: Bridge
}

export interface CoverityArbitrary {
  version?: string
  build?: Command
  clean?: Command
  config?: Config
  args?: string
}

export interface PolarisFixPrData {
  enabled?: boolean
  maxCount?: number
  useUpgradeGuidance?: string[]
  filter?: PolarisFixPrFilterData
}

export interface PolarisFixPrFilterData {
  severities?: string[]
  issueTypes?: string[]
  confidence?: string[]
}

export interface PolarisPrCommentFilterData {
  issueTypes?: string[]
}

export interface PolarisData extends Common {
  accesstoken: string
  serverUrl: string
  application: {name: string}
  project: {name: string}
  branch?: Branch
  assessment: {types: string[]}
  prComment?: PrComment
  fixpr?: PolarisFixPrData
  test?: Test
  reports?: Reports
  policy?: Policy
  externalIssues?: ExternalIssues
  artifactToUpload?: string
  container?: Container
}

export interface Container {
  name?: string
}

export interface Policy {
  badges?: Badges
}

export interface Badges {
  create?: boolean
  maxCount?: number
}

export interface ProjectData {
  directory?: string
  source?: {
    archive?: string
    preserveSymLinks?: boolean
    excludes?: string[]
  }
}

export interface PrComment {
  enabled?: boolean
  severities?: string[]
  filter?: PolarisPrCommentFilterData
}

export interface Branch {
  name?: string
  parent?: {name?: string}
}

export interface Test {
  sca?: TestDetails
  sast?: TestDetails
}

interface TestDetails {
  type?: string | string[]
  location?: string
}

export interface ExternalIssues {
  create?: boolean
  severities?: string[]
  types?: string[]
  groupSCAIssues?: boolean
  maxCount?: number
}
