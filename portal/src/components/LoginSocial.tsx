import { useState } from 'react'
import axios from 'axios'

interface Props {
  mac: string
  termsText: string
  showGoogle: boolean
  showFacebook: boolean
  onSuccess: (redirectUrl: string) => void
}

declare global {
  interface Window {
    google?: any
    FB?: any
  }
}

export default function LoginSocial({ mac, termsText, showGoogle, showFacebook, onSuccess }: Props) {
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState<'google' | 'facebook' | null>(null)
  const [error,   setError]   = useState('')

  const exchange = async (provider: 'google' | 'facebook', token: string) => {
    const { data } = await axios.post('/portal/auth/social', { provider, token, mac })
    onSuccess(data.redirectUrl)
  }

  const handleGoogle = () => {
    if (!consent) { setError('Please accept the terms to continue.'); return }
    setError(''); setLoading('google')

    window.google?.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: async (response: any) => {
        try {
          await exchange('google', response.credential)
        } catch (err: any) {
          setError(err.response?.data?.error ?? 'Google sign-in failed.')
        } finally {
          setLoading(null)
        }
      },
    })
    window.google?.accounts.id.prompt()
  }

  const handleFacebook = () => {
    if (!consent) { setError('Please accept the terms to continue.'); return }
    setError(''); setLoading('facebook')

    window.FB?.login(async (res: any) => {
      if (res.status === 'connected') {
        try {
          await exchange('facebook', res.authResponse.accessToken)
        } catch (err: any) {
          setError(err.response?.data?.error ?? 'Facebook sign-in failed.')
        }
      } else {
        setError('Facebook sign-in was cancelled.')
      }
      setLoading(null)
    }, { scope: 'public_profile,email' })
  }

  return (
    <div>
      {error && <div className="error-msg">{error}</div>}

      <div className="consent" style={{ marginBottom: '1.25rem' }}>
        <input type="checkbox" id="consent-s" checked={consent} onChange={e => setConsent(e.target.checked)} />
        <label htmlFor="consent-s" style={{ fontWeight: 400, marginBottom: 0 }}>{termsText}</label>
      </div>

      {showGoogle && (
        <button className="btn btn-social" onClick={handleGoogle} disabled={loading !== null}>
          {loading === 'google'
            ? <div className="spinner" style={{ borderTopColor: '#4285F4', borderColor: '#e0e0e0' }} />
            : <>
                <svg width="20" height="20" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Continue with Google
              </>
          }
        </button>
      )}

      {showGoogle && showFacebook && <div className="divider">or</div>}

      {showFacebook && (
        <button className="btn btn-social" onClick={handleFacebook} disabled={loading !== null}>
          {loading === 'facebook'
            ? <div className="spinner" style={{ borderTopColor: '#1877F2', borderColor: '#e0e0e0' }} />
            : <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Continue with Facebook
              </>
          }
        </button>
      )}
    </div>
  )
}
