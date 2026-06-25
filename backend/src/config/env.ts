import { z } from 'zod'

const schema = z.object({
  NODE_ENV:        z.enum(['development', 'staging', 'production']).default('development'),
  PORT:            z.coerce.number().default(3000),
  DATABASE_URL:    z.string().url(),
  REDIS_URL:       z.string().url(),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),

  JWT_SECRET:          z.string().min(32).default('wifiplatform-jwt-secret-change-in-production-x7k2'),
  JWT_ACCESS_EXPIRES:  z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),

  ENCRYPTION_KEY: z.string().min(32).default('wifiplatform-enc-key-change-in-production-x7k2'),

  // SMS — Twilio (primary)
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN:  z.string().optional(),
  TWILIO_FROM:        z.string().optional(),

  // SMS — Africa's Talking (fallback)
  AT_API_KEY:  z.string().optional(),
  AT_USERNAME: z.string().optional(),
  AT_FROM:     z.string().optional(),

  // Email — SendGrid
  SENDGRID_API_KEY: z.string().optional(),
  EMAIL_FROM:       z.string().email().default('noreply@yourplatform.com'),
  EMAIL_FROM_NAME:  z.string().default('WiFi Platform'),

  // Social login
  GOOGLE_CLIENT_ID:    z.string().optional(),
  FACEBOOK_APP_ID:     z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),

  // ── Payment gateways ─────────────────────────────────────────────────────

  // Stripe (international cards)
  STRIPE_SECRET_KEY:         z.string().optional(),
  STRIPE_WEBHOOK_SECRET:     z.string().optional(),
  STRIPE_PRICE_STARTER:      z.string().optional(), // price_xxx for $99/mo
  STRIPE_PRICE_GROWTH:       z.string().optional(), // price_xxx for $199/mo
  STRIPE_PRICE_PRO:          z.string().optional(), // price_xxx for $349/mo

  // Paystack (Nigeria, Ghana, Kenya, South Africa — ZAR/NGN/GHS/KES)
  PAYSTACK_SECRET_KEY:  z.string().optional(), // sk_live_xxx
  PAYSTACK_PUBLIC_KEY:  z.string().optional(), // pk_live_xxx

  // Flutterwave (pan-Africa + global)
  FLW_PUBLIC_KEY:       z.string().optional(), // FLWPUBK-xxx
  FLW_SECRET_KEY:       z.string().optional(), // FLWSECK-xxx
  FLW_ENCRYPTION_KEY:   z.string().optional(), // 12-char key from dashboard

  // M-Pesa Daraja (Kenya — KES STK Push)
  MPESA_CONSUMER_KEY:    z.string().optional(),
  MPESA_CONSUMER_SECRET: z.string().optional(),
  MPESA_SHORTCODE:       z.string().optional(), // Paybill or Till number
  MPESA_PASSKEY:         z.string().optional(), // LNM Online Passkey
  MPESA_CALLBACK_URL:    z.string().url().optional(), // e.g. https://api.yourdomain.com/billing/mpesa/callback

  // Pesapal (East Africa — multi-currency)
  PESAPAL_CONSUMER_KEY:    z.string().optional(),
  PESAPAL_CONSUMER_SECRET: z.string().optional(),
  PESAPAL_IPN_URL:         z.string().url().optional(), // Instant Payment Notification URL
  PESAPAL_ENV:             z.enum(['sandbox', 'live']).default('sandbox'),

  // Billing app URL (for redirect after payment)
  BILLING_SUCCESS_URL: z.string().url().default('http://localhost:3001/billing?success=1'),
  BILLING_CANCEL_URL:  z.string().url().default('http://localhost:3001/billing?cancelled=1'),

  // Seed defaults
  SUPER_ADMIN_EMAIL:    z.string().email().default('admin@yourplatform.com'),
  SUPER_ADMIN_PASSWORD: z.string().default('changeme'),
})

const result = schema.safeParse(process.env)
if (!result.success) {
  console.error('❌  Invalid environment variables:')
  console.error(result.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = result.data
export type Env = typeof env
