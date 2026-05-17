import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
    e.preventDefault()
    setError('')

    if (!ADMIN_EMAILS.includes(email.trim().toLowerCase())) {
      setError('This email is not authorized for admin access.')
      return
    }

    setLoading(true)
    try {
      const res = await API.post('/auth/login', {
        email: email.trim().toLowerCase(),
        password,
      })
      login(res.data.token, res.data.user)
      navigate('/admin')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-6">
      <div className="fixed top-20 right-20 w-72 h-72 bg-purple-600/20 rounded-full blur-3xl animate-float pointer-events-none" />
      <div className="fixed bottom-40 left-20 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl animate-float-delayed pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 mb-4 shadow-lg shadow-purple-500/30">
            <span className="text-2xl">🛡️</span>
          </div>
          <h1 className="text-3xl font-black text-white">Admin Access</h1>
          <p className="text-gray-500 text-sm mt-2">EmotiLearn System Administration</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <div onSubmit={handleLogin}>
            <div className="space-y-5">
              {/* Email */}
              <div>
                <label className="text-sm text-gray-400 mb-1.5 block">Admin Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@medipol.edu.tr"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 transition-all"
                />
              </div>

              {/* Password */}
              <div>
                <label className="text-sm text-gray-400 mb-1.5 block">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 transition-all"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleLogin}
                disabled={loading || !email || !password}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-sm hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100 transition-all shadow-lg shadow-purple-500/30"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Authenticating...
                  </div>
                ) : '🔐 Admin Login'}
              </button>
            </div>
          </div>

          {/* Authorized Emails */}
          <div className="mt-6 pt-6 border-t border-white/5">
            <p className="text-xs text-gray-600 mb-2">Authorized admin accounts:</p>
            <div className="space-y-1">
              {ADMIN_EMAILS.map(e => (
                <div key={e} className="text-xs text-gray-500 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500/50" />
                  {e}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Back link */}
        <div className="text-center mt-6">
          <a href="/login" className="text-gray-500 text-sm hover:text-gray-300 transition-colors">
            ← Back to regular login
          </a>
        </div>
      </div>
    </div>
  )
}
