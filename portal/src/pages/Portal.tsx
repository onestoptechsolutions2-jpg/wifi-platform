import { useState } from 'react'
import type { TenantConfig, PortalParams } from '../types'
import LoginEmail from '../components/LoginEmail'
import LoginPhone from '../components/LoginPhone'
import LoginSocial from '../components/LoginSocial'
import LoginClickthrough from '../components/LoginClickthrough'

interface Props {
  config: TenantConfig
  params: PortalParams
}

type Tab = 'email' | 'phone' | 'social' | 'clickthrough'

export default function Portal({ config, params }: Props) {
  const { branding, loginMethods, googleClientId, facebookAppId } = config

  // Determine available tabs
  const tabs: { id: Tab; label: string }[] = [
    loginMethods.email        && { id: 'email' as Tab,        label: 'Email' },
    loginMethods.phone        && { id: 'phone' as Tab,        label: 'Phone' },
    (loginMethods.google || loginMethods.facebook) && { id: 'social' as Tab, label: 'Social' },
    loginMethods.clickthrough && { id: 'clickthrough' as Tab, label: 'Guest' },
  ].filter(Boolean) as { id: Tab; label: string }[]

  const [activeTab, setActiveTab] = useState<Tab>(tabs[0]?.id ?? 'email')
  const [success, setSuccess] = useState(false)

  const handleSuccess = (redirectUrl: string) => {
    setSuccess(true)
    setTimeout(() => { window.location.href = redirectUrl }, 1500)
  }

  if (success) {
    return (
      <div className="card" style={{ textAlign: 'center' }}>
        {branding.logoUrl && <img src={branding.logoUrl} alt="logo" className="logo" />}
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
        <h2 className="headline">You're connected!</h2>
        <p className="subheadline">Redirecting you now...</p>
      </div>
    )
  }

  return (
    <div className="card">
      {branding.logoUrl && (
        <img src={branding.logoUrl} alt={config.name} className="logo" />
      )}

      <h1 className="headline">{branding.headline}</h1>
      <p className="subheadline">{branding.subheadline}</p>

      {/* Tab switcher — only show if more than 1 method */}
      {tabs.length > 1 && (
        <div className="tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Login forms */}
      {activeTab === 'email' && loginMethods.email && (
        <LoginEmail mac={params.mac} tok={params.tok} termsText={branding.termsText} onSuccess={handleSuccess} />
      )}
      {activeTab === 'phone' && loginMethods.phone && (
        <LoginPhone mac={params.mac} tok={params.tok} termsText={branding.termsText} onSuccess={handleSuccess} />
      )}
      {activeTab === 'social' && (
        <LoginSocial
          mac={params.mac}
          tok={params.tok}
          termsText={branding.termsText}
          showGoogle={loginMethods.google}
          showFacebook={loginMethods.facebook}
          googleClientId={googleClientId}
          facebookAppId={facebookAppId}
          onSuccess={handleSuccess}
        />
      )}
      {activeTab === 'clickthrough' && loginMethods.clickthrough && (
        <LoginClickthrough mac={params.mac} tok={params.tok} termsText={branding.termsText} onSuccess={handleSuccess} />
      )}
    </div>
  )
}
