import { useTenantConfig, usePortalParams } from './hooks/useTenantConfig'
import Portal from './pages/Portal'

export default function App() {
  const { config, loading, error } = useTenantConfig()
  const params = usePortalParams()

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <div className="spinner" style={{ borderTopColor: '#1B5FAD', borderColor: '#e0e0e0' }} />
        <p style={{ marginTop: '1rem', color: '#666' }}>Loading portal...</p>
      </div>
    )
  }

  if (error || !config) {
    return (
      <div className="card">
        <p className="error-msg">⚠️ {error ?? 'Portal unavailable. Please try again later.'}</p>
      </div>
    )
  }

  return <Portal config={config} params={params} />
}
