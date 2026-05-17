'use client'

import { useState, useRef, useCallback } from 'react'
import { Message } from '@/types'
import { MessageBubble } from './MessageBubble'
import { InputBar } from './InputBar'
import { TypingIndicator } from './TypingIndicator'
import { QuickQuestions } from './QuickQuestions'
import { AlertCircle, RefreshCw, Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { showToast } from '@/components/ui/Toast'
import { useEffect } from 'react'

export function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  // Ref-based guard — prevents any double-call regardless of React batching or StrictMode
  const isSubmittingRef = useRef(false)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleSubmit = useCallback(async (message: string) => {
    if (!message.trim()) return
    // Hard guard: if a request is already in-flight, ignore this call entirely
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)
    setError(null)

    const assistantMessageId = crypto.randomUUID()

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          conversationHistory: messages.slice(-6).map(({ role, content }) => ({ role, content })),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Request failed. Please try again.')
      }

      const data = await response.json()

      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: data.message,
          intent: data.intent,
          suggestions: data.suggestions,
          timestamp: new Date(),
        },
      ])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: errorMessage,
          timestamp: new Date(),
          error: true,
        },
      ])
    } finally {
      setIsLoading(false)
      isSubmittingRef.current = false
    }
  }, [messages])

  const handleSuggestedQuestion = useCallback((question: string) => {
    handleSubmit(question)
  }, [handleSubmit])

  const handleClearChat = useCallback(() => {
    setMessages([])
    setError(null)
    showToast({ message: 'Chat cleared ✦', duration: 2000 })
  }, [])

  const hasMessages = messages.length > 0

  // Track the latest bot message ID for typewriter
  const latestBotId = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i].id
    }
    return null
  })()

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      {hasMessages && (
        <div
          className="flex items-center justify-end px-4 py-2 flex-shrink-0 border-b"
          style={{ borderBottomColor: 'rgba(255,255,255,0.05)' }}
        >
          <button
            onClick={handleClearChat}
            aria-label="Clear chat history"
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors px-2 py-1 rounded-lg hover:bg-white/5 font-sans"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            Clear chat
          </button>
        </div>
      )}

      {/* Error Banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center justify-between px-4 py-3 bg-red-950/40 border-b border-red-500/20 flex-shrink-0"
          >
            <div className="flex items-center gap-2 text-red-400 text-sm font-sans">
              <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              aria-label="Dismiss error"
              className="flex items-center gap-1 text-xs text-red-400/70 hover:text-red-400 transition-colors px-2 py-1 rounded border border-red-500/20 hover:border-red-500/40 font-sans ml-3 flex-shrink-0"
            >
              <RefreshCw className="w-3 h-3" aria-hidden="true" />
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <main
        id="chat-messages"
        aria-label="Chat messages"
        aria-live="polite"
        className="flex-1 overflow-y-auto px-4 py-5 space-y-5"
      >
        <AnimatePresence>
          {!hasMessages && !isLoading && (
            <motion.div
              key="quick-questions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.2 } }}
            >
              <QuickQuestions onSelect={handleSuggestedQuestion} />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isLatestBot={message.id === latestBotId && message.role === 'assistant' && !isLoading}
              onSelectSuggestion={handleSuggestedQuestion}
            />
          ))}
        </AnimatePresence>

        <AnimatePresence>
          {isLoading && hasMessages && (
            <motion.div key="typing" exit={{ opacity: 0 }}>
              <TypingIndicator />
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} aria-hidden="true" />
      </main>

      {/* Input */}
      <InputBar onSubmit={handleSubmit} isLoading={isLoading} disabled={isLoading} />
    </div>
  )
}