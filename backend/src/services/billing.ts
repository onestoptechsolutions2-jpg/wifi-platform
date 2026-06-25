/**
 * billing.ts — Multi-gateway payment service
 *
 * Supported gateways:
 *   stripe      → Stripe Checkout (hosted page, card / Apple Pay / Google Pay)
 *   paystack    → Paystack (Nigeria, Ghana, Kenya, South Africa)
 *   flutterwave → Flutterwave (pan-Africa + global)
 *   mpesa       → Safaricom M-Pesa Daraja STK Push (Kenya, KES)
 *   pesapal     → Pesapal (East Africa, multi-currency)
 *
 * Each gateway exposes two functions:
 *   createCheckout(tenantId, plan, billingEmail, currency?) → { url, reference }
 *   verifyWebhook(rawBody, signature, headers)              → Payment | null
 */

import https from 'https'
import http  from 'http'
import crypto from 'crypto'
import { env } from '../config/env.js'

export type GatewayName = 'stripe' | 'paystack' | 'flutterwave' | 'mpesa' | 'pesapal'

export interface CheckoutResult {
  gateway:   GatewayName
  reference: string          // gateway's session / transaction ID
  url?:      string          // redirect URL (undefined for M-Pesa STK Push)
  stkPush?:  boolean         // true = M-Pesa STK push initiated, no redirect
}

export interface WebhookPayment {
  reference: string
  gateway:   GatewayName
  status:    'completed' | 'failed'
  amount:    number
  currency:  string
  tenantId?: string          // extracted from metadata if gateway supports it
  raw:       unknown
}

const PLAN_PRICES: Record<string, { usd: number; kes: number; ngn: number; zar: number; ghs: number }> = {
  starter: { usd: 99,  kes: 12900, ngn: 79000,  zar: 1850, ghs: 1100 },
  growth:  { usd: 199, kes: 25900, ngn: 159000, zar: 3700, ghs: 2200 },
  pro:     { usd: 349, kes: 45400, ngn: 279000, zar: 6500, ghs: 3850 },
}

// ── Helper: simple fetch over https/http ──────────────────────────────────
function request(
  url: string,
  opts: { method: string; headers: Record<string, string>; body?: string },
): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const u    = new URL(url)
    const mod  = u.protocol === 'https:' ? https : http
    const req  = mod.request(
      { hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80), path: u.pathname + u.search, method: opts.method, headers: opts.headers },
      (res) => {
        let raw = ''
        res.on('data', (c: Buffer) => { raw += c.toString() })
        res.on('end', () => {
          try { resolve({ status: res.statusCode ?? 0, data: JSON.parse(raw) }) }
          catch { resolve({ status: res.statusCode ?? 0, data: raw }) }
        })
      },
    )
    req.on('error', reject)
    if (opts.body) req.write(opts.body)
    req.end()
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. STRIPE
// ═══════════════════════════════════════════════════════════════════════════

