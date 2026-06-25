import { useState } from 'react'
import axios from 'axios'

interface Props {
  mac: string
  termsText: string
  onSuccess: (redirectUrl: string) => void
}

export default function LoginEmail({ mac, termsText, onSuccess }: Props) {
  const [name,    setName]    = useState('')
  const [email,   setEmail]   = useState('')
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!consent) { setError('Please accept the terms to continue.'); return }
    setError(''); setLoading(true)

    try {
      const { data } = await axios.post('/portal/auth/email', { name, email, mac })
      onSuccess(data.redirectUrl)
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit}>
      {error && <div className="error-msg">{error}</div>}

      <div className="form-group">
        <label htmlFor="name">Your Name</label>
        <input id="name" type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="John Smith" required />
      </div>

      <div className="form-group">
        <label htmlFor="email">Email Address</label>
        <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com" required />
      </div>

      <div className="consent">
        <input type="checkbox" id="consent" checked={consent} onChange={e => setConsent(e.target.checked)} />
        <label htmlFor="consent" style={{ fontWeight: 400, marginBottom: 0 }}>{termsText}</label>
      </div>

      <button type="submit" className="btn" disabled={loading}>
        {loading ? <div className="spinner" /> : 'Connect to WiFi'}
      </button>
    </form>
  )
}
