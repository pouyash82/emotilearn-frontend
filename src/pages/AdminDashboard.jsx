import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import API from '../api'

const FC = s => s >= 85 ? '#22c55e' : s >= 70 ? '#3b82f6' : s >= 50 ? '#eab308' : '#ef4444'

export default function AdminDashboard() {
  const { user, logout } = useAuth()
  const [tab, setTab] = useState('users')
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState(null)
  const [health, setHealth] = useState(null)
  const [flagged, setFlagged] = useState([])
  const [roleFilter, setRoleFilter] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [threshold, setThreshold] = useState(50)

  useEffect(() => {
    if (tab === 'users') loadUsers()
    if (tab === 'analytics') loadStats()
    if (tab === 'health') loadHealth()
    if (tab === 'integrity') loadIntegrity()
  }, [tab])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const params = roleFilter ? `?role=${roleFilter}` : ''
      const res = await API.get(`/admin/users${params}`)
      setUsers(res.data.users || [])
    } catch {} finally { setLoading(false) }
  }

  const loadStats = async () => {
    try { const res = await API.get('/admin/stats'); setStats(res.data) } catch {}
  }

  const loadHealth = async () => {
    setLoading(true)
    try { const res = await API.get('/admin/health'); setHealth(res.data) } catch {} finally { setLoading(false) }
  }

  const loadIntegrity = async () => {
    try { const res = await API.get(`/admin/exam-integrity?threshold=${threshold}`); setFlagged(res.data.flagged || []) } catch {}
  }

  const changeRole = async (userId, newRole) => {
    try {
      await API.put(`/admin/users/${userId}/role`, { role: newRole })
      loadUsers()
    } catch (e) { alert(e.response?.data?.detail || 'Failed') }
  }

  const toggleStatus = async (userId) => {
    try { await API.put(`/admin/users/${userId}/status`); loadUsers() } catch {}
  }

  const filtered = users.filter(u =>
    (!search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
  )

  const TABS = [
    { id: 'users', label: '👥 Users' },
    { id: 'analytics', label: '📊 Analytics' },
    { id: 'health', label: '🟢 System Health' },
    { id: 'integrity', label: '🔒 Exam Integrity' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="bg-white/5 border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-white font-black text-xl">⚙️ System Management</h1>
            <p className="text-gray-500 text-xs">Admin: {user?.name}</p>
          </div>
          <button onClick={logout} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm hover:bg-white/10">Logout</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${tab === t.id ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg' : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ═════════ USERS TAB ═════════ */}
        {tab === 'users' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center">
              <input type="text" placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 text-sm" />
              <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setTimeout(loadUsers, 100) }}
                className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm focus:outline-none">
                <option value="">All Roles</option>
                <option value="student">Students</option>
                <option value="teacher">Teachers</option>
                <option value="admin">Admins</option>
              </select>
              <span className="text-gray-500 text-sm">{filtered.length} users</span>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-5 py-3 bg-white/5 text-xs text-gray-500 font-bold uppercase">
                <div className="col-span-3">Name</div>
                <div className="col-span-3">Email</div>
                <div className="col-span-1">Role</div>
                <div className="col-span-1">Sessions</div>
                <div className="col-span-1">Status</div>
                <div className="col-span-3">Actions</div>
              </div>
              {filtered.map(u => (
                <div key={u.id} className="grid grid-cols-12 gap-2 px-5 py-3 border-t border-white/5 items-center hover:bg-white/5 transition-all">
                  <div className="col-span-3 text-white font-medium text-sm">{u.name}</div>
                  <div className="col-span-3 text-gray-400 text-xs truncate">{u.email}</div>
                  <div className="col-span-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : u.role === 'teacher' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                      {u.role}
                    </span>
                  </div>
                  <div className="col-span-1 text-gray-400 text-sm">{u.sessions}</div>
                  <div className="col-span-1">
                    <span className={`text-xs ${u.is_active ? 'text-green-400' : 'text-red-400'}`}>{u.is_active ? '● Active' : '● Inactive'}</span>
                  </div>
                  <div className="col-span-3 flex gap-2">
                    <select value={u.role} onChange={e => changeRole(u.id, e.target.value)}
                      className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300 text-xs">
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button onClick={() => toggleStatus(u.id)}
                      className={`px-2 py-1 rounded-lg text-xs font-bold ${u.is_active ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'}`}>
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && <div className="text-center py-8 text-gray-500">No users found</div>}
            </div>
          </div>
        )}

        {/* ═════════ ANALYTICS TAB ═════════ */}
        {tab === 'analytics' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              {[
                { v: stats.users?.total || 0, l: 'Total Users', s: `${stats.users?.students || 0}s · ${stats.users?.teachers || 0}t`, c: '#3b82f6', icon: '👥' },
                { v: stats.courses || 0, l: 'Courses', s: `${stats.enrollments || 0} enrollments`, c: '#22c55e', icon: '📚' },
                { v: stats.sessions || 0, l: 'Sessions', s: `${stats.avg_engagement || 0}% avg eng`, c: '#f97316', icon: '🎥' },
                { v: stats.exams?.total || 0, l: 'Exams', s: `${stats.exams?.submissions || 0} submissions`, c: '#a855f7', icon: '📝' },
              ].map(x => (
                <div key={x.l} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <div className="text-2xl mb-2">{x.icon}</div>
                  <div className="text-3xl font-black" style={{ color: x.c }}>{x.v}</div>
                  <div className="text-gray-400 text-sm mt-1">{x.l}</div>
                  <div className="text-gray-600 text-xs">{x.s}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h3 className="text-white font-bold mb-4">📊 Exam Performance</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-black" style={{ color: FC(stats.exams?.avg_score || 0) }}>{stats.exams?.avg_score || 0}%</div>
                    <div className="text-gray-500 text-xs mt-1">Avg Exam Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-black" style={{ color: FC(stats.exams?.avg_focus || 0) }}>{stats.exams?.avg_focus || 0}%</div>
                    <div className="text-gray-500 text-xs mt-1">Avg Focus Score</div>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h3 className="text-white font-bold mb-4">🕐 Recent Submissions</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {(stats.recent_submissions || []).map((s, i) => (
                    <div key={i} className="flex justify-between items-center bg-white/5 rounded-lg px-3 py-2">
                      <div>
                        <div className="text-white text-sm">{s.student}</div>
                        <div className="text-gray-500 text-xs">{s.exam}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold" style={{ color: FC(s.score) }}>{s.score}%</div>
                        <div className="text-xs text-gray-500">Focus: {s.focus}%</div>
                      </div>
                    </div>
                  ))}
                  {(!stats.recent_submissions || stats.recent_submissions.length === 0) && (
                    <div className="text-gray-500 text-sm text-center py-4">No submissions yet</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        {tab === 'analytics' && !stats && (
          <div className="text-center py-12 text-gray-500">Loading analytics...</div>
        )}

        {/* ═════════ HEALTH TAB ═════════ */}
        {tab === 'health' && (
          <div className="space-y-4">
            {health ? (
              <>
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold ${health.overall === 'healthy' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'}`}>
                  {health.overall === 'healthy' ? '✅' : '⚠️'} System {health.overall}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(health.services || {}).map(([name, info]) => (
                    <div key={name} className={`bg-white/5 border rounded-2xl p-5 ${info.status === 'online' ? 'border-green-500/20' : info.status === 'error' ? 'border-red-500/20' : 'border-yellow-500/20'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-white font-bold">{name}</div>
                          <div className="text-gray-500 text-xs">{info.type}</div>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-bold ${info.status === 'online' ? 'bg-green-500/20 text-green-400' : info.status === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                          {info.status === 'online' ? '● Online' : info.status === 'error' ? '● Error' : '● Offline'}
                        </div>
                      </div>
                      {info.error && <div className="text-red-400 text-xs mt-2 break-all">{info.error}</div>}
                    </div>
                  ))}
                </div>

                <button onClick={loadHealth} className="text-sm text-purple-400 hover:text-purple-300">↻ Refresh</button>
              </>
            ) : (
              <div className="text-center py-12">
                {loading ? (
                  <div><div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-3" /><span className="text-gray-400">Checking services...</span></div>
                ) : (
                  <span className="text-gray-500">Click tab to check health</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═════════ EXAM INTEGRITY TAB ═════════ */}
        {tab === 'integrity' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-sm">Flag submissions with focus below:</span>
              <input type="number" value={threshold} onChange={e => setThreshold(parseInt(e.target.value) || 50)}
                className="w-20 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm text-center" />
              <span className="text-gray-500 text-sm">%</span>
              <button onClick={loadIntegrity} className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm hover:bg-red-500/20">🔍 Scan</button>
              <span className="text-gray-500 text-sm">{flagged.length} flagged</span>
            </div>

            {flagged.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                <div className="text-4xl mb-3">✅</div>
                <p className="text-gray-400">No submissions flagged below {threshold}% focus</p>
              </div>
            ) : (
              <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                <div className="grid grid-cols-12 gap-2 px-5 py-3 bg-white/5 text-xs text-gray-500 font-bold uppercase">
                  <div className="col-span-2">Student</div>
                  <div className="col-span-3">Exam</div>
                  <div className="col-span-1">Score</div>
                  <div className="col-span-1">Focus</div>
                  <div className="col-span-1">Alerts</div>
                  <div className="col-span-1">Gaps</div>
                  <div className="col-span-3">Submitted</div>
                </div>
                {flagged.map(f => (
                  <div key={f.submission_id} className="grid grid-cols-12 gap-2 px-5 py-3 border-t border-white/5 items-center">
                    <div className="col-span-2">
                      <div className="text-white text-sm font-medium">{f.student}</div>
                      <div className="text-gray-600 text-[10px]">{f.email}</div>
                    </div>
                    <div className="col-span-3 text-gray-300 text-sm">{f.exam}</div>
                    <div className="col-span-1 font-bold text-sm" style={{ color: FC(f.score) }}>{f.score}%</div>
                    <div className="col-span-1 font-bold text-sm" style={{ color: FC(f.focus_score) }}>{f.focus_score}%</div>
                    <div className="col-span-1 text-yellow-400 text-sm font-bold">{f.alerts_count}</div>
                    <div className="col-span-1 text-orange-400 text-sm font-bold">{f.gap_warnings}</div>
                    <div className="col-span-3 text-gray-500 text-xs">{f.submitted ? new Date(f.submitted).toLocaleString() : ''}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
