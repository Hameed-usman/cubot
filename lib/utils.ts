import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merges Tailwind CSS class names, handling conflicts intelligently.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/**
 * Formats a Date to a human-readable time string.
 */
export function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * Detects if a string contains significant RTL characters (Arabic/Urdu).
 */
export function containsRTL(text: string): boolean {
  const rtlRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/
  return rtlRegex.test(text)
}

/**
 * Eased count-up value calculator.
 */
export function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4)
}

/**
 * Clamps a number between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
