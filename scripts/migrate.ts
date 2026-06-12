import fs from 'fs'
import path from 'path'
import { neon } from '@neondatabase/serverless'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function runMigrations() {
  console.log('Starting schema migration...')
  const dbUrl = process.env.NEON_DATABASE_URL
  if (!dbUrl) {
    console.error('Missing NEON_DATABASE_URL')
    process.exit(1)
  }

  const sql = neon(dbUrl)
  const schemaPath = path.join(process.cwd(), 'db', 'schema.sql')
  const schemaContent = fs.readFileSync(schemaPath, 'utf8')

  // Split schema by semicolon, but ignore semicolons inside plpgsql functions
  // A simple hack for this specific schema is to split by ';' but be careful with functions.
  // Actually, a better approach is to run the whole string if neon supports multiple statements.
  // Neon serverless driver neon() doesn't support multiple statements in a single call natively sometimes,
  // but it might if it's one block. Let's try splitting by '--;' or just simple regex.
  // Wait, the neon sql template tag handles arrays or we can just send the raw query using standard postgres.
  
  // Neon sql tag can't easily execute a huge multi-statement string with CREATE TRIGGER / FUNCTION sometimes.
  // To be safe, we'll import `Pool` from `@neondatabase/serverless` and run the raw string.
  
  const { Pool } = require('@neondatabase/serverless')
  const pool = new Pool({ connectionString: dbUrl })
  
  try {
    const parts = schemaContent.split('-- ─── Missing Required Tables ──────────────────────────────────────────────────')
    if (parts.length > 1) {
      console.log('Running only the missing required tables schema section...')
      await pool.query(parts[1])
    } else {
      await pool.query(schemaContent)
    }
    console.log('Migration completed successfully. All tables created.')
  } catch (err: any) {
    console.error('Migration failed:', err.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

runMigrations()
