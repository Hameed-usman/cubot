import { Message } from '@/types'
import { clsx } from 'clsx'
import { AlertCircle, Bot } from 'lucide-react'

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
    // User message - right aligned, blue background
    return (
      <div className="flex justify-end animate-fade-in">
        <div className="max-w-[80%]">
          <div className="bg-cu-blue text-white px-4 py-3 rounded-2xl rounded-br-md">
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          </div>
          <p className="text-xs text-slate-400 mt-1 text-right">
            {formatTime(message.timestamp)}
          </p>
        </div>
      </div>
    )
  }

  // Assistant message - left aligned, white card
  return (
    <div className="flex justify-start animate-fade-in">
      <div className="max-w-[85%]">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div
            className={clsx(
              'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
              isError ? 'bg-red-100' : 'bg-cu-blue/10'
            )}
          >
            {isError ? (
              <AlertCircle className="w-4 h-4 text-red-600" />
            ) : (
              <Bot className="w-4 h-4 text-cu-blue" />
            )}
          </div>

          {/* Content */}
          <div
            className={clsx(
              'flex-1 px-4 py-3 rounded-2xl rounded-bl-md',
              isError
                ? 'bg-red-50 border border-red-200'
                : 'bg-white border border-slate-200'
            )}
          >
            <p className="text-sm whitespace-pre-wrap">
              {message.content}
              {isStreaming && (
                <span className="cursor-blink text-cu-blue" />
              )}
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-400 mt-2 ml-11">
          {isError ? 'Error' : 'Cubot'} • {formatTime(message.timestamp)}
        </p>
      </div>
    </div>
  )
}