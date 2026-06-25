/**
 * Seed script — idempotent
 * Creates super admin, demo tenant, and default plan definitions on first run.
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
  const demoTargetDomain = process.env.PORTAL_DEFAULT_DOMAIN ?? 'localhost'

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

  // ── Plan definitions ───────────────────────────────────────────────────
  const defaultPlans = [
    {
      key:         'starter',
      label:       'Starter',
      price:       99,
      currency:    'USD',
      color:       '#1B5FAD',
      accentColor: '#EFF6FF',
      sortOrder:   1,
      features: [
        '1 location',
        '500 portal logins / month',
        '7-day analytics retention',
        'Email & phone login',
        'Custom branding & colors',
        'MikroTik, UniFi, Omada support',
      ],
      missing: [
        'SMS campaigns',
        'Email campaigns',
        'White-label (removes platform branding)',
        'API access',
        'Priority support',
      ],
    },
    {
      key:         'growth',
      label:       'Growth',
      price:       199,
      currency:    'USD',
      color:       '#7C3AED',
      accentColor: '#F5F3FF',
      sortOrder:   2,
      features: [
        'Up to 3 locations',
        '2,000 portal logins / month',
        '30-day analytics retention',
        'All login methods (email, phone, social, guest)',
        'Custom branding & colors',
        'All hardware vendors',
        'SMS & Email campaigns',
      ],
      missing: [
        'White-label (removes platform branding)',
        'API access',
        'Priority support',
      ],
    },
    {
      key:         'pro',
      label:       'Pro',
      price:       349,
      currency:    'USD',
      color:       '#059669',
      accentColor: '#ECFDF5',
      sortOrder:   3,
      features: [
        'Unlimited locations',
        'Unlimited portal logins',
        '12-month analytics retention',
        'All login methods',
        'Custom branding & colors',
        'All hardware vendors',
        'SMS & Email campaigns',
        'White-label (no platform branding)',
        'API access',
        'Priority support',
      ],
      missing: [],
    },
  ]

  for (const plan of defaultPlans) {
    await prisma.planDefinition.upsert({
      where:  { key: plan.key },
      update: {},          // never overwrite if admin has edited
      create: plan,
    })
  }
  console.log('✅ Plan definitions seeded (existing ones untouched)')

  console.log('✅ Seed complete')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
