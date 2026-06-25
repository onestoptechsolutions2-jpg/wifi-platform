/**
 * Portal config route — called by the React portal SPA on load.
 * GET /portal/config  (tenant resolved from Host header by resolveTenant middleware)
 *
 * Returns everything the SPA needs to:
 *  - render branding (colors, logo, headline, terms)
 *  - show the right login method tabs
 *  - initialise Google / Facebook SDKs
 *  - know how long a session lasts
 */
import type { FastifyPluginAsync } from 'fastify'
import { resolveTenant } from '../../middleware/tenant.js'
import { env } from '../../config/env.js'

const portalConfigRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    preHandler: [resolveTenant],
  }, async (request, reply) => {
    const t = request.tenant

    return reply.send({
      tenantId: t.id,
      name:     t.name,

      branding: {
        logoUrl:      t.logoUrl,
        primaryColor: t.primaryColor,
        bgColor:      t.bgColor,
        headline:     t.headline,
        subheadline:  t.subheadline,
        termsText:    t.termsText ?? 'By connecting, you agree to our terms of use.',
        redirectUrl:  t.redirectUrl,
      },

      sessionHours: t.sessionHours,

      loginMethods: {
        email:        t.loginEmail,
        phone:        t.loginPhone,
        google:       t.loginGoogle,
        facebook:     t.loginFacebook,
        clickthrough: t.loginClickthrough,
      },

      // Platform-level OAuth client IDs so the portal SPA can initialise the SDKs.
      // These are the same keys baked in at Vite build time via VITE_* args,
      // but returning them here means the SPA always has the live value.
      googleClientId: env.GOOGLE_CLIENT_ID  ?? null,
      facebookAppId:  env.FACEBOOK_APP_ID   ?? null,
    })
  })
}

export default portalConfigRoutes
