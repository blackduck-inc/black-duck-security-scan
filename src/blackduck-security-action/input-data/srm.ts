import {BlackDuckDetect} from './blackduck'
import {CoverityDetect} from './coverity'
import {Common} from './common'
import {Bridge} from './bridge'

export interface SRM {
  srm: SRMData
  project?: ProjectData
  coverity?: CoverityData
  detect?: DetectData
  bridge: Bridge
}

export interface SRMData extends Common {
  url: string
  apikey: string
  project?: {id?: string; name?: string}
  assessment: {types: string[]}
  branch?: Branch
}

export interface ProjectData {
  directory?: string
}

export interface Branch {
  name?: string
  parent?: string
}

export interface ExecutionPath {
  execution?: {path?: string}
}

export interface DetectData extends ExecutionPath, Omit<BlackDuckDetect, 'install' | 'scan'> {}

export interface CoverityData extends ExecutionPath, CoverityDetect {}
