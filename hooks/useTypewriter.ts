'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface UseTypewriterReturn {
  displayedText: string
  isTyping: boolean
  cancel: () => void
  reset: () => void
}

/**
 * Streams text character-by-character at the given speed (ms per char).
 * If `text` changes while typing, instantly shows old text and restarts.
 * Call `cancel()` to skip to full text immediately.
 */
export function useTypewriter(
  text: string,
  speed: number = 18
): UseTypewriterReturn {
  const [displayedText, setDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const cancelledRef = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancel = useCallback(() => {
    cancelledRef.current = true
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setDisplayedText(text)
    setIsTyping(false)
  }, [text])

  const reset = useCallback(() => {
    cancelledRef.current = true
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setDisplayedText('')
    setIsTyping(false)
  }, [])

  useEffect(() => {
    if (!text) {
      setDisplayedText('')
      setIsTyping(false)
      return
    }

    cancelledRef.current = false
    setDisplayedText('')
    setIsTyping(true)

    let index = 0

    const typeChar = () => {
      if (cancelledRef.current) return
      if (index < text.length) {
        index++
        setDisplayedText(text.slice(0, index))
        timeoutRef.current = setTimeout(typeChar, speed)
      } else {
        setIsTyping(false)
      }
    }

    timeoutRef.current = setTimeout(typeChar, speed)

    return () => {
      cancelledRef.current = true
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [text, speed])

  return { displayedText, isTyping, cancel, reset }
}
