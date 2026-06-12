import sql from '../lib/db';

async function main() {
  // Clear stale DB password hash
  await sql`DELETE FROM admin_config WHERE key = 'admin_password_hash'`;
  console.log('Deleted stale admin_password_hash from DB');

  // Verify it's gone
  const check = await sql`SELECT key FROM admin_config WHERE key = 'admin_password_hash'`;
  console.log('Remaining rows with that key:', check.length);
  
  console.log('DONE - Login with: admin / admin');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
