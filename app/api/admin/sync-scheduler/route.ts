import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getServerSession } from 'next-auth'
import { requireAdminAuth } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/sync-scheduler
 * Returns the current synchronization schedule.
 */
export async function GET(req: NextRequest) {
  try {
    const authRes = await requireAdminAuth(req)
    if (authRes) return authRes

    const schedules = await sql`
      SELECT * FROM sync_schedules
      ORDER BY created_at DESC
      LIMIT 1
    `

    return NextResponse.json(schedules[0] || {
      cron_expression: '0 */6 * * *',
      is_active: false,
      last_run_at: null,
      last_run_status: 'never_run'
    })
  } catch (error) {
    console.error('[SyncScheduler] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 })
  }
}

/**
 * POST /api/admin/sync-scheduler
 * Updates or creates a synchronization schedule.
 */
export async function POST(req: NextRequest) {
  try {
    const authRes = await requireAdminAuth(req)
    if (authRes) return authRes

    const { cron_expression, is_active } = await req.json()

    // Basic cron validation (very simple)
    if (!cron_expression || cron_expression.split(' ').length < 5) {
      return NextResponse.json({ error: 'Invalid cron expression' }, { status: 400 })
    }

    const existing = await sql`SELECT id FROM sync_schedules LIMIT 1`

    if (existing.length > 0) {
      await sql`
        UPDATE sync_schedules
        SET cron_expression = ${cron_expression},
            is_active = ${is_active},
            updated_at = NOW()
        WHERE id = ${existing[0].id}
      `
    } else {
      await sql`
        INSERT INTO sync_schedules (cron_expression, is_active)
        VALUES (${cron_expression}, ${is_active})
      `
    }

    return NextResponse.json({ success: true, message: 'Schedule updated successfully' })
  } catch (error) {
    console.error('[SyncScheduler] POST error:', error)
    return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 })
  }
}
