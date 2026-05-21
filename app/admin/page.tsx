'use client'

import { useState, useEffect, useRef } from 'react'
import {
  BookOpen, Save, Eye, Edit3, Trash2, Plus, CheckCircle,
  Loader2, LogOut, GraduationCap, Cpu, BarChart3, FileText,
  Layers, Users, DollarSign, Calendar, ChevronRight, Globe
} from 'lucide-react'
import { getDepartmentData, saveDepartmentData } from '../actions/admin'
import { signOut } from 'next-auth/react'
import SyncIntelligenceTab from '@/components/admin/SyncIntelligenceTab'

const departments = ['general', 'cs_it', 'bba', 'pharmacy', 'nursing']
const departmentNames: Record<string, string> = {
  general: 'General Information',
  cs_it: 'Computer Science & IT',
  bba: 'Business Administration',
  pharmacy: 'Pharmacy',
  nursing: 'Nursing',
}
const departmentColors: Record<string, string> = {
  general: 'bg-cu-navy', cs_it: 'bg-cu-gold', bba: 'bg-emerald-700',
  pharmacy: 'bg-purple-700', nursing: 'bg-rose-700',
}

const sections = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'courses', label: 'Courses', icon: Layers },
  { id: 'fees', label: 'Fee Structure', icon: DollarSign },
  { id: 'semesters', label: 'Semesters', icon: Calendar },
  { id: 'faculty', label: 'Faculty', icon: Users },
]

type AdminView = 'editor' | 'sync'

