import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../lib/api'

// ── Vendor definitions (mirrors backend/src/services/vendor.ts) ───────────

type VendorType = 'mikrotik' | 'unifi' | 'omada' | 'openwrt' | 'radius' | 'none'

interface VendorField {
  key:          string
  label:        string
  type:         'text' | 'number' | 'password'
  placeholder?: string
  default?:     string | number
  hint?:        string
  isPassword?:  boolean
}

const VENDORS: { id: VendorType; name: string; description: string; fields: VendorField[] }[] = [
  {
    id: 'mikrotik', name: 'MikroTik RouterOS',
    description: 'RouterOS API (port 8728). Works on all MikroTik hardware running v6 or v7.',
    fields: [],  // uses legacy mk* columns — handled separately
  },
  {
    id: 'unifi', name: 'Ubiquiti UniFi',
    description: 'UniFi Network Controller REST API. Works with USG, Dream Machine, and UniFi switches.',
    fields: [
      { key: 'host',     label: 'Controller IP / Hostname', type: 'text',     placeholder: '192.168.1.1' },
      { key: 'port',     label: 'Port',                     type: 'number',   default: 8443 },
      { key: 'site',     label: 'Site Name',                type: 'text',     placeholder: 'default',
        hint: 'Lowercase site ID in the URL: /manage/site/default' },
      { key: 'user',     label: 'Admin Username',           type: 'text',     placeholder: 'admin' },
      { key: 'password', label: 'Admin Password',           type: 'password', placeholder: '••••••••', isPassword: true },
    ],
  },
  {
    id: 'omada', name: 'TP-Link Omada',
    description: 'Omada Software Controller or OC200/OC300 hardware controller.',
    fields: [
      { key: 'host',      label: 'Controller IP / Hostname', type: 'text',   placeholder: '192.168.1.1' },
      { key: 'port',      label: 'Port',                     type: 'number', default: 8043 },
      { key: 'omadacId',  label: 'Controller ID',            type: 'text',   placeholder: 'abc123',
        hint: 'Settings → Controller Info in the Omada web UI' },
      { key: 'siteId',    label: 'Site Name',                type: 'text',   placeholder: 'Default' },
      { key: 'user',      label: 'Admin Username',           type: 'text',   placeholder: 'admin' },
      { key: 'password',  label: 'Admin Password',           type: 'password', placeholder: '••••••••', isPassword: true },
    ],
  },
  {
    id: 'openwrt', name: 'OpenWRT / nodogsplash',
    description: 'OpenWRT running nodogsplash. Access is granted via the nodogsplash auth endpoint.',
    fields: [
      { key: 'host', label: 'Router IP',          type: 'text',   placeholder: '192.168.1.1' },
      { key: 'port', label: 'nodogsplash Port',   type: 'number', default: 2050,
        hint: 'Check GatewayPort in /etc/nodogsplash/nodogsplash.conf' },
    ],
  },
  {
    id: 'radius', name: 'RADIUS / Generic',
    description: 'pfSense, OPNsense, Cisco Meraki, Ruckus — any RADIUS-based system. Sessions are logged; configure your RADIUS server to accept MACs after portal login.',
    fields: [
      { key: 'radiusHost',   label: 'RADIUS Server IP', type: 'text',     placeholder: '192.168.1.10' },
      { key: 'radiusPort',   label: 'RADIUS Port',       type: 'number',   default: 1812 },
      { key: 'radiusSecret', label: 'Shared Secret',     type: 'password', placeholder: '••••••••', isPassword: true },
      { key: 'nasId',        label: 'NAS Identifier',    type: 'text',     placeholder: 'wifi-nas-01' },
    ],
  },
  {
    id: 'none', name: 'None / Manual',
    description: 'No automatic access grant. Hardware handles authentication externally (e.g. Cisco Meraki click-through).',
    fields: [],
  },
]

// ── Component ─────────────────────────────────────────────────────────────

