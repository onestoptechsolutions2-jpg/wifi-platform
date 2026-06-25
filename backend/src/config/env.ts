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

  TWILIO_ACCOUNT_SID:  z.string().optional(),
  TWILIO_AUTH_TOKEN:   z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),

  AT_API_KEY:   z.string().optional(),
  AT_USERNAME:  z.string().optional(),

  SENDGRID_API_KEY: z.string().optional(),
  EMAIL_FROM:       z.string().email().default('noreply@yourplatform.com'),
  EMAIL_FROM_NAME:  z.string().default('WiFi Platform'),

  GOOGLE_CLIENT_ID:     z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  FACEBOOK_APP_ID:     z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),

  R2_ACCOUNT_ID:       z.string().optional(),
  R2_ACCESS_KEY_ID:    z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME:      z.string().optional(),
  R2_PUBLIC_URL:       z.string().optional(),

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
