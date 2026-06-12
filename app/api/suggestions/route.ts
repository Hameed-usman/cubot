import { NextResponse } from 'next/server'

export async function GET() {
  const suggestions = [
    "What are the admission requirements for BS Computer Science?",
    "Tell me about the fee structure for BBA.",
    "Where is the campus located in Peshawar?",
    "What scholarships are available for new students?",
    "How can I contact the admissions office?"
  ]

  return NextResponse.json({ suggestions })
}
