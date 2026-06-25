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

/** Extract query params passed by MikroTik hardware */
export function usePortalParams() {
  const params = new URLSearchParams(window.location.search)
  return {
    mac: params.get('mac') ?? '',
    ap:  params.get('ap')  ?? '',
    url: params.get('url') ?? 'https://google.com',
    id:  params.get('id')  ?? '',
  }
}
