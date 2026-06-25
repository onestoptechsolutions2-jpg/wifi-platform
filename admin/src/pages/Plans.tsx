import { useEffect, useState, useRef } from 'react'
import api from '../lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlanDef {
  key: string; label: string; price: number; currency: string
  color: string; accentColor: string; features: string[]
  missing: string[]; isActive: boolean; sortOrder: number
}

interface Currency { code: string; symbol: string; name: string }

interface PlatformSettings {
  defaultCurrency?: string
  platformName?: string
  supportEmail?: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const BLANK_PLAN: Omit<PlanDef, 'key'> = {
  label: '', price: 0, currency: 'USD', color: '#1B5FAD',
  accentColor: '#EFF6FF', features: [], missing: [], isActive: true, sortOrder: 99,
}

// ── Small components ───────────────────────────────────────────────────────────

function TagEditor({ label, items, color, sign, onChange }: {
  label: string; items: string[]; color: string; sign: '✓' | '✗'
  onChange: (v: string[]) => void
}) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const v = draft.trim(); if (!v) return
    onChange([...items, v]); setDraft('')
  }
  return (
    <div>
      <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>{label}</div>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.25rem' }}>
          <span style={{ color: sign === '✓' ? color : 'var(--muted)', fontSize: '0.75rem', flexShrink: 0 }}>{sign}</span>
          <span style={{ fontSize: '0.8rem', flex: 1 }}>{item}</span>
          <button onClick={() => onChange(items.filter((_, j) => j !== i))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.7rem', lineHeight: 1 }}>✕</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.3rem' }}>
        <input value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={`Add item…`} style={{ flex: 1, fontSize: '0.77rem', padding: '0.2rem 0.4rem' }} />
        <button onClick={add} className="btn btn-outline btn-sm"
          style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderColor: color, color }}>+</button>
      </div>
    </div>
  )
}

function CurrencySelect({ value, currencies, onChange, style }: {
  value: string; currencies: Currency[]; onChange: (v: string) => void; style?: React.CSSProperties
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={style}>
      {currencies.map(c => (
        <option key={c.code} value={c.code}>{c.code} — {c.name} ({c.symbol})</option>
      ))}
    </select>
  )
}

// ── Create plan modal ──────────────────────────────────────────────────────────

