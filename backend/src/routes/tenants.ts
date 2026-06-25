/**
 * Tenant management routes — super admin only
 * GET    /tenants
 * POST   /tenants
 * GET    /tenants/:id
 * PATCH  /tenants/:id          (includes MikroTik fields)
 * DELETE /tenants/:id
 * POST   /tenants/:id/test-connection
 * POST   /tenants/:id/impersonate
 *
 * Client self-service:
 * GET    /tenants/me
 * PATCH  /tenants/me
 */
import type { FastifyPluginAsync } from 'fastify'
import bcrypt from 'bcrypt'
import { z } from 'zod'
import { encrypt, decrypt } from '../utils/crypto.js'
import { mikrotikTestConnection } from '../services/mikrotik.js'

const tenantsRoutes: FastifyPluginAsync = async (fastify) => {

  async function requireSuperAdmin(request: any, reply: any) {
    await request.jwtVerify()
    if (request.user.role !== 'super_admin') {
      return reply.status(403).send({ error: 'Super admin access required' })
    }
  }

  async function requireAuth(request: any, reply: any) {
    await request.jwtVerify()
  }

  // ── GET /tenants/me — client fetches own tenant ──────────────────────
  fastify.get('/me', { preHandler: [requireAuth] }, async (request, reply) => {
    const tenant = await fastify.prisma.tenant.findUnique({
      where: { id: (request as any).user.tenantId },
    })
    if (!tenant) return reply.status(404).send({ error: 'Tenant not found' })
    // Never expose encrypted password
    const { mkPasswordEnc, ...safe } = tenant
    return reply.send(safe)
  })

  // ── PATCH /tenants/me — client updates own tenant ────────────────────
  fastify.patch('/me', { preHandler: [requireAuth] }, async (request, reply) => {
    const tenantId = (request as any).user.tenantId
    const body = tenantPatchSchema.parse(request.body)

    const data = buildUpdateData(body)
    const updated = await fastify.prisma.tenant.update({ where: { id: tenantId }, data })
    const { mkPasswordEnc, ...safe } = updated
    return reply.send(safe)
  })

  // ── GET /tenants ─────────────────────────────────────────────────────
  fastify.get('/', { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const tenants = await fastify.prisma.tenant.findMany({
      include: { _count: { select: { customers: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(tenants.map(({ mkPasswordEnc, ...t }) => t))
  })

  // ── POST /tenants ────────────────────────────────────────────────────
  fastify.post('/', { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const body = z.object({
      name:          z.string().min(1),
      domain:        z.string().min(3),
      plan:          z.enum(['starter', 'growth', 'pro']).default('starter'),
      billingEmail:  z.string().email().optional(),
      adminName:     z.string().min(1),
      adminEmail:    z.string().email(),
      adminPassword: z.string().min(8),
    }).parse(request.body)

    const hashed = await bcrypt.hash(body.adminPassword, 12)

    const tenant = await fastify.prisma.tenant.create({
      data: {
        name:         body.name,
        domain:       body.domain.toLowerCase(),
        plan:         body.plan,
        billingEmail: body.billingEmail,
        users: {
          create: {
            name:     body.adminName,
            email:    body.adminEmail,
            password: hashed,
            role:     'client_admin',
          },
        },
      },
    })

    return reply.status(201).send(tenant)
  })

  // ── GET /tenants/:id ─────────────────────────────────────────────────
  fastify.get('/:id', { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const tenant = await fastify.prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: { select: { customers: true, sessions: true } },
      },
    })
    if (!tenant) return reply.status(404).send({ error: 'Tenant not found' })
    const { mkPasswordEnc, ...safe } = tenant
    return reply.send(safe)
  })

  // ── PATCH /tenants/:id ───────────────────────────────────────────────
  fastify.patch('/:id', { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = tenantPatchSchema.parse(request.body)
    const data = buildUpdateData(body)
    const updated = await fastify.prisma.tenant.update({ where: { id }, data })
    const { mkPasswordEnc, ...safe } = updated
    return reply.send(safe)
  })

  // ── DELETE /tenants/:id ──────────────────────────────────────────────
  fastify.delete('/:id', { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await fastify.prisma.tenant.delete({ where: { id } })
    return reply.send({ ok: true })
  })

  // ── POST /tenants/:id/test-connection ────────────────────────────────
  fastify.post('/:id/test-connection', { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const tenant = await fastify.prisma.tenant.findUniqueOrThrow({ where: { id } })

    if (!tenant.mkHost || !tenant.mkUser || !tenant.mkPasswordEnc) {
      return reply.status(400).send({ error: 'MikroTik not configured for this tenant' })
    }

    const result = await mikrotikTestConnection({
      host:     tenant.mkHost,
      port:     tenant.mkPort,
      username: tenant.mkUser,
      password: decrypt(tenant.mkPasswordEnc),
    })

    return reply.send(result)
  })

  // ── POST /tenants/:id/impersonate ────────────────────────────────────
  fastify.post('/:id/impersonate', { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const adminUser = await fastify.prisma.user.findFirst({
      where: { tenantId: id, role: 'client_admin' },
    })
    if (!adminUser) return reply.status(404).send({ error: 'No admin user for this tenant' })

    const token = fastify.jwt.sign(
      { sub: adminUser.id, role: adminUser.role, tenantId: id, impersonated: true },
      { expiresIn: '2h' }
    )

    return reply.send({ accessToken: token, userId: adminUser.id })
  })
}

// ── Shared schema & helper ─────────────────────────────────────────────────

const tenantPatchSchema = z.object({
  // Identity
  name:         z.string().optional(),
  domain:       z.string().optional(),
  plan:         z.enum(['starter','growth','pro']).optional(),
  status:       z.enum(['trial','active','suspended']).optional(),
  // Branding
  logoUrl:      z.string().optional(),
  primaryColor: z.string().optional(),
  bgColor:      z.string().optional(),
  headline:     z.string().optional(),
  subheadline:  z.string().optional(),
  redirectUrl:  z.string().url().optional(),
  sessionHours: z.number().min(1).max(24).optional(),
  termsText:    z.string().optional(),
  // Login methods
  loginEmail:        z.boolean().optional(),
  loginPhone:        z.boolean().optional(),
  loginGoogle:       z.boolean().optional(),
  loginFacebook:     z.boolean().optional(),
  loginClickthrough: z.boolean().optional(),
  // MikroTik
  mkHost:      z.string().optional(),
  mkPort:      z.number().default(8728).optional(),
  mkUser:      z.string().optional(),
  mkPassword:  z.string().optional(),   // plaintext — encrypted before storage
  mkInterface: z.string().optional(),
  // Billing
  billingEmail: z.string().email().optional(),
  lastPaidAt:   z.string().datetime().optional(),
})

type TenantPatch = z.infer<typeof tenantPatchSchema>

function buildUpdateData(body: TenantPatch) {
  const { mkPassword, lastPaidAt, ...rest } = body
  return {
    ...rest,
    ...(mkPassword            ? { mkPasswordEnc: encrypt(mkPassword) } : {}),
    ...(lastPaidAt            ? { lastPaidAt: new Date(lastPaidAt) }   : {}),
  }
}

export default tenantsRoutes
