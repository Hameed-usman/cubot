'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Send, Loader2, X, Minus, MessageCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Types ─────────────────────────────────────────────────────────
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  suggestions?: string[]
}

// ─── Widget Chat ────────────────────────────────────────────────────
export default function WidgetPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [sessionId] = useState(() => crypto.randomUUID())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isSubmittingRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Welcome message on mount
  useEffect(() => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: "Hi! I'm **Cubot**, City University's AI assistant. Ask me anything about admissions, fee structure, courses, or faculty — I'm here 24/7! 🎓",
      timestamp: new Date(),
      suggestions: ['What are admission requirements?', 'Tell me about fee structure', 'What programs are offered?'],
    }])
  }, [])

  const handleSubmit = useCallback(async (msg: string) => {
    const text = msg.trim()
    if (!text || isLoading || isSubmittingRef.current) return
    isSubmittingRef.current = true

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    const assistantId = crypto.randomUUID()

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversationHistory: messages.slice(-6).map(({ role, content }) => ({ role, content })),
          sessionId,
        }),
      })

      if (!response.ok) throw new Error('Request failed')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No stream')

      const decoder = new TextDecoder()
      let fullText = ''

      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', timestamp: new Date() }])
      setIsLoading(false)

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        fullText += chunk
        const metaIdx = fullText.indexOf('[METADATA]')
        const display = metaIdx !== -1 ? fullText.slice(0, metaIdx) : fullText
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: display } : m))
      }

      const metaIdx = fullText.indexOf('[METADATA]')
      const finalContent = metaIdx !== -1 ? fullText.slice(0, metaIdx).trim() : fullText.trim()
      let suggestions: string[] = []
      if (metaIdx !== -1) {
        try { suggestions = JSON.parse(fullText.slice(metaIdx + '[METADATA]'.length).trim()).suggestions || [] } catch {}
      }

      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: finalContent, suggestions } : m))
    } catch {
      setMessages(prev => prev.map(m => m.id === assistantId
        ? { ...m, content: "I'm having trouble connecting. Please try again." }
        : m))
    } finally {
      setIsLoading(false)
      isSubmittingRef.current = false
    }
  }, [messages, sessionId, isLoading])

  return (
    <div
      className="flex flex-col"
      style={{
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(160deg, #0d1526 0%, #080d1a 100%)',
        fontFamily: 'var(--font-dm-sans), system-ui, sans-serif',
      }}
    >
      {/* ── Widget Header ── */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #1a3a8f, #0f2460)', borderBottom: '1px solid rgba(201,162,39,0.2)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm"
            style={{ background: 'linear-gradient(135deg, #c9a227, #e8bc3a)', color: '#080d1a' }}
          >
            C
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-none">Cubot</p>
            <p className="text-[10px] text-white/50 leading-none mt-0.5">City University Peshawar</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] text-green-400/80">Online</span>
          <button
            onClick={() => setMinimized(v => !v)}
            className="ml-2 w-7 h-7 rounded-lg flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
            style={{ background: 'rgba(255,255,255,0.1)' }}
            aria-label={minimized ? 'Expand chat' : 'Minimize chat'}
          >
            <Minus className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <AnimatePresence>
        {!minimized && (
          <motion.main
            key="chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 overflow-y-auto px-3 py-3 space-y-3"
          >
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
                  style={msg.role === 'user'
                    ? { background: 'linear-gradient(135deg, #c9a227, #e8bc3a)', color: '#080d1a', fontWeight: 500 }
                    : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.9)' }
                  }
                >
                  <p className="whitespace-pre-wrap">{msg.content || (isLoading ? '…' : '')}</p>

                  {/* Suggestion chips */}
                  {msg.role === 'assistant' && msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {msg.suggestions.slice(0, 3).map((s, i) => (
                        <button
                          key={i}
                          onClick={() => handleSubmit(s)}
                          className="text-xs px-2.5 py-1 rounded-full border transition-all hover:border-yellow-400/50 hover:text-yellow-300"
                          style={{ borderColor: 'rgba(201,162,39,0.3)', color: 'rgba(201,162,39,0.8)', background: 'rgba(201,162,39,0.05)' }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-4 py-3 flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 bounce-dot-1 inline-block" />
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 bounce-dot-2 inline-block" />
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 bounce-dot-3 inline-block" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </motion.main>
        )}
      </AnimatePresence>

      {/* ── Minimized pill ── */}
      {minimized && (
        <div className="flex-1 flex items-center justify-center">
          <button
            onClick={() => setMinimized(false)}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm"
            style={{ background: 'rgba(201,162,39,0.15)', border: '1px solid rgba(201,162,39,0.3)', color: '#c9a227' }}
          >
            <MessageCircle className="w-4 h-4" />
            Open Chat
          </button>
        </div>
      )}

      {/* ── Input ── */}
      {!minimized && (
        <div
          className="flex-shrink-0 px-3 py-3 border-t"
          style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(8,13,26,0.8)' }}
        >
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(input) } }}
              placeholder="Ask Cubot…"
              aria-label="Type your message"
              className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-white/5 border text-white placeholder-white/30 focus:outline-none"
              style={{ borderColor: 'rgba(255,255,255,0.1)' }}
              onFocus={e => (e.target.style.borderColor = 'rgba(201,162,39,0.5)')}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
            />
            <button
              onClick={() => handleSubmit(input)}
              disabled={!input.trim() || isLoading}
              className="w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-all"
              style={{
                background: input.trim() && !isLoading ? 'linear-gradient(135deg, #c9a227, #e8bc3a)' : 'rgba(255,255,255,0.06)',
                cursor: !input.trim() || isLoading ? 'not-allowed' : 'pointer',
              }}
              aria-label="Send message"
            >
              {isLoading
                ? <Loader2 className="w-4 h-4 animate-spin text-white/40" />
                : <Send className={`w-4 h-4 ${input.trim() ? 'text-black' : 'text-white/30'}`} />
              }
            </button>
          </div>
          <p className="text-[10px] text-white/20 text-center mt-1.5">
            Powered by Cubot AI — City University Peshawar
          </p>
        </div>
      )}
    </div>
  )
}
