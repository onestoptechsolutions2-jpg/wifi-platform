import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/Login'
import Overview from './pages/Overview'
import LiveView from './pages/LiveView'
import Customers from './pages/Customers'
import Campaigns from './pages/Campaigns'
import PortalSettings from './pages/PortalSettings'
import Reports from './pages/Reports'
import Billing from './pages/Billing'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}><span className="spinner-sm" /></div>
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Navigate to="/overview" replace />} />
        <Route path="overview"         element={<Overview />} />
        <Route path="live"             element={<LiveView />} />
        <Route path="customers"        element={<Customers />} />
        <Route path="campaigns"        element={<Campaigns />} />
        <Route path="portal-settings"  element={<PortalSettings />} />
        <Route path="reports"          element={<Reports />} />
        <Route path="billing"          element={<Billing />} />
      </Route>
      <Route path="*" element={<Navigate to="/overview" replace />} />
    </Routes>
  )
}

export default function App() {
  return <AuthProvider><AppRoutes /></AuthProvider>
}
