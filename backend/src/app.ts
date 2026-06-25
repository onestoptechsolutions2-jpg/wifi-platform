import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import { env } from './config/env.js'
import prismaPlugin from './plugins/prisma.js'
import redisPlugin from './plugins/redis.js'

// Routes
import authRoutes       from './routes/auth.js'
import tenantsRoutes    from './routes/tenants.js'
import customersRoutes  from './routes/customers.js'
import analyticsRoutes  from './routes/analytics.js'
import campaignRoutes   from './routes/campaigns.js'
import portalConfigRoutes from './routes/portal/config.js'
import portalAuthRoutes   from './routes/portal/auth.js'

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      ...(env.NODE_ENV !== 'production' ? { transport: { target: 'pino-pretty' } } : {}),
    },
  })

  // ── Core plugins ────────────────────────────────────────────────────────
  await app.register(helmet, {
    contentSecurityPolicy: false, // Handled at Nginx level
  })

  await app.register(cors, {
    origin: env.ALLOWED_ORIGINS.split(','),
    credentials: true,
  })

  await app.register(rateLimit, {
    global: true,
    max:    200,
    timeWindow: '1 minute',
  })

  await app.register(jwt, {
    secret: env.JWT_SECRET,
  })

  // Decorate authenticate helper
  app.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized' })
    }
  })

  // ── Data plugins ─────────────────────────────────────────────────────────
  await app.register(prismaPlugin)
  await app.register(redisPlugin)

  // ── Health check ─────────────────────────────────────────────────────────
  app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))

  // ── Routes ───────────────────────────────────────────────────────────────
  await app.register(authRoutes,          { prefix: '/auth' })
  await app.register(tenantsRoutes,       { prefix: '/tenants' })
  await app.register(customersRoutes,     { prefix: '/customers' })
  await app.register(analyticsRoutes,     { prefix: '/analytics' })
  await app.register(campaignRoutes,      { prefix: '/campaigns' })
  await app.register(portalConfigRoutes,  { prefix: '/portal/config' })
  await app.register(portalAuthRoutes,    { prefix: '/portal/auth' })

  return app
}

// Type augmentation for Fastify
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>
  }
}
