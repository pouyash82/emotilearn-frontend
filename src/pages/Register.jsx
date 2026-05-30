import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import API from '../api'
import AnimatedBackground from '../components/AnimatedBackground'
import TypingText from '../components/TypingText'

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
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setError('')
    setLoading(true)
    try {
      const res = await API.post('/auth/register', { name, email, password, role })
      login(res.data.user, res.data.access_token)
      const r = res.data.user.role
      navigate(r === 'teacher' ? '/teacher' : r === 'admin' ? '/admin' : '/student')
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 overflow-hidden relative">
      <AnimatedBackground />
      <div className="fixed inset-0 bg-gradient-to-br from-base via-surface/60 to-base z-0" />
      <div className="fixed top-1/4 right-1/4 w-80 h-80 bg-indigo-200/40 rounded-full blur-[100px] animate-float" />
      <div className="fixed bottom-1/4 left-1/4 w-72 h-72 bg-blue-200/30 rounded-full blur-[100px] animate-float-delayed" />

      <div className="relative z-10 w-full max-w-md animate-fade-in-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-500 shadow-lg shadow-indigo-200 mb-5 animate-bounce-slow">
            <span className="text-2xl font-bold text-white">E</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-1.5 tracking-tight">
            Join Emoti<span className="text-indigo-600">Learn</span>
          </h1>
          <p className="text-gray-500 text-sm">
            <TypingText texts={['Start your journey', 'Track emotions', 'Boost engagement']} speed={70} className="text-indigo-600/80" />
          </p>
        </div>

        {/* Card */}
        <div className="glass-heavy rounded-2xl p-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-6 text-center">Create Account</h2>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-500 text-sm animate-shake">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 tracking-wide uppercase">Full Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="input-glass" placeholder="John Doe" />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 tracking-wide uppercase">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input-glass" placeholder="you@example.com" />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 tracking-wide uppercase">Password</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required maxLength={72} className="input-glass pr-10" placeholder="••••••••" />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPass ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
              {password && (
                <div className="mt-2.5 space-y-1.5 animate-fade-in">
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= strength ? strengthColors[strength] : 'bg-gray-800'}`} />
                    ))}
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className={strengthColors[strength].replace('bg-', 'text-')}>{strengthLabels[strength]}</span>
                    <span className="text-gray-400">{password.length}/72</span>
                  </div>
                </div>
              )}
            </div>

            {/* Role */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2 tracking-wide uppercase">I am a...</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'student', label: 'Student', desc: 'Track my learning' },
                  { value: 'teacher', label: 'Teacher', desc: 'Monitor students' },
                ].map((opt) => (
                  <button key={opt.value} type="button" onClick={() => setRole(opt.value)}
                    className={`p-4 rounded-xl border text-left transition-all duration-300 ${
                      role === opt.value
                        ? 'bg-indigo-50 border-indigo-200 shadow-[0_0_16px_rgba(99,102,241,0.15)]'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-50 hover:border-white/12'
                    }`}>
                    <div className="text-sm font-semibold text-slate-800">{opt.label}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading || password.length < 6}
              className="w-full btn-primary py-3.5 mt-2 relative overflow-hidden group">
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating account...</>
                ) : (
                  <>Create Account <span className="group-hover:translate-x-1 transition-transform">&rarr;</span></>
                )}
              </span>
            </button>
          </form>

          <div className="flex items-center my-6">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
            <span className="px-4 text-gray-400 text-xs">or</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
          </div>

          <p className="text-center text-gray-500 text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-600 hover:text-indigo-500 font-medium transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
