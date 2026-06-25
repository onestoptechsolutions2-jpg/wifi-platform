/**
 * Seed script — idempotent
 * Creates super admin + demo tenant on first run.
 * Migrates demo.localhost → localhost if old row exists.
 *
 * Run via: node dist/prisma/seed.js   (from docker-compose startup)
 *      or: npx tsx prisma/seed.ts     (local dev)
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // ── Super admin ────────────────────────────────────────────────────────
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL    ?? 'admin@yourplatform.com'
  const superAdminPass  = process.env.SUPER_ADMIN_PASSWORD ?? 'changeme123'

  const existingSA = await prisma.user.findUnique({ where: { email: superAdminEmail } })
  if (!existingSA) {
    await prisma.user.create({
      data: {
        name:     'Super Admin',
        email:    superAdminEmail,
        password: await bcrypt.hash(superAdminPass, 12),
        role:     'super_admin',
      },
    })
    console.log(`✅ Super admin created: ${superAdminEmail}`)
  } else {
    console.log(`ℹ️  Super admin already exists: ${superAdminEmail}`)
  }

  // ── Demo tenant ────────────────────────────────────────────────────────
  //
  // Domain resolution in resolveTenant middleware:
  //   - strips port: "localhost:3003" → "localhost"
  //   - falls back to PORTAL_DEFAULT_DOMAIN env var (default: "localhost")
  //
  // So the demo tenant domain must be "localhost" for local dev.
  // In production each tenant gets their own domain (e.g. wifi.javacafe.com).
  //
  const demoTargetDomain = process.env.PORTAL_DEFAULT_DOMAIN ?? 'localhost'

  // Migrate old domain if it exists from a previous seed run
  const oldDomains = ['demo.localhost', 'demo.wifi.com']
  for (const old of oldDomains) {
    const stale = await prisma.tenant.findUnique({ where: { domain: old } })
    if (stale) {
      const targetExists = await prisma.tenant.findUnique({ where: { domain: demoTargetDomain } })
      if (!targetExists) {
        await prisma.tenant.update({ where: { id: stale.id }, data: { domain: demoTargetDomain } })
        console.log(`🔄 Migrated demo tenant domain: ${old} → ${demoTargetDomain}`)
      } else {
        console.log(`ℹ️  Demo tenant already exists on ${demoTargetDomain}; stale row ${old} left as-is`)
      }
    }
  }

  // Create fresh if still absent
  const demoExists = await prisma.tenant.findUnique({ where: { domain: demoTargetDomain } })
  if (!demoExists) {
    const tenant = await prisma.tenant.create({
      data: {
        name:              'Demo Coffee Shop',
        domain:            demoTargetDomain,
        plan:              'growth',
        status:            'active',
        headline:          'Welcome to Demo Coffee WiFi',
        subheadline:       'Connect free and enjoy your visit!',
        primaryColor:      '#1B5FAD',
        bgColor:           '#FFFFFF',
        redirectUrl:       'https://google.com',
        sessionHours:      4,
        loginEmail:        true,
        loginPhone:        true,
        loginClickthrough: true,
        loginGoogle:       false,
        loginFacebook:     false,
        users: {
          create: {
            name:     'Demo Owner',
            email:    'demo@yourplatform.com',
            password: await bcrypt.hash('demo1234', 12),
            role:     'client_admin',
          },
        },
      },
    })
    console.log(`✅ Demo tenant created: ${tenant.domain}`)
  } else {
    console.log(`ℹ️  Demo tenant already exists: ${demoExists.domain}`)
  }

  console.log('✅ Seed complete')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
