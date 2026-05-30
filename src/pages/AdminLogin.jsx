import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import API from '../api'

const ADMIN_EMAILS = [
  "mohammad.shafizadeh@std.medipol.edu.tr",
  "arya.ghazi@std.medipol.edu.tr",
  "helya.ghazi@std.medipol.edu.tr",
]

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth()

  const handleLogin = async (e) => {
    e?.preventDefault()
    setError('')
    if (!ADMIN_EMAILS.includes(email.trim().toLowerCase())) {
      setError('This email is not authorized for admin access.')
      return
    }
    setLoading(true)
    try {
      const res = await API.post('/auth/login', { email: email.trim().toLowerCase(), password })
      login(res.data.user, res.data.access_token)
      navigate('/admin')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed.')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 overflow-hidden relative" style={{ background: 'var(--bg-base)' }}>
      <div className="fixed inset-0 bg-gradient-to-br from-base via-surface/60 to-base z-0" />
      <div className="fixed top-1/4 right-1/4 w-72 h-72 bg-indigo-600/15 rounded-full blur-[100px] animate-float" />
      <div className="fixed bottom-1/4 left-1/4 w-64 h-64 bg-purple-600/10 rounded-full blur-[100px] animate-float-delayed" />

      <div className="relative z-10 w-full max-w-md animate-fade-in-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/20 mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Access</h1>
          <p className="text-gray-600 text-sm mt-1">EmotiLearn System Administration</p>
        </div>

        {/* Card */}
        <div className="glass-heavy rounded-2xl p-7">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 tracking-wide uppercase">Admin Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@medipol.edu.tr" className="input-glass" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 tracking-wide uppercase">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter admin password" className="input-glass"
                onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>

            {error && <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-shake">{error}</div>}

            <button onClick={handleLogin} disabled={loading || !email || !password}
              className="w-full btn-primary py-3 disabled:opacity-40">
              {loading ? (
                <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Authenticating...</span>
              ) : 'Admin Login'}
            </button>
          </div>

          {/* Authorized list */}
          <div className="mt-5 pt-5 border-t border-white/5">
            <p className="text-[10px] text-gray-600 uppercase tracking-wider font-medium mb-2">Authorized accounts</p>
            <div className="space-y-1">
              {ADMIN_EMAILS.map(e => (
                <div key={e} className="text-xs text-gray-600 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/40" />{e}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="text-center mt-5">
          <Link to="/login" className="text-gray-600 text-sm hover:text-gray-400 transition-colors">&larr; Back to login</Link>
        </div>
      </div>
    </div>
  )
}
