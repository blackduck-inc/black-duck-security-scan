import {GithubData} from './github'
import {Common, Network} from './common'
import {Bridge} from './bridge'

export interface Coverity {
  coverity: CoverityConnect
  project?: ProjectData
  github?: GithubData
  network?: Network
  bridge: Bridge
}

export interface ProjectData {
  repository?: {name: string}
  branch?: {name: string}
  directory?: string
}

export interface AutomationData {
  prcomment?: boolean | PrCommentData
}

export interface PrCommentData {
  enabled?: boolean
  impacts?: string[]
}

export interface CoverityConnect extends CoverityDetect, Common {
  connect: CoverityData
  install?: {directory: string}
  automation?: AutomationData
  prcomment?: PrCommentData
  local?: boolean
  version?: string
}

export interface CoverityDetect {
  build?: Command
  clean?: Command
  config?: Config
  args?: string
}

export interface Config {
  path: string
}

export interface CoverityData {
  user: {name: string; password: string}
  url: string
  project: {name: string}
  stream: {name: string}
  policy?: {view: string}
}

export interface Command {
  command: string
}
