import * as path from 'path';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

// Load env FIRST — before any other imports
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import sql from '../lib/db';

/**
 * Database migration script.
 * Usage: npm run setup-db
 */

async function runMigration() {
  console.log('🗄️  Running database migration from schema.sql...\n');

  try {
    const schemaPath = path.join(process.cwd(), 'db', 'schema.sql');
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    
    let successCount = 0;
    try {
      await (sql as any).query(schemaContent);
      successCount++;
    } catch (err: any) {
      console.warn(`  ⚠️  Warning on execution: ${err.message}`);
    }

    console.log('✅ Migration complete');
    console.log(`   Statements executed: ${successCount}`);

    const tables = await (sql as any).query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name
    `);
    console.log(`\n📋 Tables in database:`);
    if (tables && tables.rows) {
        tables.rows.forEach((t: any) => console.log(`   ✓ ${t.table_name}`));
    } else {
        // Fallback for some neon versions
        if (Array.isArray(tables)) {
            tables.forEach((t: any) => console.log(`   ✓ ${t.table_name}`));
        }
    }

    const cols = await (sql as any).query(`
      SELECT COUNT(*) as count FROM information_schema.columns
      WHERE table_name = 'knowledge_entries'
    `);
    const count = (cols.rows && cols.rows[0]) ? cols.rows[0].count : (Array.isArray(cols) && cols[0] ? cols[0].count : 'unknown');
    console.log(`\n📊 knowledge_entries columns: ${count}`);

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
