import { z } from 'zod'

const schema = z.object({
  NODE_ENV:        z.enum(['development', 'staging', 'production']).default('development'),
  PORT:            z.coerce.number().default(3000),
  DATABASE_URL:    z.string().url(),
  REDIS_URL:       z.string().url(),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),

  JWT_SECRET:          z.string().min(32),
  JWT_ACCESS_EXPIRES:  z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),

  ENCRYPTION_KEY: z.string().min(32),

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
