import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/ratelimit'
import { runRAGPipeline } from '@/lib/rag'
import { ChatRequest } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest): Promise<NextResponse> {
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

    // Step 3: Run RAG pipeline and get streaming response
    const stream = await runRAGPipeline(body)

    // Step 4: Return streaming response
    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (error) {
    // Step 5: Catch all unhandled errors
    console.error('Chat API error:', error)

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred'

    // Check for specific error types
    if (errorMessage.includes('rate limit')) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again in a moment.' },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: 'Cubot is temporarily unavailable. Please try again.' },
      { status: 500 }
    )
  }
}