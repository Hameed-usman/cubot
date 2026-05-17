import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './hooks/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        cu: {
          navy:    '#1a3a8f',
          'navy-deep': '#0f2460',
          'navy-mid': '#1e4db7',
          gold:    '#c9a227',
          'gold-light': '#e8bc3a',
          'gold-dark':  '#a8841e',
          dark:    '#080d1a',
          'dark-2': '#0d1526',
          'dark-3': '#111827',
          // Legacy aliases (keep for backward compat)
          blue:    '#1a3a8f',
          'blue-mid': '#1e4db7',
        },
      },
      fontFamily: {
        display: ['var(--font-syne)', 'system-ui', 'sans-serif'],
        sans:    ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        urdu:    ['var(--font-urdu)', 'serif'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #c9a227 0%, #e8bc3a 50%, #c9a227 100%)',
        'navy-gradient': 'linear-gradient(135deg, #0f2460 0%, #1a3a8f 50%, #1e4db7 100%)',
        'hero-radial':   'radial-gradient(ellipse at center, #1a3a8f22 0%, transparent 70%)',
      },
      boxShadow: {
        'gold-glow':  '0 0 20px rgba(201, 162, 39, 0.4), 0 0 60px rgba(201, 162, 39, 0.15)',
        'navy-glow':  '0 0 20px rgba(26, 58, 143, 0.4), 0 0 60px rgba(26, 58, 143, 0.15)',
        'glass':      '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
        'card-hover': '0 20px 60px rgba(201, 162, 39, 0.2), 0 8px 24px rgba(0,0,0,0.3)',
        'msg-user':   '0 4px 24px rgba(26, 58, 143, 0.3)',
        'msg-bot':    '0 4px 24px rgba(0, 0, 0, 0.2)',
      },
      animation: {
        'fade-in':       'fadeIn 0.4s ease-out forwards',
        'slide-up':      'slideUp 0.4s ease-out forwards',
        'slide-down':    'slideDown 0.3s ease-out forwards',
        'slide-in-right':'slideInRight 0.4s ease-out forwards',
        'pulse-dot':     'pulseDot 1.4s ease-in-out infinite',
        'float':         'float 3s ease-in-out infinite',
        'glow-pulse':    'glowPulse 2s ease-in-out infinite',
        'shimmer':       'shimmer 2s linear infinite',
        'aurora':        'aurora 20s ease-in-out infinite',
        'bounce-in':     'bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards',
        'ripple':        'ripple 0.6s ease-out forwards',
        'blink-cursor':  'blinkCursor 1s step-end infinite',
        'underline-grow':'underlineGrow 0.6s ease-out forwards',
        'spin-slow':     'spin 8s linear infinite',
        'toast-in':      'toastIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'toast-out':     'toastOut 0.3s ease-in forwards',
        'count-end-glow':'countEndGlow 1s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%':   { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%':   { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseDot: {
          '0%, 80%, 100%': { transform: 'scale(0.6)', opacity: '0.5' },
          '40%':           { transform: 'scale(1)',   opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(201, 162, 39, 0.3), 0 0 40px rgba(201, 162, 39, 0.1)' },
          '50%':      { boxShadow: '0 0 30px rgba(201, 162, 39, 0.6), 0 0 60px rgba(201, 162, 39, 0.2)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
        aurora: {
          '0%':   { backgroundPosition: '0% 50%' },
          '50%':  { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        bounceIn: {
          '0%':   { opacity: '0', transform: 'scale(0.3)' },
          '50%':  { opacity: '0.9', transform: 'scale(1.05)' },
          '80%':  { transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        ripple: {
          '0%':   { transform: 'scale(0)', opacity: '1' },
          '100%': { transform: 'scale(4)', opacity: '0' },
        },
        blinkCursor: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0' },
        },
        underlineGrow: {
          '0%':   { width: '0%' },
          '100%': { width: '100%' },
        },
        toastIn: {
          '0%':   { opacity: '0', transform: 'translateX(100%) scale(0.8)' },
          '100%': { opacity: '1', transform: 'translateX(0) scale(1)' },
        },
        toastOut: {
          '0%':   { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(100%)' },
        },
        countEndGlow: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      transitionDuration: {
        '400': '400ms',
      },
    },
  },
  plugins: [],
}

export default config