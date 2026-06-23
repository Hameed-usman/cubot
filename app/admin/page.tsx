'use client'

import { useState, useEffect } from 'react'
import {
  Globe, Edit3, LogOut, GraduationCap, Cpu, ShieldAlert
} from 'lucide-react'
import { signOut, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import SyncIntelligenceTab from '@/components/admin/SyncIntelligenceTab'
import ManualEntryTab from '@/components/admin/ManualEntryTab'

type AdminView = 'sync' | 'manual'

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [adminView, setAdminView] = useState<AdminView>('sync')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-cu-gold border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!session) return null

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg,#080d1a 0%,#0d1526 60%,#080d1a 100%)' }}>
      
      {/* Top Header */}
      <header className="flex-shrink-0 glass-dark border-b px-6 py-4" style={{ borderBottomColor: 'rgba(255,255,255,0.08)' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-cu-navy flex items-center justify-center shadow-navy-glow flex-shrink-0">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display font-extrabold text-white text-lg leading-tight">Cubot Command Center</h1>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-sans">
                <ShieldAlert className="w-3 h-3" />
                Authorized Admin Access Only
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View toggles */}
            <button onClick={() => setAdminView('sync')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold font-display transition-all"
              style={{ 
                background: adminView === 'sync' ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)', 
                border: adminView === 'sync' ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(255,255,255,0.1)', 
                color: adminView === 'sync' ? '#60a5fa' : 'rgba(255,255,255,0.6)' 
              }}>
              <Globe className="w-4 h-4" />
              Web Crawler
            </button>
            <button onClick={() => setAdminView('manual')} 
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold font-display transition-all"
              style={{ 
                background: adminView === 'manual' ? 'rgba(201,162,39,0.15)' : 'rgba(255,255,255,0.05)', 
                border: adminView === 'manual' ? '1px solid rgba(201,162,39,0.3)' : '1px solid rgba(255,255,255,0.1)', 
                color: adminView === 'manual' ? '#c9a227' : 'rgba(255,255,255,0.6)' 
              }}>
              <Edit3 className="w-4 h-4" />
              Manual Entry
            </button>
            
            <div className="w-px h-8 bg-white/10 mx-2" />

            <button onClick={() => signOut({ callbackUrl: '/admin/login' })} aria-label="Sign out"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold font-sans transition-all text-red-400 hover:bg-red-400/10"
              style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 md:px-6">
        {adminView === 'sync' && <SyncIntelligenceTab />}
        {adminView === 'manual' && <ManualEntryTab />}
      </main>

    </div>
  )
}