export default function TenantDetail() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [tenant,  setTenant]  = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  // MikroTik — write-only password field
  const [mkPassword, setMkPassword] = useState('')

  // Non-MikroTik vendor config state
  const [vendorCfg, setVendorCfg] = useState<Record<string, any>>({})
  const [vendorPwd, setVendorPwd] = useState('')  // new plain-text password (write-only)

  const [testing,    setTesting]    = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    api.get(`/tenants/${id}`).then(r => {
      setTenant(r.data)
      // Seed vendorCfg from DB (minus passwordEnc — never show it)
      const cfg = { ...(r.data.vendorConfig ?? {}) }
      delete cfg.passwordEnc
      delete cfg.radiusSecretEnc
      setVendorCfg(cfg)
    }).finally(() => setLoading(false))
  }, [id])

  const set = (key: string, value: any) =>
    setTenant((t: any) => ({ ...t, [key]: value }))

  const setCfg = (key: string, value: any) =>
    setVendorCfg(prev => ({ ...prev, [key]: value }))

  const vendorType: VendorType = tenant?.vendorType ?? 'mikrotik'
  const vendorDef = VENDORS.find(v => v.id === vendorType) ?? VENDORS[0]

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setSaved(false)
    const payload: any = { ...tenant }
    // MikroTik — only send mkPassword if user typed a new one
    if (vendorType === 'mikrotik') {
      if (mkPassword) payload.mkPassword = mkPassword
    } else {
      // Build vendorConfig from UI state (without passwordEnc — backend handles that)
      payload.vendorConfig   = { ...vendorCfg }
      if (vendorPwd) payload.vendorPassword = vendorPwd
    }
    await api.patch(`/tenants/${id}`, payload).finally(() => setSaving(false))
    setSaved(true)
    setMkPassword('')
    setVendorPwd('')
    setTimeout(() => setSaved(false), 3000)
  }

  const testConnection = async () => {
    setTesting(true); setTestResult(null)
    try {
      const { data } = await api.post(`/tenants/${id}/test-connection`)
      setTestResult(data)
    } catch (err: any) {
      setTestResult({ ok: false, message: err.response?.data?.error ?? 'Connection failed' })
    } finally {
      setTesting(false)
    }
  }

  const toggleStatus = async () => {
    const next = tenant.status === 'active' ? 'suspended' : 'active'
    if (next === 'suspended' && !confirm('Suspend this tenant? Their portal will stop working.')) return
    await api.patch(`/tenants/${id}`, { status: next })
    set('status', next)
  }

  if (loading) return <div className="page"><span className="spinner-sm" /></div>
  if (!tenant)  return <div className="page">Tenant not found.</div>

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/tenants')}
            style={{ marginBottom: '0.5rem' }}>← Back</button>
          <h1 className="page-title">{tenant.name}</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {saved && <span className="badge badge-green">✓ Saved</span>}
          <button className={`btn btn-sm ${tenant.status === 'active' ? 'btn-danger' : 'btn-outline'}`}
            onClick={toggleStatus}>
            {tenant.status === 'active' ? 'Suspend' : 'Activate'}
          </button>
        </div>
      </div>

      <form onSubmit={save}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>

          {/* ── General ─────────────────────────────────────────────── */}
          <div className="card">
            <h2 style={{ fontWeight: 600, marginBottom: '1rem' }}>General</h2>

            <div className="form-group">
              <label>Business Name</label>
              <input type="text" value={tenant.name} onChange={e => set('name', e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Portal Domain</label>
              <input type="text" value={tenant.domain} onChange={e => set('domain', e.target.value)} required
                placeholder="wifi.javacafe.com" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Plan</label>
                <select value={tenant.plan} onChange={e => set('plan', e.target.value)}>
                  <option value="starter">Starter – $99/mo</option>
                  <option value="growth">Growth – $199/mo</option>
                  <option value="pro">Pro – $349/mo</option>
                </select>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={tenant.status} onChange={e => set('status', e.target.value)}>
                  <option value="trial">Trial</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Billing Email</label>
              <input type="email" value={tenant.billingEmail ?? ''} onChange={e => set('billingEmail', e.target.value)} />
            </div>
          </div>

          {/* ── Hardware Vendor ─────────────────────────────────────── */}
          <div className="card">
            <h2 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Hardware Vendor</h2>

            {/* Vendor selector */}
            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label>Router / Access Point Type</label>
              <select
                value={vendorType}
                onChange={e => {
                  set('vendorType', e.target.value)
                  setVendorCfg({})
                  setVendorPwd('')
                  setTestResult(null)
                }}
              >
                {VENDORS.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
              <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.3rem' }}>
                {vendorDef.description}
              </p>
            </div>

            {/* MikroTik — uses legacy columns */}
            {vendorType === 'mikrotik' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label>Router IP / Host</label>
                    <input type="text" value={tenant.mkHost ?? ''} onChange={e => set('mkHost', e.target.value)}
                      placeholder="192.168.88.1" />
                  </div>
                  <div className="form-group">
                    <label>API Port</label>
                    <input type="number" value={tenant.mkPort ?? 8728}
                      onChange={e => set('mkPort', Number(e.target.value))} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Username</label>
                  <input type="text" value={tenant.mkUser ?? ''} onChange={e => set('mkUser', e.target.value)}
                    placeholder="admin" />
                </div>
                <div className="form-group">
                  <label>
                    Password{' '}
                    {tenant.mkPasswordEnc
                      ? <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(leave blank to keep existing)</span>
                      : null}
                  </label>
                  <input type="password" value={mkPassword} onChange={e => setMkPassword(e.target.value)}
                    placeholder={tenant.mkPasswordEnc ? '••••••••' : 'Enter password'} />
                </div>
                <div className="form-group">
                  <label>Hotspot Interface</label>
                  <input type="text" value={tenant.mkInterface ?? 'bridge'}
                    onChange={e => set('mkInterface', e.target.value)} placeholder="bridge" />
                </div>
              </>
            )}

            {/* Dynamic vendor fields (UniFi, Omada, OpenWRT, RADIUS) */}
            {vendorType !== 'mikrotik' && vendorType !== 'none' && vendorDef.fields.map(field => (
              <div className="form-group" key={field.key}>
                <label>
                  {field.label}
                  {field.isPassword && tenant.vendorConfig?.passwordEnc
                    ? <span style={{ color: 'var(--muted)', fontWeight: 400 }}> (leave blank to keep existing)</span>
                    : null}
                </label>
                <input
                  type={field.isPassword ? 'password' : field.type}
                  inputMode={field.type === 'number' ? 'numeric' : undefined}
                  value={field.isPassword ? vendorPwd : (vendorCfg[field.key] ?? field.default ?? '')}
                  onChange={e => {
                    if (field.isPassword) {
                      setVendorPwd(e.target.value)
                    } else {
                      setCfg(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)
                    }
                  }}
                  placeholder={field.isPassword
                    ? (tenant.vendorConfig?.passwordEnc ? '••••••••' : field.placeholder)
                    : field.placeholder}
                />
                {field.hint && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.25rem' }}>{field.hint}</p>
                )}
              </div>
            ))}

            {vendorType === 'none' && (
              <div style={{ padding: '0.75rem', background: 'var(--bg)', borderRadius: 8,
                fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>
                No router credentials needed. Your hardware will handle access control externally.
              </div>
            )}

            {/* Test connection */}
            {vendorType !== 'none' && (
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-outline btn-sm"
                  onClick={testConnection} disabled={testing}>
                  {testing ? <span className="spinner-sm" /> : '⚡ Test Connection'}
                </button>
                {testResult && (
                  <span className={`badge ${testResult.ok ? 'badge-green' : 'badge-red'}`}>
                    {testResult.ok ? '✓' : '✗'} {testResult.message}
                  </span>
                )}
              </div>
            )}

            {/* Setup hints */}
            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg)',
              borderRadius: 8, fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.5 }}>
              {vendorType === 'mikrotik' && (<>
                <strong>MikroTik redirect URL to set:</strong><br />
                <code>http://{tenant.domain ?? 'wifi.yourdomain.com'}</code><br /><br />
                In Winbox: IP → Hotspot → Servers → Login → Login Page: External<br />
                Set Redirect to: <code>http://{tenant.domain ?? 'wifi.yourdomain.com'}</code>
              </>)}
              {vendorType === 'unifi' && (<>
                <strong>UniFi setup:</strong> Go to Network → Settings → Guest Hotspot → External Portal Server.<br />
                Set Portal URL to: <code>https://{tenant.domain ?? 'wifi.yourdomain.com'}</code>
              </>)}
              {vendorType === 'omada' && (<>
                <strong>Omada setup:</strong> Go to Settings → Authentication → Portal → External Portal.<br />
                Set Portal URL to: <code>https://{tenant.domain ?? 'wifi.yourdomain.com'}</code>
              </>)}
              {vendorType === 'openwrt' && (<>
                <strong>nodogsplash setup:</strong> Set <code>RedirectURL</code> in nodogsplash.conf to:<br />
                <code>https://{tenant.domain ?? 'wifi.yourdomain.com'}</code>
              </>)}
              {vendorType === 'radius' && (<>
                <strong>RADIUS setup:</strong> Configure your NAS to redirect unauthenticated clients to:<br />
                <code>https://{tenant.domain ?? 'wifi.yourdomain.com'}</code><br />
                Sessions are recorded in this platform; configure your RADIUS server to check the session DB.
              </>)}
            </div>
          </div>
        </div>

        <div style={{ marginTop: '1.25rem' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <span className="spinner-sm" /> : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
