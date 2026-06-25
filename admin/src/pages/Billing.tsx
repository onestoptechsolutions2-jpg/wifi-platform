import { useEffect, useState } from 'react'
import api from '../lib/api'

interface BillingRow {
  id: string
  name: string
  domain: string
  plan: string
  status: string
  billingEmail: string | null
  lastPaidAt: string | null
  nextBillDate: string | null
  billingGateway: string | null
  billingNotes: string | null
}

interface GatewayStatus {
  name: string
  label: string
  configured: boolean
  currencies: string[]
}

const planPrice: Record<string, number> = { starter: 99, growth: 199, pro: 349 }

const GATEWAY_ICONS: Record<string, string> = {
  stripe:      '💳',
  paystack:    '🟩',
  flutterwave: '🦋',
  mpesa:       '📱',
  pesapal:     '🌍',
  manual:      '✍️',
}

export default function Billing() {
  const [tenants,  setTenants]  = useState<BillingRow[]>([])
  const [gateways, setGateways] = useState<GatewayStatus[]>([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState<'all' | 'overdue' | 'trial'>('all')
  const [editNote, setEditNote] = useState<{ id: string; note: string } | null>(null)

  useEffect(() => {
    Promise.all([
      api.get('/tenants'),
      api.get('/billing/gateways'),
    ]).then(([t, g]) => {
      setTenants(t.data)
      setGateways(g.data)
    }).finally(() => setLoading(false))
  }, [])

  const markPaid = async (id: string) => {
    const next = new Date(); next.setMonth(next.getMonth() + 1)
    await api.patch(`/tenants/${id}`, { lastPaidAt: new Date().toISOString(), nextBillDate: next.toISOString(), status: 'active' })
    setTenants(ts => ts.map(t => t.id === id ? { ...t, lastPaidAt: new Date().toISOString(), nextBillDate: next.toISOString(), status: 'active' } : t))
  }

  const saveNote = async () => {
    if (!editNote) return
    await api.patch(`/tenants/${editNote.id}`, { billingNotes: editNote.note })
    setTenants(ts => ts.map(t => t.id === editNote.id ? { ...t, billingNotes: editNote.note } : t))
    setEditNote(null)
  }

  const daysSince = (date: string | null) => {
    if (!date) return null
    return Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
  }

  const daysUntil = (date: string | null) => {
    if (!date) return null
    return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
  }

  const active  = tenants.filter(t => t.status === 'active')
  const mrr     = active.reduce((sum, t) => sum + (planPrice[t.plan] ?? 0), 0)
  const overdue = tenants.filter(t => { const d = daysUntil(t.nextBillDate); return d !== null && d < 0 })
  const trial   = tenants.filter(t => t.status === 'trial')

  const shown = tenants.filter(t => {
    if (filter === 'overdue') { const d = daysUntil(t.nextBillDate); return d !== null && d < 0 }
    if (filter === 'trial')   return t.status === 'trial'
    return true
  })

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Billing</h1>
      </div>

      {/* Summary */}
      <div className="stat-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="card stat-card">
          <div className="stat-label">Monthly Recurring Revenue</div>
          <div className="stat-value">${mrr.toLocaleString()}</div>
          <div className="stat-sub">{active.length} active tenants</div>
        </div>
        <div className="card stat-card" onClick={() => setFilter('overdue')} style={{ cursor: 'pointer' }}>
          <div className="stat-label">Overdue</div>
          <div className="stat-value" style={{ color: overdue.length > 0 ? 'var(--danger)' : undefined }}>{overdue.length}</div>
          <div className="stat-sub">past next bill date</div>
        </div>
        <div className="card stat-card" onClick={() => setFilter('trial')} style={{ cursor: 'pointer' }}>
          <div className="stat-label">On Trial</div>
          <div className="stat-value">{trial.length}</div>
          <div className="stat-sub">not yet paying</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Annual Run Rate</div>
          <div className="stat-value">${(mrr * 12).toLocaleString()}</div>
          <div className="stat-sub">projected ARR</div>
        </div>
      </div>

      {/* Gateway status */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.95rem' }}>Payment Gateways</h2>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {gateways.map(gw => (
            <div key={gw.name} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.4rem 0.75rem', borderRadius: 20,
              background: gw.configured ? '#D1FAE5' : '#F3F4F6',
              color: gw.configured ? '#065F46' : '#6B7280',
              fontSize: '0.82rem', fontWeight: 500,
            }}>
              {GATEWAY_ICONS[gw.name]} {gw.label}
              <span style={{ opacity: 0.7 }}>{gw.configured ? '✓' : '✗ not configured'}</span>
            </div>
          ))}
        </div>
        {gateways.filter(g => !g.configured).length > 0 && (
          <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--muted)' }}>
            Set missing keys in Coolify environment variables to enable those gateways.
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {(['all', 'overdue', 'trial'] as const).map(f => (
          <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(f)}>
            {f === 'all' ? `All (${tenants.length})` : f === 'overdue' ? `Overdue (${overdue.length})` : `Trial (${trial.length})`}
          </button>
        ))}
      </div>

      {loading ? <span className="spinner-sm" /> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Plan</th>
                <th>MRR</th>
                <th>Status</th>
                <th>Gateway</th>
                <th>Last Paid</th>
                <th>Next Bill</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shown.map(t => {
                const due      = daysUntil(t.nextBillDate)
                const isOverdue = due !== null && due < 0
                const dueSoon  = due !== null && due >= 0 && due <= 5
                return (
                  <tr key={t.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{t.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{t.billingEmail ?? t.domain}</div>
                    </td>
                    <td><span className="badge badge-blue" style={{ textTransform: 'capitalize' }}>{t.plan}</span></td>
                    <td>${planPrice[t.plan] ?? '—'}</td>
                    <td>
                      <span className={`badge ${t.status === 'active' ? 'badge-green' : t.status === 'trial' ? 'badge-gray' : 'badge-red'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td>
                      {t.billingGateway
                        ? <span style={{ fontSize: '0.82rem' }}>{GATEWAY_ICONS[t.billingGateway]} {t.billingGateway}</span>
                        : <span style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>—</span>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                      {t.lastPaidAt ? new Date(t.lastPaidAt).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem', color: isOverdue ? 'var(--danger)' : dueSoon ? '#D97706' : undefined, fontWeight: isOverdue || dueSoon ? 600 : undefined }}>
                      {t.nextBillDate ? (
                        <>
                          {new Date(t.nextBillDate).toLocaleDateString()}
                          <div style={{ fontSize: '0.72rem' }}>
                            {isOverdue ? `${Math.abs(due!)}d overdue` : dueSoon ? `in ${due}d` : `in ${due}d`}
                          </div>
                        </>
                      ) : '—'}
                    </td>
                    <td style={{ maxWidth: 160 }}>
                      {editNote?.id === t.id ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <input value={editNote.note} onChange={e => setEditNote({ id: t.id, note: e.target.value })}
                            style={{ fontSize: '0.78rem', padding: '2px 6px' }} autoFocus />
                          <button className="btn btn-sm btn-primary" onClick={saveNote} style={{ padding: '2px 8px', fontSize: '0.75rem' }}>✓</button>
                          <button className="btn btn-sm btn-ghost" onClick={() => setEditNote(null)} style={{ padding: '2px 6px', fontSize: '0.75rem' }}>✕</button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: 'var(--muted)', cursor: 'pointer' }}
                          onClick={() => setEditNote({ id: t.id, note: t.billingNotes ?? '' })}>
                          {t.billingNotes ?? <em>add note</em>}
                        </span>
                      )}
                    </td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={() => markPaid(t.id)}>
                        ✓ Mark Paid
                      </button>
                    </td>
                  </tr>
                )
              })}
              {shown.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>No tenants to show.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Note edit modal */}
      {editNote && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setEditNote(null)}>
          <div className="card" style={{ minWidth: 360 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontWeight: 600, marginBottom: '1rem' }}>Billing Note</h2>
            <textarea value={editNote.note} onChange={e => setEditNote({ ...editNote, note: e.target.value })}
              rows={4} style={{ width: '100%', marginBottom: '0.75rem' }} autoFocus />
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditNote(null)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={saveNote}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
