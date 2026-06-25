import { useEffect, useState } from 'react'
import api from '../lib/api'

// ── Types ──────────────────────────────────────────────────────────────────────

type Settings = Record<string, string>

// ── Helpers ────────────────────────────────────────────────────────────────────

const CURRENCIES = [
  'USD','EUR','GBP','KES','NGN','GHS','ZAR','UGX','TZS','RWF','ETB','XOF','INR','AED','CAD','AUD',
]

const TIMEZONES = [
  'UTC','Africa/Nairobi','Africa/Lagos','Africa/Accra','Africa/Johannesburg',
  'Africa/Kampala','Africa/Dar_es_Salaam','Africa/Kigali','Africa/Addis_Ababa',
  'Europe/London','Europe/Paris','America/New_York','America/Los_Angeles','Asia/Dubai','Asia/Kolkata',
]

/** A labelled input row */
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="form-group" style={{ marginBottom: '1rem' }}>
      <label style={{ fontWeight: 600 }}>{label}</label>
      {children}
      {hint && <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{hint}</span>}
    </div>
  )
}

/** A collapsible settings section card */
function Section({ title, icon, children, defaultOpen = false }: {
  title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card" style={{ marginBottom: '1rem', padding: 0, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.9rem 1.25rem', background: 'none', border: 'none', cursor: 'pointer',
          borderBottom: open ? '1px solid var(--border)' : 'none', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: '1.2rem' }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: '0.95rem', flex: 1 }}>{title}</span>
        <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={{ padding: '1.25rem' }}>{children}</div>}
    </div>
  )
}

