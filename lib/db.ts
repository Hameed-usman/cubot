import { neon, neonConfig } from '@neondatabase/serverless';

// Optionally configure neon to work in edge environments if needed, but not strictly required
// neonConfig.fetchConnectionCache = true;

const sql = neon(process.env.NEON_DATABASE_URL || '');

export default sql;
