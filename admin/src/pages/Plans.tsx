import { useEffect, useState, useRef } from 'react'
import api from '../lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlanDef {
  key:         string
  label:       string
  price:       number
  currency:    string
  color:       string
  accentColor: string
  features:    string[]
  missing:     string[]
  isActive:    boolean
  sortOrder:   number
}

// ── Small helpers ──────────────────────────────────────────────────────────────

/** Editable tag-list (features / missing items) */
function TagList({
  items,
  color,
  onChange,
}: {
  items: string[]
  color: string
  onChange: (items: string[]) => void
}) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const v = draft.trim()
    if (!v) return
    onChange([...items, v])
    setDraft('')
  }

  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i))

  return (
    <div>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.3rem' }}>
          <span style={{ color, fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>✓</span>
          <span style={{ fontSize: '0.82rem', flex: 1 }}>{item}</span>
          <button
            onClick={() => remove(i)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.75rem', padding: '0 2px', lineHeight: 1 }}
          >✕</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.4rem' }}>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="Add feature…"
          style={{ flex: 1, fontSize: '0.78rem', padding: '0.25rem 0.5rem' }}
        />
        <button
          onClick={add}
          className="btn btn-outline btn-sm"
          style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderColor: color, color }}
        >+</button>
      </div>
    </div>
  )
}

/** Editable "not included" list */
function MissingList({ items, onChange }: { items: string[]; onChange: (items: string[]) => void }) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const v = draft.trim()
    if (!v) return
    onChange([...items, v])
    setDraft('')
  }

  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i))

  return (
    <div>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.3rem' }}>
          <span style={{ color: 'var(--muted)', fontSize: '0.8rem', flexShrink: 0 }}>✗</span>
          <span style={{ fontSize: '0.82rem', color: 'var(--muted)', flex: 1 }}>{item}</span>
          <button
            onClick={() => remove(i)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.75rem', padding: '0 2px', lineHeight: 1 }}
          >✕</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.4rem' }}>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="Add unavailable item…"
          style={{ flex: 1, fontSize: '0.78rem', padding: '0.25rem 0.5rem' }}
        />
        <button
          onClick={add}
          className="btn btn-outline btn-sm"
          style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
        >+</button>
      </div>
    </div>
  )
}

// ── Plan card editor ───────────────────────────────────────────────────────────

