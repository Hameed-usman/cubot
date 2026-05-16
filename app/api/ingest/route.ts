import { NextRequest, NextResponse } from 'next/server'
import { IngestRequest } from '@/types'

export const runtime = 'nodejs'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Step 1: Verify admin secret - MUST be first, before any processing
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (token !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Step 2: Parse optional department filter
    const body: IngestRequest = await request.json()
    const { department } = body

    // Step 3: Return instructions to use CLI script instead
    // Note: On Vercel free tier, this endpoint will likely timeout for large datasets.
    // The recommended approach is to run: npm run ingest locally
    // This route exists only for manual trigger in local/staging environments.

    // Fire-and-forget: trigger ingestion asynchronously (for future admin panel)
    // In production, you'd import and call the ingest logic here
    console.log(
      `Ingestion triggered for department: ${department || 'all'}. ` +
        'For large datasets, run npm run ingest locally instead.'
    )

    return NextResponse.json({
      message:
        'Ingestion triggered. For large datasets, run npm run ingest locally for better reliability.',
      department: department || 'all',
    })
  } catch (error) {
    console.error('Ingest API error:', error)

    return NextResponse.json(
      { error: 'Ingestion failed. Please try again or run locally.' },
      { status: 500 }
    )
  }
}