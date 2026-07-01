'use server'

import sql from '@/lib/db';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';

export async function getAdminCredentials() {
  const session = await getServerSession()
  if (!session) return { success: false, error: 'Unauthorized' }
  
  try {
    const res = await sql`SELECT key, value FROM admin_config WHERE key IN ('admin_username', 'admin_password_hash')`;
    let username = process.env.ADMIN_USERNAME || 'admin';
    let hasCustomPassword = false;

    res.forEach(row => {
      if (row.key === 'admin_username') username = row.value;
      if (row.key === 'admin_password_hash') hasCustomPassword = true;
    });

    return { success: true, username, hasCustomPassword };
  } catch (err) {
    return { success: false, error: 'Failed to fetch credentials' };
  }
}

export async function updateAdminCredentials(username: string, newPassword?: string) {
  const session = await getServerSession()
  if (!session) return { success: false, error: 'Unauthorized' }
  try {
    if (username) {
      await sql`
        INSERT INTO admin_config (key, value, updated_at)
        VALUES ('admin_username', ${username.trim()}, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
      `;
    }

    if (newPassword) {
      const salt = await bcrypt.genSalt(10);
      const newPasswordHash = await bcrypt.hash(newPassword, salt);
      await sql`
        INSERT INTO admin_config (key, value, updated_at)
        VALUES ('admin_password_hash', ${newPasswordHash}, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
      `;
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating admin credentials:', error);
    return { success: false, error: 'Failed to update credentials' };
  }
}
