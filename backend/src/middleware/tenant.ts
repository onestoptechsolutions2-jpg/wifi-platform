import type { FastifyRequest, FastifyReply } from 'fastify'
import type { Tenant } from '@prisma/client'

declare module 'fastify' {
  interface FastifyRequest {
    tenant: Tenant
  }
}

/**
 * Resolve the current tenant from the incoming hostname.
 * Reads the Host header, strips port, looks up tenant by domain.
 * Attaches `request.tenant` for use in route handlers.
 */
export async function resolveTenant(request: FastifyRequest, reply: FastifyReply) {
  const host = (request.headers['x-forwarded-host'] ?? request.headers.host ?? '') as string
  const domain = host.split(':')[0].toLowerCase()

  if (!domain) {
    return reply.status(400).send({ error: 'Missing host header' })
  }

  const tenant = await request.server.prisma.tenant.findUnique({
    where: { domain },
  })

  if (!tenant) {
    return reply.status(404).send({ error: 'Portal not found' })
  }

  if (tenant.status === 'suspended') {
    return reply.status(403).send({ error: 'This portal is currently suspended' })
  }

  request.tenant = tenant
}
