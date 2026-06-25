import { useEffect, useState, useCallback } from 'react'
import api from '../lib/api'

interface Customer {
  id: string
  name: string
  email: string
  phone: string
  loginMethod: string
  visitCount: number
  lastSeen: string
  tags: string[]
}

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [total,     setTotal]     = useState(0)
  const [page,      setPage]      = useState(1)
  const [search,    setSearch]    = useState('')
  const [loading,   setLoading]   = useState(true)

  const PAGE_SIZE = 20

  const load = useCallback(() => {
    setLoading(true)
    api.get('/customers', { params: { page, limit: PAGE_SIZE, search } })
      .then(r => { setCustomers(r.data.data ?? []); setTotal(r.data.meta?.total ?? 0) })
      .finally(() => setLoading(false))
  }, [page, search])

  useEffect(() => { load() }, [load])

  // Reset to page 1 when search changes
  useEffect(() => { setPage(1) }, [search])

  const exportCsv = async () => {
    const { data } = await api.get('/customers/export', { responseType: 'blob' })
    const url  = URL.createObjectURL(data)
    const link = document.createElement('a')
    link.href = url; link.download = 'customers.csv'; link.click()
    URL.revokeObjectURL(url)
  }

  const deleteCustomer = async (id: string) => {
    if (!confirm('Delete this customer? This cannot be undone.')) return
    await api.delete(`/customers/${id}`)
    load()
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Customers <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--muted)' }}>({total.toLocaleString()})</span></h1>
        <button className="btn btn-outline btn-sm" onClick={exportCsv}>⬇ Export CSV</button>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <input type="search" placeholder="Search by name, email, or phone…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 360 }} />
      </div>

      {loading ? <span className="spinner-sm" /> : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Method</th>
                  <th>Visits</th>
                  <th>Last Seen</th>
                  <th>Tags</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>No customers found.</td></tr>
                ) : customers.map(c => (
                  <tr key={c.id}>
                    <td><span style={{ fontWeight: 500 }}>{c.name || '—'}</span></td>
                    <td>
                      <div>{c.email || '—'}</div>
                      {c.phone && <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{c.phone}</div>}
                    </td>
                    <td><span className="badge badge-blue">{c.loginMethod}</span></td>
                    <td>{c.visitCount}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(c.lastSeen).toLocaleDateString()}</td>
                    <td>
                      {c.tags.map(tag => (
                        <span key={tag} className="badge badge-gray" style={{ marginRight: 4 }}>{tag}</span>
                      ))}
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => deleteCustomer(c.id)}
                        title="Delete (GDPR)" style={{ color: 'var(--danger)' }}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem', alignItems: 'center' }}>
              <button className="btn btn-outline btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Page {page} of {totalPages}</span>
              <button className="btn btn-outline btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