/** Password-style field with show/hide and "currently set" indicator */
function SecretField({ label, hint, fieldKey, value, onChange }: {
  label: string; hint?: string; fieldKey: string
  value: string; onChange: (k: string, v: string) => void
}) {
  const [show, setShow] = useState(false)
  const isSet = value.startsWith('••••')

  return (
    <Field label={label} hint={hint}>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          placeholder={isSet ? 'Leave blank to keep existing' : 'Enter value…'}
          onChange={e => onChange(fieldKey, e.target.value)}
          style={{ paddingRight: '5.5rem' }}
        />
        <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {isSet && <span style={{ fontSize: '0.65rem', background: '#DCFCE7', color: '#166534', borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>SET</span>}
          <button type="button" onClick={() => setShow(s => !s)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '0.78rem' }}>
            {show ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>
    </Field>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function SystemSettings() {
  const [settings, setSettings] = useState<Settings>({})
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [error,    setError]    = useState('')

  useEffect(() => {
    api.get('/settings').then(r => setSettings(r.data)).finally(() => setLoading(false))
  }, [])

  const set = (key: string, value: string) => setSettings(p => ({ ...p, [key]: value }))

  const save = async () => {
    setSaving(true); setError('')
    try {
      const { data } = await api.patch('/settings', settings)
      setSettings(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const s = settings  // shorthand

  if (loading) return <div className="page"><span className="spinner-sm" /></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">System Settings</h1>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {saved && <span style={{ fontSize: '0.82rem', color: '#059669', fontWeight: 600 }}>✓ All settings saved</span>}
          {error && <span style={{ fontSize: '0.82rem', color: '#B91C1C' }}>{error}</span>}
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? <span className="spinner-sm" /> : 'Save All Settings'}
          </button>
        </div>
      </div>

      {/* ── 1. Platform ─────────────────────────────────────────────────────── */}
      <Section title="Platform" icon="🌐" defaultOpen>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1.5rem' }}>
          <Field label="Platform Name">
            <input value={s.platformName ?? ''} onChange={e => set('platformName', e.target.value)}
              placeholder="WiFi Marketing Platform" />
          </Field>
          <Field label="Support Email">
            <input type="email" value={s.supportEmail ?? ''} onChange={e => set('supportEmail', e.target.value)}
              placeholder="support@yourplatform.com" />
          </Field>
          <Field label="Logo URL">
            <input value={s.logoUrl ?? ''} onChange={e => set('logoUrl', e.target.value)}
              placeholder="https://cdn.example.com/logo.png" />
          </Field>
          <Field label="Default Currency">
            <select value={s.defaultCurrency ?? 'USD'} onChange={e => set('defaultCurrency', e.target.value)}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Timezone">
            <select value={s.timezone ?? 'UTC'} onChange={e => set('timezone', e.target.value)}>
              {TIMEZONES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        </div>
        {s.logoUrl && (
          <div style={{ marginTop: '0.5rem' }}>
            <img src={s.logoUrl} alt="logo preview" style={{ maxHeight: 48, maxWidth: 200, objectFit: 'contain' }} />
          </div>
        )}
      </Section>

      {/* ── 2. Email / SMTP ──────────────────────────────────────────────────── */}
      <Section title="Email (SMTP)" icon="📧">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1.5rem' }}>
          <Field label="SMTP Host">
            <input value={s.smtpHost ?? ''} onChange={e => set('smtpHost', e.target.value)}
              placeholder="smtp.gmail.com" />
          </Field>
          <Field label="SMTP Port">
            <input type="number" value={s.smtpPort ?? '587'} onChange={e => set('smtpPort', e.target.value)}
              placeholder="587" />
          </Field>
          <Field label="SMTP Username">
            <input value={s.smtpUser ?? ''} onChange={e => set('smtpUser', e.target.value)}
              placeholder="no-reply@yourplatform.com" />
          </Field>
          <SecretField label="SMTP Password" fieldKey="smtpPassword"
            value={s.smtpPassword ?? ''} onChange={set} />
          <Field label="From Email">
            <input type="email" value={s.smtpFromEmail ?? ''} onChange={e => set('smtpFromEmail', e.target.value)}
              placeholder="no-reply@yourplatform.com" />
          </Field>
          <Field label="From Name">
            <input value={s.smtpFromName ?? ''} onChange={e => set('smtpFromName', e.target.value)}
              placeholder="WiFi Platform" />
          </Field>
          <Field label="Encryption">
            <select value={s.smtpSecure ?? 'starttls'} onChange={e => set('smtpSecure', e.target.value)}>
              <option value="starttls">STARTTLS (port 587)</option>
              <option value="ssl">SSL/TLS (port 465)</option>
              <option value="none">None (port 25)</option>
            </select>
          </Field>
        </div>
      </Section>

      {/* ── 3. SMS ───────────────────────────────────────────────────────────── */}
      <Section title="SMS" icon="💬">
        <Field label="SMS Provider">
          <select value={s.smsProvider ?? 'none'} onChange={e => set('smsProvider', e.target.value)}>
            <option value="none">None (SMS disabled)</option>
            <option value="twilio">Twilio</option>
            <option value="africastalking">Africa's Talking</option>
          </select>
        </Field>

        {(s.smsProvider === 'twilio' || !s.smsProvider || s.smsProvider === 'none') && s.smsProvider === 'twilio' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1.5rem' }}>
            <Field label="Account SID">
              <input value={s.twilioAccountSid ?? ''} onChange={e => set('twilioAccountSid', e.target.value)}
                placeholder="ACxxxxxxxxxxxxxxxx" />
            </Field>
            <SecretField label="Auth Token" fieldKey="twilioAuthToken"
              value={s.twilioAuthToken ?? ''} onChange={set} />
            <Field label="From Number">
              <input value={s.twilioFromNumber ?? ''} onChange={e => set('twilioFromNumber', e.target.value)}
                placeholder="+12345678901" />
            </Field>
          </div>
        )}

        {s.smsProvider === 'africastalking' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1.5rem' }}>
            <Field label="Username">
              <input value={s.africasTalkingUsername ?? ''} onChange={e => set('africasTalkingUsername', e.target.value)}
                placeholder="sandbox" />
            </Field>
            <SecretField label="API Key" fieldKey="africasTalkingApiKey"
              value={s.africasTalkingApiKey ?? ''} onChange={set} />
            <Field label="Sender ID" hint="Leave blank to use default">
              <input value={s.africasTalkingSenderId ?? ''} onChange={e => set('africasTalkingSenderId', e.target.value)}
                placeholder="WIFIAPP" />
            </Field>
          </div>
        )}
      </Section>

      {/* ── 4. Payment Gateways ─────────────────────────────────────────────── */}
      <Section title="Payment Gateways" icon="💳">

        {/* Stripe */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ background: '#635BFF', color: '#fff', borderRadius: 4, padding: '1px 7px', fontSize: '0.72rem' }}>Stripe</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1.5rem' }}>
            <Field label="Publishable Key">
              <input value={s.stripePublishableKey ?? ''} onChange={e => set('stripePublishableKey', e.target.value)}
                placeholder="pk_live_..." />
            </Field>
            <SecretField label="Secret Key" fieldKey="stripeSecretKey"
              value={s.stripeSecretKey ?? ''} onChange={set} />
            <SecretField label="Webhook Secret" fieldKey="stripeWebhookSecret"
              value={s.stripeWebhookSecret ?? ''} onChange={set}
              hint="From Stripe Dashboard → Webhooks" />
          </div>
        </div>

        {/* Paystack */}
        <div style={{ marginBottom: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            <span style={{ background: '#00C3F7', color: '#fff', borderRadius: 4, padding: '1px 7px', fontSize: '0.72rem' }}>Paystack</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1.5rem' }}>
            <Field label="Public Key">
              <input value={s.paystackPublicKey ?? ''} onChange={e => set('paystackPublicKey', e.target.value)}
                placeholder="pk_live_..." />
            </Field>
            <SecretField label="Secret Key" fieldKey="paystackSecretKey"
              value={s.paystackSecretKey ?? ''} onChange={set} />
          </div>
        </div>

        {/* Flutterwave */}
        <div style={{ marginBottom: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            <span style={{ background: '#F5A623', color: '#fff', borderRadius: 4, padding: '1px 7px', fontSize: '0.72rem' }}>Flutterwave</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1.5rem' }}>
            <Field label="Public Key">
              <input value={s.flutterwavePublicKey ?? ''} onChange={e => set('flutterwavePublicKey', e.target.value)}
                placeholder="FLWPUBK_TEST-..." />
            </Field>
            <SecretField label="Secret Key" fieldKey="flutterwaveSecretKey"
              value={s.flutterwaveSecretKey ?? ''} onChange={set} />
          </div>
        </div>

        {/* M-Pesa */}
        <div style={{ marginBottom: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            <span style={{ background: '#00A651', color: '#fff', borderRadius: 4, padding: '1px 7px', fontSize: '0.72rem' }}>M-Pesa (Daraja)</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1.5rem' }}>
            <Field label="Consumer Key">
              <input value={s.mpesaConsumerKey ?? ''} onChange={e => set('mpesaConsumerKey', e.target.value)} />
            </Field>
            <SecretField label="Consumer Secret" fieldKey="mpesaConsumerSecret"
              value={s.mpesaConsumerSecret ?? ''} onChange={set} />
            <Field label="Shortcode (Paybill / Till)">
              <input value={s.mpesaShortcode ?? ''} onChange={e => set('mpesaShortcode', e.target.value)}
                placeholder="174379" />
            </Field>
            <SecretField label="Passkey" fieldKey="mpesaPasskey"
              value={s.mpesaPasskey ?? ''} onChange={set} />
            <Field label="Callback URL" hint="Must be HTTPS and publicly reachable">
              <input value={s.mpesaCallbackUrl ?? ''} onChange={e => set('mpesaCallbackUrl', e.target.value)}
                placeholder="https://api.yourplatform.com/billing/mpesa/callback" />
            </Field>
          </div>
        </div>

        {/* Pesapal */}
        <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            <span style={{ background: '#E31E24', color: '#fff', borderRadius: 4, padding: '1px 7px', fontSize: '0.72rem' }}>Pesapal</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1.5rem' }}>
            <Field label="Consumer Key">
              <input value={s.pesapalConsumerKey ?? ''} onChange={e => set('pesapalConsumerKey', e.target.value)} />
            </Field>
            <SecretField label="Consumer Secret" fieldKey="pesapalConsumerSecret"
              value={s.pesapalConsumerSecret ?? ''} onChange={set} />
            <Field label="IPN URL" hint="Instant Payment Notification endpoint">
              <input value={s.pesapalIpnUrl ?? ''} onChange={e => set('pesapalIpnUrl', e.target.value)}
                placeholder="https://api.yourplatform.com/billing/pesapal/ipn" />
            </Field>
          </div>
        </div>
      </Section>

      {/* ── 5. Security ──────────────────────────────────────────────────────── */}
      <Section title="Security" icon="🔒">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1.5rem' }}>
          <Field label="Session Timeout (hours)" hint="How long a login session stays valid">
            <input type="number" min={1} max={720}
              value={s.sessionTimeoutHours ?? '24'} onChange={e => set('sessionTimeoutHours', e.target.value)} />
          </Field>
          <Field label="Max Login Attempts" hint="Before account is temporarily locked">
            <input type="number" min={3} max={20}
              value={s.maxLoginAttempts ?? '5'} onChange={e => set('maxLoginAttempts', e.target.value)} />
          </Field>
        </div>
        <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'var(--bg)', borderRadius: 8, fontSize: '0.8rem', color: 'var(--muted)' }}>
          JWT secret, encryption key, and database credentials are managed via environment variables in Coolify and cannot be changed here.
        </div>
      </Section>

      {/* Floating save bar */}
      <div style={{ position: 'sticky', bottom: '1rem', display: 'flex', justifyContent: 'flex-end', pointerEvents: 'none' }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}
          style={{ pointerEvents: 'all', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          {saving ? <span className="spinner-sm" /> : 'Save All Settings'}
        </button>
      </div>
    </div>
  )
}