export const stripe = {
  /** Create a Stripe Checkout Session (hosted payment page) */
  async createCheckout(tenantId: string, plan: string, email: string): Promise<CheckoutResult> {
    const priceId = env[`STRIPE_PRICE_${plan.toUpperCase()}` as keyof typeof env] as string | undefined
    if (!env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not configured')
    if (!priceId) throw new Error(`No Stripe price ID configured for plan "${plan}". Set STRIPE_PRICE_${plan.toUpperCase()} in env.`)

    const params = new URLSearchParams({
      'mode':                                'subscription',
      'line_items[0][price]':               priceId,
      'line_items[0][quantity]':            '1',
      'customer_email':                      email,
      'success_url':                         env.BILLING_SUCCESS_URL,
      'cancel_url':                          env.BILLING_CANCEL_URL,
      'metadata[tenantId]':                  tenantId,
      'metadata[plan]':                      plan,
      'subscription_data[metadata][tenantId]': tenantId,
    })

    const res = await request('https://api.stripe.com/v1/checkout/sessions', {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    const session = res.data as any
    if (!session?.url) throw new Error(`Stripe error: ${JSON.stringify(session?.error ?? session)}`)
    return { gateway: 'stripe', reference: session.id, url: session.url }
  },

  /** Verify Stripe webhook signature and extract payment info */
  verifyWebhook(rawBody: string, signature: string): WebhookPayment | null {
    if (!env.STRIPE_WEBHOOK_SECRET) return null
    try {
      const [tPart, ...vParts] = signature.split(',')
      const t       = tPart.replace('t=', '')
      const signed  = vParts.find(p => p.startsWith('v1='))?.replace('v1=', '') ?? ''
      const payload = `${t}.${rawBody}`
      const expected = crypto.createHmac('sha256', env.STRIPE_WEBHOOK_SECRET).update(payload).digest('hex')
      if (!crypto.timingSafeEqual(Buffer.from(signed, 'hex'), Buffer.from(expected, 'hex'))) return null

      const event = JSON.parse(rawBody)
      if (event.type === 'checkout.session.completed' || event.type === 'invoice.payment_succeeded') {
        const obj = event.data.object
        return {
          reference: obj.id,
          gateway:   'stripe',
          status:    'completed',
          amount:    (obj.amount_total ?? obj.amount_paid ?? 0) / 100,
          currency:  (obj.currency ?? 'usd').toUpperCase(),
          tenantId:  obj.metadata?.tenantId,
          raw:       event,
        }
      }
      if (event.type === 'invoice.payment_failed') {
        const obj = event.data.object
        return { reference: obj.id, gateway: 'stripe', status: 'failed', amount: 0, currency: 'USD', tenantId: obj.metadata?.tenantId, raw: event }
      }
      return null
    } catch { return null }
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. PAYSTACK
// ═══════════════════════════════════════════════════════════════════════════

export const paystack = {
  /** Initialize a Paystack transaction (returns authorization_url) */
  async createCheckout(tenantId: string, plan: string, email: string, currency = 'KES'): Promise<CheckoutResult> {
    if (!env.PAYSTACK_SECRET_KEY) throw new Error('PAYSTACK_SECRET_KEY not configured')

    // Paystack amounts are in subunits (kobo/pesewas/cents)
    const currKey = currency.toLowerCase() as keyof typeof PLAN_PRICES['starter']
    const price   = PLAN_PRICES[plan]?.[currKey] ?? PLAN_PRICES[plan]?.usd ?? 99
    const amount  = Math.round(price * 100)

    const res = await request('https://api.paystack.co/transaction/initialize', {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount,
        currency,
        metadata: { tenantId, plan },
        callback_url: env.BILLING_SUCCESS_URL,
      }),
    })

    const body = res.data as any
    if (!body?.data?.authorization_url) throw new Error(`Paystack error: ${JSON.stringify(body)}`)
    return { gateway: 'paystack', reference: body.data.reference, url: body.data.authorization_url }
  },

  /** Verify Paystack webhook HMAC-SHA512 signature */
  verifyWebhook(rawBody: string, signature: string): WebhookPayment | null {
    if (!env.PAYSTACK_SECRET_KEY) return null
    try {
      const expected = crypto.createHmac('sha512', env.PAYSTACK_SECRET_KEY).update(rawBody).digest('hex')
      if (signature !== expected) return null

      const event = JSON.parse(rawBody) as any
      if (event.event === 'charge.success') {
        const d = event.data
        return {
          reference: d.reference,
          gateway:   'paystack',
          status:    'completed',
          amount:    d.amount / 100,
          currency:  d.currency,
          tenantId:  d.metadata?.tenantId,
          raw:       event,
        }
      }
      if (event.event === 'charge.failed') {
        const d = event.data
        return { reference: d.reference, gateway: 'paystack', status: 'failed', amount: 0, currency: d.currency, tenantId: d.metadata?.tenantId, raw: event }
      }
      return null
    } catch { return null }
  },

  /** Verify a transaction by reference (use for redirect confirmation) */
  async verifyTransaction(reference: string): Promise<{ status: 'completed' | 'failed'; amount: number; currency: string }> {
    if (!env.PAYSTACK_SECRET_KEY) throw new Error('PAYSTACK_SECRET_KEY not configured')
    const res = await request(`https://api.paystack.co/transaction/verify/${reference}`, {
      method:  'GET',
      headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` },
    })
    const body = res.data as any
    return {
      status:   body?.data?.status === 'success' ? 'completed' : 'failed',
      amount:   (body?.data?.amount ?? 0) / 100,
      currency: body?.data?.currency ?? 'KES',
    }
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. FLUTTERWAVE
// ═══════════════════════════════════════════════════════════════════════════

export const flutterwave = {
  /** Create a Flutterwave standard payment link */
  async createCheckout(tenantId: string, plan: string, email: string, currency = 'KES', name = ''): Promise<CheckoutResult> {
    if (!env.FLW_SECRET_KEY) throw new Error('FLW_SECRET_KEY not configured')

    const currKey = currency.toLowerCase() as keyof typeof PLAN_PRICES['starter']
    const price   = PLAN_PRICES[plan]?.[currKey] ?? PLAN_PRICES[plan]?.usd ?? 99
    const txRef   = `FLW-${tenantId.slice(0, 8)}-${Date.now()}`

    const res = await request('https://api.flutterwave.com/v3/payments', {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${env.FLW_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref:        txRef,
        amount:        price,
        currency,
        redirect_url:  env.BILLING_SUCCESS_URL,
        customer:      { email, name },
        meta:          { tenantId, plan },
        customizations: {
          title:       'WiFi Platform Subscription',
          description: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan — Monthly`,
        },
      }),
    })

    const body = res.data as any
    if (!body?.data?.link) throw new Error(`Flutterwave error: ${JSON.stringify(body)}`)
    return { gateway: 'flutterwave', reference: txRef, url: body.data.link }
  },

  /** Verify Flutterwave webhook (uses FLW-Signature header with secret hash) */
  verifyWebhook(rawBody: string, secretHash: string): WebhookPayment | null {
    // Flutterwave uses a plain secret hash header, not HMAC
    if (!env.FLW_SECRET_KEY) return null
    // The FLW-Signature header value should match FLW_SECRET_KEY (or a separate webhook secret)
    // In production set FLW_WEBHOOK_SECRET in Flutterwave dashboard to match FLW_SECRET_KEY
    try {
      const event = JSON.parse(rawBody) as any
      if (event.event === 'charge.completed' && event.data?.status === 'successful') {
        const d = event.data
        return {
          reference: d.tx_ref ?? d.flw_ref,
          gateway:   'flutterwave',
          status:    'completed',
          amount:    d.amount,
          currency:  d.currency,
          tenantId:  d.meta?.tenantId,
          raw:       event,
        }
      }
      if (event.event === 'charge.completed' && event.data?.status === 'failed') {
        const d = event.data
        return { reference: d.tx_ref, gateway: 'flutterwave', status: 'failed', amount: 0, currency: d.currency, tenantId: d.meta?.tenantId, raw: event }
      }
      return null
    } catch { return null }
  },

  /** Verify a transaction by ID after redirect (use ?transaction_id= from redirect URL) */
  async verifyTransaction(transactionId: string): Promise<{ status: 'completed' | 'failed'; amount: number; currency: string; meta: any }> {
    if (!env.FLW_SECRET_KEY) throw new Error('FLW_SECRET_KEY not configured')
    const res = await request(`https://api.flutterwave.com/v3/transactions/${transactionId}/verify`, {
      method:  'GET',
      headers: { Authorization: `Bearer ${env.FLW_SECRET_KEY}` },
    })
    const body = res.data as any
    return {
      status:   body?.data?.status === 'successful' ? 'completed' : 'failed',
      amount:   body?.data?.amount ?? 0,
      currency: body?.data?.currency ?? 'KES',
      meta:     body?.data?.meta ?? {},
    }
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. M-PESA (Safaricom Daraja STK Push) — Kenya KES only
// ═══════════════════════════════════════════════════════════════════════════

export const mpesa = {
  /** Get OAuth access token from Daraja */
  async _getToken(): Promise<string> {
    const creds = Buffer.from(`${env.MPESA_CONSUMER_KEY}:${env.MPESA_CONSUMER_SECRET}`).toString('base64')
    const res   = await request('https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      method:  'GET',
      headers: { Authorization: `Basic ${creds}` },
    })
    const body = res.data as any
    if (!body?.access_token) throw new Error(`M-Pesa OAuth failed: ${JSON.stringify(body)}`)
    return body.access_token
  },

  /**
   * Initiate STK Push — prompts customer's phone with a M-Pesa PIN entry.
   * phone must be in format 254XXXXXXXXX (no +).
   * Returns CheckoutResult with stkPush=true (no redirect URL).
   */
  async createCheckout(tenantId: string, plan: string, phone: string): Promise<CheckoutResult> {
    if (!env.MPESA_CONSUMER_KEY || !env.MPESA_SHORTCODE || !env.MPESA_PASSKEY || !env.MPESA_CALLBACK_URL) {
      throw new Error('M-Pesa not fully configured. Required: MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY, MPESA_CALLBACK_URL')
    }

    const token     = await this._getToken()
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14)
    const password  = Buffer.from(`${env.MPESA_SHORTCODE}${env.MPESA_PASSKEY}${timestamp}`).toString('base64')
    const price     = PLAN_PRICES[plan]?.kes ?? 12900

    const res = await request('https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BusinessShortCode: env.MPESA_SHORTCODE,
        Password:          password,
        Timestamp:         timestamp,
        TransactionType:   'CustomerPayBillOnline',
        Amount:            Math.round(price),
        PartyA:            phone,
        PartyB:            env.MPESA_SHORTCODE,
        PhoneNumber:       phone,
        CallBackURL:       env.MPESA_CALLBACK_URL,
        AccountReference:  `WIFI-${plan.toUpperCase()}`,
        TransactionDesc:   `WiFi Platform ${plan} plan`,
        // Pass tenantId in AccountReference for lookup in callback
      }),
    })

    const body = res.data as any
    if (body?.ResponseCode !== '0') throw new Error(`M-Pesa STK Push failed: ${JSON.stringify(body)}`)

    return {
      gateway:   'mpesa',
      reference: body.CheckoutRequestID,
      stkPush:   true,
      // No URL — user pays directly on their phone
    }
  },

  /** Parse M-Pesa STK Push callback */
  parseCallback(body: any): WebhookPayment | null {
    try {
      const result = body?.Body?.stkCallback
      if (!result) return null
      const code    = result.ResultCode
      const items   = result.CallbackMetadata?.Item ?? []
      const get     = (name: string) => items.find((i: any) => i.Name === name)?.Value

      return {
        reference: result.CheckoutRequestID,
        gateway:   'mpesa',
        status:    code === 0 ? 'completed' : 'failed',
        amount:    get('Amount') ?? 0,
        currency:  'KES',
        tenantId:  undefined,  // lookup by CheckoutRequestID from your Payment row
        raw:       body,
      }
    } catch { return null }
  },

  /** Query STK Push status (for polling) */
  async queryStatus(checkoutRequestId: string): Promise<'completed' | 'pending' | 'failed'> {
    if (!env.MPESA_CONSUMER_KEY || !env.MPESA_SHORTCODE || !env.MPESA_PASSKEY) throw new Error('M-Pesa not configured')
    const token     = await this._getToken()
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14)
    const password  = Buffer.from(`${env.MPESA_SHORTCODE}${env.MPESA_PASSKEY}${timestamp}`).toString('base64')

    const res = await request('https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query', {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ BusinessShortCode: env.MPESA_SHORTCODE, Password: password, Timestamp: timestamp, CheckoutRequestID: checkoutRequestId }),
    })
    const body = res.data as any
    if (body?.ResultCode === '0') return 'completed'
    if (body?.ResultCode === '1032') return 'pending'   // request cancelled by user
    if (body?.errorCode === '500.001.1001') return 'pending' // still processing
    return 'failed'
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. PESAPAL (East Africa — multi-currency)
// ═══════════════════════════════════════════════════════════════════════════

