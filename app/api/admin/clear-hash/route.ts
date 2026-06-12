import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import bcrypt from 'bcryptjs'

// Emergency password reset route
// GET = resets password to "Cubot@2024"
export async function GET() {
  try {
    const newPassword = 'Cubot@2024'
    const hash = await bcrypt.hash(newPassword, 10)

    // Delete any existing hash and insert the known one
    await sql`DELETE FROM admin_config WHERE key = 'admin_password_hash'`
    await sql`
      INSERT INTO admin_config (key, value, updated_at)
      VALUES ('admin_password_hash', ${hash}, CURRENT_TIMESTAMP)
    `
    
    return NextResponse.json({ 
      success: true, 
      message: 'Password reset successfully!',
      username: 'admin',
      password: newPassword,
      note: 'Login with the credentials above, then change your password in Admin > Security tab'
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
