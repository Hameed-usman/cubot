import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { requireAdminAuth } from '@/lib/adminAuth';

export async function POST(req: Request) {
  try {
    // NextRequest is compatible with Request for our auth middleware needs
    const authRes = await requireAdminAuth(req as any);
    if (authRes) return authRes;

    const { action, url, priority, depth } = await req.json();

    if (action === 'start' || action === 'enqueue') {
      if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 });
      
      await sql`
        INSERT INTO crawl_queue (url, depth, priority) 
        VALUES (${url}, ${depth || 0}, ${priority || 10})
      `;
      
      // Update/create crawl_runs if starting fresh
      const activeRuns = await sql`SELECT id FROM crawl_runs WHERE status = 'running' LIMIT 1`;
      let runId = activeRuns.length > 0 ? activeRuns[0].id : uuidv4();
      
      if (activeRuns.length === 0) {
        await sql`
          INSERT INTO crawl_runs (id, status) VALUES (${runId}, 'running')
        `;
      }

      return NextResponse.json({ success: true, message: 'Enqueued', runId });
    }

    if (action === 'pause') {
      await sql`UPDATE crawl_runs SET status = 'paused' WHERE status = 'running'`;
      return NextResponse.json({ success: true, message: 'Crawls paused' });
    }

    if (action === 'resume') {
      await sql`UPDATE crawl_runs SET status = 'running' WHERE status = 'paused'`;
      return NextResponse.json({ success: true, message: 'Crawls resumed' });
    }
    
    if (action === 'clear') {
      await sql`DELETE FROM crawl_queue WHERE status IN ('pending', 'failed')`;
      return NextResponse.json({ success: true, message: 'Queue cleared' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Crawl API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const authRes = await requireAdminAuth(req as any);
    if (authRes) return authRes;

    const queueStats = await sql`
      SELECT status, COUNT(*) as count 
      FROM crawl_queue 
      GROUP BY status
    `;
    const activeRuns = await sql`
      SELECT * FROM crawl_runs 
      ORDER BY started_at DESC LIMIT 5
    `;
    return NextResponse.json({ queue: queueStats, activeRuns });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
