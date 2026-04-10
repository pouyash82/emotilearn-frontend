import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import API from '../api'
import AnimatedBackground from '../components/AnimatedBackground'
import TypingText from '../components/TypingText'
import GlassCard from '../components/GlassCard'

export default function Register() {
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole]         = useState('student')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [showPass, setShowPass] = useState(false)
  const { login }               = useAuth()
  const navigate                = useNavigate()

  const strength = password.length === 0 ? 0
                 : password.length < 4 ? 1
                 : password.length < 6 ? 2
                 : password.length < 8 ? 3
                 : password.length < 12 ? 4 : 5

  const strengthColors = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500']
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent']

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await API.post('/auth/register', { name, email, password, role })
      login(res.data.user, res.data.access_token)
      navigate(res.data.user.role === 'teacher' ? '/teacher' : '/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 overflow-hidden relative">
      {/* Animated particle background */}
      <AnimatedBackground />
      
      {/* Gradient overlay */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-purple-950/50 to-slate-950 z-0" />
      
      {/* Floating gradient orbs */}
      <div className="fixed top-1/4 right-1/4 w-96 h-96 bg-pink-600/30 rounded-full blur-3xl animate-float" />
      <div className="fixed bottom-1/4 left-1/4 w-80 h-80 bg-purple-600/20 rounded-full blur-3xl animate-float-delayed" />
      <div className="fixed top-1/3 left-1/2 w-64 h-64 bg-cyan-600/20 rounded-full blur-3xl animate-float-slow" />

      {/* Main content */}
      <div className="relative z-10 w-full max-w-md animate-fade-in-up">
        
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-500 shadow-lg shadow-pink-500/30 mb-6 animate-bounce-slow">
            <span className="text-4xl">🎓</span>
          </div>
          <h1 className="text-4xl font-black bg-gradient-to-r from-white via-pink-200 to-purple-200 bg-clip-text text-transparent mb-2">
            Join EmotiLearn
          </h1>
          <p className="text-gray-400">
            <TypingText 
              texts={[
                'Start your journey',
                'Learn with AI',
                'Track emotions',
                'Boost engagement'
              ]}
              speed={80}
              className="text-pink-400"
            />
          </p>
        </div>

        {/* Register Card */}
        <GlassCard glow className="p-8">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            Create Account
          </h2>

          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm animate-shake">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Full Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-5 py-4 rounded-2xl
                           bg-white/5 border border-white/10
                           text-white placeholder-gray-500
                           focus:outline-none focus:border-purple-500/50 focus:bg-white/10
                           focus:shadow-[0_0_20px_rgba(168,85,247,0.3)]
                           transition-all duration-300"
                  placeholder="John Doe"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                  👤
                </span>
              </div>
            </div>

            {/* Email */}
            <div>
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
                           focus:outline-none focus:border-purple-500/50 focus:bg-white/10
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
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  maxLength={72}
                  className="w-full px-5 py-4 rounded-2xl
                           bg-white/5 border border-white/10
                           text-white placeholder-gray-500
                           focus:outline-none focus:border-purple-500/50 focus:bg-white/10
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
              
              {/* Password strength */}
              {password && (
                <div className="mt-3 space-y-2 animate-fade-in">
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(i => (
                      <div 
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                          i <= strength ? strengthColors[strength] : 'bg-gray-700'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className={`${strengthColors[strength].replace('bg-', 'text-')}`}>
                      {strengthLabels[strength]}
                    </span>
                    <span className="text-gray-500">{password.length}/72</span>
                  </div>
                </div>
              )}
            </div>

            {/* Role Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                I am a...
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'student', icon: '🎓', label: 'Student' },
                  { value: 'teacher', icon: '👨‍🏫', label: 'Teacher' }
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRole(option.value)}
                    className={`p-4 rounded-2xl border transition-all duration-300
                      ${role === option.value 
                        ? 'bg-gradient-to-r from-purple-600/30 to-pink-600/30 border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.3)]' 
                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                      }`}
                  >
                    <span className="text-2xl block mb-1">{option.icon}</span>
                    <span className="text-white font-medium">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || password.length < 6}
              className="w-full py-4 rounded-2xl font-bold text-white
                       bg-gradient-to-r from-pink-600 to-purple-600
                       hover:from-pink-500 hover:to-purple-500
                       shadow-lg shadow-pink-500/30
                       hover:shadow-pink-500/50 hover:scale-[1.02]
                       disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                       transition-all duration-300
                       relative overflow-hidden group"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating account...
                  </>
                ) : (
                  <>
                    Create Account
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </>
                )}
              </span>
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center my-6">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <span className="px-4 text-gray-500 text-sm">or</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          </div>

          {/* Login link */}
          <p className="text-center text-gray-400">
            Already have an account?{' '}
            <Link 
              to="/login" 
              className="text-purple-400 hover:text-purple-300 font-medium hover:underline transition-colors"
            >
              Sign in
            </Link>
          </p>
        </GlassCard>
      </div>
    </div>
  )
}
