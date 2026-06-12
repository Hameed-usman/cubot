import * as bcrypt from 'bcryptjs'

const password = process.argv[2]
if (!password) {
  console.error('Usage: tsx scripts/hash-password.ts <password>')
  process.exit(1)
}

const hash = bcrypt.hashSync(password, 12)
console.log(`\nAdmin Password Hash (cost=12):\n${hash}\n`)
console.log('Copy this into your .env.local as ADMIN_PASSWORD_HASH')
