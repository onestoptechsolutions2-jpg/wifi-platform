import { useState } from 'react'
import axios from 'axios'

interface Props {
  mac: string
  termsText: string
  onSuccess: (redirectUrl: string) => void
}

export default function LoginClickthrough({ mac, termsText, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const connect = async () => {
    setError(''); setLoading(true)
    try {
      const { data } = await axios.post('/portal/auth/clickthrough', { mac })
      onSuccess(data.redirectUrl)
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Connection failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ textAlign: 'center' }}>
      {error && <div className="error-msg">{error}</div>}

      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
        {termsText}
      </p>

      <button className="btn" onClick={connect} disabled={loading}>
        {loading ? <div className="spinner" /> : '🌐 Accept & Connect'}
      </button>
    </div>
  )
}
