import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import sql from '../lib/db';

async function main() {
  const db = (await import('../lib/db')).default;
  const url = 'https://cu.edu.pk/ProgramsOffered/FeeStructures/3cce6efe_BS-CS%20%20%20Fall%202025.pdf';
  await db`DELETE FROM knowledge_entries WHERE source_url = ${url}`;
  console.log("Deleted old chunks from DB");
}

main().catch(console.error);
