'use client'

import { useState, useEffect, useRef } from 'react'
import { BookOpen, Save, Eye, Edit3, Trash2, Plus, CheckCircle, Loader2 } from 'lucide-react'
import { getDepartmentData, saveDepartmentData } from '../actions/admin'

const departments = ['general', 'cs_it', 'bba', 'pharmacy', 'nursing']
const departmentNames: Record<string, string> = {
  general: 'General Information',
  cs_it: 'Computer Science & IT',
  bba: 'Business Administration',
  pharmacy: 'Pharmacy',
  nursing: 'Nursing'
}

export default function AdminPage() {
  const [selectedDept, setSelectedDept] = useState('general')
  const [activeSection, setActiveSection] = useState('overview')
  const [content, setContent] = useState('')
  const [saved, setSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const sections = [
    { id: 'overview', label: 'Overview', icon: BookOpen },
    { id: 'courses', label: 'Courses', icon: BookOpen },
    { id: 'fees', label: 'Fee Structure', icon: BookOpen },
    { id: 'semesters', label: 'Semesters', icon: BookOpen },
    { id: 'faculty', label: 'Faculty', icon: BookOpen },
  ]

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
    if (result.success) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value
    setContent(newContent)

    // Auto-save debounce
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(() => {
      handleSave(newContent)
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-cu-blue text-white py-6 px-4 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BookOpen className="w-8 h-8" />
              Cubot Admin Panel
            </h1>
            <p className="text-white/70 text-sm">Manage your chatbot knowledge base</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setPreviewMode(!previewMode)}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition"
            >
              <Eye className="w-4 h-4" />
              {previewMode ? 'Edit Mode' : 'Preview'}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <div className="grid md:grid-cols-4 gap-6">
          {/* Sidebar - Departments */}
          <div className="md:col-span-1">
            <div className="glass-card rounded-2xl p-4 sticky top-8">
              <h3 className="font-bold text-cu-dark mb-4 flex items-center gap-2">
                <Edit3 className="w-4 h-4" />
                Departments
              </h3>
              <div className="space-y-2">
                {departments.map((dept) => (
                  <button
                    key={dept}
                    onClick={() => {
                      setSelectedDept(dept)
                      setActiveSection('overview')
                    }}
                    className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
                      selectedDept === dept
                        ? 'bg-cu-blue text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {departmentNames[dept]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="md:col-span-3">
            {/* Section Tabs */}
            <div className="glass-card rounded-2xl p-4 mb-6">
              <div className="flex flex-wrap gap-2">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                      activeSection === section.id
                        ? 'bg-cu-blue text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <section.icon className="w-4 h-4" />
                    {section.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Editor / Preview */}
            <div className="glass-card rounded-2xl p-6 relative">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-cu-dark">
                  {departmentNames[selectedDept]} - {activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}
                </h3>
                <button
                  onClick={() => handleSave(content)}
                  disabled={isSaving}
                  className={`flex items-center gap-2 px-6 py-2 rounded-xl font-medium transition-all ${
                    saved
                      ? 'bg-green-500 text-white'
                      : isSaving
                      ? 'bg-cu-gold/70 text-cu-dark cursor-not-allowed'
                      : 'bg-cu-gold text-cu-dark hover:bg-cu-gold/90'
                  }`}
                >
                  {saved ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Saved!
                    </>
                  ) : isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>

              {isLoading ? (
                <div className="w-full h-[400px] flex items-center justify-center border-2 border-slate-200 rounded-xl bg-slate-50/50">
                   <Loader2 className="w-8 h-8 animate-spin text-cu-blue" />
                </div>
              ) : previewMode ? (
                <div className="bg-slate-50 rounded-xl p-6 min-h-[400px]">
                  <h4 className="font-bold text-cu-dark mb-4">Preview how users will see this:</h4>
                  <div className="bg-white rounded-xl p-6 shadow-sm border glass-card slide-in">
                    <h5 className="font-bold text-cu-blue mb-2">{departmentNames[selectedDept]}</h5>
                    <p className="text-slate-700 whitespace-pre-line leading-relaxed">{content || 'No content provided yet.'}</p>
                  </div>
                </div>
              ) : (
                <textarea
                  value={content}
                  onChange={handleContentChange}
                  placeholder={`Enter ${activeSection} information here...`}
                  className="w-full h-[400px] p-4 border-2 border-slate-200 rounded-xl focus:border-cu-blue focus:outline-none resize-none text-slate-700 leading-relaxed bg-white/50 backdrop-blur-sm transition-all"
                />
              )}

              <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                <span>💡 Tip: Changes are auto-saved as you type. Use line breaks to separate different points.</span>
                <span>Characters: {content.length}</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-6 grid md:grid-cols-3 gap-4">
              <button className="flex items-center justify-center gap-2 p-4 bg-white rounded-xl border-2 border-dashed border-slate-300 hover:border-cu-blue hover:bg-cu-blue/5 transition-all">
                <Plus className="w-5 h-5 text-slate-500" />
                <span className="text-slate-600">Add New Department</span>
              </button>
              <button className="flex items-center justify-center gap-2 p-4 bg-white rounded-xl border-2 border-dashed border-slate-300 hover:border-cu-gold hover:bg-cu-gold/5 transition-all">
                <Eye className="w-5 h-5 text-slate-500" />
                <span className="text-slate-600">View All Data</span>
              </button>
              <button className="flex items-center justify-center gap-2 p-4 bg-white rounded-xl border-2 border-dashed border-slate-300 hover:border-red-400 hover:bg-red-50 transition-all">
                <Trash2 className="w-5 h-5 text-slate-500" />
                <span className="text-slate-600">Reset to Default</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}