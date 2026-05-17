import Link from 'next/link'
import { Bot, GraduationCap, Home, Info } from 'lucide-react'

interface ChatHeaderProps {
  showMobileNav?: boolean
}

export function ChatHeader({ showMobileNav = false }: ChatHeaderProps) {
  return (
    <header
      className="flex-shrink-0 glass-dark border-b border-white/08 px-4 py-3 z-20"
      style={{ borderBottomColor: 'rgba(255,255,255,0.08)' }}
    >
      <div className="flex items-center justify-between max-w-full">
        {/* Left: University Logo + Name */}
        <Link href="/" className="flex items-center gap-3 group" aria-label="Go to City University Peshawar homepage">
          <div className="w-10 h-10 rounded-xl bg-cu-navy flex items-center justify-center shadow-navy-glow flex-shrink-0">
            <GraduationCap className="w-6 h-6 text-white" aria-hidden="true" />
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-bold text-white font-display leading-tight group-hover:text-cu-gold transition-colors">
              City University Peshawar
            </div>
            <div className="text-xs text-white/40 font-urdu leading-tight">
              سٹی یونیورسٹی پشاور
            </div>
          </div>
        </Link>

        {/* Center: Cubot Status */}
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-full glass-navy">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" aria-hidden="true" />
          <span className="text-sm font-bold text-white font-display tracking-wide">Cubot</span>
          <span className="text-white/40 text-xs hidden sm:inline">— AI Assistant</span>
        </div>

        {/* Right: Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-cu-gold/10 border border-cu-gold/25">
          <Bot className="w-3.5 h-3.5 text-cu-gold" aria-hidden="true" />
          <span className="text-xs font-semibold text-cu-gold font-display tracking-wide hidden sm:inline">
            An Initiative of IT & Robotics Society — CUSIT
          </span>
          <span className="text-xs font-semibold text-cu-gold font-display tracking-wide sm:hidden">
            Cubot AI
          </span>
        </div>
      </div>
    </header>
  )
}

/* Mobile Bottom Tab Bar — shown only on < lg */
export function MobileTabBar() {
  return (
    <nav
      aria-label="Mobile navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 glass-dark border-t"
      style={{
        borderTopColor: 'rgba(201,162,39,0.2)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-center justify-around px-4 py-3">
        <Link
          href="/"
          aria-label="Home"
          className="flex flex-col items-center gap-1 text-white/40 hover:text-white/70 transition-colors min-w-[44px] min-h-[44px] justify-center"
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-sans font-medium">Home</span>
        </Link>
        <Link
          href="/chat"
          aria-label="Chat (active)"
          aria-current="page"
          className="flex flex-col items-center gap-1 text-cu-gold min-w-[44px] min-h-[44px] justify-center"
        >
          <Bot className="w-5 h-5" />
          <span className="text-[10px] font-sans font-semibold">Chat</span>
        </Link>
        <a
          href="https://cityuniversity.edu.pk"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="About City University Peshawar"
          className="flex flex-col items-center gap-1 text-white/40 hover:text-white/70 transition-colors min-w-[44px] min-h-[44px] justify-center"
        >
          <Info className="w-5 h-5" />
          <span className="text-[10px] font-sans font-medium">About</span>
        </a>
      </div>
    </nav>
  )
}