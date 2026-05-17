import Link from 'next/link'
import { Bot, GraduationCap, MessageSquarePlus, Settings, Info } from 'lucide-react'

export function ChatSidebar() {
  return (
    <aside
      aria-label="Chat sidebar"
      className="hidden lg:flex flex-col w-72 flex-shrink-0 glass-dark border-r h-full"
      style={{ borderRightColor: 'rgba(255,255,255,0.06)' }}
    >
      {/* Logo area */}
      <div className="p-6 border-b" style={{ borderBottomColor: 'rgba(255,255,255,0.06)' }}>
        <Link href="/" className="flex items-center gap-3 group" aria-label="Return to homepage">
          <div className="w-11 h-11 rounded-2xl bg-cu-navy flex items-center justify-center shadow-navy-glow">
            <GraduationCap className="w-6 h-6 text-white" aria-hidden="true" />
          </div>
          <div>
            <div className="text-sm font-extrabold text-white font-display leading-tight group-hover:text-cu-gold transition-colors">
              City University
            </div>
            <div className="text-xs text-white/40 font-sans">Peshawar, Pakistan</div>
          </div>
        </Link>
      </div>

      {/* Nav actions */}
      <div className="flex-1 p-4 flex flex-col gap-2">
        <p className="text-[10px] uppercase tracking-widest text-white/30 font-sans font-semibold px-3 mb-1">
          Quick Actions
        </p>

        <button
          aria-label="Start a new chat"
          className="flex items-center gap-3 px-4 py-3 rounded-2xl text-cu-gold bg-cu-gold/10 border border-cu-gold/25 hover:bg-cu-gold/15 hover:border-cu-gold/40 transition-all group font-semibold font-display text-sm w-full text-left"
        >
          <MessageSquarePlus className="w-4 h-4" aria-hidden="true" />
          New Conversation
        </button>

        <a
          href="https://cityuniversity.edu.pk"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Visit City University official website"
          className="flex items-center gap-3 px-4 py-3 rounded-2xl text-white/60 hover:text-white hover:bg-white/5 transition-all text-sm font-sans w-full"
        >
          <Info className="w-4 h-4" aria-hidden="true" />
          About the University
        </a>

        <button
          aria-label="Settings (coming soon)"
          disabled
          className="flex items-center gap-3 px-4 py-3 rounded-2xl text-white/25 text-sm font-sans w-full cursor-not-allowed"
        >
          <Settings className="w-4 h-4" aria-hidden="true" />
          Settings <span className="ml-auto text-[10px] text-white/20 font-sans">Soon</span>
        </button>
      </div>

      {/* Bottom branding */}
      <div className="p-5 border-t" style={{ borderTopColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-cu-gold/5 border border-cu-gold/15">
          <div className="w-8 h-8 rounded-xl bg-cu-navy flex items-center justify-center flex-shrink-0">
            <Bot className="w-4 h-4 text-cu-gold" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-bold text-cu-gold font-display">Cubot AI</p>
            <p className="text-[10px] text-white/30 font-sans">An Initiative of IT & Robotics Society — CUSIT </p>
          </div>
          <div className="ml-auto w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-label="Online" />
        </div>
      </div>
    </aside>
  )
}