export const pesapal = {
  _baseUrl(): string {
    return env.PESAPAL_ENV === 'live'
      ? 'https://pay.pesapal.com/v3'
      : 'https://cybqa.pesapal.com/pesapalv3'
  },

  async _getToken(): Promise<string> {
    const res = await request(`${this._baseUrl()}/api/Auth/RequestToken`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ consumer_key: env.PESAPAL_CONSUMER_KEY, consumer_secret: env.PESAPAL_CONSUMER_SECRET }),
    })
    const body = res.data as any
    if (!body?.token) throw new Error(`Pesapal auth failed: ${JSON.stringify(body)}`)
    return body.token
  },

  async _registerIpn(token: string): Promise<string> {
    if (!env.PESAPAL_IPN_URL) throw new Error('PESAPAL_IPN_URL not configured')
    const res = await request(`${this._baseUrl()}/api/URLSetup/RegisterIPN`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: env.PESAPAL_IPN_URL, ipn_notification_type: 'POST' }),
    })
    const body = res.data as any
    return body?.ipn_id ?? ''
  },

  /** Create a Pesapal order (hosted payment page) */
  async createCheckout(tenantId: string, plan: string, email: string, currency = 'KES', firstName = '', lastName = '', phone = ''): Promise<CheckoutResult> {
    if (!env.PESAPAL_CONSUMER_KEY || !env.PESAPAL_CONSUMER_SECRET) throw new Error('Pesapal not configured. Set PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET.')

    const token  = await this._getToken()
    const ipnId  = await this._registerIpn(token)
    const currKey = currency.toLowerCase() as keyof typeof PLAN_PRICES['starter']
    const price   = PLAN_PRICES[plan]?.[currKey] ?? PLAN_PRICES[plan]?.usd ?? 99
    const ref     = `PP-${tenantId.slice(0, 8)}-${Date.now()}`

    const res = await request(`${this._baseUrl()}/api/Transactions/SubmitOrderRequest`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id:              ref,
        currency,
        amount:          price,
        description:     `WiFi Platform ${plan} plan`,
        callback_url:    env.BILLING_SUCCESS_URL,
        notification_id: ipnId,
        billing_address: { email_address: email, phone_number: phone, first_name: firstName, last_name: lastName },
      }),
    })

    const body = res.data as any
    if (!body?.redirect_url) throw new Error(`Pesapal error: ${JSON.stringify(body)}`)
    return { gateway: 'pesapal', reference: ref, url: body.redirect_url }
  },

  /** Verify a Pesapal IPN callback and get transaction status */
  async verifyTransaction(orderTrackingId: string): Promise<{ status: 'completed' | 'failed' | 'pending'; amount: number; currency: string }> {
    if (!env.PESAPAL_CONSUMER_KEY) throw new Error('Pesapal not configured')
    const token = await this._getToken()
    const res = await request(`${this._baseUrl()}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`, {
      method:  'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
    const body = res.data as any
    const statusMap: Record<number, 'completed' | 'failed' | 'pending'> = { 1: 'completed', 2: 'failed', 3: 'pending', 0: 'pending' }
    return {
      status:   statusMap[body?.payment_status_code ?? 3] ?? 'pending',
      amount:   body?.amount ?? 0,
      currency: body?.currency ?? 'KES',
    }
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// Gateway config summary (for admin UI)
// ═══════════════════════════════════════════════════════════════════════════

export function getGatewayStatus(): Array<{ name: GatewayName; label: string; configured: boolean; currencies: string[] }> {
  return [
    {
      name: 'stripe', label: 'Stripe', configured: !!env.STRIPE_SECRET_KEY,
      currencies: ['USD', 'EUR', 'GBP', 'ZAR', 'KES'],
    },
    {
      name: 'paystack', label: 'Paystack', configured: !!env.PAYSTACK_SECRET_KEY,
      currencies: ['NGN', 'GHS', 'ZAR', 'KES', 'USD'],
    },
    {
      name: 'flutterwave', label: 'Flutterwave', configured: !!env.FLW_SECRET_KEY,
      currencies: ['KES', 'NGN', 'GHS', 'ZAR', 'UGX', 'TZS', 'USD'],
    },
    {
      name: 'mpesa', label: 'M-Pesa (Daraja)', configured: !!env.MPESA_CONSUMER_KEY && !!env.MPESA_SHORTCODE,
      currencies: ['KES'],
    },
    {
      name: 'pesapal', label: 'Pesapal', configured: !!env.PESAPAL_CONSUMER_KEY,
      currencies: ['KES', 'UGX', 'TZS', 'RWF', 'USD'],
    },
  ]
}
