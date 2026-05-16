import { HTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={twMerge(
          clsx(
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
            {
              'bg-slate-100 text-slate-700': variant === 'default',
              'bg-green-100 text-green-700': variant === 'success',
              'bg-yellow-100 text-yellow-700': variant === 'warning',
              'bg-red-100 text-red-700': variant === 'error',
              'bg-cu-blue/10 text-cu-blue': variant === 'info',
            },
            className
          )
        )}
        {...props}
      >
        {children}
      </span>
    )
  }
)

Badge.displayName = 'Badge'