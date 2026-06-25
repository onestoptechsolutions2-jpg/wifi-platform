/**
 * Analytics routes — client dashboard data
 * GET /analytics/live     — real-time active sessions
 * GET /analytics/summary  — today's stats
 * GET /analytics/trends   — historical daily data
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

const analyticsRoutes: FastifyPluginAsync = async (fastify) => {

  // Middleware: require auth + extract tenantId
  async function requireClientAuth(request: any, reply: any) {
    await request.jwtVerify()
    if (!request.user.tenantId && request.user.role !== 'super_admin') {
      return reply.status(403).send({ error: 'Forbidden' })
    }
  }

  const getTenantId = (request: any, query: any) =>
    request.user.role === 'super_admin' && query.tenantId
      ? query.tenantId
      : request.user.tenantId

  // ── GET /analytics/live ──────────────────────────────────────────────
  fastify.get('/live', {
    preHandler: [requireClientAuth],
  }, async (request, reply) => {
    const tenantId = getTenantId(request, request.query as any)

    const now = new Date()
    const sessions = await fastify.prisma.portalSession.findMany({
      where: {
        tenantId,
        status:    'active',
        grantedAt: { lte: now },
        expiresAt: { gt: now },
      },
      include: { customer: true },
      orderBy: { grantedAt: 'desc' },
    })

    const byMethod: Record<string, number> = {}
    for (const s of sessions) {
      byMethod[s.loginMethod] = (byMethod[s.loginMethod] ?? 0) + 1
    }

    return reply.send({
      count: sessions.length,
      byLoginMethod: byMethod,
      sessions: sessions.map(s => ({
        id:          s.id,
        mac:         s.macAddress,
        deviceType:  s.deviceType,
        loginMethod: s.loginMethod,
        grantedAt:   s.grantedAt,
        expiresAt:   s.expiresAt,
        customer:    s.customer
          ? { name: s.customer.name, email: s.customer.email }
          : null,
      })),
    })
  })

  // ── GET /analytics/summary ───────────────────────────────────────────
  fastify.get('/summary', {
    preHandler: [requireClientAuth],
  }, async (request, reply) => {
    const tenantId = getTenantId(request, request.query as any)

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [
      liveCount,
      todaySessions,
      totalCustomers,
      newToday,
    ] = await Promise.all([
      // Live count
      fastify.prisma.portalSession.count({
        where: { tenantId, status: 'active', expiresAt: { gt: new Date() } },
      }),
      // Today's sessions
      fastify.prisma.portalSession.findMany({
        where: { tenantId, grantedAt: { gte: todayStart } },
      }),
      // Total customers
      fastify.prisma.customer.count({ where: { tenantId } }),
      // New customers today
      fastify.prisma.customer.count({
        where: { tenantId, firstSeen: { gte: todayStart } },
      }),
    ])

    const returning = todaySessions.filter(
      s => s.customerId !== null
    ).length

    const byMethod: Record<string, number> = {}
    for (const s of todaySessions) {
      byMethod[s.loginMethod] = (byMethod[s.loginMethod] ?? 0) + 1
    }

    return reply.send({
      liveVisitors:      liveCount,
      todayLogins:       todaySessions.length,
      returningToday:    returning,
      totalCustomers,
      newCustomersToday: newToday,
      loginMethodBreakdown: byMethod,
    })
  })

  // ── GET /analytics/trends ────────────────────────────────────────────
  fastify.get('/trends', {
    preHandler: [requireClientAuth],
  }, async (request, reply) => {
    const { days = '30', tenantId: qTenantId } = request.query as any
    const tenantId = getTenantId(request, { tenantId: qTenantId })
    const nDays = Math.min(parseInt(days), 90)

    const since = new Date()
    since.setDate(since.getDate() - nDays)

    const sessions = await fastify.prisma.portalSession.findMany({
      where: { tenantId, grantedAt: { gte: since } },
      select: { grantedAt: true, loginMethod: true, customerId: true },
    })

    const customers = await fastify.prisma.customer.findMany({
      where: { tenantId, firstSeen: { gte: since } },
      select: { firstSeen: true },
    })

    // Group by date
    const sessionsByDay: Record<string, number> = {}
    const newCustomersByDay: Record<string, number> = {}

    for (const s of sessions) {
      const day = s.grantedAt.toISOString().slice(0, 10)
      sessionsByDay[day] = (sessionsByDay[day] ?? 0) + 1
    }

    for (const c of customers) {
      const day = c.firstSeen.toISOString().slice(0, 10)
      newCustomersByDay[day] = (newCustomersByDay[day] ?? 0) + 1
    }

    // Build ordered array
    const trend = []
    for (let i = nDays - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      trend.push({
        date:         key,
        sessions:     sessionsByDay[key] ?? 0,
        newCustomers: newCustomersByDay[key] ?? 0,
      })
    }

    return reply.send({ days: nDays, trend })
  })
}

export default analyticsRoutes
