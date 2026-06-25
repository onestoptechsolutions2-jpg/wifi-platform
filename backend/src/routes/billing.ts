/**
 * billing.ts — Billing & subscription routes
 *
 * GET  /billing/gateways              → list configured gateways + status
 * POST /billing/checkout              → create payment session for a gateway
 * POST /billing/verify                → confirm payment after redirect (Paystack / Flutterwave / Pesapal)
 * POST /billing/mpesa/stk             → initiate M-Pesa STK push
 * GET  /billing/mpesa/status/:ref     → poll STK push status
 * GET  /billing/history               → payment history for tenant
 * POST /billing/webhook/stripe        → Stripe webhook (raw body required)
 * POST /billing/webhook/paystack      → Paystack webhook
 * POST /billing/webhook/flutterwave   → Flutterwave webhook
 * POST /billing/webhook/mpesa         → M-Pesa STK callback
 * POST /billing/webhook/pesapal       → Pesapal IPN
 */

import { FastifyInstance } from 'fastify'
import { z }              from 'zod'
import { stripe, paystack, flutterwave, mpesa, pesapal, getGatewayStatus, GatewayName } from '../services/billing.js'

function getTenantId(request: any): string {
  const u = request.user as any
  if (u.role === 'super_admin' && request.query.tenantId) return request.query.tenantId as string
  if (!u.tenantId) throw { statusCode: 403, message: 'No tenant' }
  return u.tenantId
}

async function recordPayment(prisma: any, data: {
  tenantId: string; amount: number; currency: string; gateway: GatewayName;
  reference?: string; status: 'pending' | 'completed' | 'failed'; plan: string; metadata?: any
}) {
  return prisma.payment.create({
    data: {
      tenantId:  data.tenantId,
      amount:    data.amount,
      currency:  data.currency,
      gateway:   data.gateway,
      reference: data.reference,
      status:    data.status,
      plan:      data.plan,
      paidAt:    data.status === 'completed' ? new Date() : null,
      metadata:  data.metadata ?? {},
    },
  })
}

async function markTenantPaid(prisma: any, tenantId: string) {
  const next = new Date()
  next.setMonth(next.getMonth() + 1)
  await prisma.tenant.update({
    where: { id: tenantId },
    data:  { lastPaidAt: new Date(), nextBillDate: next, status: 'active' },
  })
}

