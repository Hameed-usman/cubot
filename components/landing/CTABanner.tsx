import Link from 'next/link'
import { MessageCircle } from 'lucide-react'

export function CTABanner() {
  return (
    <section
      aria-label="Call to action"
      className="relative py-24 px-4 overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0f2460 0%, #1a3a8f 50%, #1e4db7 100%)' }}
    >
      {/* Diagonal stripe texture */}
      <div className="stripe-overlay" />

      {/* Radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 80% at 50% 50%, rgba(201,162,39,0.08) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 max-w-3xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cu-gold/10 border border-cu-gold/30 text-cu-gold text-sm font-semibold mb-6 font-display tracking-wide">
          ✦ Get Started Today
        </div>

        <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-5 leading-tight">
          Ready to Get{' '}
          <span className="gradient-text">Started?</span>
        </h2>

        <p className="text-white/70 text-lg mb-10 max-w-xl mx-auto font-sans">
          Join thousands of students getting instant answers about admissions, courses, and campus life — 24/7 in English and Urdu.
        </p>

        <Link
          href="/chat"
          aria-label="Start chatting with Cubot"
          className="btn-gold inline-flex items-center gap-3 px-10 py-4 rounded-full text-cu-dark font-bold text-lg font-display"
        >
          <MessageCircle className="w-5 h-5" />
          Start Chatting Now
        </Link>
      </div>
    </section>
  )
}
