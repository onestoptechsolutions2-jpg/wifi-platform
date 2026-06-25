import type { FastifyRequest, FastifyReply } from 'fastify'
import type { Tenant } from '@prisma/client'
import { env } from '../config/env.js'

declare module 'fastify' {
  interface FastifyRequest {
    tenant: Tenant
  }
}

/**
 * Resolve the current tenant from the incoming request.
 *
 * Resolution order:
 *  1. x-forwarded-host header  (set by Traefik / nginx in production)
 *  2. host header              (set by nginx proxy_set_header Host $host)
 *  3. PORTAL_DEFAULT_DOMAIN    (env var fallback for local dev / Coolify single-domain setups)
 *
 * The port is always stripped before lookup (e.g. "localhost:3003" → "localhost").
 *
 * Attaches `request.tenant` for use in downstream route handlers.
 */
export async function resolveTenant(request: FastifyRequest, reply: FastifyReply) {
  const prisma = request.server.prisma

  // ── Collect candidate domains ────────────────────────────────────────
  const strip = (h: string) => h.split(':')[0].toLowerCase().trim()

  const candidates: string[] = []

  const fwdHost = request.headers['x-forwarded-host']
  if (fwdHost) {
    const fwdStr = Array.isArray(fwdHost) ? fwdHost[0] : fwdHost
    const d = strip(fwdStr)
    if (d) candidates.push(d)
  }

  const hostHdr = request.headers.host
  if (hostHdr) {
    const d = strip(hostHdr)
    if (d && !candidates.includes(d)) candidates.push(d)
  }

  if (env.PORTAL_DEFAULT_DOMAIN) {
    const d = env.PORTAL_DEFAULT_DOMAIN.toLowerCase().trim()
    if (d && !candidates.includes(d)) candidates.push(d)
  }

  if (candidates.length === 0) {
    return reply.status(400).send({ error: 'Missing host header' })
  }

  // ── Try each candidate in order ──────────────────────────────────────
  let tenant: Tenant | null = null
  for (const domain of candidates) {
    tenant = await prisma.tenant.findUnique({ where: { domain } })
    if (tenant) break
  }

  if (!tenant) {
    request.server.log.warn(
      { candidates },
      'resolveTenant: no tenant matched — ensure the tenant domain is registered in the DB'
    )
    return reply.status(404).send({
      error: 'Portal not found',
      detail: `No tenant registered for: ${candidates.join(', ')}`,
    })
  }

  if (tenant.status === 'suspended') {
    return reply.status(403).send({ error: 'This portal is currently suspended' })
  }

  request.tenant = tenant
}
