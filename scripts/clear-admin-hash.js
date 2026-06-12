const { neon } = require('@neondatabase/serverless');

const sql = neon('postgresql://neondb_owner:npg_3PAujYmt6JcE@ep-aged-silence-ap6pw6y0-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
  // Clear stale DB password hash
  const del = await sql.query("DELETE FROM admin_config WHERE key = 'admin_password_hash'");
  console.log('Deleted rows:', del.rowCount);

  // Verify it's gone
  const check = await sql.query("SELECT key, value FROM admin_config WHERE key = 'admin_password_hash'");
  console.log('Remaining rows:', check.rows);
  
  console.log('DONE - You can now login with ADMIN_PASSWORD from .env.local');
}

main().catch(console.error);
