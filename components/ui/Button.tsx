import { cn } from '@/lib/utils'
import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'outline' | 'gold'
  size?: 'sm' | 'md' | 'lg'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-semibold rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cu-gold focus-visible:ring-offset-2 focus-visible:ring-offset-cu-dark disabled:opacity-50 disabled:pointer-events-none select-none',
          {
            'btn-gold text-cu-dark':
              variant === 'gold',
            'bg-cu-navy text-white hover:bg-cu-navy-mid active:scale-95':
              variant === 'primary',
            'border border-white/20 text-white hover:bg-white/10 hover:border-white/40 backdrop-blur-sm':
              variant === 'ghost',
            'border border-cu-gold/40 text-cu-gold hover:bg-cu-gold/10 hover:border-cu-gold/70':
              variant === 'outline',
          },
          {
            'px-4 py-2 text-sm gap-1.5': size === 'sm',
            'px-6 py-3 text-base gap-2': size === 'md',
            'px-8 py-4 text-lg gap-2.5': size === 'lg',
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
export { Button }