function PlanCard({
  plan,
  tenantCount,
  mrr,
  totalMrr,
  onFilter,
  isFiltered,
}: {
  plan: PlanDef
  tenantCount: number
  mrr: number
  totalMrr: number
  onFilter: () => void
  isFiltered: boolean
}) {
  const [editing,  setEditing]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [draft,    setDraft]    = useState<PlanDef>(plan)

  // sync when parent changes (e.g. initial load)
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    setDraft(plan)
  }, [plan])

  const save = async () => {
    setSaving(true)
    try {
      await api.patch(`/plans/${plan.key}`, {
        label:       draft.label,
        price:       draft.price,
        currency:    draft.currency,
        color:       draft.color,
        accentColor: draft.accentColor,
        features:    draft.features,
        missing:     draft.missing,
        isActive:    draft.isActive,
      })
      setSaved(true)
      setEditing(false)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  const cancel = () => { setDraft(plan); setEditing(false) }

  return (
    <div className="card" style={{ borderTop: `4px solid ${draft.color}`, position: 'relative' }}>
      {/* edit / save / cancel buttons */}
      <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', display: 'flex', gap: '0.4rem' }}>
        {saved && <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>✓ Saved</span>}
        {editing ? (
          <>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}
              style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem' }}>
              {saving ? '…' : 'Save'}
            </button>
            <button className="btn btn-outline btn-sm" onClick={cancel}
              style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem' }}>
              Cancel
            </button>
          </>
        ) : (
          <button className="btn btn-outline btn-sm" onClick={() => setEditing(true)}
            style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem', borderColor: draft.color, color: draft.color }}>
            ✏ Edit
          </button>
        )}
      </div>

      {/* header */}
      <div style={{ marginBottom: '0.5rem', paddingRight: '6rem' }}>
        {editing ? (
          <input
            value={draft.label}
            onChange={e => setDraft(p => ({ ...p, label: e.target.value }))}
            style={{ fontWeight: 700, fontSize: '1rem', width: '100%', marginBottom: '0.35rem' }}
          />
        ) : (
          <span style={{
            display: 'inline-block', background: draft.accentColor, color: draft.color,
            borderRadius: 6, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700,
            letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.4rem',
          }}>
            {draft.label}
          </span>
        )}

        {/* price */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginTop: '0.15rem' }}>
          {editing ? (
            <>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: draft.color }}>$</span>
              <input
                type="number" min={0}
                value={draft.price}
                onChange={e => setDraft(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))}
                style={{ width: 90, fontSize: '1.4rem', fontWeight: 800, color: draft.color }}
              />
              <select
                value={draft.currency}
                onChange={e => setDraft(p => ({ ...p, currency: e.target.value }))}
                style={{ fontSize: '0.8rem' }}
              >
                {['USD','KES','NGN','GHS','ZAR','EUR','GBP','UGX','TZS'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>/mo</span>
            </>
          ) : (
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: draft.color }}>
              {draft.currency !== 'USD' ? draft.currency + ' ' : '$'}{draft.price.toLocaleString()}
              <span style={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--muted)' }}>/mo</span>
            </div>
          )}

          {/* tenant count */}
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{tenantCount}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>tenants</div>
          </div>
        </div>
      </div>

      {/* colour pickers (edit mode) */}
      {editing && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', padding: '0.6rem', background: 'var(--bg)', borderRadius: 8 }}>
          <label style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ color: 'var(--muted)' }}>Main colour</span>
            <input type="color" value={draft.color}
              onChange={e => setDraft(p => ({ ...p, color: e.target.value }))}
              style={{ width: 32, height: 28, border: 'none', padding: 0, cursor: 'pointer' }} />
          </label>
          <label style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ color: 'var(--muted)' }}>Accent</span>
            <input type="color" value={draft.accentColor}
              onChange={e => setDraft(p => ({ ...p, accentColor: e.target.value }))}
              style={{ width: 32, height: 28, border: 'none', padding: 0, cursor: 'pointer' }} />
          </label>
          <label style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: 'auto' }}>
            <input type="checkbox" checked={draft.isActive}
              onChange={e => setDraft(p => ({ ...p, isActive: e.target.checked }))} />
            <span>Active</span>
          </label>
        </div>
      )}

      {/* MRR strip */}
      <div style={{ display: 'flex', gap: '1rem', padding: '0.6rem 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', marginBottom: '0.75rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>MRR</div>
          <div style={{ fontWeight: 700 }}>${mrr.toLocaleString()}</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>ARR</div>
          <div style={{ fontWeight: 700 }}>${(mrr * 12).toLocaleString()}</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>% MRR</div>
          <div style={{ fontWeight: 700 }}>{totalMrr ? Math.round((mrr / totalMrr) * 100) : 0}%</div>
        </div>
      </div>

      {/* features */}
      <div style={{ marginBottom: '0.5rem' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
          Included
        </div>
        {editing ? (
          <TagList items={draft.features} color={draft.color}
            onChange={features => setDraft(p => ({ ...p, features }))} />
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: '0.82rem', lineHeight: 1.8 }}>
            {draft.features.map(f => (
              <li key={f} style={{ display: 'flex', gap: '0.4rem' }}>
                <span style={{ color: draft.color, fontWeight: 700, flexShrink: 0 }}>✓</span> {f}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* missing */}
      {(draft.missing.length > 0 || editing) && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '0.4rem', marginTop: '0.5rem' }}>
            Not included
          </div>
          {editing ? (
            <MissingList items={draft.missing}
              onChange={missing => setDraft(p => ({ ...p, missing }))} />
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: '0.82rem', lineHeight: 1.8 }}>
              {draft.missing.map(f => (
                <li key={f} style={{ display: 'flex', gap: '0.4rem', color: 'var(--muted)' }}>
                  <span style={{ flexShrink: 0 }}>✗</span> {f}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* filter button */}
      <button
        className="btn btn-outline btn-sm"
        style={{ marginTop: '0.5rem', width: '100%', borderColor: draft.color, color: draft.color }}
        onClick={onFilter}
      >
        {isFiltered ? 'Show all tenants' : `View ${tenantCount} tenant${tenantCount !== 1 ? 's' : ''}`}
      </button>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

type PlanKey = string

export default function Plans() {
  const [plans,    setPlans]    = useState<PlanDef[]>([])
  const [tenants,  setTenants]  = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState<PlanKey | 'all'>('all')
  const [search,   setSearch]   = useState('')
  const [saving,   setSaving]   = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      api.get('/plans'),
      api.get('/tenants'),
    ]).then(([pr, tr]) => {
      setPlans(pr.data)
      setTenants(tr.data)
    }).finally(() => setLoading(false))
  }, [])

  // Stats per plan
  const stats = plans.reduce((acc, p) => {
    const inPlan = tenants.filter(t => t.plan === p.key && t.status !== 'suspended')
    acc[p.key] = { count: inPlan.length, mrr: inPlan.length * p.price }
    return acc
  }, {} as Record<string, { count: number; mrr: number }>)

  const totalMrr    = plans.reduce((s, p) => s + (stats[p.key]?.mrr ?? 0), 0)
  const totalActive = tenants.filter(t => t.status === 'active').length
  const totalTrial  = tenants.filter(t => t.status === 'trial').length

  // Filtered tenant list
  const visible = tenants.filter(t => {
    if (filter !== 'all' && t.plan !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!t.name?.toLowerCase().includes(q) && !t.domain?.toLowerCase().includes(q)) return false
    }
    return true
  })

  const changePlan = async (tenantId: string, newPlan: string) => {
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
      <div className="page-header">
        <h1 className="page-title">Plans & Pricing</h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: 0 }}>
          Click <strong>✏ Edit</strong> on any plan card to update its price, name, or feature list.
        </p>
      </div>

      {/* Summary strip */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Monthly Recurring Revenue', value: `$${totalMrr.toLocaleString()}`, sub: `ARR $${(totalMrr * 12).toLocaleString()}` },
          { label: 'Active Tenants',             value: totalActive },
          { label: 'Trial Tenants',              value: totalTrial  },
          { label: 'Total Tenants',              value: tenants.length },
        ].map(s => (
          <div key={s.label} className="card" style={{ flex: '1 1 150px', minWidth: 140, padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>{s.label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{s.value}</div>
            {s.sub && <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Plan cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        {plans.map(plan => (
          <PlanCard
            key={plan.key}
            plan={plan}
            tenantCount={stats[plan.key]?.count ?? 0}
            mrr={stats[plan.key]?.mrr ?? 0}
            totalMrr={totalMrr}
            isFiltered={filter === plan.key}
            onFilter={() => setFilter(filter === plan.key ? 'all' : plan.key)}
          />
        ))}
      </div>

      {/* Tenant table */}
      <div className="card">
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <h2 style={{ fontWeight: 600, margin: 0, flex: 1 }}>
            Tenants
            {filter !== 'all' && (
              <span style={{ fontSize: '0.8rem', fontWeight: 400, marginLeft: '0.5rem', color: 'var(--muted)' }}>
                — filtered by {filter}
              </span>
            )}
          </h2>
          <input
            type="search" placeholder="Search name or domain…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: 220 }}
          />
          <select value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All plans</option>
            {plans.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
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
                const planDef = plans.find(p => p.key === t.plan)
                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.65rem 0.75rem', fontWeight: 500 }}>
                      <a href={`/tenants/${t.id}`} style={{ color: 'inherit', textDecoration: 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                        onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
                        {t.name}
                      </a>
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', color: 'var(--muted)', fontFamily: 'monospace', fontSize: '0.8rem' }}>{t.domain}</td>
                    <td style={{ padding: '0.65rem 0.75rem' }}>
                      <span style={{
                        background: planDef?.accentColor, color: planDef?.color,
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
                            onChange={e => changePlan(t.id, e.target.value)}
                            style={{ fontSize: '0.82rem', padding: '0.25rem 0.5rem' }}
                          >
                            {plans.map(p => (
                              <option key={p.key} value={p.key}>→ {p.label} ${p.price}</option>
                            ))}
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
