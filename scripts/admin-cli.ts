import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import sql from '../lib/db';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  console.log('🛠️  Admin CLI\n');

  if (command === 'stats') {
    const queue = await sql`SELECT status, COUNT(*) as count FROM crawl_queue GROUP BY status`;
    console.log('Queue Stats:');
    queue.forEach((q: any) => console.log(`  ${q.status}: ${q.count}`));

    const activeRuns = await sql`SELECT * FROM crawl_runs ORDER BY started_at DESC LIMIT 1`;
    if (activeRuns.length > 0) {
      console.log('\nActive Run:');
      console.log(`  Status: ${activeRuns[0].status}`);
      console.log(`  Pages Crawled: ${activeRuns[0].pages_crawled}`);
      console.log(`  Chunks Created: ${activeRuns[0].chunks_created}`);
    } else {
      console.log('\nNo active runs.');
    }
  } else if (command === 'clear-queue') {
    await sql`DELETE FROM crawl_queue WHERE status IN ('pending', 'failed')`;
    console.log('✅ Queue cleared.');
  } else if (command === 'enqueue') {
    const url = args[1];
    if (!url) {
      console.log('❌ URL required. Usage: npx tsx scripts/admin-cli.ts enqueue <url>');
      process.exit(1);
    }
    await sql`INSERT INTO crawl_queue (url, depth, priority) VALUES (${url}, 0, 10)`;
    console.log(`✅ Enqueued: ${url}`);
  } else if (command === 'pause') {
    await sql`UPDATE crawl_runs SET status = 'paused' WHERE status = 'running'`;
    console.log('✅ Crawls paused.');
  } else if (command === 'resume') {
    await sql`UPDATE crawl_runs SET status = 'running' WHERE status = 'paused'`;
    console.log('✅ Crawls resumed.');
  } else {
    console.log(`Available Commands:
  stats         - Show current queue and run statistics
  clear-queue   - Clear pending and failed queue items
  enqueue <url> - Add a URL to the queue
  pause         - Pause active crawls
  resume        - Resume paused crawls
`);
  }

  process.exit(0);
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