function CreatePlanModal({ currencies, onSave, onClose }: {
  currencies: Currency[]
  onSave: (plan: PlanDef) => void
  onClose: () => void
}) {
  const [form, setForm]   = useState({ key: '', ...BLANK_PLAN })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      const { data } = await api.post('/plans', form)
      onSave(data)
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Failed to create plan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div style={{ background: 'var(--surface)', borderRadius: 14, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Create New Plan</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--muted)' }}>✕</button>
        </div>
        <form onSubmit={submit} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {error && <div style={{ background: '#FEF2F2', color: '#B91C1C', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.83rem' }}>{error}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Plan Key <span style={{ color: '#ef4444' }}>*</span></label>
              <input placeholder="enterprise" value={form.key} required
                onChange={e => set('key', e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                style={{ fontFamily: 'monospace' }} />
              <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>lowercase, no spaces</span>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Label <span style={{ color: '#ef4444' }}>*</span></label>
              <input placeholder="Enterprise" value={form.label} required onChange={e => set('label', e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Price <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="number" min={0} step={0.01} value={form.price} required
                onChange={e => set('price', parseFloat(e.target.value) || 0)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Currency</label>
              <CurrencySelect value={form.currency} currencies={currencies} onChange={v => set('currency', v)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Sort Order</label>
              <input type="number" value={form.sortOrder} onChange={e => set('sortOrder', parseInt(e.target.value) || 99)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Main Colour</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input type="color" value={form.color} onChange={e => set('color', e.target.value)}
                  style={{ width: 36, height: 32, border: 'none', padding: 0, cursor: 'pointer' }} />
                <input value={form.color} onChange={e => set('color', e.target.value)} style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.82rem' }} />
              </div>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Accent Colour</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input type="color" value={form.accentColor} onChange={e => set('accentColor', e.target.value)}
                  style={{ width: 36, height: 32, border: 'none', padding: 0, cursor: 'pointer' }} />
                <input value={form.accentColor} onChange={e => set('accentColor', e.target.value)} style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.82rem' }} />
              </div>
            </div>
          </div>

          <TagEditor label="Included features" items={form.features} color={form.color} sign="✓"
            onChange={v => set('features', v)} />
          <TagEditor label="Not included" items={form.missing} color={form.color} sign="✗"
            onChange={v => set('missing', v)} />

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner-sm" /> : 'Create Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Plan card ──────────────────────────────────────────────────────────────────

function PlanCard({ plan, tenantCount, mrr, totalMrr, currencies, isFiltered, onFilter, onUpdated, onDeleted }: {
  plan: PlanDef; tenantCount: number; mrr: number; totalMrr: number
  currencies: Currency[]; isFiltered: boolean
  onFilter: () => void; onUpdated: (p: PlanDef) => void; onDeleted: () => void
}) {
  const [editing,  setEditing]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [error,    setError]    = useState('')
  const [draft,    setDraft]    = useState<PlanDef>(plan)
  const firstRender = useRef(true)

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    setDraft(plan)
  }, [plan])

  const set = (k: string, v: any) => setDraft(p => ({ ...p, [k]: v }))

  const save = async () => {
    setSaving(true); setError('')
    try {
      const { data } = await api.patch(`/plans/${plan.key}`, {
        label: draft.label, price: draft.price, currency: draft.currency,
        color: draft.color, accentColor: draft.accentColor,
        features: draft.features, missing: draft.missing,
        isActive: draft.isActive, sortOrder: draft.sortOrder,
      })
      onUpdated(data); setSaved(true); setEditing(false)
      setTimeout(() => setSaved(false), 2500)
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Save failed')
    } finally { setSaving(false) }
  }

  const deletePlan = async () => {
    if (!window.confirm(`Delete the "${plan.label}" plan? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await api.delete(`/plans/${plan.key}`)
      onDeleted()
    } catch (err: any) {
      alert(err.response?.data?.error ?? 'Delete failed')
    } finally { setDeleting(false) }
  }

  const sym = currencies.find(c => c.code === draft.currency)?.symbol ?? draft.currency

  return (
    <div className="card" style={{ borderTop: `4px solid ${draft.color}`, position: 'relative' }}>
      {/* actions bar */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem', justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center' }}>
        {saved && <span style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 600 }}>✓ Saved</span>}
        {!editing && (
          <>
            <button className="btn btn-outline btn-sm" onClick={() => setEditing(true)}
              style={{ fontSize: '0.7rem', padding: '0.2rem 0.55rem', borderColor: draft.color, color: draft.color }}>
              ✏ Edit
            </button>
            <button className="btn btn-outline btn-sm" onClick={deletePlan} disabled={deleting}
              style={{ fontSize: '0.7rem', padding: '0.2rem 0.55rem', borderColor: '#ef4444', color: '#ef4444' }}>
              {deleting ? '…' : '🗑'}
            </button>
          </>
        )}
        {editing && (
          <>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}
              style={{ fontSize: '0.7rem', padding: '0.2rem 0.55rem' }}>
              {saving ? '…' : 'Save'}
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => { setDraft(plan); setEditing(false) }}
              style={{ fontSize: '0.7rem', padding: '0.2rem 0.55rem' }}>
              Cancel
            </button>
          </>
        )}
      </div>

      {error && <div style={{ background: '#FEF2F2', color: '#B91C1C', borderRadius: 6, padding: '0.4rem 0.6rem', fontSize: '0.78rem', marginBottom: '0.5rem' }}>{error}</div>}

      {/* plan name / badge */}
      {editing ? (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
          <input value={draft.label} onChange={e => set('label', e.target.value)}
            style={{ fontWeight: 700, fontSize: '0.95rem', flex: 1 }} />
          <label style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <input type="checkbox" checked={draft.isActive} onChange={e => set('isActive', e.target.checked)} />
            Active
          </label>
        </div>
      ) : (
        <div style={{ marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{
            display: 'inline-block', background: draft.accentColor, color: draft.color,
            borderRadius: 6, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700,
            letterSpacing: '0.05em', textTransform: 'uppercase',
          }}>{draft.label}</span>
          {!draft.isActive && <span className="badge" style={{ fontSize: '0.65rem' }}>Inactive</span>}
        </div>
      )}

      {/* price + currency */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
        {editing ? (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
              <input type="color" value={draft.color} onChange={e => set('color', e.target.value)}
                title="Main colour" style={{ width: 28, height: 26, border: 'none', padding: 0, cursor: 'pointer' }} />
              <input type="color" value={draft.accentColor} onChange={e => set('accentColor', e.target.value)}
                title="Accent colour" style={{ width: 28, height: 26, border: 'none', padding: 0, cursor: 'pointer' }} />
            </div>
            <input type="number" min={0} step={0.01} value={draft.price}
              onChange={e => set('price', parseFloat(e.target.value) || 0)}
              style={{ width: 80, fontWeight: 700, fontSize: '1rem' }} />
            <CurrencySelect value={draft.currency} currencies={currencies} onChange={v => set('currency', v)}
              style={{ fontSize: '0.78rem' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>/mo</span>
          </div>
        ) : (
          <>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: draft.color }}>
              {sym}{draft.price.toLocaleString()}
              <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--muted)' }}>/mo</span>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{tenantCount}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>tenants</div>
            </div>
          </>
        )}
      </div>

      {/* MRR strip */}
      <div style={{ display: 'flex', gap: '0.75rem', padding: '0.5rem 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', marginBottom: '0.7rem', fontSize: '0.8rem' }}>
        {[
          ['MRR',    `$${mrr.toLocaleString()}`],
          ['ARR',    `$${(mrr*12).toLocaleString()}`],
          ['% MRR',  `${totalMrr ? Math.round((mrr/totalMrr)*100) : 0}%`],
        ].map(([lbl, val]) => (
          <div key={lbl} style={{ flex: 1 }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{lbl}</div>
            <div style={{ fontWeight: 700 }}>{val}</div>
          </div>
        ))}
      </div>

      {/* features */}
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <TagEditor label="Included" items={draft.features} color={draft.color} sign="✓"
            onChange={v => set('features', v)} />
          <TagEditor label="Not included" items={draft.missing} color={draft.color} sign="✗"
            onChange={v => set('missing', v)} />
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: '0.82rem', lineHeight: 1.8 }}>
          {draft.features.map(f => (
            <li key={f} style={{ display: 'flex', gap: '0.4rem' }}>
              <span style={{ color: draft.color, fontWeight: 700, flexShrink: 0 }}>✓</span> {f}
            </li>
          ))}
          {draft.missing.map(f => (
            <li key={f} style={{ display: 'flex', gap: '0.4rem', color: 'var(--muted)' }}>
              <span style={{ flexShrink: 0 }}>✗</span> {f}
            </li>
          ))}
        </ul>
      )}

      <button className="btn btn-outline btn-sm" onClick={onFilter}
        style={{ marginTop: '0.75rem', width: '100%', borderColor: draft.color, color: draft.color }}>
        {isFiltered ? 'Show all tenants' : `View ${tenantCount} tenant${tenantCount !== 1 ? 's' : ''}`}
      </button>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function Plans() {
  const [plans,       setPlans]       = useState<PlanDef[]>([])
  const [currencies,  setCurrencies]  = useState<Currency[]>([])
  const [settings,    setSettings]    = useState<PlatformSettings>({})
  const [tenants,     setTenants]     = useState<any[]>([])
  const [loading,     setLoading]     = useState(true)
  const [filter,      setFilter]      = useState<string>('all')
  const [search,      setSearch]      = useState('')
  const [savingTenant,setSavingTenant]= useState<string | null>(null)
  const [showCreate,  setShowCreate]  = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSaved,  setSettingsSaved]  = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/plans'),
      api.get('/plans/currencies'),
      api.get('/plans/settings'),
      api.get('/tenants'),
    ]).then(([pr, cr, sr, tr]) => {
      setPlans(pr.data)
      setCurrencies(cr.data)
      setSettings(sr.data)
      setTenants(tr.data)
    }).finally(() => setLoading(false))
  }, [])

  const stats = plans.reduce((acc, p) => {
    const inPlan = tenants.filter(t => t.plan === p.key && t.status !== 'suspended')
    acc[p.key] = { count: inPlan.length, mrr: inPlan.length * p.price }
    return acc
  }, {} as Record<string, { count: number; mrr: number }>)

  const totalMrr    = plans.reduce((s, p) => s + (stats[p.key]?.mrr ?? 0), 0)
  const totalActive = tenants.filter(t => t.status === 'active').length
  const totalTrial  = tenants.filter(t => t.status === 'trial').length

  const visible = tenants.filter(t => {
    if (filter !== 'all' && t.plan !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return t.name?.toLowerCase().includes(q) || t.domain?.toLowerCase().includes(q)
    }
    return true
  })

  const saveSettings = async () => {
    setSavingSettings(true)
    try {
      const data = await api.patch('/plans/settings', settings)
      setSettings(data.data)
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 2500)
    } finally { setSavingSettings(false) }
  }

  const changeTenantPlan = async (tenantId: string, plan: string) => {
    setSavingTenant(tenantId)
    try {
      await api.patch(`/tenants/${tenantId}`, { plan })
      setTenants(prev => prev.map(t => t.id === tenantId ? { ...t, plan } : t))
    } finally { setSavingTenant(null) }
  }

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { active: 'badge-green', trial: 'badge-blue', suspended: 'badge-red' }
    return <span className={`badge ${map[s] ?? ''}`}>{s}</span>
  }

  if (loading) return <div className="page"><span className="spinner-sm" /></div>

  return (
    <div className="page">
      <div className="page-header" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: '0.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%' }}>
          <h1 className="page-title" style={{ margin: 0 }}>Plans & Pricing</h1>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}
            style={{ marginLeft: 'auto' }}>
            + New Plan
          </button>
        </div>
      </div>

      {/* ── Platform settings strip ───────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '0.875rem 1rem' }}>
        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 200 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
              Default Currency
            </label>
            <CurrencySelect
              value={settings.defaultCurrency ?? 'USD'}
              currencies={currencies}
              onChange={v => setSettings(p => ({ ...p, defaultCurrency: v }))}
              style={{ fontSize: '0.85rem' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: 160 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>Platform Name</label>
            <input value={settings.platformName ?? ''} onChange={e => setSettings(p => ({ ...p, platformName: e.target.value }))}
              placeholder="WiFi Marketing Platform" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: 160 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>Support Email</label>
            <input type="email" value={settings.supportEmail ?? ''} onChange={e => setSettings(p => ({ ...p, supportEmail: e.target.value }))}
              placeholder="support@platform.com" />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {settingsSaved && <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>✓ Saved</span>}
            <button className="btn btn-primary btn-sm" onClick={saveSettings} disabled={savingSettings}>
              {savingSettings ? <span className="spinner-sm" /> : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>

      {/* ── MRR Summary ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Monthly Recurring Revenue', value: `$${totalMrr.toLocaleString()}`, sub: `ARR $${(totalMrr*12).toLocaleString()}` },
          { label: 'Active Tenants',             value: totalActive },
          { label: 'Trial Tenants',              value: totalTrial  },
          { label: 'Total Tenants',              value: tenants.length },
        ].map(s => (
          <div key={s.label} className="card" style={{ flex: '1 1 140px', minWidth: 130, padding: '0.875rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '0.2rem' }}>{s.label}</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700 }}>{s.value}</div>
            {s.sub && <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Plan cards ────────────────────────────────────────────────── */}
      {plans.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
          <div>No plans yet. Click <strong>+ New Plan</strong> to create one.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
          {plans.map(plan => (
            <PlanCard
              key={plan.key}
              plan={plan}
              tenantCount={stats[plan.key]?.count ?? 0}
              mrr={stats[plan.key]?.mrr ?? 0}
              totalMrr={totalMrr}
              currencies={currencies}
              isFiltered={filter === plan.key}
              onFilter={() => setFilter(filter === plan.key ? 'all' : plan.key)}
              onUpdated={updated => setPlans(prev => prev.map(p => p.key === updated.key ? updated : p))}
              onDeleted={() => setPlans(prev => prev.filter(p => p.key !== plan.key))}
            />
          ))}
        </div>
      )}

      {/* ── Tenant table ──────────────────────────────────────────────── */}
      <div className="card">
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <h2 style={{ fontWeight: 600, margin: 0, flex: 1 }}>
            Tenants
            {filter !== 'all' && <span style={{ fontSize: '0.8rem', fontWeight: 400, marginLeft: '0.5rem', color: 'var(--muted)' }}>— {filter}</span>}
          </h2>
          <input type="search" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 200 }} />
          <select value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All plans</option>
            {plans.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                {['Tenant','Domain','Plan','Status','Next Bill','Change Plan'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--muted)', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>No tenants found</td></tr>
              )}
              {visible.map(t => {
                const pd = plans.find(p => p.key === t.plan)
                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.6rem 0.75rem', fontWeight: 500 }}>
                      <a href={`/tenants/${t.id}`} style={{ color: 'inherit', textDecoration: 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.textDecoration='underline')}
                        onMouseLeave={e => (e.currentTarget.style.textDecoration='none')}>
                        {t.name}
                      </a>
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', color: 'var(--muted)', fontFamily: 'monospace', fontSize: '0.78rem' }}>{t.domain}</td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>
                      <span style={{ background: pd?.accentColor ?? '#f3f4f6', color: pd?.color ?? '#374151', borderRadius: 5, padding: '2px 8px', fontSize: '0.73rem', fontWeight: 600 }}>
                        {t.plan}
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>{statusBadge(t.status)}</td>
                    <td style={{ padding: '0.6rem 0.75rem', color: 'var(--muted)', fontSize: '0.78rem' }}>
                      {t.nextBillDate ? new Date(t.nextBillDate).toLocaleDateString()
                        : t.lastPaidAt ? new Date(t.lastPaidAt).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>
                      {savingTenant === t.id ? <span className="spinner-sm" /> : (
                        <select value={t.plan} onChange={e => changeTenantPlan(t.id, e.target.value)}
                          style={{ fontSize: '0.8rem', padding: '0.2rem 0.4rem' }}>
                          {plans.map(p => (
                            <option key={p.key} value={p.key}>→ {p.label} {p.currency !== 'USD' ? p.currency : '$'}{p.price}</option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {visible.length > 0 && (
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.75rem', textAlign: 'right' }}>
            {visible.length} of {tenants.length} tenant{tenants.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {showCreate && (
        <CreatePlanModal
          currencies={currencies}
          onSave={plan => { setPlans(prev => [...prev, plan].sort((a,b) => a.sortOrder - b.sortOrder)); setShowCreate(false) }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}
