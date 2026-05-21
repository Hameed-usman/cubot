'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Lock, Eye, EyeOff, GraduationCap, Loader2, AlertCircle, Cpu } from 'lucide-react'

export default function AdminLoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setLoading(true); setError('')
    const res = await signIn('credentials', { redirect: false, username, password })
    if (res?.error) {
      setError('Invalid credentials. Access denied.')
      setLoading(false)
    } else {
      window.location.replace('/admin')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg,#080d1a 0%,#0d1526 50%,#080d1a 100%)' }}>
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-[140px] bg-cu-navy/30" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full blur-[120px]" style={{background:'rgba(201,162,39,0.06)'}} />
      </div>
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-cu-navy border border-cu-navy-mid/60 shadow-navy-glow mb-4">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-display font-extrabold text-2xl text-white mb-1">Admin Portal</h1>
          <p className="text-white/40 text-sm font-sans">Cubot Knowledge Base Management</p>
          <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full border text-xs font-sans"
            style={{background:'rgba(201,162,39,0.06)',borderColor:'rgba(201,162,39,0.2)',color:'rgba(201,162,39,0.7)'}}>
            <Cpu className="w-3 h-3" />IT &amp; Robotics Society — CUSIT
          </div>
        </div>
        <div className="glass-dark rounded-3xl p-8" style={{border:'1px solid rgba(255,255,255,0.08)'}}>
          <div className="flex items-center gap-2 mb-6">
            <Lock className="w-4 h-4 text-cu-gold" />
            <span className="text-xs font-semibold text-white/50 font-display tracking-widest uppercase">Secure Access Required</span>
          </div>
          {error && (
            <div className="flex items-center gap-2 mb-5 px-4 py-3 rounded-2xl text-red-400 text-sm font-sans"
              style={{background:'rgba(127,29,29,0.3)',border:'1px solid rgba(239,68,68,0.2)'}} role="alert">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4" aria-label="Admin login form">
            <div>
              <label htmlFor="admin-username" className="block text-sm font-semibold text-white/50 font-sans mb-2">Username</label>
              <input id="admin-username" type="text" required autoComplete="username" value={username}
                onChange={e => setUsername(e.target.value)} placeholder="Admin username"
                className="w-full px-4 py-3 rounded-2xl text-white placeholder-white/25 text-sm font-sans focus:outline-none transition-all"
                style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)'}} />
            </div>
            <div>
              <label htmlFor="admin-password" className="block text-sm font-semibold text-white/50 font-sans mb-2">Password</label>
              <div className="relative">
                <input id="admin-password" type={showPw ? 'text' : 'password'} required autoComplete="current-password"
                  value={password} onChange={e => setPassword(e.target.value)} placeholder="Password"
                  className="w-full px-4 py-3 pr-12 rounded-2xl text-white placeholder-white/25 text-sm font-sans focus:outline-none transition-all"
                  style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)'}} />
                <button type="button" onClick={() => setShowPw(!showPw)} aria-label={showPw ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors p-1">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} aria-label="Sign in"
              className="w-full btn-gold flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-cu-dark font-display text-base mt-2 disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Authenticating…</> : <><Lock className="w-4 h-4" />Sign In to Admin</>}
            </button>
          </form>
        </div>
        <p className="text-center text-white/20 text-xs font-sans mt-6">Unauthorized access is prohibited. All activity is monitored.</p>
      </div>
    </div>
  )
}
