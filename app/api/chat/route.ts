import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/ratelimit'
import { runRAGPipeline, runStreamingRAGPipeline } from '@/lib/rag'
import { ChatRequest } from '@/types'
import { classifyIntent, getIntentContext } from '@/lib/intent'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest): Promise<Response> {
  try {
    // Step 1: Rate limiting - runs first before any other processing
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1'

    const { success, reset } = await checkRateLimit(ip)

    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again in a moment.' },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
          },
        }
      )
    }

    // Step 2: Parse and validate request body
    const body: ChatRequest = await request.json()

    if (!body.message || typeof body.message !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request: message is required and must be a string' },
        { status: 400 }
      )
    }

    if (body.message.length > 500) {
      return NextResponse.json(
        { error: 'Message too long: maximum 500 characters allowed' },
        { status: 400 }
      )
    }

    // Step 3: Classify intent and get context
    const intent = classifyIntent(body.message)
    const intentContext = getIntentContext(intent)

    // Step 4: Run RAG pipeline (Streaming)
    const stream = await runStreamingRAGPipeline(body, intentContext, intent)

    // Step 5: Return Streaming Response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error: any) {
    // Step 5: Catch all unhandled errors
    console.error('[ChatRoute] API error:', error)

    const statusCode = error.statusCode || 500;
    const errorMessage = error.message || 'Unknown error occurred';

    // Check for specific error types or messages
    if (errorMessage.includes('rate limit') || errorMessage.includes('429') || statusCode === 429) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again in a moment.' },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: statusCode === 500 ? 'Cubot is temporarily unavailable. Please try again.' : errorMessage },
      { status: statusCode }
    )
  }
}