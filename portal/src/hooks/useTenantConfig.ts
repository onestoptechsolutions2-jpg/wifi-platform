import { useEffect, useState } from 'react'
import axios from 'axios'
import type { TenantConfig } from '../types'

export function useTenantConfig() {
  const [config, setConfig]   = useState<TenantConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    axios.get('/portal/config')
      .then(r => setConfig(r.data))
      .catch(() => setError('Unable to load portal. Please try again.'))
      .finally(() => setLoading(false))
  }, [])

  // Apply branding CSS variables once config loads
  useEffect(() => {
    if (!config) return
    const root = document.documentElement
    root.style.setProperty('--primary', config.branding.primaryColor)
    root.style.setProperty('--bg', config.branding.bgColor)
    document.title = config.name + ' — WiFi Login'
  }, [config])

  return { config, loading, error }
}

/**
 * Extract query params from the captive portal redirect URL.
 * Different vendors use different param names:
 *   MikroTik   — ?mac=MAC&ap=AP&url=URL&id=ID
 *   UniFi      — ?mac=MAC&ap=AP&url=URL&id=ID&ssid=SSID
 *   Omada      — ?clientMac=MAC&apMac=AP&redirectUrl=URL&token=TOKEN
 *   OpenWRT    — ?clientmac=MAC&gatewayname=GW&tok=TOKEN&redir=URL
 *   nodogsplash— ?clientip=IP&clientmac=MAC&tok=TOKEN&redir=URL
 */
export function usePortalParams() {
  const p = new URLSearchParams(window.location.search)
  return {
    mac: p.get('mac') ?? p.get('clientMac') ?? p.get('clientmac') ?? '',
    ap:  p.get('ap')  ?? p.get('apMac')     ?? '',
    url: p.get('url') ?? p.get('redirectUrl') ?? p.get('redir') ?? 'https://google.com',
    id:  p.get('id')  ?? '',
    tok: p.get('tok') ?? p.get('token') ?? '',  // OpenWRT/nodogsplash/Omada auth token
  }
}
