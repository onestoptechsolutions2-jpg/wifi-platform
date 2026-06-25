import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../lib/api'

export default function TenantDetail() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [tenant,  setTenant]  = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  // MikroTik password is write-only — show a placeholder unless user types a new one
  const [mkPassword, setMkPassword] = useState('')

  const [testing,    setTesting]    = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    api.get(`/tenants/${id}`)
      .then(r => setTenant(r.data))
      .finally(() => setLoading(false))
  }, [id])

  const set = (key: string, value: any) =>
    setTenant((t: any) => ({ ...t, [key]: value }))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setSaved(false)
    const payload: any = { ...tenant }
    if (mkPassword) payload.mkPassword = mkPassword  // only send if user typed a new one
    await api.patch(`/tenants/${id}`, payload).finally(() => setSaving(false))
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const testConnection = async () => {
    setTesting(true); setTestResult(null)
    const { data } = await api.post(`/tenants/${id}/test-connection`).finally(() => setTesting(false))
    setTestResult(data)
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

          {/* General */}
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

          {/* MikroTik */}
          <div className="card">
            <h2 style={{ fontWeight: 600, marginBottom: '1rem' }}>MikroTik Router</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label>Router IP / Host</label>
                <input type="text" value={tenant.mkHost ?? ''} onChange={e => set('mkHost', e.target.value)}
                  placeholder="192.168.88.1" />
              </div>
              <div className="form-group">
                <label>API Port</label>
                <input type="number" value={tenant.mkPort ?? 8728} onChange={e => set('mkPort', Number(e.target.value))} />
              </div>
            </div>

            <div className="form-group">
              <label>Username</label>
              <input type="text" value={tenant.mkUser ?? ''} onChange={e => set('mkUser', e.target.value)}
                placeholder="admin" />
            </div>

            <div className="form-group">
              <label>Password {tenant.mkPasswordEnc ? <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(leave blank to keep existing)</span> : null}</label>
              <input type="password" value={mkPassword} onChange={e => setMkPassword(e.target.value)}
                placeholder={tenant.mkPasswordEnc ? '••••••••' : 'Enter password'} />
            </div>

            <div className="form-group">
              <label>Interface</label>
              <input type="text" value={tenant.mkInterface ?? 'bridge'} onChange={e => set('mkInterface', e.target.value)}
                placeholder="bridge" />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={testConnection} disabled={testing}>
                {testing ? <span className="spinner-sm" /> : '⚡ Test Connection'}
              </button>
              {testResult && (
                <span className={`badge ${testResult.ok ? 'badge-green' : 'badge-red'}`}>
                  {testResult.ok ? '✓' : '✗'} {testResult.message}
                </span>
              )}
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
