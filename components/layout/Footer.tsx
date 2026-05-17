import Link from 'next/link'
import { Bot, GraduationCap, Cpu } from 'lucide-react'

export function Footer() {
  return (
    <footer className="py-10 px-6 border-t" style={{ background: '#040810', borderTopColor: 'rgba(255,255,255,0.06)' }} aria-label="Site footer">
      <div className="max-w-6xl mx-auto">
        {/* Top row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-6">
          <Link href="/" className="flex items-center gap-3 group" aria-label="City University Peshawar homepage">
            <div className="w-10 h-10 rounded-xl bg-cu-navy flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <div>
              <span className="block text-sm font-bold text-white font-display group-hover:text-cu-gold transition-colors">City University Peshawar</span>
              <span className="block text-xs text-white/30 font-urdu leading-tight">سٹی یونیورسٹی پشاور</span>
            </div>
          </Link>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border" style={{ background: 'rgba(201,162,39,0.06)', borderColor: 'rgba(201,162,39,0.18)' }}>
            <Bot className="w-3.5 h-3.5 text-cu-gold" aria-hidden="true" />
            <span className="text-xs font-semibold text-cu-gold font-display">Powered by Cubot AI</span>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px mb-6" style={{ background: 'rgba(255,255,255,0.05)' }} />

        {/* Bottom row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/25 font-sans">
            © 2025 City University Peshawar. All rights reserved.
          </p>
          <div className="flex items-center gap-1.5 text-xs text-white/25 font-sans">
            <Cpu className="w-3 h-3 text-cu-gold/40" aria-hidden="true" />
            <span>An Initiative of</span>
            <span className="text-cu-gold/60 font-semibold font-display">IT &amp; Robotics Society — CUSIT</span>
          </div>
        </div>
      </div>
    </footer>
  )
}