import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/70 border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 group-hover:scale-110 transition-all duration-300">
              <span className="text-xl">🧠</span>
            </div>
            <span className="text-xl font-black bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
              EmotiLearn
            </span>
          </Link>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {/* User info */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <p className="text-white font-medium text-sm">{user?.name}</p>
                <p className="text-gray-500 text-xs capitalize">{user?.role}</p>
              </div>
              
              {/* Avatar */}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
                {user?.role === 'teacher' ? '👨‍🏫' : '🎓'}
              </div>
            </div>

            {/* Role badge */}
            <span className={`
              px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider
              ${user?.role === 'teacher' 
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              }
            `}>
              {user?.role}
            </span>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-xl text-sm font-medium
                       bg-white/5 border border-white/10 text-gray-400
                       hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-400
                       transition-all duration-300"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
