/**
 * Portal authentication routes — all 4 login methods
 *
 * POST /portal/auth/email          — email login
 * POST /portal/auth/phone          — request OTP
 * POST /portal/auth/otp/verify     — verify OTP and complete login
 * POST /portal/auth/social         — social login (Google / Facebook token)
 * POST /portal/auth/clickthrough   — click-through (no data)
 *
 * All routes resolve tenant from Host header.
 * On success, call the configured vendor service to grant access and return session info.
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { resolveTenant } from '../../middleware/tenant.js'
import { grantAccess } from '../../services/vendor.js'
import { sendOtp } from '../../services/sms.js'
import { generateOtp } from '../../utils/crypto.js'
import { addMinutes, addHours } from 'date-fns'
import axios from 'axios'

// ── Helpers ────────────────────────────────────────────────────────────────

function deviceType(ua: string): string {
  if (/mobile|android|iphone|ipad/i.test(ua)) return 'mobile'
  if (/tablet/i.test(ua)) return 'tablet'
  return 'desktop'
}

/** Create a portal session record and call hardware to grant access */
async function createSession(
  fastify: any,
  tenantId: string,
  customerId: string | null,
  mac: string,
  method: string,
  request: any,
  tok?: string,  // OpenWRT nodogsplash token (from ?tok= query param)
) {
  const tenant = await fastify.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })
  const expiresAt = addHours(new Date(), tenant.sessionHours)

  const session = await fastify.prisma.portalSession.create({
    data: {
      tenantId,
      customerId,
      macAddress:  mac,
      deviceType:  deviceType(request.headers['user-agent'] ?? ''),
      loginMethod: method as any,
      expiresAt,
    },
  })

  // Grant internet access via the configured vendor
  try {
    await grantAccess(tenant, mac, tok)
  } catch (err: any) {
    fastify.log.warn({ err, mac, tenantId, vendor: tenant.vendorType }, 'Vendor grant failed — session created but access not granted')
  }

  return { session, redirectUrl: tenant.redirectUrl }
}

/** Upsert customer record */
async function upsertCustomer(
  fastify: any,
  tenantId: string,
  data: {
    name?: string
    email?: string
    phone?: string
    phoneVerified?: boolean
    socialProvider?: string
    socialId?: string
    photoUrl?: string
    loginMethod: string
  }
) {
  const findWhere = data.email
    ? { tenantId, email: data.email }
    : data.phone
    ? { tenantId, phone: data.phone }
    : data.socialId
    ? { tenantId, socialId: data.socialId }
    : null

  if (!findWhere) return null

  const existing = await fastify.prisma.customer.findFirst({ where: findWhere })

  if (existing) {
    return fastify.prisma.customer.update({
      where: { id: existing.id },
      data: {
        lastSeen:   new Date(),
        visitCount: { increment: 1 },
        ...(data.name && { name: data.name }),
        ...(data.phone && { phone: data.phone }),
        ...(data.phoneVerified && { phoneVerified: true }),
      },
    })
  }

  return fastify.prisma.customer.create({
    data: {
      tenantId,
      loginMethod:  data.loginMethod as any,
      consentGiven: true,
      ...data,
    },
  })
}

// ── Routes ────────────────────────────────────────────────────────────────

