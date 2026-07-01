'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Database, 
  BarChart2, 
  MessageSquare, 
  HelpCircle, 
  Activity, 
  LogOut,
  ShieldAlert
} from 'lucide-react'
import { signOut } from 'next-auth/react'

import ManualEntryTab from '@/components/admin/ManualEntryTab'
import SyncIntelligenceTab from '@/components/admin/SyncIntelligenceTab'
import KnowledgeAnalyticsTab from '@/components/admin/KnowledgeAnalyticsTab'
import ConversationAnalyticsTab from '@/components/admin/ConversationAnalyticsTab'
import UnansweredTab from '@/components/admin/UnansweredTab'
import SystemHealthTab from '@/components/admin/SystemHealthTab'
import RAGDebuggerTab from '@/components/admin/RAGDebuggerTab'
import SecurityTab from '@/components/admin/SecurityTab'

type TabType = 'knowledge_base' | 'knowledge_analytics' | 'conversation_analytics' | 'unanswered' | 'system_health' | 'rag_debugger' | 'security'

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('knowledge_base')
  const [subTab, setSubTab] = useState<'manual' | 'scraper'>('manual')

  const sidebarItems = [
    { id: 'knowledge_base', label: 'Knowledge Base', icon: Database },
    { id: 'knowledge_analytics', label: 'Knowledge Analytics', icon: BarChart2 },
    { id: 'conversation_analytics', label: 'Conversation Analytics', icon: MessageSquare },
    { id: 'unanswered', label: 'Unanswered Questions', icon: HelpCircle },
    { id: 'system_health', label: 'System Health', icon: Activity },
    { id: 'rag_debugger', label: 'RAG Debugger', icon: Database }, // reuse icon
    { id: 'security', label: 'Security', icon: ShieldAlert },
  ] as const

  return (
    <div className="min-h-screen bg-[#080d1a] text-white flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-800 bg-[#0d1526] flex flex-col">
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            Cubot Admin
          </h1>
          <p className="text-xs text-gray-500 mt-1">Production Panel</p>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === item.id 
                  ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-[0_0_15px_rgba(37,99,235,0.1)]' 
                  : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200 border border-transparent'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <button 
            onClick={() => signOut({ callbackUrl: '/admin/login' })}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
          >
            <LogOut className="w-4 h-4" />
            <span className="font-medium text-sm">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative h-screen">
        {/* Background effects */}
        <div className="absolute inset-0 z-0 bg-[url('/noise.png')] opacity-[0.03] pointer-events-none mix-blend-overlay"></div>
        <div className="absolute top-0 right-0 w-[800px] h-[600px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none transform translate-x-1/3 -translate-y-1/3"></div>

        <div className="relative z-10 p-8 max-w-7xl mx-auto min-h-full pb-24">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'knowledge_base' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h2 className="text-2xl font-bold">Knowledge Base</h2>
                      <p className="text-gray-400 mt-1">Manage the core data source for the AI.</p>
                    </div>
                    <div className="flex bg-[#141414] p-1 rounded-xl border border-gray-800 self-stretch sm:self-auto">
                      <button
                        onClick={() => setSubTab('manual')}
                        className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                          subTab === 'manual' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        Manual Entry
                      </button>
                      <button
                        onClick={() => setSubTab('scraper')}
                        className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                          subTab === 'scraper' ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        Web Scraper
                      </button>
                    </div>
                  </div>
                  {subTab === 'manual' ? <ManualEntryTab /> : <SyncIntelligenceTab />}
                </div>
              )}
              {activeTab === 'knowledge_analytics' && <KnowledgeAnalyticsTab />}
              {activeTab === 'conversation_analytics' && <ConversationAnalyticsTab />}
              {activeTab === 'unanswered' && <UnansweredTab />}
              {activeTab === 'system_health' && <SystemHealthTab />}
              {activeTab === 'rag_debugger' && <RAGDebuggerTab />}
              {activeTab === 'security' && <SecurityTab />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}