'use client'

import { useState, useEffect, useRef } from 'react'
import { easeOutQuart } from '@/lib/utils'

interface UseCountUpOptions {
  end: number
  duration?: number   // ms
  prefix?: string
  suffix?: string
}

interface UseCountUpReturn {
  value: string
  hasStarted: boolean
  ref: React.RefObject<HTMLDivElement | null>
}

/**
 * Counts up from 0 to `end` when element enters the viewport.
 * Uses IntersectionObserver + easeOutQuart curve.
 */
export function useCountUp({
  end,
  duration = 1800,
  prefix = '',
  suffix = '',
}: UseCountUpOptions): UseCountUpReturn {
  const [value, setValue] = useState(`${prefix}0${suffix}`)
  const [hasStarted, setHasStarted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const startTimeRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) {
          setHasStarted(true)

          const animate = (timestamp: number) => {
            if (!startTimeRef.current) startTimeRef.current = timestamp
            const elapsed = timestamp - startTimeRef.current
            const progress = Math.min(elapsed / duration, 1)
            const eased = easeOutQuart(progress)
            const current = Math.round(eased * end)
            setValue(`${prefix}${current}${suffix}`)

            if (progress < 1) {
              rafRef.current = requestAnimationFrame(animate)
            } else {
              setValue(`${prefix}${end}${suffix}`)
            }
          }

          rafRef.current = requestAnimationFrame(animate)
          observer.disconnect()
        }
      },
      { threshold: 0.5 }
    )

    observer.observe(el)

    return () => {
      observer.disconnect()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [end, duration, prefix, suffix, hasStarted])

  return { value, hasStarted, ref }
}
