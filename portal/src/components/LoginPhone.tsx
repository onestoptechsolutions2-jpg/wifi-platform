import { useState } from 'react'
import axios from 'axios'

interface Props {
  mac:      string
  tok?:     string  // OpenWRT/nodogsplash auth token
  termsText: string
  onSuccess: (redirectUrl: string) => void
}

// ── Country codes — Africa first, then global ─────────────────────────────
interface Country { flag: string; name: string; dial: string }

const COUNTRIES: Country[] = [
  // ── East Africa ──────────────────────────────────────────────────────
  { flag: '🇰🇪', name: 'Kenya',           dial: '+254' },
  { flag: '🇹🇿', name: 'Tanzania',         dial: '+255' },
  { flag: '🇺🇬', name: 'Uganda',           dial: '+256' },
  { flag: '🇷🇼', name: 'Rwanda',           dial: '+250' },
  { flag: '🇪🇹', name: 'Ethiopia',         dial: '+251' },
  { flag: '🇧🇮', name: 'Burundi',          dial: '+257' },
  { flag: '🇩🇯', name: 'Djibouti',         dial: '+253' },
  { flag: '🇪🇷', name: 'Eritrea',          dial: '+291' },
  { flag: '🇸🇴', name: 'Somalia',          dial: '+252' },
  { flag: '🇸🇸', name: 'South Sudan',      dial: '+211' },
  // ── West Africa ──────────────────────────────────────────────────────
  { flag: '🇳🇬', name: 'Nigeria',          dial: '+234' },
  { flag: '🇬🇭', name: 'Ghana',            dial: '+233' },
  { flag: '🇸🇳', name: 'Senegal',          dial: '+221' },
  { flag: '🇨🇮', name: "Côte d'Ivoire",   dial: '+225' },
  { flag: '🇨🇲', name: 'Cameroon',         dial: '+237' },
  { flag: '🇲🇱', name: 'Mali',             dial: '+223' },
  { flag: '🇧🇫', name: 'Burkina Faso',     dial: '+226' },
  { flag: '🇹🇬', name: 'Togo',             dial: '+228' },
  { flag: '🇧🇯', name: 'Benin',            dial: '+229' },
  { flag: '🇳🇪', name: 'Niger',            dial: '+227' },
  { flag: '🇬🇳', name: 'Guinea',           dial: '+224' },
  { flag: '🇸🇱', name: 'Sierra Leone',     dial: '+232' },
  { flag: '🇱🇷', name: 'Liberia',          dial: '+231' },
  { flag: '🇬🇲', name: 'Gambia',           dial: '+220' },
  { flag: '🇬🇼', name: 'Guinea-Bissau',    dial: '+245' },
  { flag: '🇨🇻', name: 'Cape Verde',       dial: '+238' },
  { flag: '🇸🇹', name: 'São Tomé',         dial: '+239' },
  { flag: '🇬🇶', name: 'Eq. Guinea',       dial: '+240' },
  { flag: '🇲🇷', name: 'Mauritania',       dial: '+222' },
  // ── Central Africa ───────────────────────────────────────────────────
  { flag: '🇨🇩', name: 'DR Congo',         dial: '+243' },
  { flag: '🇨🇬', name: 'Congo',            dial: '+242' },
  { flag: '🇦🇴', name: 'Angola',           dial: '+244' },
  { flag: '🇬🇦', name: 'Gabon',            dial: '+241' },
  { flag: '🇨🇫', name: 'C. African Rep.',  dial: '+236' },
  { flag: '🇹🇩', name: 'Chad',             dial: '+235' },
  // ── Southern Africa ──────────────────────────────────────────────────
  { flag: '🇿🇦', name: 'South Africa',     dial: '+27'  },
  { flag: '🇿🇲', name: 'Zambia',           dial: '+260' },
  { flag: '🇿🇼', name: 'Zimbabwe',         dial: '+263' },
  { flag: '🇲🇼', name: 'Malawi',           dial: '+265' },
  { flag: '🇲🇿', name: 'Mozambique',       dial: '+258' },
  { flag: '🇳🇦', name: 'Namibia',          dial: '+264' },
  { flag: '🇧🇼', name: 'Botswana',         dial: '+267' },
  { flag: '🇱🇸', name: 'Lesotho',          dial: '+266' },
  { flag: '🇸🇿', name: 'Eswatini',         dial: '+268' },
  { flag: '🇲🇬', name: 'Madagascar',       dial: '+261' },
  { flag: '🇲🇺', name: 'Mauritius',        dial: '+230' },
  { flag: '🇸🇨', name: 'Seychelles',       dial: '+248' },
  { flag: '🇰🇲', name: 'Comoros',          dial: '+269' },
  // ── North Africa ─────────────────────────────────────────────────────
  { flag: '🇪🇬', name: 'Egypt',            dial: '+20'  },
  { flag: '🇩🇿', name: 'Algeria',          dial: '+213' },
  { flag: '🇲🇦', name: 'Morocco',          dial: '+212' },
  { flag: '🇹🇳', name: 'Tunisia',          dial: '+216' },
  { flag: '🇱🇾', name: 'Libya',            dial: '+218' },
  { flag: '🇸🇩', name: 'Sudan',            dial: '+249' },
  // ── Middle East ──────────────────────────────────────────────────────
  { flag: '🇦🇪', name: 'UAE',              dial: '+971' },
  { flag: '🇸🇦', name: 'Saudi Arabia',     dial: '+966' },
  { flag: '🇶🇦', name: 'Qatar',            dial: '+974' },
  { flag: '🇰🇼', name: 'Kuwait',           dial: '+965' },
  { flag: '🇧🇭', name: 'Bahrain',          dial: '+973' },
  { flag: '🇴🇲', name: 'Oman',             dial: '+968' },
  // ── Asia ─────────────────────────────────────────────────────────────
  { flag: '🇮🇳', name: 'India',            dial: '+91'  },
  { flag: '🇵🇰', name: 'Pakistan',         dial: '+92'  },
  { flag: '🇧🇩', name: 'Bangladesh',       dial: '+880' },
  { flag: '🇨🇳', name: 'China',            dial: '+86'  },
  { flag: '🇵🇭', name: 'Philippines',      dial: '+63'  },
  { flag: '🇮🇩', name: 'Indonesia',        dial: '+62'  },
  // ── Europe ───────────────────────────────────────────────────────────
  { flag: '🇬🇧', name: 'UK',               dial: '+44'  },
  { flag: '🇩🇪', name: 'Germany',          dial: '+49'  },
  { flag: '🇫🇷', name: 'France',           dial: '+33'  },
  { flag: '🇳🇱', name: 'Netherlands',      dial: '+31'  },
  // ── Americas ─────────────────────────────────────────────────────────
  { flag: '🇺🇸', name: 'USA / Canada',     dial: '+1'   },
  { flag: '🇧🇷', name: 'Brazil',           dial: '+55'  },
]

