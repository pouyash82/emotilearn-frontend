import { useAuth } from '../context/AuthContext'
import { useNavigate, Link } from 'react-router-dom'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate         = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav className="bg-card border-b border-border px-6 py-4
                    flex items-center justify-between">
      <Link to="/" className="flex items-center gap-3">
        <span className="text-2xl">🧠</span>
        <span className="text-xl font-bold text-purple-400">
          EmotiLearn
        </span>
      </Link>

      <div className="flex items-center gap-4">
        {user && (
          <>
            <span className="text-sm text-gray-400">
              {user.role === 'teacher' ? '👨‍🏫' : '🎓'} {user.name}
            </span>
            <span className="text-xs bg-primary/20 text-purple-400
                             border border-primary/30 px-2 py-1
                             rounded-full capitalize">
              {user.role}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-red-400
                         transition-colors"
            >
              Logout
            </button>
          </>
        )}
      </div>
    </nav>
  )
}