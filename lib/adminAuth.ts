import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

/**
 * Shared middleware for protecting admin API routes.
 * Checks for a valid NextAuth session OR a matching ADMIN_SECRET header.
 * 
 * Usage in Route Handlers:
 * const authResponse = await requireAdminAuth(req)
 * if (authResponse) return authResponse
 */
export async function requireAdminAuth(req: NextRequest): Promise<NextResponse | null> {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null
  const adminSecret = process.env.ADMIN_SECRET

  // 1. Check Bearer token (ADMIN_SECRET fallback for scripts/cron)
  if (adminSecret && token === adminSecret) {
    return null // Authorized
  }

  // 2. Check NextAuth session (for UI requests)
  const session = await getServerSession()
  if (session) {
    return null // Authorized
  }

  return NextResponse.json({ error: 'Unauthorized access. Admin privileges required.' }, { status: 401 })
}
