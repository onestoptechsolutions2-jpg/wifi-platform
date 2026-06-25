/**
 * Plans & Platform Settings routes — super-admin only
 *
 * Plans:
 *   GET    /plans           list all plan definitions
 *   POST   /plans           create a new plan
 *   PATCH  /plans/:key      update price, label, features, etc.
 *   DELETE /plans/:key      delete (blocked if tenants still on it)
 *
 * Platform settings (currency etc.):
 *   GET    /plans/settings        get all platform settings
 *   PATCH  /plans/settings        update platform settings
 */
import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

// ── Validation schemas ────────────────────────────────────────────────────────

const planCreateSchema = z.object({
  key:         z.string().min(1).regex(/^[a-z0-9_-]+$/, 'key must be lowercase alphanumeric'),
  label:       z.string().min(1),
  price:       z.number().min(0),
  currency:    z.string().length(3).default('USD'),
  color:       z.string().default('#1B5FAD'),
  accentColor: z.string().default('#EFF6FF'),
  features:    z.array(z.string()).default([]),
  missing:     z.array(z.string()).default([]),
  isActive:    z.boolean().default(true),
  sortOrder:   z.number().int().default(99),
})

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

const settingsPatchSchema = z.object({
  defaultCurrency: z.string().length(3).optional(),
  platformName:    z.string().optional(),
  supportEmail:    z.string().email().optional(),
})

// ── Supported currencies ──────────────────────────────────────────────────────
export const CURRENCIES = [
  { code: 'USD', symbol: '$',  name: 'US Dollar'       },
  { code: 'EUR', symbol: '€',  name: 'Euro'             },
  { code: 'GBP', symbol: '£',  name: 'British Pound'    },
  { code: 'KES', symbol: 'KSh',name: 'Kenyan Shilling'  },
  { code: 'NGN', symbol: '₦',  name: 'Nigerian Naira'   },
  { code: 'GHS', symbol: 'GH₵',name: 'Ghanaian Cedi'   },
  { code: 'ZAR', symbol: 'R',  name: 'South African Rand'},
  { code: 'UGX', symbol: 'USh',name: 'Ugandan Shilling' },
  { code: 'TZS', symbol: 'TSh',name: 'Tanzanian Shilling'},
  { code: 'RWF', symbol: 'RF', name: 'Rwandan Franc'    },
  { code: 'ETB', symbol: 'Br', name: 'Ethiopian Birr'   },
  { code: 'XOF', symbol: 'CFA',name: 'West African CFA' },
  { code: 'INR', symbol: '₹',  name: 'Indian Rupee'     },
  { code: 'AED', symbol: 'AED',name: 'UAE Dirham'       },
  { code: 'CAD', symbol: 'CA$',name: 'Canadian Dollar'  },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar'},
]

// ── Helper: upsert a setting ──────────────────────────────────────────────────
async function setSetting(prisma: any, key: string, value: string) {
  await prisma.platformSettings.upsert({
    where:  { key },
    update: { value },
    create: { key, value },
  })
}

// ── Route plugin ──────────────────────────────────────────────────────────────

const plansRoutes: FastifyPluginAsync = async (app) => {

  async function requireSuperAdmin(request: any, reply: any) {
    await request.jwtVerify()
    if (request.user.role !== 'super_admin') {
      return reply.status(403).send({ error: 'Forbidden' })
    }
  }

  // ── GET /plans/currencies — public list of supported currencies ───────────
  app.get('/currencies', async () => CURRENCIES)

  // ── GET /plans/settings ───────────────────────────────────────────────────
  app.get('/settings', { preHandler: requireSuperAdmin }, async () => {
    const rows = await app.prisma.platformSettings.findMany()
    return Object.fromEntries(rows.map(r => [r.key, r.value]))
  })

  // ── PATCH /plans/settings ─────────────────────────────────────────────────
  app.patch('/settings', { preHandler: requireSuperAdmin }, async (request, reply) => {
    const body = settingsPatchSchema.parse(request.body)
    const updates: Record<string, string> = {}

    if (body.defaultCurrency) updates.defaultCurrency = body.defaultCurrency
    if (body.platformName)    updates.platformName    = body.platformName
    if (body.supportEmail)    updates.supportEmail    = body.supportEmail

    for (const [k, v] of Object.entries(updates)) {
      await setSetting(app.prisma, k, v)
    }
    const rows = await app.prisma.platformSettings.findMany()
    return Object.fromEntries(rows.map(r => [r.key, r.value]))
  })

  // ── GET /plans ─────────────────────────────────────────────────────────────
  app.get('/', { preHandler: requireSuperAdmin }, async () => {
    return app.prisma.planDefinition.findMany({ orderBy: { sortOrder: 'asc' } })
  })

  // ── POST /plans — create a new plan ───────────────────────────────────────
  app.post('/', { preHandler: requireSuperAdmin }, async (request, reply) => {
    const body = planCreateSchema.parse(request.body)

    const existing = await app.prisma.planDefinition.findUnique({ where: { key: body.key } })
    if (existing) return reply.status(409).send({ error: `Plan key "${body.key}" already exists` })

    const plan = await app.prisma.planDefinition.create({ data: body })
    return reply.status(201).send(plan)
  })

  // ── PATCH /plans/:key — update a plan ─────────────────────────────────────
  app.patch('/:key', { preHandler: requireSuperAdmin }, async (request: any, reply) => {
    const { key } = request.params as { key: string }
    const body = planPatchSchema.parse(request.body)

    const existing = await app.prisma.planDefinition.findUnique({ where: { key } })
    if (!existing) return reply.status(404).send({ error: 'Plan not found' })

    const updated = await app.prisma.planDefinition.update({ where: { key }, data: body })
    return updated
  })

  // ── DELETE /plans/:key ─────────────────────────────────────────────────────
  app.delete('/:key', { preHandler: requireSuperAdmin }, async (request: any, reply) => {
    const { key } = request.params as { key: string }

    const existing = await app.prisma.planDefinition.findUnique({ where: { key } })
    if (!existing) return reply.status(404).send({ error: 'Plan not found' })

    // Block deletion if any tenants are on this plan
    const tenantCount = await app.prisma.tenant.count({ where: { plan: key } })
    if (tenantCount > 0) {
      return reply.status(409).send({
        error: `Cannot delete — ${tenantCount} tenant${tenantCount > 1 ? 's' : ''} are on this plan. Move them first.`,
      })
    }

    await app.prisma.planDefinition.delete({ where: { key } })
    return reply.status(204).send()
  })
}

export default plansRoutes
