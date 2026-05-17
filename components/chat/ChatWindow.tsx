'use client'

import { useState, useRef, useEffect, FormEvent } from 'react'
import { Message } from '@/types'
import { MessageBubble } from './MessageBubble'
import { ChatInput } from './ChatInput'
import { TypingIndicator } from './TypingIndicator'
import { SuggestedQuestions } from './SuggestedQuestions'
import { AlertCircle, RefreshCw, Bot, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { motion } from 'framer-motion'

export function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleSubmit = async (message: string) => {
    if (!message.trim()) return

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
      const conversationHistory = messages.slice(-5).map((msg) => ({
        role: msg.role,
        content: msg.content,
      }))

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, conversationHistory }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Request failed')
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
    }
  }

  const handleSuggestedQuestion = (question: string) => {
    handleSubmit(question)
  }

  const clearError = () => setError(null)

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="flex flex-col h-[calc(100vh-140px)] glass-card rounded-3xl shadow-[0_8px_32px_rgba(0,61,165,0.15)] overflow-hidden border border-white/40 backdrop-blur-xl"
    >
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-cu-blue/90 to-cu-blue-mid/90 backdrop-blur-md text-white border-b border-white/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shadow-inner backdrop-blur-sm">
              <Bot className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg flex items-center gap-2 tracking-wide">
                Cubot
                <span className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.8)]" />
              </h2>
              <p className="text-white/80 text-sm flex items-center gap-1.5 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-cu-gold" />
                AI Assistant - Online
              </p>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-white/90 text-xs font-semibold tracking-wider uppercase bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-md">City University</p>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center justify-between px-4 py-3 bg-red-500/10 border-b border-red-500/20 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={clearError}
            className="text-red-600 border-red-200 hover:bg-red-50"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Dismiss
          </Button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gradient-to-b from-white/40 to-white/60">
        {messages.length === 0 && !isLoading && (
          <SuggestedQuestions onSelect={handleSuggestedQuestion} />
        )}

        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isStreaming={
              message.role === 'assistant' &&
              message.isStreaming &&
              message.id === messages[messages.length - 1]?.id
            }
            onSelectSuggestion={handleSuggestedQuestion}
          />
        ))}

        {isLoading && messages.length > 0 && <TypingIndicator />}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white/80 backdrop-blur-md border-t border-white/50">
        <ChatInput onSubmit={handleSubmit} isLoading={isLoading} disabled={isLoading} />
      </div>
    </motion.div>
  )
}