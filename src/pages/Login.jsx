import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import API from '../api'
import AnimatedBackground from '../components/AnimatedBackground'
import TypingText from '../components/TypingText'
import GlassCard from '../components/GlassCard'

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
      navigate(res.data.user.role === 'teacher' ? '/teacher' : '/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 overflow-hidden relative">
      {/* Animated particle background */}
      <AnimatedBackground />
      
      {/* Gradient overlay */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900/50 to-slate-950 z-0" />
      
      {/* Floating gradient orbs */}
      <div className="fixed top-1/4 left-1/4 w-96 h-96 bg-blue-600/30 rounded-full blur-3xl animate-float" />
      <div className="fixed bottom-1/4 right-1/4 w-80 h-80 bg-indigo-600/20 rounded-full blur-3xl animate-float-delayed" />
      <div className="fixed top-1/2 right-1/3 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl animate-float-slow" />

      {/* Main content */}
      <div className="relative z-10 w-full max-w-md animate-fade-in-up">
        
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/30 mb-6 animate-bounce-slow">
            <span className="text-4xl">🧠</span>
          </div>
          <h1 className="text-4xl font-black bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent mb-2">
            EmotiLearn
          </h1>
          <p className="text-gray-400">
            <TypingText 
              texts={[
                
                'Emotion Recognition',
                'Smart Education',
                'Track Your Progress'
              ]}
              speed={80}
              className="text-blue-400"
            />
          </p>
        </div>

        {/* Login Card */}
        <GlassCard glow className="p-8">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            Welcome Back
          </h2>

          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm animate-shake">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="group">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-5 py-4 rounded-2xl
                           bg-white/5 border border-white/10
                           text-white placeholder-gray-500
                           focus:outline-none focus:border-blue-500/50 focus:bg-white/10
                           focus:shadow-[0_0_20px_rgba(168,85,247,0.3)]
                           transition-all duration-300"
                  placeholder="you@example.com"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                  ✉️
                </span>
              </div>
            </div>

            {/* Password */}
            <div className="group">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-5 py-4 rounded-2xl
                           bg-white/5 border border-white/10
                           text-white placeholder-gray-500
                           focus:outline-none focus:border-blue-500/50 focus:bg-white/10
                           focus:shadow-[0_0_20px_rgba(168,85,247,0.3)]
                           transition-all duration-300"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl font-bold text-white
                       bg-gradient-to-r from-blue-600 to-indigo-600
                       hover:from-blue-500 hover:to-indigo-500
                       shadow-lg shadow-blue-500/30
                       hover:shadow-blue-500/50 hover:scale-[1.02]
                       disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                       transition-all duration-300
                       relative overflow-hidden group"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </>
                )}
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center my-6">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <span className="px-4 text-gray-500 text-sm">or</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          </div>

          {/* Register link */}
          <p className="text-center text-gray-400">
            Don't have an account?{' '}
            <Link 
              to="/register" 
              className="text-blue-400 hover:text-purple-300 font-medium hover:underline transition-colors"
            >
              Create one
            </Link>
          </p>
        </GlassCard>

        {/* Footer */}
        <p className="text-center text-gray-600 text-sm mt-8">
          © 2026 EmotiLearn • Learning Profile System
        </p>
      </div>
    </div>
  )
}
