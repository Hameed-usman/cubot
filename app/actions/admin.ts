'use server'

import sql from '@/lib/db';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';

export async function updateAdminPassword(newPassword: string) {
  const session = await getServerSession()
  if (!session) return { success: false, error: 'Unauthorized' }
  try {
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    // Upsert the password hash into the admin_config table
    await sql`
      INSERT INTO admin_config (key, value, updated_at)
      VALUES ('admin_password_hash', ${newPasswordHash}, CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE 
      SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
    `;
    return { success: true };
  } catch (error) {
    console.error('Error updating admin password:', error);
    return { success: false, error: 'Failed to update password' };
  }
}
