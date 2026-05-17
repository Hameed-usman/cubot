'use client'

import { useEffect, useRef, RefObject } from 'react'

const FRAME_MS = 16 // ~60fps debounce

/**
 * Auto-resizes a textarea from 1 line up to maxLines as content grows.
 * Uses a debounced RAF to avoid layout thrashing.
 */
export function useAutoResize(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  lineHeight: number = 24,
  maxLines: number = 5
): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      const el = ref.current
      if (!el) return

      el.style.height = 'auto'
      const maxHeight = lineHeight * maxLines + 24 // 24px padding
      const newHeight = Math.min(el.scrollHeight, maxHeight)
      el.style.height = `${newHeight}px`
    }, FRAME_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [value, ref, lineHeight, maxLines])
}
