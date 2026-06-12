import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import { requireAdminAuth } from '@/lib/adminAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Note: To secure this route, you should add an API key or session check.
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const authRes = await requireAdminAuth(request)
    if (authRes) return authRes


    // Spawn the scraper in a detached background process so the API route can return immediately
    // without waiting for the crawl to finish (which could take 5-10 minutes and time out).
    const scriptPath = path.join(process.cwd(), 'scripts', 'full-site-scraper.ts')
    
    // We use tsx because it's a TS file
    const child = spawn('npx', ['tsx', '--env-file=.env.local', scriptPath], {
      detached: true,
      stdio: 'ignore', // Ignore stdio to allow fully detached execution
      windowsHide: true
    })

    // Unref the child process so it runs completely independent of this Node process
    child.unref()

    return NextResponse.json({
      message: 'Scraping process started successfully in the background.',
      status: 'started'
    })
  } catch (error: any) {
    console.error('[ScrapeAPI] Error:', error)
    return NextResponse.json(
      { error: 'Failed to start scraping process' },
      { status: 500 }
    )
  }
}
