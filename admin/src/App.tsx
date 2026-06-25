import { useState, createContext, useContext, useEffect, ReactNode } from 'react'
import { Routes, Route, Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import api from './lib/api'
import Tenants from './pages/Tenants'
import TenantDetail from './pages/TenantDetail'
import Billing from './pages/Billing'

/* ---- Auth context ---- */
interface AuthCtx { user: any; loading: boolean; login: (e: string, p: string) => Promise<void>; logout: () => void }
const Ctx = createContext<AuthCtx>(null!)
const useAuth = () => useContext(Ctx)

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/auth/me').then(r => setUser(r.data)).catch(() => setUser(null)).finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password })
    if (data.user.role !== 'super_admin') throw new Error('Not authorized')
    localStorage.setItem('sa_token', data.accessToken)
    setUser(data.user)
  }

  const logout = () => { localStorage.removeItem('sa_token'); setUser(null) }

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>
}

/* ---- Sidebar layout ---- */
const navItems = [
  { to: '/tenants', icon: '🏢', label: 'Tenants' },
  { to: '/billing',  icon: '💳', label: 'Billing' },
]

function Layout() {
  const { user, logout } = useAuth()
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">⚙️ Super Admin</div>
        <nav className="sidebar-nav">
          {navItems.map(n => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <span>{n.icon}</span><span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>{user?.email}</div>
          <button className="btn btn-ghost btn-sm" onClick={logout} style={{ width: '100%' }}>Sign out</button>
        </div>
      </aside>
      <main className="main"><Outlet /></main>
    </div>
  )
}

/* ---- Login page ---- */
function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const { login }  = useAuth()
  const navigate   = useNavigate()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    try { await login(email, password); navigate('/tenants') }
    catch (err: any) { setError(err.response?.data?.error ?? err.message ?? 'Login failed.') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="card" style={{ maxWidth: 360, width: '100%' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.5rem' }}>Super Admin Sign In</h1>
        {error && <div style={{ background: '#FEF2F2', color: '#B91C1C', borderRadius: 8, padding: '0.6rem 0.75rem', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</div>}
        <form onSubmit={submit}>
          <div className="form-group"><label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
          <div className="form-group"><label>Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? <span className="spinner-sm" /> : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

/* ---- Guard ---- */
function Require({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><span className="spinner-sm" /></div>
  return user?.role === 'super_admin' ? <>{children}</> : <Navigate to="/login" replace />
}

/* ---- App ---- */
export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Require><Layout /></Require>}>
          <Route index element={<Navigate to="/tenants" replace />} />
          <Route path="tenants"          element={<Tenants />} />
          <Route path="tenants/:id"      element={<TenantDetail />} />
          <Route path="billing"          element={<Billing />} />
        </Route>
        <Route path="*" element={<Navigate to="/tenants" replace />} />
      </Routes>
    </AuthProvider>
  )
}
