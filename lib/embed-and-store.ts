import { v4 as uuidv4 } from 'uuid';
import sql from './db';
import { embedText } from './embeddings';
import { pineconeIndex } from './pinecone';

export async function upsertKnowledgeEntry(title: string, category: string, content: string) {
    try {
        // Generate a new UUID for the entry
        const id = uuidv4();

        // 1. Save to Neon DB
        await sql`
            INSERT INTO knowledge_entries (id, title, content, category)
            VALUES (${id}, ${title}, ${content}, ${category})
        `;

        // 2. Embed content
        const embedding = await embedText(content);

        // 3. Upsert to Pinecone
        const index = pineconeIndex.get();
        if (index) {
            await index.upsert([{
                id,
                values: embedding,
                metadata: {
                    title,
                    category,
                    content
                }
            }]);
        } else {
            console.warn('Pinecone index not available, vector not upserted.');
        }

        return { success: true, id };
    } catch (error) {
        console.error('Error upserting knowledge entry:', error);
        return { success: false, error };
    }
}
