/**
 * Seed script — creates the super admin user and a demo tenant
 * Run: yarn db:seed (or tsx prisma/seed.ts)
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Super admin
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL ?? 'admin@yourplatform.com'
  const superAdminPass  = process.env.SUPER_ADMIN_PASSWORD ?? 'changeme123'

  const existing = await prisma.user.findUnique({ where: { email: superAdminEmail } })
  if (!existing) {
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

  // Demo tenant
  const demoExists = await prisma.tenant.findUnique({ where: { domain: 'demo.localhost' } })
  if (!demoExists) {
    const tenant = await prisma.tenant.create({
      data: {
        name:       'Demo Coffee Shop',
        domain:     'demo.localhost',
        plan:       'growth',
        status:     'active',
        headline:   'Welcome to Demo Coffee WiFi',
        subheadline:'Connect free and enjoy your visit!',
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
    console.log(`ℹ️  Demo tenant already exists`)
  }

  console.log('✅ Seed complete')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