export default function AdminPage() {
  const [adminView, setAdminView] = useState<AdminView>('editor')
  const [selectedDept, setSelectedDept] = useState('general')
  const [activeSection, setActiveSection] = useState('overview')
  const [content, setContent] = useState('')
  const [saved, setSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      const data = await getDepartmentData(selectedDept, activeSection)
      setContent(data)
      setIsLoading(false)
    }
    loadData()
  }, [selectedDept, activeSection])

  const handleSave = async (contentToSave: string) => {
    setIsSaving(true)
    const result = await saveDepartmentData(selectedDept, activeSection, contentToSave)
    setIsSaving(false)
    if (result.success) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value
    setContent(newContent)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => handleSave(newContent), 1200)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg,#080d1a 0%,#0d1526 60%,#080d1a 100%)' }}>

      {/* Top header */}
      <header className="flex-shrink-0 glass-dark border-b px-6 py-4" style={{ borderBottomColor: 'rgba(255,255,255,0.08)' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-cu-navy flex items-center justify-center shadow-navy-glow flex-shrink-0">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display font-extrabold text-white text-lg leading-tight">Cubot Admin</h1>
              <div className="flex items-center gap-1.5 text-xs text-white/30 font-sans">
                <Cpu className="w-3 h-3 text-cu-gold/60" />
                IT &amp; Robotics Society — CUSIT
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold font-display"
              style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', color: 'rgba(52,211,153,0.9)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              System Online
            </span>
            {/* View toggle */}
            <button onClick={() => setAdminView(v => v === 'editor' ? 'sync' : 'editor')} aria-label="Toggle sync view"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold font-display transition-all"
              style={{ background: adminView === 'sync' ? 'rgba(201,162,39,0.15)' : 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: adminView === 'sync' ? '#c9a227' : 'rgba(255,255,255,0.6)' }}>
              {adminView === 'sync' ? <BookOpen className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
              {adminView === 'sync' ? 'Editor' : 'Sync'}
            </button>
            {adminView === 'editor' && (
              <button onClick={() => setPreviewMode(!previewMode)} aria-label="Toggle preview mode"
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold font-display transition-all"
                style={{ background: previewMode ? 'rgba(201,162,39,0.15)' : 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: previewMode ? '#c9a227' : 'rgba(255,255,255,0.6)' }}>
                {previewMode ? <Edit3 className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {previewMode ? 'Edit' : 'Preview'}
              </button>
            )}
            <button onClick={() => signOut({ callbackUrl: '/admin/login' })} aria-label="Sign out"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold font-sans transition-all text-red-400 hover:text-red-300"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 md:px-6 md:py-8">
        {adminView === 'sync' && (
          <SyncIntelligenceTab />
        )}
        {adminView === 'editor' && (
        <div className="grid md:grid-cols-4 gap-6 h-full">

          {/* Sidebar */}
          <aside className="md:col-span-1">
            <div className="glass-dark rounded-3xl p-4 sticky top-8" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-[10px] uppercase tracking-widest text-white/30 font-sans font-semibold px-2 mb-3">Departments</p>
              <nav className="space-y-1" aria-label="Department navigation">
                {departments.map((dept) => (
                  <button key={dept} onClick={() => { setSelectedDept(dept); setActiveSection('overview') }}
                    aria-label={`Select ${departmentNames[dept]}`}
                    className="w-full text-left px-4 py-3 rounded-2xl transition-all flex items-center gap-3 group"
                    style={{
                      background: selectedDept === dept ? 'rgba(26,58,143,0.4)' : 'transparent',
                      border: selectedDept === dept ? '1px solid rgba(26,58,143,0.5)' : '1px solid transparent',
                      color: selectedDept === dept ? '#fff' : 'rgba(255,255,255,0.45)',
                    }}>
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${departmentColors[dept]}`} />
                    <span className="text-sm font-sans font-medium flex-1">{departmentNames[dept]}</span>
                    {selectedDept === dept && <ChevronRight className="w-3.5 h-3.5 text-cu-gold" />}
                  </button>
                ))}
              </nav>

              <div className="mt-6 pt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-[10px] uppercase tracking-widest text-white/20 font-sans font-semibold px-2 mb-3">Actions</p>
                <button aria-label="Add new department"
                  className="w-full flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-sans transition-all text-white/40 hover:text-white/70"
                  style={{ border: '1px dashed rgba(255,255,255,0.12)' }}>
                  <Plus className="w-4 h-4" />Add Department
                </button>
                <button aria-label="Reset to default"
                  className="w-full flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-sans transition-all text-red-400/50 hover:text-red-400 mt-1"
                  style={{ border: '1px dashed rgba(239,68,68,0.15)' }}>
                  <Trash2 className="w-4 h-4" />Reset Default
                </button>
              </div>
            </div>
          </aside>

          {/* Main editor */}
          <main className="md:col-span-3 flex flex-col gap-5" aria-label="Knowledge base editor">

            {/* Section tabs */}
            <div className="glass-dark rounded-3xl p-3 flex flex-wrap gap-2" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              {sections.map((section) => {
                const Icon = section.icon
                const active = activeSection === section.id
                return (
                  <button key={section.id} onClick={() => setActiveSection(section.id)}
                    aria-label={`Switch to ${section.label} section`}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold font-display transition-all"
                    style={{
                      background: active ? 'rgba(26,58,143,0.5)' : 'transparent',
                      border: active ? '1px solid rgba(26,58,143,0.6)' : '1px solid transparent',
                      color: active ? '#fff' : 'rgba(255,255,255,0.4)',
                    }}>
                    <Icon className="w-4 h-4" aria-hidden="true" />
                    {section.label}
                    {active && <span className="w-1.5 h-1.5 rounded-full bg-cu-gold" />}
                  </button>
                )
              })}
            </div>

            {/* Editor card */}
            <div className="glass-dark rounded-3xl p-6 flex flex-col gap-4 flex-1" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="font-display font-bold text-white text-lg">
                    {departmentNames[selectedDept]}
                    <span className="mx-2 text-white/20">/</span>
                    <span className="text-cu-gold">{activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}</span>
                  </h2>
                  <p className="text-xs text-white/30 font-sans mt-0.5">Edit knowledge base content — changes affect Cubot's responses instantly</p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-white/25 font-sans">{content.length} chars</span>
                  <button onClick={() => handleSave(content)} disabled={isSaving} aria-label="Save changes"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold font-display text-sm transition-all"
                    style={{
                      background: saved ? 'rgba(52,211,153,0.15)' : isSaving ? 'rgba(201,162,39,0.2)' : '#c9a227',
                      border: saved ? '1px solid rgba(52,211,153,0.3)' : '1px solid transparent',
                      color: saved ? 'rgb(52,211,153)' : isSaving ? '#c9a227' : '#080d1a',
                      cursor: isSaving ? 'not-allowed' : 'pointer',
                    }}>
                    {saved ? <><CheckCircle className="w-4 h-4" />Saved!</> :
                      isSaving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> :
                        <><Save className="w-4 h-4" />Save Changes</>}
                  </button>
                </div>
              </div>

              {isLoading ? (
                <div className="flex-1 min-h-[400px] flex flex-col items-center justify-center gap-3 rounded-2xl"
                  style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                  <Loader2 className="w-8 h-8 animate-spin text-cu-gold" />
                  <span className="text-white/30 text-sm font-sans">Loading content…</span>
                </div>
              ) : previewMode ? (
                <div className="flex-1 min-h-[400px] rounded-2xl p-6 overflow-auto" style={{ background: 'rgba(26,58,143,0.05)', border: '1px solid rgba(26,58,143,0.2)' }}>
                  <div className="flex items-center gap-2 mb-4 text-xs text-white/30 font-sans">
                    <Eye className="w-3.5 h-3.5" />
                    Preview — how Cubot will use this content
                  </div>
                  <div className="glass-dark rounded-2xl p-5" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                    <p className="text-xs font-bold text-cu-gold font-display mb-1">Cubot</p>
                    <p className="text-white/70 whitespace-pre-line leading-relaxed text-sm font-sans">
                      {content || <span className="text-white/25 italic">No content yet — switch to Edit mode to add content.</span>}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 relative">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-3.5 h-3.5 text-white/25" />
                    <span className="text-xs text-white/25 font-sans">Use plain text. Line breaks separate paragraphs.</span>
                  </div>
                  <textarea
                    value={content}
                    onChange={handleContentChange}
                    placeholder={`Enter ${activeSection} information for ${departmentNames[selectedDept]}…`}
                    aria-label={`Edit ${activeSection} content for ${departmentNames[selectedDept]}`}
                    className="w-full min-h-[400px] p-5 rounded-2xl resize-none text-sm font-sans leading-relaxed focus:outline-none transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.8)',
                    }}
                  />
                  <p className="text-xs text-white/20 font-sans mt-2">✦ Auto-saves 1.2s after you stop typing</p>
                </div>
              )}
            </div>
          </main>
        </div>
        )}
      </div>
    </div>
  )
}