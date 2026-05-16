import { Bot } from 'lucide-react'

export function TypingIndicator() {
  return (
    <div className="flex justify-start animate-fade-in">
      <div className="max-w-[85%]">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-cu-blue/10 flex items-center justify-center flex-shrink-0">
            <Bot className="w-4 h-4 text-cu-blue" />
          </div>

          {/* Content */}
          <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-bl-md">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse-dot" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse-dot" style={{ animationDelay: '160ms' }} />
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse-dot" style={{ animationDelay: '320ms' }} />
              <span className="text-xs text-slate-400 ml-2">Cubot is thinking...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}