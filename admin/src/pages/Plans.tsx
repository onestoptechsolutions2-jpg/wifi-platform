import { useEffect, useState } from 'react'
import api from '../lib/api'

// ── Plan definitions ──────────────────────────────────────────────────────

type PlanKey = 'starter' | 'growth' | 'pro'

interface PlanDef {
  key:         PlanKey
  label:       string
  price:       number
  color:       string
  accent:      string
  features:    string[]
  missing:     string[]
}

const PLANS: PlanDef[] = [
  {
    key:    'starter',
    label:  'Starter',
    price:  99,
    color:  '#1B5FAD',
    accent: '#EFF6FF',
    features: [
      '1 location',
      '500 portal logins / month',
      '7-day analytics retention',
      'Email & phone login',
      'Custom branding & colors',
      'MikroTik, UniFi, Omada support',
    ],
    missing: [
      'SMS campaigns',
      'Email campaigns',
      'White-label (removes platform branding)',
      'API access',
      'Priority support',
    ],
  },
  {
    key:    'growth',
    label:  'Growth',
    price:  199,
    color:  '#7C3AED',
    accent: '#F5F3FF',
    features: [
      'Up to 3 locations',
      '2,000 portal logins / month',
      '30-day analytics retention',
      'All login methods (email, phone, social, guest)',
      'Custom branding & colors',
      'All hardware vendors',
      'SMS & Email campaigns',
    ],
    missing: [
      'White-label (removes platform branding)',
      'API access',
      'Priority support',
    ],
  },
  {
    key:    'pro',
    label:  'Pro',
    price:  349,
    color:  '#059669',
    accent: '#ECFDF5',
    features: [
      'Unlimited locations',
      'Unlimited portal logins',
      '12-month analytics retention',
      'All login methods',
      'Custom branding & colors',
      'All hardware vendors',
      'SMS & Email campaigns',
      'White-label (no platform branding)',
      'API access',
      'Priority support',
    ],
    missing: [],
  },
]

// ── Component ─────────────────────────────────────────────────────────────

