'use client'

import { useState } from 'react'
import { Edit3, Save, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'

const NAMESPACES = [
  'academic', 'admissions', 'alumni', 'contact', 'dept-bba', 
  'dept-cs', 'dept-nursing', 'dept-pharmacy', 'events', 
  'facilities', 'faculty', 'finance', 'general', 'notices', 
  'policies', 'scholarships'
]

export default function ManualEntryTab() {
  const [namespace, setNamespace] = useState('')
  const [content, setContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ text: string, type: 'success' | 'error' } | null>(null)

  const handleSave = async () => {
    if (!namespace) {
      setStatusMsg({ text: 'You must select a namespace before saving.', type: 'error' })
      return
    }
    if (!content.trim()) {
      setStatusMsg({ text: 'Content cannot be empty.', type: 'error' })
      return
    }

    setIsSaving(true)
    setStatusMsg(null)

    try {
      const res = await fetch('/api/admin/manual-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ namespace, content })
      })

      const data = await res.json()
      
      if (res.ok && data.success) {
        setStatusMsg({ text: 'Successfully saved to Pinecone! The bot can now answer using this data.', type: 'success' })
        setContent('')
      } else {
        setStatusMsg({ text: data.error || 'Failed to save data.', type: 'error' })
      }
    } catch (err) {
      setStatusMsg({ text: 'Network error while saving.', type: 'error' })
    }

    setIsSaving(false)
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="font-display font-bold text-white text-xl flex items-center gap-2">
          <Edit3 className="w-5 h-5 text-cu-gold" />
          Manual Data Injection
        </h2>
        <p className="text-sm text-white/40 font-sans mt-1">
          Directly insert exact information into the AI's brain. Data entered here bypasses the web crawler and goes live instantly.
        </p>
      </div>

      <div className="glass-dark rounded-3xl p-6 md:p-8" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        
        {statusMsg && (
          <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 border ${
            statusMsg.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            {statusMsg.type === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> : <AlertTriangle className="w-5 h-5 flex-shrink-0" />}
            <span className="text-sm font-sans">{statusMsg.text}</span>
          </div>
        )}

        <div className="space-y-5">
          {/* Namespace Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-white/50 mb-2">
              Target Namespace <span className="text-red-400">*</span>
            </label>
            <select
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
              className="w-full bg-[#0d1526] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cu-gold transition-colors appearance-none font-sans"
            >
              <option value="" disabled>-- Select a precise namespace --</option>
              {NAMESPACES.map(ns => (
                <option key={ns} value={ns}>{ns}</option>
              ))}
            </select>
            <p className="text-[11px] text-white/30 mt-1.5 font-sans">
              Compulsory. This prevents data from being lost in the wrong bucket. If you are entering Fee Structure, choose <b>finance</b>.
            </p>
          </div>

          {/* Content Textarea */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-white/50 mb-2">
              Raw Data Content <span className="text-red-400">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="E.g., The exact per-semester fee for BS Nursing is Rs. 85,000. Students scoring above 80% are eligible for a 20% merit scholarship..."
              className="w-full min-h-[300px] bg-[#0d1526] border border-white/10 rounded-xl p-5 text-sm text-white leading-relaxed focus:outline-none focus:border-cu-gold transition-colors resize-y font-sans"
            />
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <button
              onClick={handleSave}
              disabled={isSaving || !namespace || !content.trim()}
              className="flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold font-display text-sm transition-all shadow-lg"
              style={{
                background: (!namespace || !content.trim()) ? 'rgba(255,255,255,0.05)' : isSaving ? 'rgba(201,162,39,0.5)' : '#c9a227',
                color: (!namespace || !content.trim()) ? 'rgba(255,255,255,0.3)' : '#080d1a',
                cursor: (!namespace || !content.trim() || isSaving) ? 'not-allowed' : 'pointer',
              }}
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {isSaving ? 'Injecting into Pinecone...' : 'Save & Inject Live Data'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
