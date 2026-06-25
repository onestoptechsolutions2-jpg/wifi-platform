import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../lib/api'

interface Summary {
  totalCustomers:    number
  todayLogins:       number
  liveVisitors:      number
  newCustomersToday: number
}
interface TrendPoint { date: string; sessions: number; newCustomers: number }

export default function Overview() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [trends,  setTrends]  = useState<TrendPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/analytics/summary'),
      api.get('/analytics/trends?days=14'),
    ]).then(([s, t]) => {
      setSummary(s.data)
      setTrends(t.data.trend ?? [])   // backend returns { days, trend: [...] }
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="page"><span className="spinner-sm" /></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Overview</h1>
      </div>

      <div className="stat-grid">
        {[
          { label: 'Total Customers', value: summary?.totalCustomers    ?? 0, sub: 'all time' },
          { label: 'Logins Today',    value: summary?.todayLogins       ?? 0, sub: 'last 24 h' },
          { label: 'Live Visitors',   value: summary?.liveVisitors      ?? 0, sub: 'right now' },
          { label: 'New Today',       value: summary?.newCustomersToday ?? 0, sub: 'first visit' },
        ].map(s => (
          <div key={s.label} className="card stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{(s.value ?? 0).toLocaleString()}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem' }}>Sessions — last 14 days</h2>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={trends}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="sessions"     stroke="#1B5FAD" strokeWidth={2} dot={false} name="Sessions" />
            <Line type="monotone" dataKey="newCustomers" stroke="#16A34A" strokeWidth={2} dot={false} name="New Customers" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
