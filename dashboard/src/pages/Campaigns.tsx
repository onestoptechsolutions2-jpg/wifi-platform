import { useEffect, useState } from 'react'
import api from '../lib/api'

interface Campaign {
  id: string
  type: 'email' | 'sms'
  status: 'draft' | 'sending' | 'sent' | 'failed'
  subject: string
  recipientCount: number
  deliveredCount: number
  scheduledAt: string | null
  createdAt: string
}

const statusBadge: Record<string, string> = {
  draft: 'badge-gray', sending: 'badge-orange', sent: 'badge-green', failed: 'badge-red'
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)

  // New campaign form state
  const [form, setForm] = useState({ type: 'email', subject: '', body: '', scheduledAt: '' })
  const [saving, setSaving] = useState(false)

  const load = () =>
    api.get('/campaigns')
      .then(r => setCampaigns(r.data))
      .finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  const send = async (id: string) => {
    if (!confirm('Send this campaign now?')) return
    await api.post(`/campaigns/${id}/send`)
    load()
  }

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/campaigns', form)
      setShowForm(false)
      setForm({ type: 'email', subject: '', body: '', scheduledAt: '' })
      load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Campaigns</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v => !v)}>
          {showForm ? '✕ Cancel' : '+ New Campaign'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontWeight: 600, marginBottom: '1rem' }}>New Campaign</h2>
          <form onSubmit={create}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Type</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                </select>
              </div>
              <div className="form-group">
                <label>Schedule (optional)</label>
                <input type="text" placeholder="ISO date or leave blank to send now"
                  value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} />
              </div>
            </div>
            {form.type === 'email' && (
              <div className="form-group">
                <label>Subject</label>
                <input type="text" value={form.subject} required
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder="e.g. Come back for a free coffee!" />
              </div>
            )}
            <div className="form-group">
              <label>Message Body</label>
              <textarea rows={4} value={form.body} required
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                placeholder="Hi {{name}}, we miss you! Visit us this week for a special offer." />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? <span className="spinner-sm" /> : 'Create Campaign'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <span className="spinner-sm" /> : campaigns.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon">📣</div>
          <p>No campaigns yet. Create your first one!</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Subject / Body</th>
                <th>Type</th>
                <th>Status</th>
                <th>Recipients</th>
                <th>Delivered</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => (
                <tr key={c.id}>
                  <td style={{ maxWidth: 280 }}>
                    <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.subject || '(SMS)'}
                    </div>
                  </td>
                  <td><span className="badge badge-blue">{c.type.toUpperCase()}</span></td>
                  <td><span className={`badge ${statusBadge[c.status]}`}>{c.status}</span></td>
                  <td>{c.recipientCount ?? '—'}</td>
                  <td>{c.deliveredCount ?? '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td>
                    {c.status === 'draft' && (
                      <button className="btn btn-primary btn-sm" onClick={() => send(c.id)}>Send</button>
                    )}
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
