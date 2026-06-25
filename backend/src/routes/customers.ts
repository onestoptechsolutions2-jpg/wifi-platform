/**
 * Customer routes
 * GET    /customers          — list with search/filter/pagination
 * GET    /customers/:id      — single customer
 * PATCH  /customers/:id      — update tags
 * DELETE /customers/:id      — GDPR delete
 * GET    /customers/export   — CSV download
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

const customersRoutes: FastifyPluginAsync = async (fastify) => {

  async function requireAuth(request: any, reply: any) {
    await request.jwtVerify()
  }

  const getTenantId = (request: any) =>
    request.user.role === 'super_admin' && (request.query as any).tenantId
      ? (request.query as any).tenantId
      : request.user.tenantId

  // ── GET /customers ───────────────────────────────────────────────────
  fastify.get('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const q = z.object({
      search:      z.string().optional(),
      method:      z.enum(['email','phone','google','facebook','clickthrough']).optional(),
      minVisits:   z.coerce.number().optional(),
      tag:         z.string().optional(),
      page:        z.coerce.number().default(1),
      limit:       z.coerce.number().max(100).default(25),
      tenantId:    z.string().optional(),
    }).parse(request.query)

    const tenantId = getTenantId(request)
    const skip = (q.page - 1) * q.limit

    const where: any = { tenantId }
    if (q.search) {
      where.OR = [
        { name:  { contains: q.search, mode: 'insensitive' } },
        { email: { contains: q.search, mode: 'insensitive' } },
        { phone: { contains: q.search } },
      ]
    }
    if (q.method)    where.loginMethod = q.method
    if (q.minVisits) where.visitCount  = { gte: q.minVisits }
    if (q.tag)       where.tags = { has: q.tag }

    const [customers, total] = await Promise.all([
      fastify.prisma.customer.findMany({
        where, skip, take: q.limit,
        orderBy: { lastSeen: 'desc' },
      }),
      fastify.prisma.customer.count({ where }),
    ])

    return reply.send({
      data: customers,
      meta: { total, page: q.page, limit: q.limit, pages: Math.ceil(total / q.limit) },
    })
  })

  // ── GET /customers/export ────────────────────────────────────────────
  fastify.get('/export', { preHandler: [requireAuth] }, async (request, reply) => {
    const tenantId = getTenantId(request)
    const customers = await fastify.prisma.customer.findMany({
      where: { tenantId },
      orderBy: { firstSeen: 'desc' },
    })

    const header = 'id,name,email,phone,login_method,phone_verified,first_seen,last_seen,visit_count,tags\n'
    const rows = customers.map(c =>
      [c.id, c.name ?? '', c.email ?? '', c.phone ?? '', c.loginMethod,
       c.phoneVerified, c.firstSeen.toISOString(), c.lastSeen.toISOString(),
       c.visitCount, c.tags.join(';')].join(',')
    ).join('\n')

    return reply
      .header('Content-Type', 'text/csv')
      .header('Content-Disposition', `attachment; filename="customers-${tenantId}.csv"`)
      .send(header + rows)
  })

  // ── GET /customers/:id ───────────────────────────────────────────────
  fastify.get('/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const tenantId = getTenantId(request)
    const customer = await fastify.prisma.customer.findFirst({
      where: { id, tenantId },
      include: {
        sessions: { orderBy: { grantedAt: 'desc' }, take: 10 },
      },
    })
    if (!customer) return reply.status(404).send({ error: 'Customer not found' })
    return reply.send(customer)
  })

  // ── PATCH /customers/:id (update tags) ───────────────────────────────
  fastify.patch('/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const tenantId = getTenantId(request)
    const body = z.object({ tags: z.array(z.string()) }).parse(request.body)

    const customer = await fastify.prisma.customer.updateMany({
      where: { id, tenantId },
      data: { tags: body.tags },
    })
    return reply.send({ ok: true })
  })

  // ── DELETE /customers/:id ────────────────────────────────────────────
  fastify.delete('/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const tenantId = getTenantId(request)
    await fastify.prisma.customer.deleteMany({ where: { id, tenantId } })
    return reply.send({ ok: true })
  })
}

export default customersRoutes
