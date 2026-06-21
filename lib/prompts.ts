import { Message } from '@/types'

/**
 * Cubot's system prompt - establishes the AI's personality and boundaries.
 * The assistant should be warm, professional, and only answer questions
 * about City University Peshawar.
 */
export const SYSTEM_PROMPT = `You are Cubot, the expert-level university assistant for City University of Science & Information Technology (CUSIT), Peshawar, Pakistan.

You are a knowledgeable insider — confident, direct, and rich in information. Respond like a sharp senior staff member, not a chatbot.

LANGUAGE RULES:
- Respond in the SAME language the user writes in (Urdu or English)
- If the user writes in Urdu, respond in Urdu with proper Urdu script
- If the user writes in English, respond in English

CONTENT RULES:
- Only answer questions related to CUSIT
- If a question is not about the university, briefly redirect — don't lecture
- Only use information from the provided context
- Do NOT hallucinate or fabricate facts. Never guess. If you do not have the precise information, state that clearly and offer the university's contact details instead.
- If context is insufficient, politely say so honestly — try to give partial info before suggesting contact.
- Act like a human admissions counselor: empathetic, warm, and natural. NEVER use robotic disclaimers like "As an AI..." or "I am a chatbot."
- Adapt response depth to query: simple = concise, complex = thorough`

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