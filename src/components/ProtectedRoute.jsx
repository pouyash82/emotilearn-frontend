import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen flex items-center
                    justify-center bg-dark">
      <div className="text-purple-400 text-xl animate-pulse">
        Loading...
      </div>
    </div>
  )

  if (!user) return <Navigate to="/login" replace />

  if (role && user.role !== role && user.role !== 'admin') {
    return <Navigate to={
      user.role === 'teacher' ? '/teacher' : '/student'
    } replace />
  }

  return children
}