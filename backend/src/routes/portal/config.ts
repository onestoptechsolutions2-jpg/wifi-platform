/**
 * Portal config route — called by the React portal SPA on load
 * GET /portal/config  (resolved by tenant domain from Host header)
 */
import type { FastifyPluginAsync } from 'fastify'
import { resolveTenant } from '../../middleware/tenant.js'

const portalConfigRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    preHandler: [resolveTenant],
  }, async (request, reply) => {
    const t = request.tenant
    return reply.send({
      tenantId:     t.id,
      name:         t.name,
      branding: {
        logoUrl:      t.logoUrl,
        primaryColor: t.primaryColor,
        bgColor:      t.bgColor,
        headline:     t.headline,
        subheadline:  t.subheadline,
        termsText:    t.termsText ?? 'By connecting, you agree to our terms of use.',
        redirectUrl:  t.redirectUrl,
      },
      loginMethods: {
        email:        t.loginEmail,
        phone:        t.loginPhone,
        google:       t.loginGoogle,
        facebook:     t.loginFacebook,
        clickthrough: t.loginClickthrough,
      },
    })
  })
}

export default portalConfigRoutes
