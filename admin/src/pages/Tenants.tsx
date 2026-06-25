import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'

interface Tenant {
  id: string
  name: string
  domain: string
  plan: string
  status: 'active' | 'suspended' | 'trial'
  billingEmail: string
  lastPaidAt: string | null
  _count?: { customers: number }
}

interface PlanDef {
  key: string
  label: string
  price: number
  currency: string
}

const planBadge: Record<string, string> = { starter: 'badge-blue', growth: 'badge-orange', pro: 'badge-purple' }
const statusBadge: Record<string, string> = { active: 'badge-green', suspended: 'badge-red', trial: 'badge-orange' }

export default function Tenants() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [plans,   setPlans]   = useState<PlanDef[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const navigate = useNavigate()

  // New tenant form
  const [form,   setForm]   = useState({ name: '', domain: '', plan: 'starter', billingEmail: '', adminName: '', adminEmail: '', adminPassword: '' })
  const [saving, setSaving] = useState(false)

  const reloadTenants = () =>
    api.get('/tenants').then(r => setTenants(r.data))

  useEffect(() => {
    Promise.all([
      api.get('/tenants'),
      api.get('/plans'),
    ]).then(([t, p]) => {
      setTenants(t.data)
      setPlans(p.data)
      // Default form plan to first available plan key
      if (p.data.length > 0) setForm(f => ({ ...f, plan: p.data[0].key }))
    }).finally(() => setLoading(false))
  }, [])

  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try {
      const { data } = await api.post('/tenants', form)
      setShowNew(false)
      navigate(`/tenants/${data.id}`)
    } finally { setSaving(false) }
  }

  const impersonate = async (id: string) => {
    const { data } = await api.post(`/tenants/${id}/impersonate`)
    const dashboardUrl = import.meta.env.VITE_DASHBOARD_URL ?? `${window.location.protocol}//${window.location.hostname}:3001`
    window.open(`${dashboardUrl}?impersonate=${data.token}`, '_blank')
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Tenants ({tenants.length})</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setShowNew(v => !v)}>
          {showNew ? 'x Cancel' : '+ Add Tenant'}
        </button>
      </div>

      {showNew && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="modal-title">New Tenant</div>
          <form onSubmit={create}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Business Name</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Portal Domain (e.g. wifi.javacafe.com)</label>
                <input type="text" value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Plan</label>
                <select value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}>
                  {plans.length === 0
                    ? <option value="starter">Starter</option>
                    : plans.map(p => (
                        <option key={p.key} value={p.key}>
                          {p.label} - {p.currency} {p.price}/mo
                        </option>
                      ))
                  }
                </select>
              </div>
              <div className="form-group">
                <label>Billing Email</label>
                <input type="email" value={form.billingEmail} onChange={e => setForm(f => ({ ...f, billingEmail: e.target.value }))} required />
              </div>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>
              Admin login credentials — the client will use these to access their dashboard.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Admin Name</label>
                <input type="text" value={form.adminName} onChange={e => setForm(f => ({ ...f, adminName: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Admin Email</label>
                <input type="email" value={form.adminEmail} onChange={e => setForm(f => ({ ...f, adminEmail: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Admin Password</label>
                <input type="password" value={form.adminPassword} onChange={e => setForm(f => ({ ...f, adminPassword: e.target.value }))} required minLength={8} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? <span className="spinner-sm" /> : 'Create Tenant'}
            </button>
          </form>
        </div>
      )}

      {loading ? <span className="spinner-sm" /> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Domain</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Customers</th>
                <th>Last Paid</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map(t => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 500 }}>{t.name}</td>
                  <td><code style={{ fontSize: '0.8rem' }}>{t.domain}</code></td>
                  <td><span className={`badge ${planBadge[t.plan] ?? 'badge-gray'}`}>{t.plan}</span></td>
                  <td><span className={`badge ${statusBadge[t.status] ?? 'badge-gray'}`}>{t.status}</span></td>
                  <td>{t._count?.customers ?? 0}</td>
                  <td>{t.lastPaidAt ? new Date(t.lastPaidAt).toLocaleDateString() : 'Never'}</td>
                  <td style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-outline btn-sm" onClick={() => navigate(`/tenants/${t.id}`)}>Edit</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => impersonate(t.id)} title="Open dashboard as this tenant">
                      Impersonate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
