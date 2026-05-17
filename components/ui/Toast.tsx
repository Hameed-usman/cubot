'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ToastOptions {
  message: string
  duration?: number
  type?: 'default' | 'success' | 'error'
}

let showToastFn: ((opts: ToastOptions) => void) | null = null

export function showToast(opts: ToastOptions) {
  showToastFn?.(opts)
}

interface ToastItem extends ToastOptions {
  id: string
  leaving: boolean
}

export function ToastProvider() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    setToasts(prev =>
      prev.map(t => t.id === id ? { ...t, leaving: true } : t)
    )
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 320)
    const timer = timers.current.get(id)
    if (timer) { clearTimeout(timer); timers.current.delete(id) }
  }, [])

  useEffect(() => {
    showToastFn = (opts) => {
      const id = crypto.randomUUID()
      const duration = opts.duration ?? 3000
      setToasts(prev => [...prev, { ...opts, id, leaving: false }])
      const timer = setTimeout(() => dismiss(id), duration)
      timers.current.set(id, timer)
    }
    return () => { showToastFn = null }
  }, [dismiss])

  return (
    <div
      aria-live="polite"
      className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none"
    >
      {toasts.map(toast => (
        <div
          key={toast.id}
          role="status"
          aria-label={toast.message}
          style={{ animation: toast.leaving ? 'toastOut 0.3s ease-in forwards' : 'toastIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}
          className={cn(
            'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl glass-dark border-l-4 min-w-[260px] max-w-[360px] shadow-glass',
            toast.type === 'error' ? 'border-l-red-500' : 'border-l-cu-gold'
          )}
        >
          <Sparkles className="w-4 h-4 text-cu-gold flex-shrink-0" />
          <span className="text-sm font-medium text-white/90 flex-1">{toast.message}</span>
          <button
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss notification"
            className="text-white/40 hover:text-white/80 transition-colors p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
