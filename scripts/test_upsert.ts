import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const { upsertKnowledgeChunk } = await import('../lib/embed-and-store');
  const sql = (await import('../lib/db')).default;

  console.log("Creating Admissions Fall 2026...");
  const result = await upsertKnowledgeChunk({
    title: 'Admissions Fall 2026',
    content: 'Admissions for Fall 2026 are open. Apply at the portal.',
    category: 'admissions',
    sourceUrl: '',
    sourceType: 'manual',
    forceUpdate: true,
  });

  console.log("Result:", result);

  if (result.success) {
    const entry = await sql`SELECT * FROM knowledge_entries WHERE id = ${result.id}`;
    console.log("DB Entry:", JSON.stringify(entry, null, 2));
  }
}

main().catch(console.error);
