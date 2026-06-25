import Fastify from 'fastify'
import cors      from '@fastify/cors'
import helmet    from '@fastify/helmet'
import jwt       from '@fastify/jwt'
import cookie    from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import { env } from './config/env.js'
import prismaPlugin from './plugins/prisma.js'
import redisPlugin  from './plugins/redis.js'

// Routes
import authRoutes         from './routes/auth.js'
import tenantsRoutes      from './routes/tenants.js'
import customersRoutes    from './routes/customers.js'
import analyticsRoutes    from './routes/analytics.js'
import campaignRoutes     from './routes/campaigns.js'
import portalConfigRoutes from './routes/portal/config.js'
import portalAuthRoutes   from './routes/portal/auth.js'
import billingRoutes      from './routes/billing.js'
import plansRoutes        from './routes/plans.js'

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      ...(env.NODE_ENV !== 'production' ? { transport: { target: 'pino-pretty' } } : {}),
    },
  })

  // ── Core plugins ──────────────────────────────────────────────────────────
  await app.register(helmet, { contentSecurityPolicy: false })

  await app.register(cors, {
    origin:      env.ALLOWED_ORIGINS.split(','),
    credentials: true,
  })

  await app.register(cookie)

  await app.register(rateLimit, {
    global:     true,
    max:        500,
    timeWindow: '1 minute',
    // Use real client IP when behind nginx proxy, not the proxy's IP
    keyGenerator: (request) => {
      const forwarded = request.headers['x-forwarded-for']
      return (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : null) ?? request.ip
    },
  })

  await app.register(jwt, { secret: env.JWT_SECRET })

  // Auth helper decorator
  app.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify()
    } catch {
      reply.status(401).send({ error: 'Unauthorized' })
    }
  })

  // ── Data plugins ──────────────────────────────────────────────────────────
  await app.register(prismaPlugin)
  await app.register(redisPlugin)

  // ── Global error handler — converts ZodError to 400 ─────────────────────
  app.setErrorHandler((err: any, _request, reply) => {
    if (err.name === 'ZodError') {
      return reply.status(400).send({ error: 'Validation error', issues: err.issues })
    }
    // Fastify built-in errors (rate limit, etc.) already have statusCode
    const status = err.statusCode ?? err.status ?? 500
    app.log.error(err)
    return reply.status(status).send({ error: err.message ?? 'Internal server error' })
  })

  // ── Health check ──────────────────────────────────────────────────────────
  app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))

  // ── Routes ────────────────────────────────────────────────────────────────
  await app.register(authRoutes,          { prefix: '/auth' })
  await app.register(tenantsRoutes,       { prefix: '/tenants' })
  await app.register(customersRoutes,     { prefix: '/customers' })
  await app.register(analyticsRoutes,     { prefix: '/analytics' })
  await app.register(campaignRoutes,      { prefix: '/campaigns' })
  await app.register(portalConfigRoutes,  { prefix: '/portal/config' })
  await app.register(portalAuthRoutes,    { prefix: '/portal/auth' })
  await app.register(billingRoutes,       { prefix: '/billing' })
  await app.register(plansRoutes,         { prefix: '/plans' })

  return app
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>
  }
}