export default function Plans() {
  const [tenants,  setTenants]  = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState<PlanKey | 'all'>('all')
  const [search,   setSearch]   = useState('')
  const [saving,   setSaving]   = useState<string | null>(null)

  useEffect(() => {
    api.get('/tenants').then(r => setTenants(r.data)).finally(() => setLoading(false))
  }, [])

  // Stats
  const stats = PLANS.reduce((acc, p) => {
    const inPlan = tenants.filter(t => t.plan === p.key && t.status !== 'suspended')
    acc[p.key] = { count: inPlan.length, mrr: inPlan.length * p.price }
    return acc
  }, {} as Record<PlanKey, { count: number; mrr: number }>)

  const totalMrr    = PLANS.reduce((s, p) => s + (stats[p.key]?.mrr ?? 0), 0)
  const totalActive = tenants.filter(t => t.status === 'active').length
  const totalTrial  = tenants.filter(t => t.status === 'trial').length

  // Filtered tenant list
  const visible = tenants.filter(t => {
    if (filter !== 'all' && t.plan !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!t.name.toLowerCase().includes(q) && !t.domain.toLowerCase().includes(q)) return false
    }
    return true
  })

  const changePlan = async (tenantId: string, newPlan: PlanKey) => {
    setSaving(tenantId)
    try {
      await api.patch(`/tenants/${tenantId}`, { plan: newPlan })
      setTenants(prev => prev.map(t => t.id === tenantId ? { ...t, plan: newPlan } : t))
    } finally {
      setSaving(null)
    }
  }

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { active: 'badge-green', trial: 'badge-blue', suspended: 'badge-red' }
    return <span className={`badge ${map[s] ?? ''}`}>{s}</span>
  }

  if (loading) return <div className="page"><span className="spinner-sm" /></div>

  return (
    <div className="page">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="page-header">
        <h1 className="page-title">Plans</h1>
      </div>

      {/* ── Summary strip ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Monthly Recurring Revenue', value: `$${totalMrr.toLocaleString()}`, sub: `ARR $${(totalMrr * 12).toLocaleString()}` },
          { label: 'Active Tenants',             value: totalActive },
          { label: 'Trial Tenants',              value: totalTrial },
          { label: 'Total Tenants',              value: tenants.length },
        ].map(s => (
          <div key={s.label} className="card" style={{ flex: '1 1 150px', minWidth: 140, padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>{s.label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{s.value}</div>
            {s.sub && <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Plan cards ────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', marginBottom: '2rem' }}>
        {PLANS.map(plan => {
          const s = stats[plan.key] ?? { count: 0, mrr: 0 }
          return (
            <div key={plan.key} className="card" style={{ borderTop: `4px solid ${plan.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div>
                  <span style={{
                    display: 'inline-block', background: plan.accent, color: plan.color,
                    borderRadius: 6, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700,
                    letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.4rem',
                  }}>
                    {plan.label}
                  </span>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: plan.color }}>
                    ${plan.price}<span style={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--muted)' }}>/mo</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{s.count}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>tenants</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', padding: '0.6rem 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', marginBottom: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>MRR</div>
                  <div style={{ fontWeight: 700 }}>${s.mrr.toLocaleString()}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>ARR</div>
                  <div style={{ fontWeight: 700 }}>${(s.mrr * 12).toLocaleString()}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>% of MRR</div>
                  <div style={{ fontWeight: 700 }}>{totalMrr ? Math.round((s.mrr / totalMrr) * 100) : 0}%</div>
                </div>
              </div>

              <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: '0.82rem', lineHeight: 1.8 }}>
                {plan.features.map(f => (
                  <li key={f} style={{ display: 'flex', gap: '0.4rem', alignItems: 'baseline' }}>
                    <span style={{ color: plan.color, fontWeight: 700, flexShrink: 0 }}>✓</span> {f}
                  </li>
                ))}
                {plan.missing.map(f => (
                  <li key={f} style={{ display: 'flex', gap: '0.4rem', alignItems: 'baseline', color: 'var(--muted)' }}>
                    <span style={{ flexShrink: 0 }}>✗</span> {f}
                  </li>
                ))}
              </ul>

              <button
                className="btn btn-outline btn-sm"
                style={{ marginTop: '1rem', width: '100%', borderColor: plan.color, color: plan.color }}
                onClick={() => setFilter(filter === plan.key ? 'all' : plan.key)}
              >
                {filter === plan.key ? 'Show all tenants' : `View ${s.count} tenant${s.count !== 1 ? 's' : ''}`}
              </button>
            </div>
          )
        })}
      </div>

      {/* ── Tenant table ──────────────────────────────────────────── */}
      <div className="card">
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <h2 style={{ fontWeight: 600, margin: 0, flex: 1 }}>
            Tenants
            {filter !== 'all' && <span style={{ fontSize: '0.8rem', fontWeight: 400, marginLeft: '0.5rem', color: 'var(--muted)' }}>
              — filtered by {filter}
            </span>}
          </h2>

          <input
            type="search" placeholder="Search name or domain…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: 220 }}
          />

          <select value={filter} onChange={e => setFilter(e.target.value as any)}>
            <option value="all">All plans</option>
            <option value="starter">Starter</option>
            <option value="growth">Growth</option>
            <option value="pro">Pro</option>
          </select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                {['Tenant', 'Domain', 'Plan', 'Status', 'Next Bill', 'Change Plan'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>No tenants found</td></tr>
              )}
              {visible.map(t => {
                const plan = PLANS.find(p => p.key === t.plan)
                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.65rem 0.75rem', fontWeight: 500 }}>
                      <a href={`/tenants/${t.id}`} style={{ color: 'inherit', textDecoration: 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                        onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
                        {t.name}
                      </a>
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', color: 'var(--muted)', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {t.domain}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem' }}>
                      <span style={{
                        background: plan?.accent, color: plan?.color,
                        borderRadius: 5, padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600,
                      }}>
                        {t.plan}
                      </span>
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem' }}>{statusBadge(t.status)}</td>
                    <td style={{ padding: '0.65rem 0.75rem', color: 'var(--muted)', fontSize: '0.8rem' }}>
                      {t.nextBillDate
                        ? new Date(t.nextBillDate).toLocaleDateString()
                        : t.lastPaidAt
                        ? new Date(t.lastPaidAt).toLocaleDateString()
                        : '—'}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem' }}>
                      {saving === t.id
                        ? <span className="spinner-sm" />
                        : (
                          <select
                            value={t.plan}
                            onChange={e => changePlan(t.id, e.target.value as PlanKey)}
                            style={{ fontSize: '0.82rem', padding: '0.25rem 0.5rem' }}
                          >
                            <option value="starter">→ Starter $99</option>
                            <option value="growth">→ Growth $199</option>
                            <option value="pro">→ Pro $349</option>
                          </select>
                        )
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {visible.length > 0 && (
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.75rem', textAlign: 'right' }}>
            {visible.length} of {tenants.length} tenant{tenants.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  )
}
