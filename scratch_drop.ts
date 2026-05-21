import * as path from 'path'
import * as dotenv from 'dotenv'
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import sql from '@/lib/db'

async function run() {
    try {
        console.log("Dropping table...");
        await sql.unsafe(`DROP TABLE IF EXISTS knowledge_entries CASCADE`);
        console.log("Recreating table...");
        await sql.unsafe(`
            CREATE TABLE knowledge_entries (
                id UUID PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'general',
                source_url TEXT,
                source_type TEXT NOT NULL DEFAULT 'manual',
                page_type TEXT NOT NULL DEFAULT 'general',
                breadcrumb TEXT,
                content_hash TEXT,
                chunk_index INTEGER NOT NULL DEFAULT 0,
                total_chunks INTEGER NOT NULL DEFAULT 1,
                parent_page_id UUID,
                search_vector tsvector,
                last_scraped_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("Checking columns...");
        const res = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'knowledge_entries'`;
        console.log(res);
    } catch (e: any) {
        console.error("Error:", e.message)
    }
}
run()
