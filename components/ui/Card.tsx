import { HTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'bordered' | 'elevated'
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={twMerge(
          clsx(
            'rounded-xl',
            {
              'bg-white': variant === 'default',
              'bg-white border border-slate-200': variant === 'bordered',
              'bg-white shadow-md': variant === 'elevated',
            },
            className
          )
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'