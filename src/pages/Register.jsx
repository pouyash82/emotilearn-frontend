import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import API from '../api'

function PasswordStrength({ password }) {
  const getStrength = () => {
    if (password.length === 0) return { level: 0, label: '', color: '' }
    if (password.length < 6)   return { level: 1, label: 'Too short', color: '#ef4444' }
    if (password.length < 8)   return { level: 2, label: 'Weak', color: '#f97316' }
    const hasUpper  = /[A-Z]/.test(password)
    const hasNum    = /[0-9]/.test(password)
    const hasSymbol = /[^A-Za-z0-9]/.test(password)
    const score     = [hasUpper, hasNum, hasSymbol]
                      .filter(Boolean).length
    if (score === 0) return { level: 2, label: 'Weak',   color: '#f97316' }
    if (score === 1) return { level: 3, label: 'Fair',   color: '#eab308' }
    if (score === 2) return { level: 4, label: 'Good',   color: '#22c55e' }
    return            { level: 5, label: 'Strong', color: '#7c3aed' }
  }

  const { level, label, color } = getStrength()
  if (password.length === 0) return null

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1,2,3,4,5].map(i => (
          <div key={i}
               className="h-1 flex-1 rounded-full transition-all"
               style={{ background: i <= level ? color : '#2d2d4e' }}
          />
        ))}
      </div>
      <div className="flex justify-between">
        <span className="text-xs" style={{ color }}>
          {label}
        </span>
        <span className="text-xs text-gray-600">
          {password.length}/72
        </span>
      </div>
    </div>
  )
}

export default function Register() {
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'student'
  })
  const [error,    setError   ] = useState('')
  const [loading,  setLoading ] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const { login } = useAuth()
  const navigate  = useNavigate()

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (form.name.trim().length < 2) {
      setError('Please enter your full name')
      return
    }
    setLoading(true)
    try {
      const res = await API.post('/auth/register', form)
      login(res.data.user, res.data.access_token)
      navigate(form.role === 'student' ? '/student' : '/teacher')
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center
                    justify-center bg-dark px-4 py-8">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🧠</div>
          <h1 className="text-3xl font-bold text-purple-400">
            EmotiLearn
          </h1>
          <p className="text-gray-500 mt-2">Create your account</p>
        </div>

        <div className="bg-card border border-border
                        rounded-2xl p-8">
          <h2 className="text-xl font-semibold mb-6">
            Get started
          </h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30
                            text-red-400 rounded-lg px-4 py-3
                            mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Name */}
            <div>
              <label className="text-sm text-gray-400 mb-1 block">
                Full Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({...form,
                  name: e.target.value})}
                maxLength={100}
                className="w-full bg-dark border border-border
                           rounded-lg px-4 py-3 text-white
                           focus:outline-none focus:border-primary
                           transition-colors"
                placeholder="Mohammad Shafizadeh"
                required
              />
            </div>

            {/* Email */}
            <div>
              <label className="text-sm text-gray-400 mb-1 block">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({...form,
                  email: e.target.value})}
                className="w-full bg-dark border border-border
                           rounded-lg px-4 py-3 text-white
                           focus:outline-none focus:border-primary
                           transition-colors"
                placeholder="you@university.edu"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="text-sm text-gray-400 mb-1 block">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm({...form,
                    password: e.target.value})}
                  maxLength={72}
                  className="w-full bg-dark border border-border
                             rounded-lg px-4 py-3 pr-12 text-white
                             focus:outline-none focus:border-primary
                             transition-colors"
                  placeholder="Min. 6 characters"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2
                             text-gray-500 hover:text-gray-300
                             transition-colors text-lg select-none"
                  tabIndex={-1}
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
              <PasswordStrength password={form.password} />
            </div>

            {/* Role */}
            <div>
              <label className="text-sm text-gray-400 mb-1 block">
                I am a...
              </label>
              <div className="grid grid-cols-2 gap-3">
                {['student', 'teacher'].map(role => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setForm({...form, role})}
                    className={`py-3 rounded-lg border font-medium
                                capitalize transition-colors
                                ${form.role === role
                                  ? 'bg-primary border-primary text-white'
                                  : 'bg-dark border-border text-gray-400 hover:border-primary'
                                }`}
                  >
                    {role === 'student' ? '🎓 Student' : '👨‍🏫 Teacher'}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || form.password.length < 6}
              className="w-full bg-primary hover:bg-purple-700
                         text-white font-semibold py-3 rounded-lg
                         transition-colors disabled:opacity-50
                         disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            Already have an account?{' '}
            <Link to="/login"
                  className="text-purple-400 hover:text-purple-300">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}