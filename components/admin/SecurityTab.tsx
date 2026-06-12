'use client'

import { useState } from 'react'
import { Shield, Lock, Save, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { updateAdminPassword } from '@/app/actions/admin'

export default function SecurityTab() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.')
      setStatus('error')
      return
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.')
      setStatus('error')
      return
    }

    setIsSaving(true)
    setStatus('idle')
    
    const result = await updateAdminPassword(password)
    
    setIsSaving(false)
    if (result.success) {
      setStatus('success')
      setPassword('')
      setConfirmPassword('')
      setTimeout(() => setStatus('idle'), 3000)
    } else {
      setErrorMsg(result.error || 'Failed to update password')
      setStatus('error')
    }
  }

  return (
    <div className="flex flex-col gap-6 h-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="glass-dark rounded-3xl p-6 flex items-center justify-between" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
            <Shield className="w-6 h-6 text-rose-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-display text-white">Security Settings</h2>
            <p className="text-sm text-white/40 font-sans mt-0.5">Manage your admin access credentials.</p>
          </div>
        </div>
      </div>

      <div className="glass-dark rounded-3xl p-8" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <Lock className="w-5 h-5 text-rose-400" />
          Change Admin Password
        </h3>
        
        <form onSubmit={handleSave} className="space-y-6 max-w-md">
          {status === 'error' && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {errorMsg}
            </div>
          )}
          
          {status === 'success' && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              Password updated successfully!
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-rose-500/50 transition-colors"
              placeholder="Enter new password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-rose-500/50 transition-colors"
              placeholder="Confirm new password"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving || !password}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold transition-all"
            style={{
              background: isSaving ? 'rgba(244,63,94,0.5)' : '#f43f5e',
              color: '#fff',
              cursor: isSaving || !password ? 'not-allowed' : 'pointer',
            }}
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {isSaving ? 'Updating...' : 'Update Password'}
          </button>
        </form>
        
        <p className="text-xs text-white/30 mt-6 max-w-md leading-relaxed">
          <strong>Note:</strong> Updating the password here overrides the default password hash set in your `.env.local` file. This new password is encrypted and stored securely in your database.
        </p>
      </div>
    </div>
  )
}
