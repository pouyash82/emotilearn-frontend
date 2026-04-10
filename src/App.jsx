import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login            from './pages/Login'
import Register         from './pages/Register'
import StudentDashboard from './pages/StudentDashboard'
import TeacherDashboard from './pages/TeacherDashboard'
import ProtectedRoute   from './components/ProtectedRoute'

function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user)   return <Navigate to="/login" replace />
  return <Navigate to={
    user.role === 'student' ? '/student' : '/teacher'
  } replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/"         element={<HomeRedirect />} />
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/student"  element={
            <ProtectedRoute role="student">
              <StudentDashboard />
            </ProtectedRoute>
          } />
          <Route path="/teacher"  element={
            <ProtectedRoute role="teacher">
              <TeacherDashboard />
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
