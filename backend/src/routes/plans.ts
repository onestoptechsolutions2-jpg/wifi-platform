/**
 * Plans routes — super-admin only
 * GET  /plans        → list all plan definitions
 * PATCH /plans/:key  → update price, label, features, etc.
 */
import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

const planPatchSchema = z.object({
  label:       z.string().min(1).optional(),
  price:       z.number().min(0).optional(),
  currency:    z.string().length(3).optional(),
  color:       z.string().optional(),
  accentColor: z.string().optional(),
  features:    z.array(z.string()).optional(),
  missing:     z.array(z.string()).optional(),
  isActive:    z.boolean().optional(),
  sortOrder:   z.number().int().optional(),
})

const plansRoutes: FastifyPluginAsync = async (app) => {
  // All routes require super-admin auth
  app.addHook('onRequest', app.authenticate)

  // GET /plans — list all plans ordered by sortOrder
  app.get('/', async (request: any, reply) => {
    if (request.user.role !== 'super_admin') return reply.status(403).send({ error: 'Forbidden' })

    const plans = await app.prisma.planDefinition.findMany({
      orderBy: { sortOrder: 'asc' },
    })
    return plans
  })

  // PATCH /plans/:key — update a plan definition
  app.patch('/:key', async (request: any, reply) => {
    if (request.user.role !== 'super_admin') return reply.status(403).send({ error: 'Forbidden' })

    const { key } = request.params as { key: string }
    const body = planPatchSchema.parse(request.body)

    const existing = await app.prisma.planDefinition.findUnique({ where: { key } })
    if (!existing) return reply.status(404).send({ error: 'Plan not found' })

    const updated = await app.prisma.planDefinition.update({
      where: { key },
      data:  body,
    })
    return updated
  })
}

export default plansRoutes
