import { useEffect, useState } from 'react'
import api from '../lib/api'

interface Settings {
  name: string
  logoUrl:      string
  primaryColor: string
  bgColor:      string
  headline:     string
  subheadline:  string
  termsText:    string
  redirectUrl:  string
  sessionHours: number
  loginEmail:        boolean
  loginPhone:        boolean
  loginGoogle:       boolean
  loginFacebook:     boolean
  loginClickthrough: boolean
}

export default function PortalSettings() {
  const [s,       setS]       = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  useEffect(() => {
    api.get('/tenants/me').then(r => setS(r.data)).finally(() => setLoading(false))
  }, [])

  const update = (key: keyof Settings, value: any) =>
    setS(prev => prev ? { ...prev, [key]: value } : prev)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setSaved(false)
    await api.patch('/tenants/me', s).finally(() => setSaving(false))
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading || !s) return <div className="page"><span className="spinner-sm" /></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Portal Settings</h1>
        {saved && <span className="badge badge-green">✓ Saved</span>}
      </div>

      <form onSubmit={save}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>

          {/* Branding */}
          <div className="card">
            <h2 style={{ fontWeight: 600, marginBottom: '1rem' }}>Branding</h2>

            <div className="form-group">
              <label>Logo URL</label>
              <input type="text" value={s.logoUrl ?? ''} onChange={e => update('logoUrl', e.target.value)}
                placeholder="https://yourcdn.com/logo.png" />
            </div>

            <div className="form-group">
              <label>Headline</label>
              <input type="text" value={s.headline} onChange={e => update('headline', e.target.value)} required />
            </div>

            <div className="form-group">
              <label>Subheadline</label>
              <input type="text" value={s.subheadline} onChange={e => update('subheadline', e.target.value)} />
            </div>

            <div className="form-group">
              <label>Terms / Consent Text</label>
              <textarea rows={2} value={s.termsText} onChange={e => update('termsText', e.target.value)} />
            </div>

            <div className="form-group">
              <label>Redirect URL (after login)</label>
              <input type="text" value={s.redirectUrl} onChange={e => update('redirectUrl', e.target.value)}
                placeholder="https://yourwebsite.com" />
            </div>

            <div className="form-group">
              <label>Session Duration (hours)</label>
              <input type="number" min={1} max={24} value={s.sessionHours}
                onChange={e => update('sessionHours', Number(e.target.value))} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Primary Colour</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input type="color" value={s.primaryColor} onChange={e => update('primaryColor', e.target.value)}
                    style={{ width: 40, height: 36, padding: 2, border: '1.5px solid var(--border)', borderRadius: 8 }} />
                  <input type="text" value={s.primaryColor} onChange={e => update('primaryColor', e.target.value)}
                    style={{ flex: 1 }} />
                </div>
              </div>
              <div className="form-group">
                <label>Background Colour</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input type="color" value={s.bgColor} onChange={e => update('bgColor', e.target.value)}
                    style={{ width: 40, height: 36, padding: 2, border: '1.5px solid var(--border)', borderRadius: 8 }} />
                  <input type="text" value={s.bgColor} onChange={e => update('bgColor', e.target.value)}
                    style={{ flex: 1 }} />
                </div>
              </div>
            </div>
          </div>

          {/* Login methods */}
          <div className="card">
            <h2 style={{ fontWeight: 600, marginBottom: '1rem' }}>Login Methods</h2>

            {([
              ['loginEmail',        'Email'],
              ['loginPhone',        'Phone / OTP'],
              ['loginGoogle',       'Google'],
              ['loginFacebook',     'Facebook'],
              ['loginClickthrough', 'Click-through (Guest)'],
            ] as [keyof Settings, string][]).map(([key, label]) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.875rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={s[key] as boolean} onChange={e => update(key, e.target.checked)}
                  style={{ accentColor: 'var(--primary)', width: 16, height: 16 }} />
                <span style={{ fontWeight: 500 }}>{label}</span>
              </label>
            ))}

            {s.logoUrl && (
              <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>Logo preview</p>
                <img src={s.logoUrl} alt="logo" style={{ maxHeight: 60, maxWidth: 180, objectFit: 'contain' }} />
              </div>
            )}

            <div style={{ marginTop: '1.5rem', padding: '0.875rem', background: 'var(--bg)', borderRadius: 8, fontSize: '0.82rem', color: 'var(--muted)' }}>
              <strong>Portal domain:</strong><br />
              <code style={{ wordBreak: 'break-all' }}>{(s as any)?.domain ? `https://${(s as any).domain}` : 'https://wifi.yourdomain.com'}</code>
            </div>
          </div>
        </div>

        {/* ── Router / Vendor setup hint ─────────────────────────────── */}
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Router Setup</h2>
          {(() => {
            const vendor = (s as any)?.vendorType ?? 'mikrotik'
            const domain = (s as any)?.domain ? `https://${(s as any).domain}` : 'https://wifi.yourdomain.com'
            const hints: Record<string, JSX.Element> = {
              mikrotik: (
                <p style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.6 }}>
                  <strong>MikroTik:</strong> In Winbox go to IP → Hotspot → Servers → Login tab.<br />
                  Set <em>Login Page</em> to <strong>External</strong> and <em>Redirect</em> to:{' '}
                  <code style={{ background: 'var(--bg2, #f5f5f5)', padding: '0 4px', borderRadius: 4 }}>{domain}</code>
                </p>
              ),
              unifi: (
                <p style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.6 }}>
                  <strong>UniFi:</strong> Network → Settings → Guest Hotspot → External Portal Server.<br />
                  Set Portal URL to:{' '}
                  <code style={{ background: 'var(--bg2, #f5f5f5)', padding: '0 4px', borderRadius: 4 }}>{domain}</code>
                </p>
              ),
              omada: (
                <p style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.6 }}>
                  <strong>Omada:</strong> Settings → Authentication → Portal → External Portal Server.<br />
                  Set Portal URL to:{' '}
                  <code style={{ background: 'var(--bg2, #f5f5f5)', padding: '0 4px', borderRadius: 4 }}>{domain}</code>
                </p>
              ),
              openwrt: (
                <p style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.6 }}>
                  <strong>OpenWRT / nodogsplash:</strong> Set <code>RedirectURL</code> in{' '}
                  <code>/etc/nodogsplash/nodogsplash.conf</code> to:{' '}
                  <code style={{ background: 'var(--bg2, #f5f5f5)', padding: '0 4px', borderRadius: 4 }}>{domain}</code>
                </p>
              ),
              radius: (
                <p style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.6 }}>
                  <strong>RADIUS / Generic:</strong> Configure your NAS to redirect unauthenticated clients to:{' '}
                  <code style={{ background: 'var(--bg2, #f5f5f5)', padding: '0 4px', borderRadius: 4 }}>{domain}</code><br />
                  Contact your platform administrator to configure RADIUS credentials.
                </p>
              ),
              none: (
                <p style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.6 }}>
                  <strong>Manual / No vendor:</strong> Your hardware handles access control externally.
                  Ensure your router redirects unauthenticated clients to:{' '}
                  <code style={{ background: 'var(--bg2, #f5f5f5)', padding: '0 4px', borderRadius: 4 }}>{domain}</code>
                </p>
              ),
            }
            return hints[vendor] ?? hints.mikrotik
          })()}
          <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
            Router credentials are managed by your platform administrator.
          </p>
        </div>

        <div style={{ marginTop: '1.25rem' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <span className="spinner-sm" /> : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}
