import * as path from 'path'
import * as dotenv from 'dotenv'
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import sql from '@/lib/db'

async function run() {
    const res = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'knowledge_entries'`
    console.log(res)
}
run()
