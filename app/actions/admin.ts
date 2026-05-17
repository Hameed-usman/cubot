'use server'

import sql from '@/lib/db';
import { embedText } from '@/lib/embeddings';
import { pineconeIndex } from '@/lib/pinecone';
import { v4 as uuidv4 } from 'uuid';

export async function getDepartmentData(dept: string, section: string) {
  try {
    const result = await sql`
      SELECT content FROM knowledge_entries 
      WHERE category = ${dept} AND title = ${section}
      LIMIT 1
    `;
    
    if (result.length > 0) {
      return result[0].content;
    }
    return '';
  } catch (error) {
    console.error(`Error reading data for ${dept}/${section}:`, error);
    return '';
  }
}

export async function saveDepartmentData(dept: string, section: string, content: string) {
  try {
    // 1. Check if entry exists
    const existing = await sql`
      SELECT id FROM knowledge_entries 
      WHERE category = ${dept} AND title = ${section}
      LIMIT 1
    `;
    
    let id;
    if (existing.length > 0) {
      id = existing[0].id;
      // Update existing
      await sql`
        UPDATE knowledge_entries 
        SET content = ${content}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
      `;
    } else {
      // Insert new
      id = uuidv4();
      await sql`
        INSERT INTO knowledge_entries (id, title, content, category)
        VALUES (${id}, ${section}, ${content}, ${dept})
      `;
    }

    // 2. Embed content
    const embedding = await embedText(content);

    // 3. Upsert to Pinecone
    const index = pineconeIndex.get();
    if (index) {
      await index.upsert([{
        id,
        values: embedding,
        metadata: {
          title: section,
          category: dept,
          content
        }
      }]);
    } else {
      console.warn('Pinecone index not available, vector not upserted.');
    }

    return { success: true };
  } catch (error) {
    console.error(`Error saving data for ${dept}/${section}:`, error);
    return { success: false, error: 'Failed to save data' };
  }
}
