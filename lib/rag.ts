import { ChatRequest } from '@/types'

/**
 * Simple chat using direct Groq API (no SDK needed)
 */

const UNIVERSITY_INFO = `
You are Cubot, the official AI assistant of City University Peshawar, Pakistan.
Your personality is warm, professional, and helpful - like a senior university staff member.
IMPORTANT: Respond in the SAME language the user writes in (Urdu or English).

Key Information:
- City University Peshawar is in Peshawar, Khyber Pakhtunkhwa, Pakistan
- Phone: +92-91-1234567, Email: info@cityuniversity.edu.pk
- Programs: Computer Science, IT, BBA, Pharmacy, Nursing
- Admission: At least 45% marks in Intermediate for Bachelor's
- Fall Semester starts August, Spring Semester starts January
- CS/IT fee: ~95,000 Rs/semester, BBA: ~80,000 Rs/semester
- Facilities: Library, computer labs, sports, cafeteria, transport
`

/**
 * Run the chat pipeline
 */
export async function runRAGPipeline(
  request: ChatRequest
): Promise<ReadableStream<string>> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    throw new Error('Groq is not configured. Please set GROQ_API_KEY.')
  }

  const { message, conversationHistory } = request

  // Build conversation context
  const historyText = conversationHistory
    .slice(-5)
    .map(msg => msg.role + ': ' + msg.content)
    .join('\n')

  const prompt = `${UNIVERSITY_INFO}
${historyText ? 'Previous conversation:\n' + historyText + '\n' : ''}
User: ${message}
Answer as Cubot:`

  // Use Groq API directly
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 512
    })
  })

  if (!response.ok) {
    const err = await response.text()
    console.error('Groq API error:', err)
    console.error('Status:', response.status)
    throw new Error('AI service error: ' + response.status + ' - ' + err)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || 'Sorry, I could not find an answer.'

  return new ReadableStream({
    start(controller) {
      controller.enqueue(content)
      controller.close()
    }
  })
}