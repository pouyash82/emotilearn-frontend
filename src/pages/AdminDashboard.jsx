import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import GlassCard from '../components/GlassCard'
import API from '../api'

const engColor = (v) => v >= 65 ? '#22c55e' : v >= 40 ? '#eab308' : '#ef4444'

const fmtDate = (iso) => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch { return '—' }
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const [tab, setTab] = useState('overview')
  const [stats, setStats] = useState(null)
  const [health, setHealth] = useState(null)
  const [users, setUsers] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [consents, setConsents] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [modelPerf, setModelPerf] = useState(null)
  const [retention, setRetention] = useState(null)
  const [anonymization, setAnonymization] = useState(null)
  const [institution, setInstitution] = useState(null)
  const [integrations, setIntegrations] = useState([])
  const [streams, setStreams] = useState({})
  const [loading, setLoading] = useState(false)

  // Bulk operations
  const [bulkStudents, setBulkStudents] = useState('')
  const [bulkResult, setBulkResult] = useState(null)
  const [bulkEnrollEmails, setBulkEnrollEmails] = useState('')
  const [bulkEnrollCourse, setBulkEnrollCourse] = useState('')
  const [courses, setCourses] = useState([])

  // Announcements form
  const [annForm, setAnnForm] = useState({ title: '', content: '', priority: 'normal', target_role: '' })

  useEffect(() => {
    loadStats()
    loadHealth()
  }, [])

  useEffect(() => {
    if (tab === 'users') loadUsers()
    if (tab === 'audit') loadAuditLogs()
    if (tab === 'consent') loadConsents()
    if (tab === 'announcements') loadAnnouncements()
    if (tab === 'model') loadModelPerf()
    if (tab === 'retention') loadRetention()
    if (tab === 'anonymization') loadAnonymization()
    if (tab === 'analytics') loadInstitution()
    if (tab === 'integrations') loadIntegrations()
    if (tab === 'streams') loadStreams()
    if (tab === 'bulk') loadCourses()
  }, [tab])

  const loadStats = () => API.get('/admin/stats').then(r => setStats(r.data)).catch(() => {})
  const loadHealth = () => API.get('/admin/system-health').then(r => setHealth(r.data)).catch(() => {})
  const loadUsers = () => API.get('/admin/users').then(r => setUsers(r.data.users || [])).catch(() => {})
  const loadAuditLogs = () => API.get('/admin/audit-logs').then(r => setAuditLogs(r.data.logs || [])).catch(() => {})
  const loadConsents = () => API.get('/admin/consents').then(r => setConsents(r.data.consents || [])).catch(() => {})
  const loadAnnouncements = () => API.get('/admin/announcements').then(r => setAnnouncements(r.data.announcements || [])).catch(() => {})
  const loadModelPerf = () => API.get('/admin/model-performance').then(r => setModelPerf(r.data)).catch(() => {})
  const loadRetention = () => API.get('/admin/retention/stats').then(r => setRetention(r.data)).catch(() => {})
  const loadAnonymization = () => API.get('/admin/anonymization/status').then(r => setAnonymization(r.data)).catch(() => {})
  const loadInstitution = () => API.get('/admin/analytics/institution').then(r => setInstitution(r.data)).catch(() => {})
  const loadIntegrations = () => API.get('/admin/integrations').then(r => setIntegrations(r.data.integrations || [])).catch(() => {})
  const loadStreams = () => API.get('/admin/streams').then(r => setStreams(r.data.streams || {})).catch(() => {})
  const loadCourses = () => API.get('/admin/users').then(r => setUsers(r.data.users || [])).catch(() => {})

  const toggleRole = async (userId, newRole) => {
    await API.put(`/admin/users/${userId}/role`, { role: newRole }).catch(() => {})
    loadUsers()
  }
  const toggleStatus = async (userId) => {
    await API.put(`/admin/users/${userId}/status`).catch(() => {})
    loadUsers()
  }

  const archiveData = async (days) => {
    setLoading(true)
    const r = await API.post(`/admin/retention/archive?days_old=${days}`).catch(() => null)
    if (r) { alert(`Archived ${r.data.logs_archived} emotion logs older than ${days} days`); loadRetention() }
    setLoading(false)
  }

  const deleteStudentData = async (studentId, name) => {
    if (!confirm(`Delete ALL data for ${name}? This cannot be undone.`)) return
    const r = await API.post(`/admin/retention/delete-student?student_id=${studentId}`).catch(() => null)
    if (r) alert(`Deleted ${r.data.sessions_deleted} sessions and ${r.data.logs_deleted} logs for ${name}`)
  }

  const createAnnouncement = async () => {
    if (!annForm.title.trim() || !annForm.content.trim()) return
    await API.post('/admin/announcements', {
      ...annForm,
      target_role: annForm.target_role || null,
    }).catch(() => {})
    setAnnForm({ title: '', content: '', priority: 'normal', target_role: '' })
    loadAnnouncements()
  }

  const deleteAnnouncement = async (id) => {
    await API.delete(`/admin/announcements/${id}`).catch(() => {})
    loadAnnouncements()
  }

  const bulkCreateStudents = async () => {
    try {
      const lines = bulkStudents.trim().split('\n').filter(Boolean)
      const students = lines.map(l => {
        const [name, email, password] = l.split(',').map(s => s.trim())
        return { name, email, password: password || 'student123' }
      })
      const r = await API.post('/admin/bulk/students', { students })
      setBulkResult(r.data)
      setBulkStudents('')
    } catch (e) { alert('Failed to create students') }
  }

  const bulkEnroll = async () => {
    if (!bulkEnrollCourse) return
    const emails = bulkEnrollEmails.split('\n').map(e => e.trim()).filter(Boolean)
    const r = await API.post('/admin/bulk/enroll', {
      course_id: parseInt(bulkEnrollCourse),
      student_emails: emails,
    }).catch(() => null)
    if (r) alert(`Enrolled ${r.data.enrolled}, skipped ${r.data.skipped}`)
  }

  const exportUsers = () => {
    API.get('/admin/export/users', { responseType: 'blob' }).then(r => {
      const url = URL.createObjectURL(new Blob([r.data]))
      const a = document.createElement('a'); a.href = url; a.download = 'users_export.csv'
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
    }).catch(() => alert('Export failed'))
  }

  const TABS = [
    { id: 'overview',       label: '📊 Overview' },
    { id: 'health',         label: '💚 System Health' },
    { id: 'users',          label: '👥 Users' },
    { id: 'analytics',      label: '🏛️ Institution' },
    { id: 'model',          label: '🧠 Model Performance' },
    { id: 'streams',        label: '📹 Cameras' },
    { id: 'consent',        label: '🔒 Consent' },
    { id: 'retention',      label: '🗑️ Data Retention' },
    { id: 'audit',          label: '📋 Audit Logs' },
    { id: 'announcements',  label: '📢 Announcements' },
    { id: 'bulk',           label: '📦 Bulk Ops' },
    { id: 'integrations',   label: '🔗 Integrations' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="fixed top-20 right-20 w-72 h-72 bg-purple-600/20 rounded-full blur-3xl animate-float pointer-events-none" />
      <div className="fixed bottom-40 left-20 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl animate-float-delayed pointer-events-none" />
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 py-8 relative z-10">
        {/* Header */}
        <div className="mb-8 animate-fade-in-up">
          <h1 className="text-3xl font-black text-white mb-2">
            Admin Panel — <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">{user?.name}</span> 🛡️
          </h1>
          <p className="text-gray-400">System management, analytics, and moderation</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl font-medium text-sm transition-all duration-300 ${
                tab === t.id
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                  : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
              }`}>{t.label}</button>
          ))}
        </div>

        {/* ═══════ OVERVIEW ═══════ */}
        {tab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Users', value: stats?.users?.total || stats?.total_users || 0, icon: '👥' },
                { label: 'Sessions', value: stats?.sessions || stats?.total_sessions || 0, icon: '📊' },
                { label: 'Courses', value: stats?.courses || 0, icon: '📚' },
                { label: 'Avg Engagement', value: `${stats?.avg_engagement || 0}%`, icon: '⚡' },
              ].map(s => (
                <GlassCard key={s.label} className="p-5 text-center">
                  <div className="text-2xl mb-1">{s.icon}</div>
                  <div className="text-2xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">{s.value}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </GlassCard>
              ))}
            </div>
            {health && (
              <GlassCard className="p-6">
                <h3 className="text-white font-bold mb-4">Quick Health Check</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-white/5 rounded-xl p-4 text-center border border-white/5">
                    <div className={`text-lg font-bold ${health.database?.status === 'online' ? 'text-green-400' : 'text-red-400'}`}>
                      {health.database?.status === 'online' ? '✅ Online' : '❌ Error'}
                    </div>
                    <div className="text-xs text-gray-500">Database</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 text-center border border-white/5">
                    <div className="text-lg font-bold text-blue-400">{health.system?.cpu_percent || 0}%</div>
                    <div className="text-xs text-gray-500">CPU Usage</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 text-center border border-white/5">
                    <div className="text-lg font-bold text-amber-400">{health.system?.memory_percent || 0}%</div>
                    <div className="text-xs text-gray-500">Memory</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 text-center border border-white/5">
                    <div className="text-lg font-bold text-purple-400">{health.uptime_hours || 0}h</div>
                    <div className="text-xs text-gray-500">Uptime</div>
                  </div>
                </div>
              </GlassCard>
            )}
          </div>
        )}

        {/* ═══════ SYSTEM HEALTH ═══════ */}
        {tab === 'health' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex justify-end">
              <button onClick={loadHealth} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm hover:bg-white/10">🔄 Refresh</button>
            </div>
            {health && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <GlassCard className="p-6">
                    <h3 className="text-white font-bold mb-4">🖥️ System Resources</h3>
                    {['cpu_percent', 'memory_percent', 'disk_percent'].map(key => {
                      const val = health.system?.[key] || 0
                      const label = key.replace('_percent', '').replace('_', ' ').toUpperCase()
                      const color = val < 60 ? '#22c55e' : val < 85 ? '#eab308' : '#ef4444'
                      return (
                        <div key={key} className="mb-4">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-400">{label}</span>
                            <span className="font-bold" style={{ color }}>{val}%</span>
                          </div>
                          <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${val}%`, backgroundColor: color }} />
                          </div>
                        </div>
                      )
                    })}
                  </GlassCard>
                  <GlassCard className="p-6">
                    <h3 className="text-white font-bold mb-4">📊 Service Status</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">PostgreSQL</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${health.database?.status === 'online' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {health.database?.status || 'Unknown'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">Active Sessions (1h)</span>
                        <span className="text-white font-bold">{health.active_sessions_1h || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">Server Uptime</span>
                        <span className="text-white font-bold">{health.uptime_hours || 0} hours</span>
                      </div>
                    </div>
                  </GlassCard>
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══════ USERS ═══════ */}
        {tab === 'users' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">User Management ({users.length})</h2>
              <button onClick={exportUsers} className="px-4 py-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 text-sm hover:bg-purple-500/30">📄 Export CSV</button>
            </div>
            <GlassCard className="p-6">
              <div className="space-y-2">
                {users.map(u => (
                  <div key={u.id} className="flex items-center gap-4 p-3 bg-white/5 rounded-xl border border-white/5">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold shrink-0">
                      {u.name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium text-sm truncate">{u.name}</div>
                      <div className="text-gray-500 text-xs truncate">{u.email}</div>
                    </div>
                    <select value={u.role} onChange={(e) => toggleRole(u.id, e.target.value)}
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs">
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                      <option value="admin">Admin</option>
                    </select>
                    <div className="text-center shrink-0">
                      <div className="text-white font-bold text-xs">{u.sessions || 0}</div>
                      <div className="text-[10px] text-gray-500">Sessions</div>
                    </div>
                    <button onClick={() => toggleStatus(u.id)}
                      className={`px-3 py-1 rounded-full text-xs font-bold ${u.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {u.is_active ? 'Active' : 'Disabled'}
                    </button>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        )}

        {/* ═══════ INSTITUTION ANALYTICS ═══════ */}
        {tab === 'analytics' && institution && (
          <div className="space-y-6 animate-fade-in">
            <GlassCard className="p-6">
              <h3 className="text-white font-bold mb-4">🏛️ Course Engagement Rankings</h3>
              <div className="space-y-3">
                {(institution.courses || []).map((c, i) => (
                  <div key={c.id} className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/5">
                    <div className="text-2xl font-black text-gray-600 w-8">#{i + 1}</div>
                    <div className="flex-1">
                      <div className="text-white font-medium">{c.name}</div>
                      <div className="text-gray-500 text-xs">by {c.teacher} · {c.enrolled} students · {c.total_sessions} sessions</div>
                    </div>
                    <div className="w-32">
                      <div className="flex justify-end mb-1">
                        <span className="text-sm font-bold" style={{ color: engColor(c.avg_engagement) }}>{c.avg_engagement}%</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${c.avg_engagement}%`, backgroundColor: engColor(c.avg_engagement) }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
            {institution.daily_trend?.length > 0 && (
              <GlassCard className="p-6">
                <h3 className="text-white font-bold mb-4">📈 Daily Activity (Last 30 Days)</h3>
                <div className="flex items-end gap-1 h-32">
                  {institution.daily_trend.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                      <span className="text-[8px] text-gray-600">{d.sessions}</span>
                      <div className="w-full rounded-t-sm" style={{
                        height: `${Math.max(4, d.avg_engagement)}%`,
                        backgroundColor: engColor(d.avg_engagement),
                      }} title={`${d.date}: ${d.sessions} sessions, ${d.avg_engagement}% avg`} />
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}
          </div>
        )}

        {/* ═══════ MODEL PERFORMANCE ═══════ */}
        {tab === 'model' && modelPerf && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-4 gap-4">
              <GlassCard className="p-5 text-center">
                <div className="text-2xl font-black text-white">{modelPerf.total_detections}</div>
                <div className="text-xs text-gray-500">Total Detections</div>
              </GlassCard>
              <GlassCard className="p-5 text-center">
                <div className="text-2xl font-black text-green-400">{modelPerf.avg_confidence}%</div>
                <div className="text-xs text-gray-500">Avg Confidence</div>
              </GlassCard>
              <GlassCard className="p-5 text-center">
                <div className="text-2xl font-black text-blue-400">{modelPerf.high_confidence_pct}%</div>
                <div className="text-xs text-gray-500">High Confidence</div>
              </GlassCard>
              <GlassCard className="p-5 text-center">
                <div className="text-2xl font-black text-red-400">{modelPerf.low_confidence_pct}%</div>
                <div className="text-xs text-gray-500">Low Confidence</div>
              </GlassCard>
            </div>
            <GlassCard className="p-6">
              <h3 className="text-white font-bold mb-4">🎭 Emotion Detection Distribution</h3>
              <div className="space-y-2">
                {Object.entries(modelPerf.emotion_distribution || {}).sort((a, b) => b[1] - a[1]).map(([emo, cnt]) => {
                  const pct = modelPerf.total_detections > 0 ? (cnt / modelPerf.total_detections * 100) : 0
                  return (
                    <div key={emo}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-300 capitalize">{emo}</span>
                        <span className="text-white font-bold">{cnt} ({pct.toFixed(1)}%)</span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-purple-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </GlassCard>
            <GlassCard className="p-6">
              <h3 className="text-white font-bold mb-4">📡 Detection Sources</h3>
              <div className="flex gap-4">
                {Object.entries(modelPerf.source_breakdown || {}).map(([src, cnt]) => (
                  <div key={src} className="bg-white/5 rounded-xl p-4 border border-white/5 flex-1 text-center">
                    <div className="text-xl font-bold text-white">{cnt}</div>
                    <div className="text-xs text-gray-500 capitalize">{src}</div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        )}

        {/* ═══════ CAMERAS / STREAMS ═══════ */}
        {tab === 'streams' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">Camera / Stream Management</h2>
              <button onClick={loadStreams} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm hover:bg-white/10">🔄 Refresh</button>
            </div>
            {Object.keys(streams).length === 0 ? (
              <GlassCard className="p-12 text-center">
                <div className="text-5xl mb-4">📹</div>
                <p className="text-gray-400">No active streams. Add streams via the API.</p>
                <code className="text-xs text-gray-600 mt-2 block">POST /api/streams/add</code>
              </GlassCard>
            ) : (
              <div className="space-y-3">
                {Object.entries(streams).map(([id, s]) => (
                  <GlassCard key={id} className="p-5">
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${s.status === 'running' ? 'bg-green-500 animate-pulse' : s.status === 'error' ? 'bg-red-500' : 'bg-gray-500'}`} />
                      <div className="flex-1">
                        <div className="text-white font-medium">{s.name || id}</div>
                        <div className="text-gray-500 text-xs">{s.source}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-white font-bold text-sm">{s.frames || 0}</div>
                        <div className="text-[10px] text-gray-500">Frames</div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${s.status === 'running' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {s.status}
                      </span>
                    </div>
                    {s.error && <div className="mt-2 text-red-400 text-xs bg-red-500/10 rounded-lg p-2">{s.error}</div>}
                  </GlassCard>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════ CONSENT ═══════ */}
        {tab === 'consent' && (
          <div className="space-y-6 animate-fade-in">
            {anonymization && (
              <div className="grid grid-cols-4 gap-4">
                <GlassCard className="p-5 text-center">
                  <div className="text-2xl font-black text-white">{anonymization.total_students}</div>
                  <div className="text-xs text-gray-500">Total Students</div>
                </GlassCard>
                <GlassCard className="p-5 text-center">
                  <div className="text-2xl font-black text-green-400">{anonymization.consented}</div>
                  <div className="text-xs text-gray-500">Consented</div>
                </GlassCard>
                <GlassCard className="p-5 text-center">
                  <div className="text-2xl font-black text-red-400">{anonymization.not_consented}</div>
                  <div className="text-xs text-gray-500">Not Consented</div>
                </GlassCard>
                <GlassCard className="p-5 text-center">
                  <div className="text-2xl font-black text-purple-400">{anonymization.consent_rate}%</div>
                  <div className="text-xs text-gray-500">Consent Rate</div>
                </GlassCard>
              </div>
            )}
            <GlassCard className="p-6">
              <h3 className="text-white font-bold mb-4">Consent Records</h3>
              {consents.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No consent records yet</p>
              ) : (
                <div className="space-y-2">
                  {consents.map(c => (
                    <div key={c.id} className="flex items-center gap-4 p-3 bg-white/5 rounded-xl border border-white/5">
                      <div className="flex-1">
                        <div className="text-white text-sm font-medium">{c.student_name}</div>
                        <div className="text-gray-500 text-xs">{c.student_email}</div>
                      </div>
                      <div className="text-gray-400 text-xs capitalize">{c.consent_type.replace('_', ' ')}</div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${c.granted ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {c.granted ? '✓ Granted' : '✗ Revoked'}
                      </span>
                      <div className="text-gray-600 text-xs">{fmtDate(c.granted_at || c.revoked_at)}</div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>
        )}

        {/* ═══════ DATA RETENTION ═══════ */}
        {tab === 'retention' && (
          <div className="space-y-6 animate-fade-in">
            {retention && (
              <div className="grid grid-cols-4 gap-4">
                <GlassCard className="p-5 text-center">
                  <div className="text-2xl font-black text-white">{retention.total_emotion_logs}</div>
                  <div className="text-xs text-gray-500">Total Emotion Logs</div>
                </GlassCard>
                <GlassCard className="p-5 text-center">
                  <div className="text-2xl font-black text-blue-400">{retention.total_sessions}</div>
                  <div className="text-xs text-gray-500">Total Sessions</div>
                </GlassCard>
                <GlassCard className="p-5 text-center">
                  <div className="text-2xl font-black text-yellow-400">{retention.logs_older_30_days}</div>
                  <div className="text-xs text-gray-500">Logs &gt; 30 Days</div>
                </GlassCard>
                <GlassCard className="p-5 text-center">
                  <div className="text-2xl font-black text-red-400">{retention.logs_older_90_days}</div>
                  <div className="text-xs text-gray-500">Logs &gt; 90 Days</div>
                </GlassCard>
              </div>
            )}
            <GlassCard className="p-6">
              <h3 className="text-white font-bold mb-4">🗑️ Archive Old Data</h3>
              <p className="text-gray-400 text-sm mb-4">Remove old emotion detection logs while keeping session summaries.</p>
              <div className="flex gap-3">
                {[30, 60, 90, 180].map(d => (
                  <button key={d} onClick={() => archiveData(d)} disabled={loading}
                    className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 disabled:opacity-50">
                    Archive &gt; {d} days
                  </button>
                ))}
              </div>
            </GlassCard>
          </div>
        )}

        {/* ═══════ AUDIT LOGS ═══════ */}
        {tab === 'audit' && (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-xl font-bold text-white">Audit Log ({auditLogs.length})</h2>
            <GlassCard className="p-6">
              {auditLogs.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No audit events yet</p>
              ) : (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {auditLogs.map(l => (
                    <div key={l.id} className="flex items-center gap-4 p-3 bg-white/5 rounded-xl border border-white/5">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 text-xs shrink-0">📋</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm"><span className="font-bold">{l.user}</span> → <span className="text-purple-400">{l.action}</span></div>
                        {l.target && <div className="text-gray-500 text-xs">Target: {l.target}</div>}
                      </div>
                      <div className="text-gray-600 text-xs shrink-0">{fmtDate(l.created_at)}</div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>
        )}

        {/* ═══════ ANNOUNCEMENTS ═══════ */}
        {tab === 'announcements' && (
          <div className="space-y-6 animate-fade-in">
            <GlassCard className="p-6">
              <h3 className="text-white font-bold mb-4">📢 Create Announcement</h3>
              <div className="space-y-3">
                <input type="text" placeholder="Title" value={annForm.title} onChange={e => setAnnForm({ ...annForm, title: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-purple-500/50" />
                <textarea placeholder="Content" value={annForm.content} onChange={e => setAnnForm({ ...annForm, content: e.target.value })} rows={3}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-purple-500/50 resize-none" />
                <div className="flex gap-3">
                  <select value={annForm.priority} onChange={e => setAnnForm({ ...annForm, priority: e.target.value })}
                    className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm">
                    <option value="low">Low</option><option value="normal">Normal</option>
                    <option value="high">High</option><option value="critical">Critical</option>
                  </select>
                  <select value={annForm.target_role} onChange={e => setAnnForm({ ...annForm, target_role: e.target.value })}
                    className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm">
                    <option value="">All Users</option><option value="student">Students Only</option><option value="teacher">Teachers Only</option>
                  </select>
                  <button onClick={createAnnouncement} disabled={!annForm.title.trim()}
                    className="px-6 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-sm disabled:opacity-40">Publish</button>
                </div>
              </div>
            </GlassCard>
            <GlassCard className="p-6">
              <h3 className="text-white font-bold mb-4">Active Announcements</h3>
              {announcements.length === 0 ? (
                <p className="text-gray-500 text-center py-6">No announcements yet</p>
              ) : (
                <div className="space-y-3">
                  {announcements.map(a => (
                    <div key={a.id} className={`p-4 rounded-xl border ${a.priority === 'critical' ? 'bg-red-500/10 border-red-500/20' : a.priority === 'high' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-white/5 border-white/5'}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-white font-bold text-sm">{a.title}</div>
                          <div className="text-gray-400 text-xs mt-1">{a.content}</div>
                          <div className="text-gray-600 text-[10px] mt-2">{fmtDate(a.created_at)} · {a.priority} · {a.target_role || 'All'}</div>
                        </div>
                        <button onClick={() => deleteAnnouncement(a.id)} className="text-gray-500 hover:text-red-400 text-sm">🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>
        )}

        {/* ═══════ BULK OPERATIONS ═══════ */}
        {tab === 'bulk' && (
          <div className="space-y-6 animate-fade-in">
            <GlassCard className="p-6">
              <h3 className="text-white font-bold mb-4">👥 Bulk Create Students</h3>
              <p className="text-gray-500 text-xs mb-3">One student per line: name, email, password (password optional — defaults to student123)</p>
              <textarea value={bulkStudents} onChange={e => setBulkStudents(e.target.value)} rows={5}
                placeholder="John Doe, john@uni.edu, pass123&#10;Jane Smith, jane@uni.edu"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 text-sm font-mono focus:outline-none resize-none mb-3" />
              <button onClick={bulkCreateStudents} disabled={!bulkStudents.trim()}
                className="px-6 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-sm disabled:opacity-40">Create Students</button>
              {bulkResult && (
                <div className="mt-3 p-3 bg-green-500/10 rounded-xl border border-green-500/20 text-green-400 text-sm">
                  Created: {bulkResult.created} · Skipped: {bulkResult.skipped}
                </div>
              )}
            </GlassCard>
            <GlassCard className="p-6">
              <h3 className="text-white font-bold mb-4">📚 Bulk Enroll in Course</h3>
              <div className="space-y-3">
                <input type="text" placeholder="Course ID" value={bulkEnrollCourse}
                  onChange={e => setBulkEnrollCourse(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 text-sm focus:outline-none" />
                <textarea value={bulkEnrollEmails} onChange={e => setBulkEnrollEmails(e.target.value)} rows={4}
                  placeholder="student1@uni.edu&#10;student2@uni.edu"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 text-sm font-mono focus:outline-none resize-none" />
                <button onClick={bulkEnroll} disabled={!bulkEnrollCourse || !bulkEnrollEmails.trim()}
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold text-sm disabled:opacity-40">Enroll All</button>
              </div>
            </GlassCard>
            <GlassCard className="p-6">
              <h3 className="text-white font-bold mb-4">📄 Export Data</h3>
              <button onClick={exportUsers}
                className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 font-medium hover:bg-white/10">
                📥 Download All Users (CSV)
              </button>
            </GlassCard>
          </div>
        )}

        {/* ═══════ INTEGRATIONS ═══════ */}
        {tab === 'integrations' && (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-xl font-bold text-white">🔗 LMS & Service Integrations</h2>
            <div className="grid grid-cols-2 gap-4">
              {integrations.map(i => (
                <GlassCard key={i.name} className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-white font-bold">{i.name}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      i.status === 'connected' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                    }`}>{i.status === 'connected' ? '✓ Connected' : 'Not Connected'}</span>
                  </div>
                  <p className="text-gray-400 text-sm mb-4">{i.description}</p>
                  <button className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm hover:bg-white/10 cursor-not-allowed opacity-50">
                    Coming Soon
                  </button>
                </GlassCard>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
