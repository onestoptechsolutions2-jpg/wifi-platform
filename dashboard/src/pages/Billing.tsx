import { useEffect, useState } from 'react'
import api from '../lib/api'

interface Gateway {
  name: string
  label: string
  configured: boolean
  currencies: string[]
}

interface Payment {
  id: string
  gateway: string
  amount: number
  currency: string
  status: string
  plan: string
  paidAt: string | null
  createdAt: string
  reference: string | null
}

interface Tenant {
  plan: string
  status: string
  billingEmail: string | null
  lastPaidAt: string | null
  nextBillDate: string | null
  billingGateway: string | null
}

const PLAN_PRICE: Record<string, number> = { starter: 99, growth: 199, pro: 349 }

const GATEWAY_ICONS: Record<string, string> = {
  stripe:      '💳',
  paystack:    '🟩',
  flutterwave: '🦋',
  mpesa:       '📱',
  pesapal:     '🌍',
}

const GATEWAY_CURRENCIES: Record<string, string> = {
  stripe:      'USD',
  paystack:    'KES',
  flutterwave: 'KES',
  mpesa:       'KES',
  pesapal:     'KES',
}

export default function Billing() {
  const [tenant,    setTenant]    = useState<Tenant | null>(null)
  const [gateways,  setGateways]  = useState<Gateway[]>([])
  const [history,   setHistory]   = useState<Payment[]>([])
  const [loading,   setLoading]   = useState(true)
  const [selected,  setSelected]  = useState<string>('')
  const [currency,  setCurrency]  = useState('KES')
  const [paying,    setPaying]    = useState(false)
  const [mpesaPhone, setMpesaPhone] = useState('')
  const [stkRef,    setStkRef]    = useState<string | null>(null)
  const [stkStatus, setStkStatus] = useState<string | null>(null)
  const [error,     setError]     = useState('')

  useEffect(() => {
    Promise.all([
      api.get('/tenants/me'),
      api.get('/billing/gateways'),
      api.get('/billing/history'),
    ]).then(([t, g, h]) => {
      setTenant(t.data)
      setGateways(g.data)
      setHistory(h.data)
      const preferred = t.data.billingGateway ?? (g.data.find((gw: Gateway) => gw.configured)?.name ?? '')
      setSelected(preferred)
      setCurrency(GATEWAY_CURRENCIES[preferred] ?? 'KES')
    }).finally(() => setLoading(false))
  }, [])

  // Poll STK status
  useEffect(() => {
    if (!stkRef || stkStatus === 'completed' || stkStatus === 'failed') return
    const id = setInterval(async () => {
      try {
        const { data } = await api.get(`/billing/mpesa/status/${stkRef}`)
        setStkStatus(data.status)
        if (data.status === 'completed') {
          clearInterval(id)
          const t = await api.get('/tenants/me')
          setTenant(t.data)
          const h = await api.get('/billing/history')
          setHistory(h.data)
        }
      } catch { /* ignore */ }
    }, 5000)
    return () => clearInterval(id)
  }, [stkRef, stkStatus])

  const pay = async () => {
    if (!selected || !tenant) return
    setError(''); setPaying(true)
    try {
      if (selected === 'mpesa') {
        if (!mpesaPhone.match(/^254\d{9}$/)) { setError('Enter phone as 254XXXXXXXXX'); setPaying(false); return }
        const { data } = await api.post('/billing/mpesa/stk', { plan: tenant.plan, phone: mpesaPhone })
        setStkRef(data.checkoutRequestId); setStkStatus('pending')
      } else {
        const { data } = await api.post('/billing/checkout', {
          gateway:  selected,
          plan:     tenant.plan,
          currency,
        })
        if (data.url) window.location.href = data.url
      }
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Payment failed. Try again.')
    } finally {
      setPaying(false)
    }
  }

  const daysSince = (date: string | null) => {
    if (!date) return null
    return Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
  }

  const daysUntil = (date: string | null) => {
    if (!date) return null
    const d = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
    return d
  }

  const configured = gateways.filter(g => g.configured)

  if (loading) return <div className="page"><span className="spinner-sm" /></div>

  const daysSincePaid = daysSince(tenant?.lastPaidAt ?? null)
  const dueIn         = daysUntil(tenant?.nextBillDate ?? null)
  const overdue       = dueIn !== null && dueIn < 0
  const dueSoon       = dueIn !== null && dueIn >= 0 && dueIn <= 7

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Billing & Subscription</h1>
      </div>

      {/* Current Plan */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card stat-card">
          <div className="stat-label">Current Plan</div>
          <div className="stat-value" style={{ textTransform: 'capitalize' }}>{tenant?.plan}</div>
          <div className="stat-sub">${PLAN_PRICE[tenant?.plan ?? 'starter']}/mo</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Last Payment</div>
          <div className="stat-value" style={{ fontSize: '1.1rem' }}>
            {tenant?.lastPaidAt ? new Date(tenant.lastPaidAt).toLocaleDateString() : '—'}
          </div>
          <div className="stat-sub" style={{ color: overdue ? 'var(--danger)' : 'var(--muted)' }}>
            {daysSincePaid !== null ? `${daysSincePaid}d ago` : 'No payment recorded'}
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Next Bill</div>
          <div className="stat-value" style={{ fontSize: '1.1rem', color: overdue ? 'var(--danger)' : dueSoon ? '#D97706' : undefined }}>
            {tenant?.nextBillDate ? new Date(tenant.nextBillDate).toLocaleDateString() : '—'}
          </div>
          <div className="stat-sub" style={{ color: overdue ? 'var(--danger)' : 'var(--muted)' }}>
            {dueIn !== null ? (overdue ? `${Math.abs(dueIn)}d overdue` : dueSoon ? `Due in ${dueIn}d` : `${dueIn}d remaining`) : ''}
          </div>
        </div>
      </div>

      {/* Payment section */}
      {configured.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
          No payment gateways configured yet. Contact your administrator.
        </div>
      ) : (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontWeight: 600, marginBottom: '1rem' }}>Make a Payment</h2>

          {/* Gateway selector */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            {configured.map(gw => (
              <button
                key={gw.name}
                onClick={() => { setSelected(gw.name); setCurrency(GATEWAY_CURRENCIES[gw.name] ?? 'KES') }}
                className={`btn btn-sm ${selected === gw.name ? 'btn-primary' : 'btn-outline'}`}
                style={{ minWidth: 140 }}
              >
                {GATEWAY_ICONS[gw.name]} {gw.label}
              </button>
            ))}
          </div>

          {selected && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 420 }}>

              {/* Currency selector (not for M-Pesa — KES only) */}
              {selected !== 'mpesa' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Currency</label>
                  <select value={currency} onChange={e => setCurrency(e.target.value)}>
                    {(gateways.find(g => g.name === selected)?.currencies ?? ['USD']).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* M-Pesa phone input */}
              {selected === 'mpesa' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>M-Pesa Phone Number</label>
                  <input
                    type="tel"
                    placeholder="254712345678"
                    value={mpesaPhone}
                    onChange={e => setMpesaPhone(e.target.value.replace(/\D/g, ''))}
                    maxLength={12}
                  />
                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 4 }}>Format: 254 followed by 9 digits</div>
                </div>
              )}

              {/* STK status */}
              {stkRef && (
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 8,
                  background: stkStatus === 'completed' ? '#D1FAE5' : stkStatus === 'failed' ? '#FEE2E2' : '#FEF3C7',
                  color:      stkStatus === 'completed' ? '#065F46' : stkStatus === 'failed' ? '#991B1B' : '#92400E',
                  fontSize: '0.875rem',
                }}>
                  {stkStatus === 'completed' && '✅ Payment received! Your subscription is active.'}
                  {stkStatus === 'failed'    && '❌ Payment failed or was cancelled. Try again.'}
                  {stkStatus === 'pending'   && '⏳ Waiting for M-Pesa PIN confirmation on your phone…'}
                </div>
              )}

              {error && (
                <div style={{ padding: '0.75rem', borderRadius: 8, background: '#FEE2E2', color: '#991B1B', fontSize: '0.875rem' }}>{error}</div>
              )}

              <button
                className="btn btn-primary"
                onClick={pay}
                disabled={paying || (stkStatus === 'pending')}
                style={{ alignSelf: 'flex-start' }}
              >
                {paying ? <span className="spinner-sm" /> : `Pay $${PLAN_PRICE[tenant?.plan ?? 'starter']}/mo via ${gateways.find(g => g.name === selected)?.label}`}
              </button>

              {selected !== 'mpesa' && (
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                  You'll be redirected to a secure payment page.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Payment history */}
      <div className="card">
        <h2 style={{ fontWeight: 600, marginBottom: '1rem' }}>Payment History</h2>
        {history.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>No payments yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Plan</th>
                  <th>Gateway</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {history.map(p => (
                  <tr key={p.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td style={{ textTransform: 'capitalize' }}>{p.plan}</td>
                    <td>{GATEWAY_ICONS[p.gateway]} {p.gateway}</td>
                    <td>{p.amount > 0 ? `${p.currency} ${p.amount.toLocaleString()}` : '—'}</td>
                    <td>
                      <span className={`badge ${p.status === 'completed' ? 'badge-green' : p.status === 'failed' ? 'badge-red' : 'badge-gray'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'monospace' }}>
                      {p.reference?.slice(0, 20) ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
