import * as path from 'path'
import * as dotenv from 'dotenv'
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import sql from '@/lib/db'

async function run() {
    try {
        await sql`ALTER TABLE knowledge_entries ADD COLUMN source_type TEXT NOT NULL DEFAULT 'manual'`
        console.log("Success!")
    } catch (e: any) {
        console.error("Error:", e.message)
    }
}
run()
