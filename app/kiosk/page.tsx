'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, MicOff, Send, Loader2, Volume2, VolumeX, RotateCcw, Wifi, WifiOff } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Types ─────────────────────────────────────────────────────────
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// ─── Rotating Idle Prompts ──────────────────────────────────────────
const IDLE_PROMPTS = [
  'Ask me about admissions requirements',
  'سوال کریں: BS Computer Science fees کیا ہیں؟',
  'Ask about scholarships for new students',
  'Ask about available departments & programs',
  'سوال کریں: داخلے کی آخری تاریخ کیا ہے؟',
  'Ask about the campus location & facilities',
  'Ask how to contact the admissions office',
]

// ─── Kiosk Chat Window ─────────────────────────────────────────────
function KioskChatWindow() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId] = useState(() => crypto.randomUUID())
  const [isListening, setIsListening] = useState(false)
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const [idlePromptIdx, setIdlePromptIdx] = useState(0)
  const [lastActivity, setLastActivity] = useState(Date.now())
  const [showIdle, setShowIdle] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const isSubmittingRef = useRef(false)
  const synthRef = useRef<SpeechSynthesis | null>(null)

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Idle prompt rotation
  useEffect(() => {
    const interval = setInterval(() => {
      setIdlePromptIdx(i => (i + 1) % IDLE_PROMPTS.length)
    }, 3500)
    return () => clearInterval(interval)
  }, [])

  // Init TTS
  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis
    }
  }, [])

  const speak = useCallback((text: string) => {
    if (!ttsEnabled || !synthRef.current) return
    synthRef.current.cancel()
    // Strip markdown for TTS
    const clean = text.replace(/[#*_`[\]()]/g, '').replace(/\n+/g, '. ').slice(0, 600)
    const utterance = new SpeechSynthesisUtterance(clean)
    utterance.rate = 0.92
    utterance.pitch = 1.05
    utterance.volume = 1
    synthRef.current.speak(utterance)
  }, [ttsEnabled])

  const handleSubmit = useCallback(async (msg: string) => {
    const text = msg.trim()
    if (!text || isLoading || isSubmittingRef.current) return
    isSubmittingRef.current = true
    setLastActivity(Date.now())
    setShowIdle(false)

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
          conversationHistory: messages.slice(-4).map(({ role, content }) => ({ role, content })),
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

      // Final parse
      const metaIdx = fullText.indexOf('[METADATA]')
      const finalContent = metaIdx !== -1 ? fullText.slice(0, metaIdx).trim() : fullText.trim()
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: finalContent } : m))
      speak(finalContent)
    } catch {
      setMessages(prev => prev.map(m => m.id === assistantId
        ? { ...m, content: "Sorry, I'm having trouble connecting. Please try again." }
        : m))
    } finally {
      setIsLoading(false)
      isSubmittingRef.current = false
    }
  }, [messages, sessionId, isLoading, speak])

  // Voice recognition
  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Voice recognition not supported in this browser.')
      return
    }

    if (synthRef.current) synthRef.current.cancel()

    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)
    recognition.onresult = (e: any) => {
      const transcript = e.results[0]?.[0]?.transcript
      if (transcript) {
        setInput(transcript)
        handleSubmit(transcript)
      }
    }
    recognition.start()
  }, [handleSubmit])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }, [])

  const handleReset = useCallback(() => {
    if (synthRef.current) synthRef.current.cancel()
    setMessages([])
    setInput('')
    setIsLoading(false)
    setShowIdle(true)
    setLastActivity(Date.now())
    isSubmittingRef.current = false
  }, [])

  // Auto-reset after 3 min inactivity
  useEffect(() => {
    const check = setInterval(() => {
      if (messages.length > 0 && Date.now() - lastActivity > 3 * 60 * 1000) {
        handleReset()
      }
    }, 30000)
    return () => clearInterval(check)
  }, [messages, lastActivity, handleReset])

  const hasMessages = messages.length > 0

  return (
    <div className="flex flex-col h-screen w-screen" style={{ background: '#080d1a' }}>
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-8 py-4 flex-shrink-0 border-b" style={{ borderColor: 'rgba(201,162,39,0.15)', background: 'rgba(8,13,26,0.9)', backdropFilter: 'blur(20px)' }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #c9a227, #e8bc3a)' }}>
            <span className="text-2xl font-bold text-black">C</span>
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-syne)', color: '#c9a227' }}>Cubot</h1>
            <p className="text-xs text-white/40">City University Peshawar — AI Assistant</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* TTS toggle */}
          <button
            onClick={() => { if (synthRef.current) synthRef.current.cancel(); setTtsEnabled(v => !v) }}
            className="w-11 h-11 rounded-xl flex items-center justify-center border transition-all"
            style={{ borderColor: ttsEnabled ? 'rgba(201,162,39,0.5)' : 'rgba(255,255,255,0.1)', background: ttsEnabled ? 'rgba(201,162,39,0.1)' : 'rgba(255,255,255,0.04)' }}
            aria-label={ttsEnabled ? 'Disable voice output' : 'Enable voice output'}
          >
            {ttsEnabled ? <Volume2 className="w-5 h-5 text-yellow-400" /> : <VolumeX className="w-5 h-5 text-white/40" />}
          </button>

          {/* Reset */}
          {hasMessages && (
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm transition-all"
              style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)' }}
              aria-label="Start new conversation"
            >
              <RotateCcw className="w-4 h-4" />
              New Session
            </button>
          )}
        </div>
      </header>

      {/* ── Idle state ── */}
      <AnimatePresence>
        {!hasMessages && showIdle && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex-1 flex flex-col items-center justify-center gap-10 px-8"
          >
            {/* Pulse ring */}
            <div className="relative flex items-center justify-center">
              <div className="absolute w-56 h-56 rounded-full animate-ping" style={{ background: 'rgba(201,162,39,0.06)', animationDuration: '2.5s' }} />
              <div className="absolute w-44 h-44 rounded-full animate-ping" style={{ background: 'rgba(201,162,39,0.08)', animationDuration: '2s' }} />
              <div className="w-36 h-36 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #c9a22720, #1a3a8f30)', border: '2px solid rgba(201,162,39,0.3)' }}>
                <span className="text-7xl select-none">🤖</span>
              </div>
            </div>

            <div className="text-center max-w-2xl">
              <h2 className="text-4xl font-bold mb-3" style={{ fontFamily: 'var(--font-syne)', color: '#c9a227' }}>
                How can I help you today?
              </h2>
              <p className="text-white/50 text-lg mb-6">Ask me anything about City University Peshawar — admissions, courses, fees, faculty &amp; more.</p>

              {/* Rotating prompt */}
              <div className="h-10 overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={idlePromptIdx}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.4 }}
                    className="text-base"
                    style={{ color: 'rgba(201,162,39,0.7)' }}
                  >
                    💡 {IDLE_PROMPTS[idlePromptIdx]}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>

            {/* Big voice button */}
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={startListening}
              className="flex items-center gap-4 px-10 py-5 rounded-3xl text-xl font-semibold shadow-2xl transition-all"
              style={{
                background: 'linear-gradient(135deg, #c9a227, #e8bc3a)',
                color: '#080d1a',
                boxShadow: '0 0 60px rgba(201,162,39,0.4)',
              }}
              aria-label="Tap to speak"
            >
              <Mic className="w-7 h-7" />
              Tap to Speak
            </motion.button>

            <p className="text-white/25 text-sm">or type your question below ↓</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Messages ── */}
      {hasMessages && (
        <main className="flex-1 overflow-y-auto px-6 md:px-16 py-6 space-y-6">
          <AnimatePresence initial={false}>
            {messages.map(msg => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-3xl rounded-3xl px-7 py-5 text-lg leading-relaxed ${
                    msg.role === 'user'
                      ? 'text-black font-medium'
                      : 'text-white/90'
                  }`}
                  style={msg.role === 'user'
                    ? { background: 'linear-gradient(135deg, #c9a227, #e8bc3a)' }
                    : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }
                  }
                >
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-3 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <span className="text-base font-semibold" style={{ color: '#c9a227' }}>Cubot</span>
                    </div>
                  )}
                  <p className="whitespace-pre-wrap">{msg.content || (isLoading ? '' : '…')}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="rounded-3xl px-7 py-5 flex items-center gap-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#c9a227' }} />
                <span className="text-white/50">Cubot is thinking…</span>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </main>
      )}

      {/* ── Input bar ── */}
      <div className="flex-shrink-0 px-6 md:px-16 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(8,13,26,0.8)', backdropFilter: 'blur(20px)' }}>
        <div className="flex items-center gap-3 max-w-5xl mx-auto">
          {/* Text input */}
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(input) } }}
            placeholder="Type your question here…"
            aria-label="Type your question"
            className="flex-1 px-6 py-4 rounded-2xl text-lg bg-white/5 border focus:outline-none text-white placeholder-white/30"
            style={{
              borderColor: 'rgba(255,255,255,0.1)',
              boxShadow: 'none',
            }}
            onFocus={e => (e.target.style.borderColor = 'rgba(201,162,39,0.5)')}
            onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
          />

          {/* Voice button */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={isListening ? stopListening : startListening}
            className="w-14 h-14 flex-shrink-0 rounded-2xl flex items-center justify-center transition-all"
            style={{
              background: isListening ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)',
              border: `2px solid ${isListening ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)'}`,
            }}
            aria-label={isListening ? 'Stop listening' : 'Start voice input'}
          >
            {isListening
              ? <MicOff className="w-6 h-6 text-red-400" />
              : <Mic className="w-6 h-6 text-white/60" />
            }
          </motion.button>

          {/* Send button */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => handleSubmit(input)}
            disabled={!input.trim() || isLoading}
            className="w-14 h-14 flex-shrink-0 rounded-2xl flex items-center justify-center transition-all"
            style={{
              background: input.trim() && !isLoading ? 'linear-gradient(135deg, #c9a227, #e8bc3a)' : 'rgba(255,255,255,0.06)',
              border: `2px solid ${input.trim() && !isLoading ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
              cursor: !input.trim() || isLoading ? 'not-allowed' : 'pointer',
            }}
            aria-label="Send message"
          >
            {isLoading
              ? <Loader2 className="w-6 h-6 animate-spin text-white/50" />
              : <Send className={`w-6 h-6 ${input.trim() && !isLoading ? 'text-black' : 'text-white/30'}`} />
            }
          </motion.button>
        </div>

        {isListening && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-sm mt-2"
            style={{ color: 'rgba(239,68,68,0.8)' }}
          >
            🔴 Listening… speak now
          </motion.p>
        )}
      </div>
    </div>
  )
}

export default function KioskPage() {
  return <KioskChatWindow />
}
