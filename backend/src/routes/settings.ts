/**
 * System Settings routes — super-admin only
 *
 * GET  /settings         → return all settings (secrets masked)
 * PATCH /settings        → update one or more settings
 *
 * Sensitive fields (API keys, passwords) are stored AES-256 encrypted.
 * GET returns them as "••••••1234" (last-4 visible) so the admin can
 * confirm they are set without re-entering them.
 * PATCH skips a field if the submitted value is empty or the mask sentinel.
 */
import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { encrypt, decrypt } from '../utils/crypto.js'

// ── Which keys are treated as secrets ────────────────────────────────────────

const SECRET_KEYS = new Set([
  'smtpPassword',
  'stripeSecretKey', 'stripeWebhookSecret',
  'paystackSecretKey',
  'flutterwaveSecretKey',
  'mpesaConsumerSecret', 'mpesaPasskey',
  'pesapalConsumerSecret',
  'twilioAuthToken',
  'africasTalkingApiKey',
])

const MASK_SENTINEL = '••••'   // submitted value meaning "don't change"

// ── Allowed setting keys (whitelist) ─────────────────────────────────────────

const ALLOWED_KEYS = [
  // Platform
  'platformName', 'supportEmail', 'defaultCurrency', 'logoUrl', 'timezone',
  // SMTP
  'smtpHost', 'smtpPort', 'smtpUser', 'smtpPassword', 'smtpFromEmail', 'smtpFromName', 'smtpSecure',
  // SMS
  'smsProvider',                                             // twilio | africastalking | none
  'twilioAccountSid', 'twilioAuthToken', 'twilioFromNumber',
  'africasTalkingUsername', 'africasTalkingApiKey', 'africasTalkingSenderId',
  // Stripe
  'stripePublishableKey', 'stripeSecretKey', 'stripeWebhookSecret',
  // Paystack
  'paystackPublicKey', 'paystackSecretKey',
  // Flutterwave
  'flutterwavePublicKey', 'flutterwaveSecretKey',
  // M-Pesa
  'mpesaConsumerKey', 'mpesaConsumerSecret', 'mpesaShortcode', 'mpesaPasskey', 'mpesaCallbackUrl',
  // Pesapal
  'pesapalConsumerKey', 'pesapalConsumerSecret', 'pesapalIpnUrl',
  // Security
  'sessionTimeoutHours', 'maxLoginAttempts',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskSecret(plain: string): string {
  if (!plain || plain.length < 8) return MASK_SENTINEL
  return '••••' + plain.slice(-4)
}

function decryptSafe(ciphertext: string): string {
  try { return decrypt(ciphertext) } catch { return '' }
}

async function getAll(prisma: any): Promise<Record<string, string>> {
  const rows = await prisma.platformSettings.findMany()
  const result: Record<string, string> = {}
  for (const row of rows) {
    if (SECRET_KEYS.has(row.key)) {
      const plain = decryptSafe(row.value)
      result[row.key] = plain ? maskSecret(plain) : ''
    } else {
      result[row.key] = row.value
    }
  }
  return result
}

// ── Plugin ────────────────────────────────────────────────────────────────────

const settingsRoutes: FastifyPluginAsync = async (app) => {

  async function requireSuperAdmin(request: any, reply: any) {
    await request.jwtVerify()
    if (request.user.role !== 'super_admin') {
      return reply.status(403).send({ error: 'Forbidden' })
    }
  }

  // GET /settings
  app.get('/', { preHandler: requireSuperAdmin }, async () => getAll(app.prisma))

  // PATCH /settings
  app.patch('/', { preHandler: requireSuperAdmin }, async (request: any, reply) => {
    const body = z.record(z.string()).parse(request.body)

    for (const [key, rawValue] of Object.entries(body)) {
      if (!ALLOWED_KEYS.includes(key)) continue
      const value = String(rawValue ?? '').trim()
      // Skip empty or unchanged sentinel
      if (!value || value === MASK_SENTINEL || value.startsWith('••••')) continue

      const storedValue = SECRET_KEYS.has(key) ? encrypt(value) : value

      await app.prisma.platformSettings.upsert({
        where:  { key },
        update: { value: storedValue },
        create: { key, value: storedValue },
      })
    }

    return getAll(app.prisma)
  })

  // GET /settings/raw/:key — returns decrypted value (for internal use by other services)
  // Not exposed to frontend — called server-side only
  app.get('/raw/:key', { preHandler: requireSuperAdmin }, async (request: any, reply) => {
    const { key } = request.params as { key: string }
    const row = await app.prisma.platformSettings.findUnique({ where: { key } })
    if (!row) return reply.status(404).send({ error: 'Not found' })
    const value = SECRET_KEYS.has(key) ? decryptSafe(row.value) : row.value
    return { key, value }
  })
}

export default settingsRoutes
