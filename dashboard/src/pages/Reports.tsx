import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import api from '../lib/api'

const COLORS = ['#1B5FAD', '#16A34A', '#F59E0B', '#DC2626', '#8B5CF6']

export default function Reports() {
  const [trends,  setTrends]  = useState<any[]>([])
  const [methods, setMethods] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [days,    setDays]    = useState(30)

  useEffect(() => {
    setLoading(true)
    api.get(`/analytics/trends?days=${days}`)
      .then(r => {
        const trend: any[] = r.data.trend ?? []   // backend: { days, trend: [...] }
        setTrends(trend)
        const methodMap: Record<string, number> = {}
        trend.forEach((d: any) => {
          Object.entries(d.byMethod ?? {}).forEach(([m, count]) => {
            methodMap[m] = (methodMap[m] ?? 0) + (count as number)
          })
        })
        setMethods(Object.entries(methodMap).map(([name, value]) => ({ name, value })))
      })
      .finally(() => setLoading(false))
  }, [days])

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
        <select value={days} onChange={e => setDays(Number(e.target.value))} style={{ width: 'auto' }}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {loading ? <span className="spinner-sm" /> : (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
          <div className="card">
            <h2 style={{ fontWeight: 600, marginBottom: '1.25rem' }}>Daily Sessions</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="sessions"     fill="#1B5FAD" radius={[4,4,0,0]} name="Sessions" />
                <Bar dataKey="newCustomers" fill="#16A34A" radius={[4,4,0,0]} name="New Customers" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h2 style={{ fontWeight: 600, marginBottom: '1.25rem' }}>Login Methods</h2>
            {methods.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={methods} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={90}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {methods.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
