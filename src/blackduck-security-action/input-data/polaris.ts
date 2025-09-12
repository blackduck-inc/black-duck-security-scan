import {BlackDuckDetect} from './blackduck'
import {CoverityDetect} from './coverity'
import {GithubData} from './github'
import {Reports} from './reports'
import {Common, Network} from './common'
import {Bridge} from './bridge'

export interface Polaris {
  polaris: PolarisData
  project?: ProjectData
  github?: GithubData
  coverity?: CoverityDetect
  detect?: Omit<BlackDuckDetect, 'install' | 'scan'>
  network: Network
  bridge: Bridge
}

export interface PolarisData extends Common {
  accesstoken: string
  serverUrl: string
  application: {name: string}
  project: {name: string}
  branch?: Branch
  assessment: {types: string[]}
  prComment?: PrComment
  test?: Test
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
