export interface NetworkConfiguration {
  airGap?: boolean
  ssl?: SslConfiguration
}

export interface SslConfiguration {
  trust?: SslTrustConfiguration
  cert?: SslCertificateConfiguration
}

export interface SslTrustConfiguration {
  all?: boolean
}

export interface SslCertificateConfiguration {
  file?: string
}

export interface NetworkAirGap {
  airGap: boolean
}
