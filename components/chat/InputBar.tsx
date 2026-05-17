'use client'

import { useState, useRef, useCallback, FormEvent } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAutoResize } from '@/hooks/useAutoResize'
import { containsRTL, cn } from '@/lib/utils'

interface InputBarProps {
  onSubmit: (message: string) => void
  isLoading: boolean
  disabled?: boolean
}

export function InputBar({ onSubmit, isLoading, disabled }: InputBarProps) {
  const [input, setInput] = useState('')
  const [sendPressed, setSendPressed] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isRTL = containsRTL(input)

  useAutoResize(textareaRef, input, 24, 5)

  const handleSubmit = useCallback((e?: FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || isLoading || disabled) return

    setSendPressed(true)
    setTimeout(() => setSendPressed(false), 200)

    onSubmit(input.trim())
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.blur() // dismiss mobile keyboard after send
    }
  }, [input, isLoading, disabled, onSubmit])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const canSubmit = !!input.trim() && !isLoading && !disabled

  return (
    <form
      onSubmit={handleSubmit}
      className="flex-shrink-0 px-4 py-3 glass-dark border-t"
      style={{ borderTopColor: 'rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-end gap-3">
        {/* Textarea */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            id="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Cubot about City University..."
            disabled={disabled}
            rows={1}
            dir="auto"
            inputMode="text"
            enterKeyHint="send"
            aria-label="Type your message"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            // Touch devices: scroll the view when keyboard opens
            onFocus={() => {
              setTimeout(() => {
                textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }, 300)
            }}
            style={{ transition: 'height 150ms ease, box-shadow 0.2s ease', minHeight: '48px' }}
            className={cn(
              'w-full px-5 py-3 rounded-2xl resize-none font-sans text-sm text-white placeholder-white/30 bg-white/[0.04] border border-white/10 focus:outline-none input-gold-focus disabled:opacity-40 disabled:cursor-not-allowed',
              isRTL && 'text-right'
            )}
          />
        </div>

        {/* Send button */}
        <motion.button
          type="submit"
          disabled={!canSubmit}
          aria-label="Send message"
          animate={{ scale: sendPressed ? 0.88 : 1 }}
          transition={{ type: 'spring', stiffness: 600, damping: 20 }}
          className={cn(
            'ripple-container w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-2xl transition-all duration-200',
            canSubmit
              ? 'bg-cu-gold text-cu-dark shadow-gold-glow hover:bg-cu-gold-light'
              : 'bg-white/[0.06] text-white/20 cursor-not-allowed'
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            {isLoading ? (
              <motion.span key="loader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Loader2 className="w-5 h-5 animate-spin" />
              </motion.span>
            ) : (
              <motion.span key="send" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                <Send className="w-5 h-5" />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      <p className="text-[11px] text-white/20 text-center mt-2 font-sans select-none" aria-hidden="true">
        <kbd className="px-1 py-0.5 rounded bg-white/5 text-white/30">Enter</kbd> to send ·{' '}
        <kbd className="px-1 py-0.5 rounded bg-white/5 text-white/30">Shift+Enter</kbd> new line
      </p>
    </form>
  )
}
