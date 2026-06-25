import { useEffect, useState, useRef } from 'react'
import api from '../lib/api'

interface Session {
  id: string
  macAddress: string
  deviceType: string
  loginMethod: string
  grantedAt: string
  durationMinutes: number
  customer?: { name: string; email: string }
}

export default function LiveView() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading,  setLoading]  = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  const fetch = () =>
    api.get('/analytics/live')
      .then(r => setSessions(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))

  useEffect(() => {
    fetch()
    intervalRef.current = setInterval(fetch, 10_000) // refresh every 10 s
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
        <span className="badge badge-green" style={{ fontSize: '0.8rem' }}>● {sessions.length} online</span>
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
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{s.customer?.name ?? '—'}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{s.customer?.email ?? ''}</div>
                  </td>
                  <td><code style={{ fontSize: '0.8rem' }}>{s.macAddress}</code></td>
                  <td>{s.deviceType}</td>
                  <td><span className={`badge ${methodBadge[s.loginMethod] ?? 'badge-gray'}`}>{s.loginMethod}</span></td>
                  <td>{new Date(s.grantedAt).toLocaleTimeString()}</td>
                  <td>{s.durationMinutes} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
