export interface Common {
  waitForScan?: boolean
}

export interface Network {
  airGap?: boolean
  ssl?: Cert
}

export interface Cert {
  cert?: File
  trustAll?: boolean
}

export interface File {
  file?: string
}
