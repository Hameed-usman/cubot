import { neon } from '@neondatabase/serverless';
import { sql } from '@/lib/db';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env variables
const envPath = path.join(process.cwd(), '.env.local');
const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error('Failed to load .env.local:', result.error);
  process.exit(1);
}

/**
 * Simple script to output key statistics from the Neon PostgreSQL database.
 * Run with: `npm run db-stats` (script added to package.json)
 */
async function main() {
  try {
    const db = neon(process.env.NEON_DATABASE_URL!);
    const client = await db.connect();

    // Total entries
    const totalRes = await client.query<{ count: string }>(
      sql`SELECT COUNT(*) AS count FROM knowledge_entries`
    );
    const total = parseInt(totalRes.rows[0].count, 10);

    // Category breakdown
    const catRes = await client.query<{ category: string; count: string }>(
      sql`SELECT category, COUNT(*) AS count FROM knowledge_entries GROUP BY category ORDER BY count DESC`
    );
    const categories = catRes.rows.map(r => ({ category: r.category, count: parseInt(r.count, 10) }));

    // Source type breakdown
    const srcRes = await client.query<{ source_type: string; count: string }>(
      sql`SELECT source_type, COUNT(*) AS count FROM knowledge_entries GROUP BY source_type ORDER BY count DESC`
    );
    const sources = srcRes.rows.map(r => ({ sourceType: r.source_type ?? 'unknown', count: parseInt(r.count, 10) }));

    console.log('=== Cubot Database Statistics ===');
    console.log(`Total knowledge entries : ${total}`);
    console.log('\nEntries by Category:');
    categories.forEach(c => console.log(`  ${c.category}: ${c.count}`));
    console.log('\nEntries by Source Type:');
    sources.forEach(s => console.log(`  ${s.sourceType}: ${s.count}`));
    console.log('\nRun completed successfully.');
  } catch (err) {
    console.error('Error gathering stats:', err);
    process.exit(1);
  }
}

main();
