'use client'

import { Message } from '@/types'
import { cn } from '@/lib/utils'
import { AlertCircle, Bot, User } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTypewriter } from '@/hooks/useTypewriter'
import { formatTime } from '@/lib/utils'

interface MessageBubbleProps {
  message: Message
  isLatestBot?: boolean
  onSelectSuggestion?: (suggestion: string) => void
}

/* Typewriter-enabled bot message content */
function BotMessageContent({ content, isLatest, isError }: { content: string; isLatest: boolean; isError?: boolean }) {
  const { displayedText, isTyping } = useTypewriter(content, isLatest ? 18 : 0)

  const paragraphs = displayedText.split('\n').filter(Boolean)

  return (
    <div>
      {paragraphs.length > 0 ? (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}
        >
          {paragraphs.map((para, i) => (
            <motion.p
              key={i}
              variants={{
                hidden: { opacity: 0, y: 8 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
              }}
              className={cn(
                'text-sm leading-relaxed font-sans mb-1 last:mb-0',
                isError ? 'text-red-400' : 'text-white/85'
              )}
            >
              {para}
              {isLatest && isTyping && i === paragraphs.length - 1 && (
                <span
                  className="inline-block w-0.5 h-4 bg-cu-gold ml-0.5 align-middle"
                  style={{ animation: 'blinkCursor 1s step-end infinite' }}
                  aria-hidden="true"
                />
              )}
            </motion.p>
          ))}
        </motion.div>
      ) : (
        <p className="text-sm leading-relaxed font-sans text-white/85">
          {displayedText}
          {isLatest && isTyping && (
            <span
              className="inline-block w-0.5 h-4 bg-cu-gold ml-0.5 align-middle"
              style={{ animation: 'blinkCursor 1s step-end infinite' }}
              aria-hidden="true"
            />
          )}
        </p>
      )}
    </div>
  )
}

export function MessageBubble({ message, isLatestBot = false, onSelectSuggestion }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isError = !!message.error

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
        className="flex justify-end"
        role="article"
        aria-label={`You said: ${message.content}`}
      >
        <div className="max-w-[78%]">
          <div
            className="px-5 py-3 rounded-2xl rounded-br-md font-sans text-sm text-white leading-relaxed shadow-msg-user"
            style={{ background: 'linear-gradient(135deg, #1a3a8f 0%, #1e4db7 100%)' }}
          >
            {message.content}
          </div>
          <div className="flex items-center justify-end gap-1.5 mt-1.5">
            <User className="w-3 h-3 text-white/25" aria-hidden="true" />
            <time className="text-[11px] text-white/30 font-sans" dateTime={new Date(message.timestamp).toISOString()}>
              You · {formatTime(message.timestamp)}
            </time>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 280, damping: 24 }}
      className="flex justify-start"
      role="article"
      aria-label="Cubot response"
    >
      <div className="max-w-[85%]">
        <div className="flex items-start gap-3">
          {/* Bot avatar */}
          <div className={cn(
            'w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg border',
            isError
              ? 'bg-red-900/50 border-red-500/30'
              : 'bg-cu-navy border-cu-navy-mid/50 shadow-navy-glow'
          )}>
            {isError
              ? <AlertCircle className="w-4 h-4 text-red-400" aria-hidden="true" />
              : <Bot className="w-4 h-4 text-cu-gold" aria-hidden="true" />
            }
          </div>

          {/* Bubble */}
          <div className={cn(
            'flex-1 px-5 py-4 rounded-2xl rounded-bl-md glass-dark border shadow-msg-bot',
            isError ? 'border-red-500/20 bg-red-950/20' : 'border-white/06'
          )} style={!isError ? { borderColor: 'rgba(255,255,255,0.06)' } : {}}>
            {/* Username */}
            <p className={cn('text-xs font-bold font-display mb-2', isError ? 'text-red-400' : 'text-cu-gold')}>
              {isError ? 'Error' : 'Cubot'}
              {message.intent && (
                <span className="ml-2 px-2 py-0.5 bg-cu-navy/50 text-white/50 font-sans font-medium rounded text-[10px] uppercase tracking-wide">
                  {message.intent.replace('_', ' ')}
                </span>
              )}
            </p>

            <BotMessageContent
              content={message.content}
              isLatest={isLatestBot}
              isError={isError}
            />
          </div>
        </div>

        {/* Timestamp */}
        <div className="flex items-center gap-1.5 mt-1.5 ml-12">
          <Bot className="w-3 h-3 text-cu-gold/40" aria-hidden="true" />
          <time className="text-[11px] text-white/25 font-sans" dateTime={new Date(message.timestamp).toISOString()}>
            Cubot · {formatTime(message.timestamp)}
          </time>
        </div>

        {/* Suggestion chips */}
        {message.suggestions && message.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 ml-12" role="list" aria-label="Suggested follow-up questions">
            {message.suggestions.map((suggestion, index) => (
              <button
                key={index}
                role="listitem"
                onClick={() => onSelectSuggestion?.(suggestion)}
                aria-label={`Ask follow-up: ${suggestion}`}
                className="text-xs font-medium text-cu-gold/80 hover:text-cu-gold bg-cu-gold/5 hover:bg-cu-gold/10 px-3.5 py-1.5 rounded-full border border-cu-gold/20 hover:border-cu-gold/40 transition-all font-sans text-left"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}