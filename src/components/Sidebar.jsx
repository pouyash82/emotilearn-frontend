import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/* ─── Icon components (inline SVG for zero dependencies) ─── */
const icons = {
  overview: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  live: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M16.95 7.05a7 7 0 0 1 0 9.9" /><path d="M7.05 16.95a7 7 0 0 1 0-9.9" />
      <path d="M19.78 4.22a11 11 0 0 1 0 15.56" /><path d="M4.22 19.78a11 11 0 0 1 0-15.56" />
    </svg>
  ),
  history: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  courses: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  notifications: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  compare: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  students: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  analytics: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9" /><path d="M21 3l-9 9" />
      <path d="M21 3h-6" /><path d="M21 3v6" />
    </svg>
  ),
  settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  ),
  admin: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  chat: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  logout: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  exam: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  heatmap: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" /><rect x="7" y="7" width="3" height="3" /><rect x="14" y="7" width="3" height="3" />
      <rect x="7" y="14" width="3" height="3" /><rect x="14" y="14" width="3" height="3" />
    </svg>
  ),
}

/* ─── Navigation configs by role ─── */
const NAV_CONFIGS = {
  student: {
    label: 'STUDENT',
    items: [
      { id: 'overview',      label: 'Overview',       icon: 'overview' },
      { id: 'live',          label: 'Live session',   icon: 'live' },
      { id: 'history',       label: 'History',        icon: 'history' },
      { id: 'courses',       label: 'Courses',        icon: 'courses' },
      { id: 'compare',       label: 'Compare',        icon: 'compare' },
      { id: 'notifications', label: 'Notifications',  icon: 'notifications' },
    ],
  },
  teacher: {
    label: 'TEACHER',
    items: [
      { id: 'overview',  label: 'Overview',    icon: 'overview' },
      { id: 'students',  label: 'Students',    icon: 'students' },
      { id: 'courses',   label: 'Courses',     icon: 'courses' },
      { id: 'analytics', label: 'Analytics',   icon: 'analytics' },
      { id: 'exams',     label: 'Exams',       icon: 'exam' },
      { id: 'notifications', label: 'Notifications', icon: 'notifications' },
    ],
  },
  admin: {
    label: 'ADMIN',
    items: [
      { id: 'overview', label: 'Overview',  icon: 'overview' },
      { id: 'users',    label: 'Users',     icon: 'students' },
      { id: 'stats',    label: 'Stats',     icon: 'analytics' },
    ],
  },
}

export default function Sidebar({ activeTab, onTabChange, unreadCount = 0 }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const role = user?.role || 'student'
  const config = NAV_CONFIGS[role] || NAV_CONFIGS.student

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className="fixed left-0 top-0 bottom-0 glass-sidebar z-40 flex flex-col"
      style={{ width: 'var(--sidebar-width)' }}>

      {/* ── Logo ── */}
      <div className="px-5 py-5 border-b border-white/5">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 group-hover:scale-105 transition-all duration-300">
            <span className="text-lg font-bold text-white">E</span>
          </div>
          <span className="text-lg font-bold tracking-tight text-white">
            Emoti<span className="text-indigo-400">Learn</span>
          </span>
        </Link>
      </div>

      {/* ── Role label ── */}
      <div className="px-5 pt-5 pb-2">
        <span className="text-[10px] font-semibold tracking-[0.15em] text-gray-500 uppercase">
          {config.label}
        </span>
      </div>

      {/* ── Nav items ── */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {config.items.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`sidebar-nav-item w-full ${activeTab === item.id ? 'active' : ''}`}
          >
            <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
              {icons[item.icon]}
            </span>
            <span className="flex-1 text-left">{item.label}</span>
            {item.id === 'notifications' && unreadCount > 0 && (
              <span className="min-w-[20px] h-5 flex items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-bold px-1.5">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* ── Bottom section: user + logout ── */}
      <div className="border-t border-white/5 p-3 space-y-1">
        <Link to="/chat" className="sidebar-nav-item w-full">
          <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
            {icons.chat}
          </span>
          <span className="flex-1 text-left">AI Chat</span>
        </Link>

        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user?.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-[11px] text-gray-500 capitalize">{user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
            title="Logout"
          >
            {icons.logout}
          </button>
        </div>
      </div>
    </aside>
  )
}
