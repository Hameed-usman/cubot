import { ButtonHTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={twMerge(
          clsx(
            'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
            {
              'bg-cu-blue text-white hover:bg-cu-blue-mid focus:ring-cu-blue':
                variant === 'primary',
              'bg-slate-100 text-slate-700 hover:bg-slate-200 focus:ring-slate-400':
                variant === 'secondary',
              'border-2 border-cu-blue text-cu-blue hover:bg-cu-blue/10 focus:ring-cu-blue':
                variant === 'outline',
              'px-3 py-1.5 text-sm': size === 'sm',
              'px-4 py-2 text-sm': size === 'md',
              'px-6 py-3 text-base': size === 'lg',
            },
            className
          )
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'