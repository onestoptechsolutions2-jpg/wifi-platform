export interface TenantConfig {
  tenantId: string
  name: string
  branding: {
    logoUrl:      string | null
    primaryColor: string
    bgColor:      string
    headline:     string
    subheadline:  string
    termsText:    string
    redirectUrl:  string
  }
  loginMethods: {
    email:        boolean
    phone:        boolean
    google:       boolean
    facebook:     boolean
    clickthrough: boolean
  }
}

export interface PortalParams {
  mac: string          // Device MAC address passed by hardware
  ap:  string          // Access point MAC
  url: string          // Original URL the user tried to visit
  id:  string          // MikroTik hotspot challenge ID
}
