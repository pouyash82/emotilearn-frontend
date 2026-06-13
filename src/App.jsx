import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login            from './pages/Login'
import Register         from './pages/Register'
import AdminLogin       from './pages/AdminLogin'
import StudentDashboard from './pages/StudentDashboard'
import TeacherDashboard from './pages/TeacherDashboard'
import AdminDashboard   from './pages/AdminDashboard'
import ChatPage         from './pages/ChatPage'
import ProtectedRoute   from './components/ProtectedRoute'
import ExamPage         from './pages/ExamPage'

function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user)   return <Navigate to="/login" replace />
  if (user.role === 'admin')   return <Navigate to="/admin" replace />
  if (user.role === 'teacher') return <Navigate to="/teacher" replace />
  return <Navigate to="/student" replace />
}

// ── Theme toggle button (fixed position, always visible) ──
function ThemeToggle({ dark, onToggle }) {
  return (
    <button
      onClick={onToggle}
      aria-label="Toggle dark mode"
      className="fixed bottom-6 right-6 z-[9990] w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-300"
      style={{
        background: dark ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.9)',
        border: dark ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(0,0,0,0.1)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {dark ? (
        // Sun icon
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      ) : (
        // Moon icon
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  )
}

export default function App() {
  const [dark, setDark] = useState(() => {
    // Restore saved preference
    return localStorage.getItem('emotilearn_theme') === 'dark'
  })

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('emotilearn_theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/exam" element={<ExamPage />} />
          <Route path="/gaze-demo" element={<GazeTrackingDemo />} />
          <Route path="/"         element={<HomeRedirect />} />
          <Route path="/login"    element={<Login />} />
          <Route path="/admin-login" element={<AdminLogin />} />
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
          <Route path="/admin"    element={
            <ProtectedRoute role="admin">
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/chat"     element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ThemeToggle dark={dark} onToggle={() => setDark(d => !d)} />
      </AuthProvider>
    </BrowserRouter>
  )
}
