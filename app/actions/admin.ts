'use server'

import sql from '@/lib/db';
import { embedText } from '@/lib/embeddings';
import { pineconeIndex } from '@/lib/pinecone';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';

export async function getDepartmentData(dept: string, section: string) {
  const session = await getServerSession()
  if (!session) return ''
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
  const session = await getServerSession()
  if (!session) return { success: false, error: 'Unauthorized' }
  try {
    // 1. Check if entry exists
    const existing = await sql`
      SELECT id FROM knowledge_entries 
      WHERE category = ${dept} AND title = ${section}
      LIMIT 1
    `;
    
    // Generate content hash so keyword search can find this entry
    const contentHash = createHash('sha256').update(content).digest('hex')

    let id;
    if (existing.length > 0) {
      id = existing[0].id;
      // Update existing
      await sql`
        UPDATE knowledge_entries 
        SET content = ${content}, 
            content_hash = ${contentHash},
            search_vector = setweight(to_tsvector('english', COALESCE(${section}, '')), 'A') ||
                            setweight(to_tsvector('english', COALESCE(${dept}, '')), 'B') ||
                            setweight(to_tsvector('english', COALESCE(${content}, '')), 'C'),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
      `;
    } else {
      // Insert new
      id = uuidv4();
      await sql`
        INSERT INTO knowledge_entries (id, title, content, category, content_hash, search_vector)
        VALUES (
          ${id}, ${section}, ${content}, ${dept}, ${contentHash},
          setweight(to_tsvector('english', COALESCE(${section}, '')), 'A') ||
          setweight(to_tsvector('english', COALESCE(${dept}, '')), 'B') ||
          setweight(to_tsvector('english', COALESCE(${content}, '')), 'C')
        )
      `;
    }

    // 2. Embed content
    const embedding = await embedText(content);

    // 3. Determine correct Pinecone namespace so retrieval can find this content
    // Map the editor's dept+section to the retrieval engine's expected namespaces
    let namespace = 'general' // default fallback
    if (section === 'faculty') {
      namespace = 'faculty'
    } else if (section === 'fees') {
      namespace = 'finance'
    } else if (section === 'overview' || section === 'courses' || section === 'semesters') {
      if (dept === 'general') namespace = 'general'
      else if (dept === 'cs_it') namespace = 'dept-cs'
      else if (dept === 'bba') namespace = 'dept-bba'
      else if (dept === 'pharmacy') namespace = 'dept-pharmacy'
      else if (dept === 'nursing') namespace = 'dept-nursing'
      else namespace = 'academic'
    }

    // 4. Upsert to Pinecone in the correct namespace
    const index = pineconeIndex.get();
    if (index) {
      await index.namespace(namespace).upsert([{
        id,
        values: embedding,
        metadata: {
          title: section,
          category: dept,
          text: content, // Use 'text' as that's what retrieval reads from metadata
          content,
          sourceUrl: '',
          namespace,
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

export async function getKnowledgeEntries() {
  const session = await getServerSession()
  if (!session) return { success: false, error: 'Unauthorized' }
  try {
    const entries = await sql`
      SELECT id, title, category, source_type as type, source_url, created_at, updated_at
      FROM knowledge_entries
      ORDER BY updated_at DESC
    `;
    return { success: true, data: entries };
  } catch (error) {
    console.error('Error fetching knowledge entries:', error);
    return { success: false, error: 'Failed to fetch knowledge entries' };
  }
}

export async function deleteKnowledgeEntry(id: string) {
  const session = await getServerSession()
  if (!session) return { success: false, error: 'Unauthorized' }
  try {
    const entry = await sql`SELECT category, title, source_type as type FROM knowledge_entries WHERE id = ${id}`;
    if (entry.length > 0) {
      const index = pineconeIndex.get();
      if (index) {
        try {
          const e = entry[0];
          let namespace = 'general';
          if (e.type === 'document' || e.type === 'url') {
            namespace = 'documents';
          } else {
            if (e.title === 'faculty') namespace = 'faculty'
            else if (e.title === 'fees') namespace = 'finance'
            else if (e.category === 'cs_it') namespace = 'dept-cs'
            else if (e.category === 'bba') namespace = 'dept-bba'
            else if (e.category === 'pharmacy') namespace = 'dept-pharmacy'
            else if (e.category === 'nursing') namespace = 'dept-nursing'
            else namespace = 'academic'
          }
          await index.namespace(namespace).deleteOne(id);
        } catch (e) {
          console.error("Failed to delete from pinecone:", e);
        }
      }
      await sql`DELETE FROM knowledge_entries WHERE id = ${id}`;
    }
    return { success: true };
  } catch (error) {
    console.error('Error deleting knowledge entry:', error);
    return { success: false, error: 'Failed to delete knowledge entry' };
  }
}

export async function getUnansweredQuestions() {
  const session = await getServerSession()
  if (!session) return { success: false, error: 'Unauthorized' }
  try {
    const questions = await sql`
      SELECT id, question_text, language, persona, tier_reached, created_at, is_resolved
      FROM unanswered_questions
      ORDER BY created_at DESC
    `;
    return { success: true, data: questions };
  } catch (error) {
    console.error('Error fetching unanswered questions:', error);
    return { success: false, error: 'Failed to fetch unanswered questions' };
  }
}

export async function resolveUnansweredQuestion(id: number) {
  const session = await getServerSession()
  if (!session) return { success: false, error: 'Unauthorized' }
  try {
    await sql`
      UPDATE unanswered_questions
      SET is_resolved = true
      WHERE id = ${id}
    `;
    return { success: true };
  } catch (error) {
    console.error('Error resolving question:', error);
    return { success: false, error: 'Failed to resolve question' };
  }
}