const portalAuthRoutes: FastifyPluginAsync = async (fastify) => {

  // Rate limit helper — 10 req/IP/min for all portal auth
  const rateKey = (ip: string, action: string) => `ratelimit:portal:${action}:${ip}`
  async function checkRateLimit(fastify: any, ip: string, action: string, max: number, windowSec: number) {
    const key = rateKey(ip, action)
    const current = await fastify.redis.incr(key)
    if (current === 1) await fastify.redis.expire(key, windowSec)
    if (current > max) throw { statusCode: 429, message: 'Too many requests. Please wait and try again.' }
  }

  // ── Email login ───────────────────────────────────────────────────────
  fastify.post('/email', {
    preHandler: [resolveTenant],
  }, async (request, reply) => {
    const body = z.object({
      name:  z.string().min(1).max(100),
      email: z.string().email(),
      mac:   z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/),
      tok:   z.string().optional(),  // OpenWRT nodogsplash token
    }).parse(request.body)

    if (!request.tenant.loginEmail) {
      return reply.status(400).send({ error: 'Email login is not enabled for this portal' })
    }

    const customer = await upsertCustomer(fastify, request.tenant.id, {
      name:        body.name,
      email:       body.email,
      loginMethod: 'email',
    })

    const { session, redirectUrl } = await createSession(
      fastify, request.tenant.id, customer?.id ?? null, body.mac, 'email', request, body.tok
    )

    return reply.send({ sessionId: session.id, redirectUrl })
  })

  // ── Phone — request OTP ───────────────────────────────────────────────
  fastify.post('/phone', {
    preHandler: [resolveTenant],
  }, async (request, reply) => {
    const body = z.object({
      phone: z.string().regex(/^\+[1-9]\d{6,14}$/, 'Phone must be in E.164 format e.g. +254712345678'),
      name:  z.string().min(1).max(100).optional(),
    }).parse(request.body)

    if (!request.tenant.loginPhone) {
      return reply.status(400).send({ error: 'Phone login is not enabled for this portal' })
    }

    // Rate limit: 3 OTPs per phone per hour
    const otpRateKey = `otp:rate:${request.tenant.id}:${body.phone}`
    const attempts = await fastify.redis.incr(otpRateKey)
    if (attempts === 1) await fastify.redis.expire(otpRateKey, 3600)
    if (attempts > 3) {
      return reply.status(429).send({ error: 'Too many OTP requests. Please wait before trying again.' })
    }

    const otp = generateOtp(6)
    const expiresAt = addMinutes(new Date(), 10)

    // Store in DB (also used for cleanup)
    await fastify.prisma.otpCode.create({
      data: {
        phone:    body.phone,
        tenantId: request.tenant.id,
        code:     otp,
        expiresAt,
      },
    })

    // Also store in Redis for fast lookup
    await fastify.redis.set(
      `otp:${request.tenant.id}:${body.phone}`,
      otp,
      'EX', 600  // 10 minutes
    )

    const sent = await sendOtp(body.phone, otp)
    if (!sent) {
      return reply.status(500).send({ error: 'Failed to send OTP. Please try another login method.' })
    }

    return reply.send({ ok: true, message: 'OTP sent to your phone' })
  })

  // ── Phone — verify OTP ────────────────────────────────────────────────
  fastify.post('/otp/verify', {
    preHandler: [resolveTenant],
  }, async (request, reply) => {
    const body = z.object({
      phone: z.string(),
      otp:   z.string().length(6),
      name:  z.string().min(1).max(100).optional(),
      mac:   z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/),
      tok:   z.string().optional(),  // OpenWRT nodogsplash token
    }).parse(request.body)

    const stored = await fastify.redis.get(`otp:${request.tenant.id}:${body.phone}`)
    if (!stored || stored !== body.otp) {
      return reply.status(401).send({ error: 'Invalid or expired OTP' })
    }

    // Consume OTP
    await fastify.redis.del(`otp:${request.tenant.id}:${body.phone}`)

    const customer = await upsertCustomer(fastify, request.tenant.id, {
      name:          body.name,
      phone:         body.phone,
      phoneVerified: true,
      loginMethod:   'phone',
    })

    const { session, redirectUrl } = await createSession(
      fastify, request.tenant.id, customer?.id ?? null, body.mac, 'phone', request, body.tok
    )

    return reply.send({ sessionId: session.id, redirectUrl })
  })

  // ── Social login (Google / Facebook) ─────────────────────────────────
  fastify.post('/social', {
    preHandler: [resolveTenant],
  }, async (request, reply) => {
    const body = z.object({
      provider:    z.enum(['google', 'facebook']),
      accessToken: z.string(),
      mac:         z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/),
      tok:         z.string().optional(),  // OpenWRT nodogsplash token
    }).parse(request.body)

    if (body.provider === 'google' && !request.tenant.loginGoogle) {
      return reply.status(400).send({ error: 'Google login is not enabled for this portal' })
    }
    if (body.provider === 'facebook' && !request.tenant.loginFacebook) {
      return reply.status(400).send({ error: 'Facebook login is not enabled for this portal' })
    }

    // Verify token with provider and get profile
    let profile: { id: string; name: string; email?: string; photo?: string }

    try {
      if (body.provider === 'google') {
        const { data } = await axios.get(
          `https://www.googleapis.com/oauth2/v3/userinfo`,
          { headers: { Authorization: `Bearer ${body.accessToken}` } }
        )
        profile = { id: data.sub, name: data.name, email: data.email, photo: data.picture }
      } else {
        const { data } = await axios.get(
          `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${body.accessToken}`
        )
        profile = { id: data.id, name: data.name, email: data.email, photo: data.picture?.data?.url }
      }
    } catch {
      return reply.status(401).send({ error: 'Invalid social token — please try again' })
    }

    const customer = await upsertCustomer(fastify, request.tenant.id, {
      name:           profile.name,
      email:          profile.email,
      socialProvider: body.provider,
      socialId:       profile.id,
      photoUrl:       profile.photo,
      loginMethod:    body.provider,
    })

    const { session, redirectUrl } = await createSession(
      fastify, request.tenant.id, customer?.id ?? null, body.mac, body.provider, request, body.tok
    )

    return reply.send({ sessionId: session.id, redirectUrl })
  })

  // ── Click-through (no data collected) ────────────────────────────────
  fastify.post('/clickthrough', {
    preHandler: [resolveTenant],
  }, async (request, reply) => {
    const body = z.object({
      mac: z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/),
      tok: z.string().optional(),  // OpenWRT nodogsplash token
    }).parse(request.body)

    if (!request.tenant.loginClickthrough) {
      return reply.status(400).send({ error: 'Click-through login is not enabled for this portal' })
    }

    const { session, redirectUrl } = await createSession(
      fastify, request.tenant.id, null, body.mac, 'clickthrough', request, body.tok
    )

    return reply.send({ sessionId: session.id, redirectUrl })
  })
}

export default portalAuthRoutes
