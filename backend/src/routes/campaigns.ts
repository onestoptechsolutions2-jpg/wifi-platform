/**
 * Campaign routes — always sends to ALL customers with contact info
 * GET  /campaigns
 * POST /campaigns
 * POST /campaigns/:id/send
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import sgMail from '@sendgrid/mail'
import { sendSms } from '../services/sms.js'
import { env } from '../config/env.js'

if (env.SENDGRID_API_KEY) sgMail.setApiKey(env.SENDGRID_API_KEY)

const campaignRoutes: FastifyPluginAsync = async (fastify) => {

  async function requireAuth(request: any, reply: any) {
    await request.jwtVerify()
  }

  const getTenantId = (request: any): string => request.user.tenantId

  // ── GET /campaigns ────────────────────────────────────────────────────
  fastify.get('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const campaigns = await fastify.prisma.campaign.findMany({
      where:   { tenantId: getTenantId(request) },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(campaigns)
  })

  // ── POST /campaigns ───────────────────────────────────────────────────
  fastify.post('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = z.object({
      type:        z.enum(['email', 'sms']),
      subject:     z.string().optional(),   // email only
      body:        z.string().min(1),
      scheduledAt: z.string().datetime().optional(),
    }).parse(request.body)

    const campaign = await fastify.prisma.campaign.create({
      data: {
        tenantId:    getTenantId(request),
        type:        body.type,
        subject:     body.subject,
        body:        body.body,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        status:      'draft',
      },
    })

    return reply.status(201).send(campaign)
  })

  // ── POST /campaigns/:id/send ──────────────────────────────────────────
  fastify.post('/:id/send', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const tenantId = getTenantId(request)

    const campaign = await fastify.prisma.campaign.findFirst({ where: { id, tenantId } })
    if (!campaign) return reply.status(404).send({ error: 'Campaign not found' })
    if (campaign.status === 'sending' || campaign.status === 'sent') {
      return reply.status(400).send({ error: 'Campaign already sent or in progress' })
    }

    // Audience: all customers with the required contact field
    const customers = await fastify.prisma.customer.findMany({
      where: {
        tenantId,
        ...(campaign.type === 'email' ? { email: { not: null } } : { phone: { not: null } }),
      },
    })

    await fastify.prisma.campaign.update({
      where: { id },
      data: { status: 'sending', sentAt: new Date(), recipientCount: customers.length },
    })

    // Return 202 immediately — send in background
    reply.status(202).send({ ok: true, recipientCount: customers.length })

    let delivered = 0
    let failed    = 0

    for (const customer of customers) {
      try {
        if (campaign.type === 'email' && customer.email) {
          await sgMail.send({
            to:      customer.email,
            from:    { email: env.EMAIL_FROM, name: env.EMAIL_FROM_NAME },
            subject: campaign.subject ?? 'A message from us',
            html:    campaign.body,
          })
          delivered++
        } else if (campaign.type === 'sms' && customer.phone) {
          const ok = await sendSms(customer.phone, campaign.body)
          if (ok) delivered++; else failed++
        }
      } catch {
        failed++
      }
    }

    await fastify.prisma.campaign.update({
      where: { id },
      data: { status: 'sent', deliveredCount: delivered, failedCount: failed },
    })
  })
}

export default campaignRoutes