export default async function billingRoutes(app: FastifyInstance) {
  const prisma = app.prisma

  // ── GET /billing/gateways ──────────────────────────────────────────────
  app.get('/gateways', { preHandler: app.authenticate }, async () => {
    return getGatewayStatus()
  })

  // ── GET /billing/history ───────────────────────────────────────────────
  app.get('/history', { preHandler: app.authenticate }, async (request) => {
    const tenantId = getTenantId(request)
    return prisma.payment.findMany({
      where:   { tenantId },
      orderBy: { createdAt: 'desc' },
      take:    50,
    })
  })

  // ── POST /billing/checkout ─────────────────────────────────────────────
  // Body: { gateway, plan, currency?, phone? (M-Pesa), firstName?, lastName? }
  app.post('/checkout', { preHandler: app.authenticate }, async (request: any, reply) => {
    const tenantId = getTenantId(request)
    const schema = z.object({
      gateway:   z.enum(['stripe', 'paystack', 'flutterwave', 'pesapal']),
      plan:      z.enum(['starter', 'growth', 'pro']),
      currency:  z.string().default('USD'),
      firstName: z.string().optional(),
      lastName:  z.string().optional(),
    })
    const body = schema.parse(request.body)

    const user = await prisma.user.findFirst({ where: { tenantId, role: 'client_admin' } })
    if (!user) return reply.status(404).send({ error: 'No admin user found for tenant' })

    let result
    try {
      if (body.gateway === 'stripe') {
        result = await stripe.createCheckout(tenantId, body.plan, user.email)
      } else if (body.gateway === 'paystack') {
        result = await paystack.createCheckout(tenantId, body.plan, user.email, body.currency)
      } else if (body.gateway === 'flutterwave') {
        result = await flutterwave.createCheckout(tenantId, body.plan, user.email, body.currency, body.firstName, body.lastName)
      } else {
        result = await pesapal.createCheckout(tenantId, body.plan, user.email, body.currency, body.firstName, body.lastName)
      }
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }

    // Create a pending Payment row
    await recordPayment(prisma, {
      tenantId,
      amount:    0,  // will be updated by webhook / verify
      currency:  body.currency,
      gateway:   body.gateway,
      reference: result.reference,
      status:    'pending',
      plan:      body.plan,
    })

    // Track preferred gateway on tenant
    await prisma.tenant.update({ where: { id: tenantId }, data: { billingGateway: body.gateway } })

    return result
  })

  // ── POST /billing/mpesa/stk ────────────────────────────────────────────
  // Body: { plan, phone (254XXXXXXXXX) }
  app.post('/mpesa/stk', { preHandler: app.authenticate }, async (request: any, reply) => {
    const tenantId = getTenantId(request)
    const { plan, phone } = z.object({
      plan:  z.enum(['starter', 'growth', 'pro']),
      phone: z.string().regex(/^254\d{9}$/, 'Phone must be 254XXXXXXXXX format'),
    }).parse(request.body)

    let result
    try {
      result = await mpesa.createCheckout(tenantId, plan, phone)
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }

    await recordPayment(prisma, { tenantId, amount: 0, currency: 'KES', gateway: 'mpesa', reference: result.reference, status: 'pending', plan })
    await prisma.tenant.update({ where: { id: tenantId }, data: { billingGateway: 'mpesa' } })

    return { checkoutRequestId: result.reference, message: 'STK push sent. Enter M-Pesa PIN on your phone.' }
  })

  // ── GET /billing/mpesa/status/:ref ────────────────────────────────────
  app.get('/mpesa/status/:ref', { preHandler: app.authenticate }, async (request: any, reply) => {
    const { ref } = request.params as { ref: string }
    try {
      const status = await mpesa.queryStatus(ref)
      return { status }
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })

  // ── POST /billing/verify ───────────────────────────────────────────────
  // Used after redirect from Paystack / Flutterwave / Pesapal
  // Body: { gateway, reference, transactionId? (Flutterwave uses tx ID in URL) }
  app.post('/verify', { preHandler: app.authenticate }, async (request: any, reply) => {
    const tenantId = getTenantId(request)
    const { gateway, reference, transactionId } = z.object({
      gateway:       z.enum(['paystack', 'flutterwave', 'pesapal']),
      reference:     z.string(),
      transactionId: z.string().optional(),
    }).parse(request.body)

    let result: { status: 'completed' | 'failed'; amount: number; currency: string }
    try {
      if (gateway === 'paystack') {
        result = await paystack.verifyTransaction(reference)
      } else if (gateway === 'flutterwave') {
        if (!transactionId) return reply.status(400).send({ error: 'transactionId required for Flutterwave' })
        const r = await flutterwave.verifyTransaction(transactionId)
        result = r
      } else {
        result = await pesapal.verifyTransaction(reference)
      }
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }

    // Update Payment row
    const payment = await prisma.payment.findFirst({ where: { reference, tenantId } })
    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data:  { status: result.status, amount: result.amount, currency: result.currency, paidAt: result.status === 'completed' ? new Date() : null },
      })
    }

    if (result.status === 'completed') {
      await markTenantPaid(prisma, tenantId)
    }

    return result
  })

  // ── Webhooks (no auth — verified by signature) ─────────────────────────

  /** Stripe webhook — requires raw body */
  app.post('/webhook/stripe', {
    config: { rawBody: true },  // requires @fastify/rawbody or custom hook
  }, async (request: any, reply) => {
    const sig = request.headers['stripe-signature'] as string
    const raw = (request.rawBody as Buffer | undefined)?.toString() ?? JSON.stringify(request.body)
    const payment = stripe.verifyWebhook(raw, sig)
    if (!payment) return reply.status(400).send({ error: 'Invalid signature' })

    const existing = await prisma.payment.findFirst({ where: { reference: payment.reference } })
    if (existing) {
      await prisma.payment.update({ where: { id: existing.id }, data: { status: payment.status, amount: payment.amount, currency: payment.currency, paidAt: payment.status === 'completed' ? new Date() : null } })
      if (payment.status === 'completed' && existing.tenantId) await markTenantPaid(prisma, existing.tenantId)
    } else if (payment.tenantId) {
      await recordPayment(prisma, { tenantId: payment.tenantId, amount: payment.amount, currency: payment.currency, gateway: 'stripe', reference: payment.reference, status: payment.status, plan: 'starter', metadata: payment.raw })
      if (payment.status === 'completed') await markTenantPaid(prisma, payment.tenantId)
    }

    return { received: true }
  })

  /** Paystack webhook */
  app.post('/webhook/paystack', async (request: any, reply) => {
    const sig    = request.headers['x-paystack-signature'] as string
    const raw    = JSON.stringify(request.body)
    const result = paystack.verifyWebhook(raw, sig)
    if (!result) return reply.status(400).send({ error: 'Invalid signature' })

    const existing = await prisma.payment.findFirst({ where: { reference: result.reference } })
    if (existing) {
      await prisma.payment.update({ where: { id: existing.id }, data: { status: result.status, amount: result.amount, currency: result.currency, paidAt: result.status === 'completed' ? new Date() : null } })
      if (result.status === 'completed' && existing.tenantId) await markTenantPaid(prisma, existing.tenantId)
    } else if (result.tenantId) {
      await recordPayment(prisma, { tenantId: result.tenantId, amount: result.amount, currency: result.currency, gateway: 'paystack', reference: result.reference, status: result.status, plan: 'starter', metadata: result.raw })
      if (result.status === 'completed') await markTenantPaid(prisma, result.tenantId)
    }

    return { received: true }
  })

  /** Flutterwave webhook */
  app.post('/webhook/flutterwave', async (request: any, reply) => {
    const sig    = request.headers['verif-hash'] as string
    const raw    = JSON.stringify(request.body)
    const result = flutterwave.verifyWebhook(raw, sig)
    if (!result) return reply.status(400).send({ error: 'Invalid or unhandled event' })

    const existing = await prisma.payment.findFirst({ where: { reference: result.reference } })
    if (existing) {
      await prisma.payment.update({ where: { id: existing.id }, data: { status: result.status, amount: result.amount, currency: result.currency, paidAt: result.status === 'completed' ? new Date() : null } })
      if (result.status === 'completed' && existing.tenantId) await markTenantPaid(prisma, existing.tenantId)
    } else if (result.tenantId) {
      await recordPayment(prisma, { tenantId: result.tenantId, amount: result.amount, currency: result.currency, gateway: 'flutterwave', reference: result.reference, status: result.status, plan: 'starter', metadata: result.raw })
      if (result.status === 'completed') await markTenantPaid(prisma, result.tenantId)
    }

    return { received: true }
  })

  /** M-Pesa STK Push callback */
  app.post('/webhook/mpesa', async (request: any) => {
    const result = mpesa.parseCallback(request.body)
    if (!result) return { ResultCode: 0, ResultDesc: 'Accepted' }

    const existing = await prisma.payment.findFirst({ where: { reference: result.reference } })
    if (existing) {
      await prisma.payment.update({ where: { id: existing.id }, data: { status: result.status, amount: result.amount, currency: 'KES', paidAt: result.status === 'completed' ? new Date() : null } })
      if (result.status === 'completed' && existing.tenantId) await markTenantPaid(prisma, existing.tenantId)
    }

    return { ResultCode: 0, ResultDesc: 'Accepted' }
  })

  /** Pesapal IPN */
  app.post('/webhook/pesapal', async (request: any) => {
    const { orderTrackingId } = request.body as any
    if (!orderTrackingId) return { message: 'ignored' }

    try {
      const result   = await pesapal.verifyTransaction(orderTrackingId)
      const existing = await prisma.payment.findFirst({ where: { reference: orderTrackingId } })
      if (existing && result.status !== 'pending') {
        await prisma.payment.update({ where: { id: existing.id }, data: { status: result.status, amount: result.amount, currency: result.currency, paidAt: result.status === 'completed' ? new Date() : null } })
        if (result.status === 'completed' && existing.tenantId) await markTenantPaid(prisma, existing.tenantId)
      }
    } catch { /* log */ }

    return { message: 'ok' }
  })
}