export default function LoginPhone({ mac, tok, termsText, onSuccess }: Props) {
  const [step,        setStep]     = useState<'phone' | 'otp'>('phone')
  const [name,        setName]     = useState('')
  const [dialCode,    setDialCode] = useState(COUNTRIES[0].dial) // default: Kenya +254
  const [localNumber, setLocal]    = useState('')
  const [otp,         setOtp]      = useState('')
  const [consent,     setConsent]  = useState(false)
  const [loading,     setLoading]  = useState(false)
  const [error,       setError]    = useState('')

  /** Full E.164 — strip leading zero then prepend dial code */
  const phone = dialCode + localNumber.replace(/^0+/, '').replace(/\D/g, '')

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!consent) { setError('Please accept the terms to continue.'); return }
    if (localNumber.replace(/\D/g, '').length < 6) {
      setError('Please enter a valid local phone number.')
      return
    }
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
      const { data } = await axios.post('/portal/auth/otp/verify', { phone, otp, name, mac, tok })
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
          <input
            id="otp" type="text" inputMode="numeric" pattern="[0-9]*"
            value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
            placeholder="123456" maxLength={6} required autoComplete="one-time-code"
            style={{ fontSize: '1.5rem', letterSpacing: '0.25em', textAlign: 'center' }}
          />
        </div>
        <button type="submit" className="btn" disabled={loading || otp.length !== 6}>
          {loading ? <div className="spinner" /> : 'Verify & Connect'}
        </button>
        <button
          type="button" className="btn btn-outline"
          style={{ marginTop: '0.75rem' }}
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
        <input
          id="pname" type="text" value={name}
          onChange={e => setName(e.target.value)}
          placeholder="John Smith" required
        />
      </div>

      <div className="form-group">
        <label htmlFor="phone-local">Phone Number</label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {/* Country dial code selector */}
          <select
            value={dialCode}
            onChange={e => setDialCode(e.target.value)}
            aria-label="Country code"
            style={{
              flexShrink: 0,
              width: '7.5rem',
              fontFamily: 'inherit',
              fontSize: '0.95rem',
              padding: '0.55rem 0.4rem',
              border: '1.5px solid var(--border, #ddd)',
              borderRadius: '8px',
              background: 'var(--surface, #fff)',
              color: 'inherit',
              cursor: 'pointer',
            }}
          >
            {COUNTRIES.map(c => (
              <option key={c.dial + c.name} value={c.dial}>
                {c.flag} {c.dial}
              </option>
            ))}
          </select>

          {/* Local number (leading zero removed automatically) */}
          <input
            id="phone-local"
            type="tel"
            inputMode="numeric"
            value={localNumber}
            onChange={e => setLocal(e.target.value)}
            placeholder="712 345 678"
            required
            style={{ flex: 1 }}
          />
        </div>
        <p style={{ fontSize: '0.78rem', color: '#888', marginTop: '0.3rem' }}>
          Full number: <strong>{phone || dialCode + '…'}</strong>
          &nbsp;· Leading zero removed automatically
        </p>
      </div>

      <div className="consent">
        <input
          type="checkbox" id="consent-p"
          checked={consent} onChange={e => setConsent(e.target.checked)}
        />
        <label htmlFor="consent-p" style={{ fontWeight: 400, marginBottom: 0 }}>{termsText}</label>
      </div>

      <button type="submit" className="btn" disabled={loading}>
        {loading ? <div className="spinner" /> : 'Send Code'}
      </button>
    </form>
  )
}
