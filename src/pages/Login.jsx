import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import API from '../api'
import AnimatedBackground from '../components/AnimatedBackground'
import TypingText from '../components/TypingText'

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [showPass, setShowPass] = useState(false)
  const { login }               = useAuth()
  const navigate                = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await API.post('/auth/login', { email, password })
      login(res.data.user, res.data.access_token)
      navigate(res.data.user.role === 'teacher' ? '/teacher' : '/student')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 overflow-hidden relative">
      <AnimatedBackground />

      {/* Gradient base */}
      <div className="fixed inset-0 bg-gradient-to-br from-base via-surface/60 to-base z-0" />

      {/* Orbs */}
      <div className="fixed top-1/4 left-1/4 w-80 h-80 bg-indigo-200/40 rounded-full blur-[100px] animate-float" />
      <div className="fixed bottom-1/4 right-1/4 w-72 h-72 bg-blue-200/30 rounded-full blur-[100px] animate-float-delayed" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-md animate-fade-in-up">

        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-500 shadow-lg shadow-indigo-200 mb-5 animate-bounce-slow">
            <span className="text-3xl font-bold text-white">E</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-1.5 tracking-tight">
            Emoti<span className="text-indigo-600">Learn</span>
          </h1>
          <p className="text-gray-500 text-sm">
            <TypingText
              texts={['Emotion-Aware Learning', 'Real-Time Engagement', 'Smart Education']}
              speed={70}
              className="text-indigo-600/80"
            />
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-heavy rounded-2xl p-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-6 text-center">
            Welcome back
          </h2>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-500 text-sm animate-shake">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 tracking-wide uppercase">
                Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="input-glass pr-10"
                  placeholder="you@example.com"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                  </svg>
                </span>
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 tracking-wide uppercase">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="input-glass pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPass ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3.5 relative overflow-hidden group mt-2"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="group-hover:translate-x-1 transition-transform">
                      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </>
                )}
              </span>
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center my-6">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
            <span className="px-4 text-gray-400 text-xs">or</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
          </div>

          {/* Register link */}
          <p className="text-center text-gray-500 text-sm">
            Don't have an account?{' '}
            <Link to="/register" className="text-indigo-600 hover:text-indigo-500 font-medium transition-colors">
              Create one
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-300 text-xs mt-6">
          &copy; 2026 EmotiLearn &middot; Learning Profile System
        </p>
      </div>
    </div>
  )
}
