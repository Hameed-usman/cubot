import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdminAuth } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authRes = await requireAdminAuth(req);
    if (authRes) return authRes;

    const queueStats = await sql`
      SELECT status, COUNT(*) as count 
      FROM crawl_queue 
      GROUP BY status
    `;

    const recentRuns = await sql`
      SELECT * FROM crawl_runs 
      ORDER BY started_at DESC LIMIT 5
    `;

    const pageStats = await sql`
      SELECT crawl_status, COUNT(*) as count 
      FROM scraped_pages 
      GROUP BY crawl_status
    `;

    const recentFailedUrls = await sql`
      SELECT * FROM failed_urls
      ORDER BY attempted_at DESC LIMIT 10
    `;

    const recentRetrievals = await sql`
      SELECT * FROM retrieval_logs
      ORDER BY created_at DESC LIMIT 10
    `;

    // Attempt to get pinecone counts if possible, else 0 (Pinecone API requires fetching index stats separately, so we just return local db counts)
    const chunkStats = await sql`
      SELECT COUNT(*) as total_chunks FROM document_chunks
    `;

    return NextResponse.json({
      queue: queueStats,
      runs: recentRuns,
      pages: pageStats,
      failedUrls: recentFailedUrls,
      retrievals: recentRetrievals,
      chunks: chunkStats[0]?.total_chunks || 0
    });
  } catch (error: any) {
    console.error('Stats API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
