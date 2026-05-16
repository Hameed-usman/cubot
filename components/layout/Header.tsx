import Link from 'next/link'
import { Bot, GraduationCap } from 'lucide-react'

export function Header() {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo and University Name */}
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cu-blue rounded-lg flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-cu-dark leading-tight">
                City University Peshawar
              </h1>
              <p className="text-sm text-cu-blue font-urdu hidden sm:block">
                یونیورسٹی آف سٹی پشاور
              </p>
            </div>
          </Link>

          {/* Cubot Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-cu-gold/10 rounded-full">
            <Bot className="w-4 h-4 text-cu-gold" />
            <span className="text-sm font-medium text-cu-gold">
              Powered by Cubot AI
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}