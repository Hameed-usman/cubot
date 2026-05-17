import { Message } from '@/types'
import { clsx } from 'clsx'
import { AlertCircle, Bot, User } from 'lucide-react'
import { motion } from 'framer-motion'

interface MessageBubbleProps {
  message: Message
  isStreaming?: boolean
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isError = message.error

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  if (isUser) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="flex justify-end"
      >
        <div className="max-w-[80%]">
          <div className="bg-gradient-to-r from-cu-blue to-cu-blue-mid text-white px-5 py-3 rounded-2xl rounded-br-md shadow-[0_8px_30px_rgb(0,61,165,0.2)]">
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
          </div>
          <p className="text-xs text-slate-400 mt-2 text-right flex items-center justify-end gap-1">
            <User className="w-3 h-3" />
            You • {formatTime(message.timestamp)}
          </p>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className="flex justify-start"
    >
      <div className="max-w-[85%]">
        <div className="flex items-start gap-3">
          <div className={clsx(
            'w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg transition-transform hover:scale-105',
            isError ? 'bg-red-500' : 'bg-gradient-to-br from-cu-gold to-yellow-500'
          )}>
            {isError ? (
              <AlertCircle className="w-5 h-5 text-white" />
            ) : (
              <Bot className="w-6 h-6 text-white" />
            )}
          </div>

          <div className={clsx(
            'flex-1 px-5 py-4 rounded-2xl rounded-bl-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] glass-card border border-white/50 backdrop-blur-md',
            isError
              ? 'bg-red-50/80 border-red-200'
              : 'bg-white/80'
          )}>
            <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
              {message.content}
              {isStreaming && (
                <span className="inline-block w-1.5 h-4 bg-cu-gold ml-1 animate-pulse rounded-full" />
              )}
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-500 mt-2 ml-13 flex items-center gap-1">
          <Bot className="w-3 h-3 text-cu-gold" />
          {isError ? 'Error' : 'Cubot'} • {formatTime(message.timestamp)}
        </p>
      </div>
    </motion.div>
  )
}