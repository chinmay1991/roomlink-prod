// One-off script: creates platform-level super_admin users.
// Run from repo root: node packages/db/scripts/create-super-admins.cjs
//
// Idempotent: re-running skips any email that already exists.

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')

// Prisma reads DATABASE_URL from process.env; load packages/db/.env manually
// since this is a plain node script (no Next.js/dotenv auto-load here).
if (!process.env.DATABASE_URL) {
  const envPath = path.join(__dirname, '..', '.env')
  const envFile = fs.readFileSync(envPath, 'utf8')
  for (const line of envFile.split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (match) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }
}

const prisma = new PrismaClient()

const NEW_ADMINS = [
  { fullName: 'Chinmaya Kumar Dehury', email: 'chinmayakumardehury@gmail.com' },
  { fullName: 'Tanmay Sahoo', email: 'stanmay19@yahoo.com' },
]

function generateStrongPassword() {
  const words = ['Harbor', 'Lantern', 'Cedar', 'Comet', 'Marble', 'Falcon', 'Willow', 'Quartz']
  const word = words[crypto.randomBytes(1)[0] % words.length]
  const digits = crypto.randomBytes(3).readUIntBE(0, 3) % 100000
  const symbol = '!@#$%'[crypto.randomBytes(1)[0] % 5]
  return `${word}${digits}${symbol}`
}

async function main() {
  let role = await prisma.roles.findFirst({ where: { hotel_id: null, name: 'Super Admin' } })
  if (!role) {
    role = await prisma.roles.create({
      data: { hotel_id: null, name: 'Super Admin', is_system_role: true },
    })
    console.log(`Created platform role "Super Admin" (${role.role_id})`)
  }

  const created = []

  for (const admin of NEW_ADMINS) {
    const existing = await prisma.users.findUnique({ where: { email: admin.email } })
    if (existing) {
      console.log(`Skipped ${admin.email} — a user with this email already exists.`)
      continue
    }

    const password = generateStrongPassword()
    const passwordHash = await bcrypt.hash(password, 10)

    await prisma.users.create({
      data: {
        hotel_id: null,
        role_id: role.role_id,
        user_type: 'super_admin',
        full_name: admin.fullName,
        email: admin.email,
        password_hash: passwordHash,
        status: 'active',
      },
    })

    created.push({ ...admin, password })
  }

  if (created.length) {
    console.log('\nCreated super admin accounts (share these once, rotate on first login):\n')
    for (const c of created) {
      console.log(`  ${c.fullName} <${c.email}>  password: ${c.password}`)
    }
  } else {
    console.log('\nNo new accounts created.')
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
