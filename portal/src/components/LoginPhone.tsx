import { useState } from 'react'
import axios from 'axios'

interface Props {
  mac: string
  termsText: string
  onSuccess: (redirectUrl: string) => void
}

export default function LoginPhone({ mac, termsText, onSuccess }: Props) {
  const [step,    setStep]    = useState<'phone' | 'otp'>('phone')
  const [name,    setName]    = useState('')
  const [phone,   setPhone]   = useState('')
  const [otp,     setOtp]     = useState('')
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!consent) { setError('Please accept the terms to continue.'); return }
    setError(''); setLoading(true)

    try {
      await axios.post('/portal/auth/phone', { phone, name })
      setStep('otp')
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Failed to send OTP.')
    } finally {
      setLoading(false)
    }
  }

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setLoading(true)

    try {
      const { data } = await axios.post('/portal/auth/otp/verify', { phone, otp, name, mac })
      onSuccess(data.redirectUrl)
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Invalid OTP. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'otp') {
    return (
      <form onSubmit={verifyOtp}>
        <div className="otp-sent">📱 Code sent to {phone}</div>
        {error && <div className="error-msg">{error}</div>}
        <div className="form-group">
          <label htmlFor="otp">Enter 6-digit code</label>
          <input id="otp" type="number" value={otp} onChange={e => setOtp(e.target.value)}
            placeholder="123456" maxLength={6} required style={{ fontSize: '1.5rem', letterSpacing: '0.25em', textAlign: 'center' }} />
        </div>
        <button type="submit" className="btn" disabled={loading || otp.length !== 6}>
          {loading ? <div className="spinner" /> : 'Verify & Connect'}
        </button>
        <button type="button" className="btn btn-outline" style={{ marginTop: '0.75rem' }}
          onClick={() => { setStep('phone'); setOtp(''); setError('') }}>
          ← Change number
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={requestOtp}>
      {error && <div className="error-msg">{error}</div>}

      <div className="form-group">
        <label htmlFor="pname">Your Name</label>
        <input id="pname" type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="John Smith" required />
      </div>

      <div className="form-group">
        <label htmlFor="phone">Phone Number</label>
        <input id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)}
          placeholder="+254712345678" required />
        <p style={{ fontSize: '0.78rem', color: '#888', marginTop: '0.25rem' }}>
          Include country code, e.g. +254 for Kenya
        </p>
      </div>

      <div className="consent">
        <input type="checkbox" id="consent-p" checked={consent} onChange={e => setConsent(e.target.checked)} />
        <label htmlFor="consent-p" style={{ fontWeight: 400, marginBottom: 0 }}>{termsText}</label>
      </div>

      <button type="submit" className="btn" disabled={loading}>
        {loading ? <div className="spinner" /> : 'Send Code'}
      </button>
    </form>
  )
}
