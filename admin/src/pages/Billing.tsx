import { useEffect, useState } from 'react'
import api from '../lib/api'

interface BillingRow {
  id: string
  name: string
  domain: string
  plan: string
  status: string
  billingEmail: string
  lastPaidAt: string | null
  billingNotes: string | null
}

const planPrice: Record<string, number> = { starter: 99, growth: 199, pro: 349 }

export default function Billing() {
  const [tenants, setTenants] = useState<BillingRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/tenants').then(r => setTenants(r.data)).finally(() => setLoading(false))
  }, [])

  const markPaid = async (id: string) => {
    await api.patch(`/tenants/${id}`, { lastPaidAt: new Date().toISOString() })
    setTenants(ts => ts.map(t => t.id === id ? { ...t, lastPaidAt: new Date().toISOString() } : t))
  }

  const active   = tenants.filter(t => t.status === 'active')
  const mrr      = active.reduce((sum, t) => sum + (planPrice[t.plan] ?? 0), 0)

  const daysSince = (date: string | null) => {
    if (!date) return null
    return Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Billing</h1>
      </div>

      <div className="stat-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="card stat-card">
          <div className="stat-label">Monthly Recurring Revenue</div>
          <div className="stat-value">${mrr.toLocaleString()}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Active Tenants</div>
          <div className="stat-value">{active.length}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Overdue (30+ days)</div>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>
            {tenants.filter(t => (daysSince(t.lastPaidAt) ?? 999) > 30).length}
          </div>
        </div>
      </div>

      {loading ? <span className="spinner-sm" /> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Tenant</th><th>Plan</th><th>MRR</th><th>Status</th><th>Last Paid</th><th>Days Since</th><th></th></tr>
            </thead>
            <tbody>
              {tenants.map(t => {
                const days = daysSince(t.lastPaidAt)
                const overdue = days !== null && days > 30
                return (
                  <tr key={t.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{t.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{t.billingEmail}</div>
                    </td>
                    <td><span className="badge badge-blue">{t.plan}</span></td>
                    <td>${planPrice[t.plan] ?? '—'}</td>
                    <td><span className={`badge ${t.status === 'active' ? 'badge-green' : 'badge-red'}`}>{t.status}</span></td>
                    <td>{t.lastPaidAt ? new Date(t.lastPaidAt).toLocaleDateString() : '—'}</td>
                    <td style={{ color: overdue ? 'var(--danger)' : undefined, fontWeight: overdue ? 700 : undefined }}>
                      {days !== null ? `${days}d` : '—'}
                    </td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={() => markPaid(t.id)}>
                        Mark Paid
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
