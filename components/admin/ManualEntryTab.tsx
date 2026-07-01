'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Edit2, Trash2, RefreshCw, Layers } from 'lucide-react'

export default function ManualEntryTab() {
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  
  // Form State
  const [editId, setEditId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [namespace, setNamespace] = useState('general')
  const [sourceUrl, setSourceUrl] = useState('')
  const [tags, setTags] = useState('general')
  const [isSaving, setIsSaving] = useState(false)

  const fetchEntries = async () => {
    setLoading(true)
    try {
      const query = new URLSearchParams()
      if (search) query.append('search', search)
      if (categoryFilter) query.append('category', categoryFilter)
      
      const res = await fetch(`/api/admin/knowledge?${query.toString()}`)
      const data = await res.json()
      setEntries(data.entries || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEntries()
  }, [search, categoryFilter])

  const handleEdit = (entry: any) => {
    setEditId(entry.id)
    setTitle(entry.title)
    setContent(entry.content)
    setNamespace(entry.category || 'general')
    setSourceUrl(entry.source_url || '')
    setTags(entry.page_type || 'general')
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this entry? It will also be removed from the Pinecone vector index.')) return
    try {
      await fetch(`/api/admin/knowledge/${id}`, { method: 'DELETE' })
      fetchEntries()
    } catch (e) {
      console.error(e)
    }
  }

  const handleReEmbed = async (id: string) => {
    try {
      await fetch(`/api/admin/knowledge/${id}/re-embed`, { method: 'POST' })
      alert('Re-embedded successfully!')
    } catch (e) {
      console.error(e)
      alert('Failed to re-embed')
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const payload = { title, content, namespace, source_url: sourceUrl, tags }
      if (editId) {
        await fetch(`/api/admin/knowledge/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      } else {
        await fetch(`/api/admin/knowledge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      }
      setShowForm(false)
      setEditId(null)
      fetchEntries()
    } catch (err) {
      console.error(err)
      alert('Failed to save entry')
    } finally {
      setIsSaving(false)
    }
  }

  const resetForm = () => {
    setEditId(null)
    setTitle('')
    setContent('')
    setNamespace('general')
    setSourceUrl('')
    setTags('general')
    setShowForm(false)
  }

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 bg-[#141414] p-4 rounded-xl border border-gray-800">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search knowledge..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <select 
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-sm outline-none"
          >
            <option value="">All Categories</option>
            <option value="general">General</option>
            <option value="admissions">Admissions</option>
            <option value="faculty">Faculty</option>
            <option value="dept-cs">CS & IT</option>
            <option value="finance">Finance</option>
          </select>
        </div>
        <button 
          onClick={() => { resetForm(); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Entry
        </button>
      </div>

      {/* Editor Form */}
      {showForm && (
        <div className="bg-[#141414] border border-blue-500/30 rounded-xl p-6 shadow-[0_0_20px_rgba(37,99,235,0.05)]">
          <h3 className="text-lg font-semibold mb-4">{editId ? 'Edit Knowledge Entry' : 'New Knowledge Entry'}</h3>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Title</label>
                <input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Category / Namespace</label>
                <select required value={namespace} onChange={e => setNamespace(e.target.value)} className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2">
                  <option value="general">General</option>
                  <option value="admissions">Admissions</option>
                  <option value="faculty">Faculty</option>
                  <option value="dept-cs">CS & IT</option>
                  <option value="finance">Finance</option>
                  <option value="scholarships">Scholarships</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Source URL (Optional)</label>
                <input type="url" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Page Type / Tags</label>
                <input type="text" value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. policy, notice" className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2" />
              </div>
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-1">Content</label>
              <textarea 
                required 
                value={content} 
                onChange={e => setContent(e.target.value)} 
                rows={8}
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 font-mono text-sm" 
              />
            </div>
            
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={resetForm} className="px-4 py-2 hover:bg-gray-800 rounded-lg text-sm text-gray-400">Cancel</button>
              <button type="submit" disabled={isSaving} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium flex items-center gap-2">
                {isSaving ? 'Saving & Embedding...' : (editId ? 'Save Changes' : 'Save & Embed')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="bg-[#141414] border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-400 uppercase bg-gray-900/50 border-b border-gray-800">
            <tr>
              <th className="px-6 py-4">Title</th>
              <th className="px-6 py-4">Category</th>
              <th className="px-6 py-4">Source</th>
              <th className="px-6 py-4">Updated</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {loading ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Loading entries...</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No knowledge entries found.</td></tr>
            ) : (
              entries.map(entry => (
                <tr key={entry.id} className="hover:bg-gray-800/20">
                  <td className="px-6 py-4 font-medium text-gray-200">{entry.title}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-gray-800 rounded-md text-xs text-gray-400 border border-gray-700">
                      {entry.category || 'general'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-md text-xs ${entry.source_type === 'manual' ? 'bg-purple-900/30 text-purple-400 border border-purple-800/50' : 'bg-emerald-900/30 text-emerald-400 border border-emerald-800/50'}`}>
                      {entry.source_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">{new Date(entry.updated_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleReEmbed(entry.id)} title="Regenerate Embedding" className="p-1.5 hover:bg-blue-900/30 text-blue-400 rounded-md transition-colors">
                        <Layers className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleEdit(entry)} className="p-1.5 hover:bg-gray-800 text-gray-400 hover:text-white rounded-md transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(entry.id)} className="p-1.5 hover:bg-red-900/30 text-red-400 rounded-md transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
