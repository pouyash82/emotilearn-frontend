import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import API from '../api'

export default function Login() {
  const [form,    setForm   ] = useState({ email: '', password: '' })
  const [error,   setError  ] = useState('')
  const [loading, setLoading] = useState(false)
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
    setLoading(true)
    try {
      const res = await API.post('/auth/login', form)
      login(res.data.user, res.data.access_token)
      if (res.data.user.role === 'teacher' ||
          res.data.user.role === 'admin') {
        navigate('/teacher')
      } else {
        navigate('/student')
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center
                    justify-center bg-dark px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🧠</div>
          <h1 className="text-3xl font-bold text-purple-400">
            EmotiLearn
          </h1>
          <p className="text-gray-500 mt-2">
            Learning Profile Recognition System
          </p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border
                        rounded-2xl p-8">
          <h2 className="text-xl font-semibold mb-6">
            Sign in to your account
          </h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30
                            text-red-400 rounded-lg px-4 py-3
                            mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

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
                  placeholder="••••••••"
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
              {form.password.length > 0 && (
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-gray-600">
                    {form.password.length}/72 characters
                  </span>
                  {form.password.length < 6 && (
                    <span className="text-xs text-red-400">
                      Too short
                    </span>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-purple-700
                         text-white font-semibold py-3 rounded-lg
                         transition-colors disabled:opacity-50
                         disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            Don't have an account?{' '}
            <Link to="/register"
                  className="text-purple-400 hover:text-purple-300">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}