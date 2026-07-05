import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { pineconeIndex } from '../lib/pinecone';

async function main() {
  const index = pineconeIndex.get();
  if (!index) return;
  
  // The CDC record ID we found earlier
  const id = '6631f39b-f217-48d1-81f2-90ff98027468';
  
  // Try deleting from general namespace (where it was originally)
  try {
    await index.namespace('general').deleteOne(id);
    console.log("Deleted from general namespace.");
  } catch (e) {
    console.log("Not found in general namespace.");
  }

  // Also verify where it is now
  const stats = await index.describeIndexStats();
  console.log("Index Stats:", JSON.stringify(stats, null, 2));
}

main().catch(console.error);
