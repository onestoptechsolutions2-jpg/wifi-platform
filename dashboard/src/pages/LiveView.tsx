import { useEffect, useState, useRef } from 'react'
import api from '../lib/api'

interface Session {
  id: string
  mac: string
  deviceType: string
  loginMethod: string
  grantedAt: string
  expiresAt: string
  customer?: { name: string; email: string } | null
}

export default function LiveView() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [count,    setCount]    = useState(0)
  const [loading,  setLoading]  = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  const load = () =>
    api.get('/analytics/live')
      .then(r => {
        setSessions(r.data.sessions ?? [])   // backend: { count, byLoginMethod, sessions }
        setCount(r.data.count ?? 0)
      })
      .catch(() => {})
      .finally(() => setLoading(false))

  useEffect(() => {
    load()
    intervalRef.current = setInterval(load, 10_000)
    return () => clearInterval(intervalRef.current)
  }, [])

  const methodBadge: Record<string, string> = {
    email: 'badge-blue', phone: 'badge-green', google: 'badge-orange',
    facebook: 'badge-orange', clickthrough: 'badge-gray',
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Live View <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--muted)' }}>— auto-refreshes every 10 s</span></h1>
        <span className="badge badge-green" style={{ fontSize: '0.8rem' }}>● {count} online</span>
      </div>

      {loading ? (
        <span className="spinner-sm" />
      ) : sessions.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon">📡</div>
          <p>No active sessions right now.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>MAC Address</th>
                <th>Device</th>
                <th>Login Method</th>
                <th>Connected At</th>
                <th>Expires At</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{s.customer?.name ?? '—'}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{s.customer?.email ?? ''}</div>
                  </td>
                  <td><code style={{ fontSize: '0.8rem' }}>{s.mac}</code></td>
                  <td>{s.deviceType ?? '—'}</td>
                  <td><span className={`badge ${methodBadge[s.loginMethod] ?? 'badge-gray'}`}>{s.loginMethod}</span></td>
                  <td>{new Date(s.grantedAt).toLocaleTimeString()}</td>
                  <td>{new Date(s.expiresAt).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
