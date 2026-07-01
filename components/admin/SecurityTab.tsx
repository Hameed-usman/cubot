'use client'

import { useState, useEffect } from 'react'
import { Shield, Lock, Save, Loader2, CheckCircle, AlertCircle, Eye, EyeOff, User } from 'lucide-react'
import { getAdminCredentials, updateAdminCredentials } from '@/app/actions/admin'

export default function SecurityTab() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  const [showPassword, setShowPassword] = useState(false)
  
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function loadData() {
      const res = await getAdminCredentials()
      if (res.success && res.username) {
        setUsername(res.username)
      }
      setIsLoadingData(false)
    }
    loadData()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password && password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.')
      setStatus('error')
      return
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.')
      setStatus('error')
      return
    }
    if (!username.trim()) {
      setErrorMsg('Username cannot be empty.')
      setStatus('error')
      return
    }

    setIsSaving(true)
    setStatus('idle')
    
    // Only pass password if they are trying to update it
    const newPasswordStr = password ? password : undefined
    
    const result = await updateAdminCredentials(username, newPasswordStr)
    
    setIsSaving(false)
    if (result.success) {
      setStatus('success')
      setPassword('')
      setConfirmPassword('')
      setTimeout(() => setStatus('idle'), 4000)
    } else {
      setErrorMsg(result.error || 'Failed to update credentials')
      setStatus('error')
    }
  }

  if (isLoadingData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
        <p>Loading security settings...</p>
      </div>
    )
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
          Update Admin Credentials
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
              Credentials updated successfully! Use these on your next login.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2 flex items-center gap-2">
              <User className="w-4 h-4" /> Admin Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-rose-500/50 transition-colors"
              placeholder="Enter admin username"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">New Password (Leave blank to keep current)</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-4 pr-12 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-rose-500/50 transition-colors"
                placeholder="Enter new password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-white transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Confirm New Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-4 pr-12 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-rose-500/50 transition-colors"
                placeholder="Confirm new password"
              />
              {/* Duplicate eye icon for ease of use */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-white transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold transition-all"
            style={{
              background: isSaving ? 'rgba(244,63,94,0.5)' : '#f43f5e',
              color: '#fff',
              cursor: isSaving ? 'not-allowed' : 'pointer',
            }}
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {isSaving ? 'Updating...' : 'Save Credentials'}
          </button>
        </form>
        
        <div className="mt-8 pt-6 border-t border-white/10 space-y-3">
          <p className="text-sm text-gray-400 leading-relaxed">
            <strong className="text-rose-400">Security Note:</strong> Passwords are securely hashed and encrypted before being saved to the database. We cannot show your current active password in plain text for your safety.
          </p>
          <p className="text-sm text-gray-400 leading-relaxed">
            Updating credentials here will override the default settings in your <code>.env.local</code> file.
          </p>
        </div>
      </div>
    </div>
  )
}
