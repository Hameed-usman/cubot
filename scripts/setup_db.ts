import * as path from 'path';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

// Load env FIRST — before any other imports
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import sql from '../lib/db';

/**
 * Database migration script.
 * Usage: npm run setup-db
 *
 * Neon's HTTP driver rejects multi-statement queries sent as one string
 * ("cannot insert multiple commands into a prepared statement"), so we split
 * schema.sql into individual statements ourselves and run them one at a time.
 * This also gives per-statement error visibility instead of one silent
 * all-or-nothing failure.
 */

/**
 * Splits a SQL file into individual statements on top-level semicolons,
 * while treating anything between $$ ... $$ (function bodies) as opaque
 * so semicolons inside a trigger function don't get split apart.
 */
function splitSqlStatements(sqlText: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inDollarQuote = false;

  for (let i = 0; i < sqlText.length; i++) {
    if (sqlText[i] === '$' && sqlText[i + 1] === '$') {
      inDollarQuote = !inDollarQuote;
      current += '$$';
      i++;
      continue;
    }
    if (sqlText[i] === ';' && !inDollarQuote) {
      statements.push(current);
      current = '';
      continue;
    }
    current += sqlText[i];
  }
  if (current.trim()) statements.push(current);

  return statements
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

async function runMigration() {
  console.log('🗄️  Running database migration from schema.sql...\n');

  try {
    const schemaPath = path.join(process.cwd(), 'db', 'schema.sql');
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    const statements = splitSqlStatements(schemaContent);

    console.log(`   Found ${statements.length} statements to execute\n`);

    let successCount = 0;
    let failCount = 0;

    for (const stmt of statements) {
      // Skip fragments that are only comments (no actual SQL after stripping them)
      const withoutComments = stmt.replace(/--.*$/gm, '').trim();
      if (!withoutComments) continue;

      try {
        await (sql as any).query(stmt);
        successCount++;
      } catch (err: any) {
        failCount++;
        const preview = withoutComments.slice(0, 80).replace(/\s+/g, ' ');
        console.warn(`  ⚠️  Failed: ${preview}... — ${err.message}`);
      }
    }

    console.log('\n✅ Migration complete');
    console.log(`   Statements executed: ${successCount}`);
    if (failCount > 0) console.log(`   Statements failed:   ${failCount} (see warnings above)`);

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
