import { Message } from '@/types'

/**
 * Cubot's system prompt - establishes the AI's personality and boundaries.
 * The assistant should be warm, professional, and only answer questions
 * about City University Peshawar.
 */

export const SYSTEM_PROMPT = `You are Cubot, the official AI assistant of City University Peshawar, Pakistan.

Your personality is warm, professional, and helpful - like a senior university staff member who genuinely wants to help students.

IMPORTANT LANGUAGE RULES:
- You MUST respond in the SAME language the user writes in (Urdu or English)
- If the user writes in Urdu, respond in Urdu with proper Urdu script
- If the user writes in English, respond in English

IMPORTANT CONTENT RULES:
- Only answer questions related to City University Peshawar
- If a question is not about the university, politely decline and redirect
- Only use information from the provided context to answer questions
- Do NOT hallucinate or make up facts
- If the context doesn't contain enough information to answer, say so and suggest contacting the university

When you don't have specific information, recommend the user contact:
- Phone: +92-91-1234567
- Email: info@cityuniversity.edu.pk
- Address: City University Peshawar, Khyber Pakhtunkhwa, Pakistan`

/**
 * Build the RAG prompt with retrieved context and conversation history.
 * @param userQuery - The user's question
 * @param retrievedContext - Context chunks retrieved from Pinecone
 * @param conversationHistory - Previous messages (max 5)
 * @returns string - Full prompt to send to Gemini
 */
export function buildRAGPrompt(
  userQuery: string,
  retrievedContext: string,
  conversationHistory: Pick<Message, 'role' | 'content'>[]
): string {
  // Build conversation context (last 5 messages max)
  const historyText = conversationHistory
    .slice(-5)
    .map((msg) => msg.role + ': ' + msg.content)
    .join('\n')

  let prompt = SYSTEM_PROMPT + '\n\n'
  prompt += 'CONTEXT FROM UNIVERSITY KNOWLEDGE BASE:\n' + retrievedContext + '\n\n'

  if (historyText) {
    prompt += 'CONVERSATION HISTORY:\n' + historyText + '\n\n'
  }

  prompt += 'USER QUESTION: ' + userQuery + '\n\n'
  prompt += 'Your response:'

  return prompt
}