/**
 * Dashboard auth routes (for admin and client users)
 * POST /auth/login
 * POST /auth/refresh
 * POST /auth/logout
 * GET  /auth/me
 */
import type { FastifyPluginAsync } from 'fastify'
import bcrypt from 'bcrypt'
import { z } from 'zod'

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
})

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // ── POST /auth/login ────────────────────────────────────────────────────
  fastify.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body)

    const user = await fastify.prisma.user.findUnique({
      where: { email: body.email },
      include: { tenant: true },
    })

    if (!user || !user.isActive) {
      return reply.status(401).send({ error: 'Invalid credentials' })
    }

    const valid = await bcrypt.compare(body.password, user.password)
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid credentials' })
    }

    // Update last login
    await fastify.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    const payload = {
      sub:      user.id,
      role:     user.role,
      tenantId: user.tenantId,
    }

    const accessToken  = fastify.jwt.sign(payload, { expiresIn: '15m' })
    const refreshToken = fastify.jwt.sign({ sub: user.id }, { expiresIn: '7d' })

    // Store refresh token in Redis with 7-day TTL
    await fastify.redis.set(
      `refresh:${user.id}`,
      refreshToken,
      'EX',
      60 * 60 * 24 * 7
    )

    return reply
      .cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge:   60 * 60 * 24 * 7,
        path:     '/auth/refresh',
      })
      .send({
        accessToken,
        user: {
          id:       user.id,
          name:     user.name,
          email:    user.email,
          role:     user.role,
          tenantId: user.tenantId,
          tenant:   user.tenant
            ? { id: user.tenant.id, name: user.tenant.name, domain: user.tenant.domain }
            : null,
        },
      })
  })

  // ── POST /auth/refresh ──────────────────────────────────────────────────
  fastify.post('/refresh', async (request, reply) => {
    const token = (request.cookies as any)?.refreshToken
    if (!token) return reply.status(401).send({ error: 'No refresh token' })

    let payload: any
    try {
      payload = fastify.jwt.verify(token)
    } catch {
      return reply.status(401).send({ error: 'Invalid refresh token' })
    }

    // Validate against stored token
    const stored = await fastify.redis.get(`refresh:${payload.sub}`)
    if (stored !== token) {
      return reply.status(401).send({ error: 'Refresh token revoked' })
    }

    const user = await fastify.prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user || !user.isActive) {
      return reply.status(401).send({ error: 'User not found' })
    }

    const accessToken = fastify.jwt.sign(
      { sub: user.id, role: user.role, tenantId: user.tenantId },
      { expiresIn: '15m' }
    )

    return reply.send({ accessToken })
  })

  // ── POST /auth/logout ───────────────────────────────────────────────────
  fastify.post('/logout', async (request, reply) => {
    const token = (request.cookies as any)?.refreshToken
    if (token) {
      try {
        const payload = fastify.jwt.verify(token) as any
        await fastify.redis.del(`refresh:${payload.sub}`)
      } catch { /* ignore */ }
    }
    return reply.clearCookie('refreshToken', { path: '/auth/refresh' }).send({ ok: true })
  })

  // ── GET /auth/me ────────────────────────────────────────────────────────
  fastify.get('/me', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = await fastify.prisma.user.findUnique({
      where: { id: (request.user as any).sub },
      include: { tenant: true },
    })
    if (!user) return reply.status(404).send({ error: 'User not found' })
    const { password: _, ...safeUser } = user
    return reply.send(safeUser)
  })
}

export default authRoutes
