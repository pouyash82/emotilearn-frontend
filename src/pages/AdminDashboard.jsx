import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import DashboardLayout from '../components/DashboardLayout'
import GlassCard from '../components/GlassCard'
import ChatButton from '../components/ChatButton'
import API from '../api'

const engColor = (v) => v >= 65 ? '#22c55e' : v >= 40 ? '#eab308' : '#ef4444'
const fmtDate = (iso) => { if (!iso) return '—'; try { return new Date(iso).toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) } catch { return '—' } }

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

  const [bulkStudents, setBulkStudents] = useState('')
  const [bulkResult, setBulkResult] = useState(null)
  const [bulkEnrollEmails, setBulkEnrollEmails] = useState('')
  const [bulkEnrollCourse, setBulkEnrollCourse] = useState('')
  const [annForm, setAnnForm] = useState({ title: '', content: '', priority: 'normal', target_role: '' })

  // Sub-tab for stats view
  const [statsSubTab, setStatsSubTab] = useState('institution')

  useEffect(() => { loadStats(); loadHealth() }, [])
  useEffect(() => {
    if (tab === 'users') loadUsers()
    if (tab === 'stats') {
      if (statsSubTab === 'institution') loadInstitution()
      if (statsSubTab === 'model') loadModelPerf()
      if (statsSubTab === 'streams') loadStreams()
      if (statsSubTab === 'consent') { loadConsents(); loadAnonymization() }
      if (statsSubTab === 'retention') loadRetention()
      if (statsSubTab === 'audit') loadAuditLogs()
      if (statsSubTab === 'announcements') loadAnnouncements()
      if (statsSubTab === 'integrations') loadIntegrations()
    }
  }, [tab, statsSubTab])

  const loadStats = () => API.get('/admin/stats').then(r => setStats(r.data)).catch(() => {})
  const loadHealth = () => API.get('/admin/system-health').then(r => setHealth(r.data)).catch(() => {})
  const loadUsers = () => API.get('/admin/users').then(r => setUsers(r.data.users || [])).catch(() => {})
  const loadAuditLogs = () => API.get('/admin/audit-logs').then(r => setAuditLogs(r.data.logs || [])).catch(() => {})
  const loadConsents = () => API.get('/admin/consents').then(r => setConsents(r.data.consents || [])).catch(() => {})
  const loadAnonymization = () => API.get('/admin/anonymization/status').then(r => setAnonymization(r.data)).catch(() => {})
  const loadAnnouncements = () => API.get('/admin/announcements').then(r => setAnnouncements(r.data.announcements || [])).catch(() => {})
  const loadModelPerf = () => API.get('/admin/model-performance').then(r => setModelPerf(r.data)).catch(() => {})
  const loadRetention = () => API.get('/admin/retention/stats').then(r => setRetention(r.data)).catch(() => {})
  const loadInstitution = () => API.get('/admin/analytics/institution').then(r => setInstitution(r.data)).catch(() => {})
  const loadIntegrations = () => API.get('/admin/integrations').then(r => setIntegrations(r.data.integrations || [])).catch(() => {})
  const loadStreams = () => API.get('/admin/streams').then(r => setStreams(r.data.streams || {})).catch(() => {})

  const toggleRole = async (uid, role) => { await API.put(`/admin/users/${uid}/role`, { role }).catch(() => {}); loadUsers() }
  const toggleStatus = async (uid) => { await API.put(`/admin/users/${uid}/status`).catch(() => {}); loadUsers() }
  const archiveData = async (days) => { setLoading(true); const r = await API.post(`/admin/retention/archive?days_old=${days}`).catch(() => null); if (r) { alert(`Archived ${r.data.logs_archived} logs > ${days} days`); loadRetention() }; setLoading(false) }
  const createAnnouncement = async () => { if (!annForm.title.trim()) return; await API.post('/admin/announcements', { ...annForm, target_role: annForm.target_role || null }).catch(() => {}); setAnnForm({ title: '', content: '', priority: 'normal', target_role: '' }); loadAnnouncements() }
  const deleteAnnouncement = async (id) => { await API.delete(`/admin/announcements/${id}`).catch(() => {}); loadAnnouncements() }
  const bulkCreateStudents = async () => { try { const students = bulkStudents.trim().split('\n').filter(Boolean).map(l => { const [name,email,password] = l.split(',').map(s=>s.trim()); return { name, email, password: password||'student123' } }); const r = await API.post('/admin/bulk/students', { students }); setBulkResult(r.data); setBulkStudents('') } catch { alert('Failed') } }
  const bulkEnroll = async () => { if (!bulkEnrollCourse) return; const emails = bulkEnrollEmails.split('\n').map(e=>e.trim()).filter(Boolean); const r = await API.post('/admin/bulk/enroll', { course_id: parseInt(bulkEnrollCourse), student_emails: emails }).catch(()=>null); if (r) alert(`Enrolled ${r.data.enrolled}, skipped ${r.data.skipped}`) }
  const exportUsers = () => { API.get('/admin/export/users', { responseType: 'blob' }).then(r => { const u=URL.createObjectURL(new Blob([r.data])); const a=document.createElement('a'); a.href=u; a.download='users_export.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u) }).catch(()=>alert('Export failed')) }

  const STATS_SUB_TABS = [
    { id: 'institution', label: 'Institution' },
    { id: 'model', label: 'Model' },
    { id: 'streams', label: 'Cameras' },
    { id: 'consent', label: 'Consent' },
    { id: 'retention', label: 'Retention' },
    { id: 'audit', label: 'Audit' },
    { id: 'announcements', label: 'Announce' },
    { id: 'integrations', label: 'Integrations' },
  ]

  return (
    <DashboardLayout activeTab={tab} onTabChange={setTab} title={`Admin / ${user?.name || 'Admin'}`}
      headerRight={<span className="badge badge-danger uppercase text-[10px]">Admin</span>}>

      {/* ═══════ OVERVIEW ═══════ */}
      {tab === 'overview' && (
        <div className="space-y-5 animate-fade-in">
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Users', value: stats?.users?.total || stats?.total_users || 0, accent: 'indigo' },
              { label: 'Sessions', value: stats?.sessions || stats?.total_sessions || 0, accent: 'teal' },
              { label: 'Courses', value: stats?.courses || 0, accent: 'amber' },
              { label: 'Avg Engagement', value: `${stats?.avg_engagement || 0}%`, accent: 'green' },
            ].map(s => (
              <GlassCard key={s.label} variant="stat" accent={s.accent} className="p-5">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{s.label}</span>
                <div className="text-3xl font-bold text-white mt-2">{s.value}</div>
              </GlassCard>
            ))}
          </div>

          {health && (
            <GlassCard className="p-5">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">System Health</h3>
              <div className="grid grid-cols-4 gap-3">
                <div className="glass-subtle rounded-xl p-4 text-center">
                  <div className={`text-sm font-bold ${health.database?.status === 'online' ? 'text-green-400' : 'text-red-400'}`}>{health.database?.status === 'online' ? 'Online' : 'Error'}</div>
                  <div className="text-[10px] text-gray-600 mt-0.5">Database</div>
                </div>
                <div className="glass-subtle rounded-xl p-4 text-center">
                  <div className="text-sm font-bold text-blue-400">{health.system?.cpu_percent || 0}%</div>
                  <div className="text-[10px] text-gray-600 mt-0.5">CPU</div>
                </div>
                <div className="glass-subtle rounded-xl p-4 text-center">
                  <div className="text-sm font-bold text-amber-400">{health.system?.memory_percent || 0}%</div>
                  <div className="text-[10px] text-gray-600 mt-0.5">Memory</div>
                </div>
                <div className="glass-subtle rounded-xl p-4 text-center">
                  <div className="text-sm font-bold text-purple-400">{health.uptime_hours || 0}h</div>
                  <div className="text-[10px] text-gray-600 mt-0.5">Uptime</div>
                </div>
              </div>
            </GlassCard>
          )}

          {/* Bulk ops quick access */}
          <GlassCard className="p-5">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Bulk Create Students</h3>
            <p className="text-gray-600 text-xs mb-2">One per line: name, email, password (password optional)</p>
            <textarea value={bulkStudents} onChange={e => setBulkStudents(e.target.value)} rows={4} placeholder={"John Doe, john@uni.edu, pass123\nJane Smith, jane@uni.edu"} className="w-full input-glass font-mono text-xs resize-none mb-2" />
            <div className="flex items-center gap-3">
              <button onClick={bulkCreateStudents} disabled={!bulkStudents.trim()} className="btn-primary text-xs px-4 py-2 disabled:opacity-40">Create Students</button>
              <button onClick={exportUsers} className="btn-secondary text-xs px-4 py-2">Export Users CSV</button>
            </div>
            {bulkResult && <div className="mt-2 px-3 py-2 bg-green-500/10 rounded-lg border border-green-500/15 text-green-400 text-xs">Created: {bulkResult.created} · Skipped: {bulkResult.skipped}</div>}
          </GlassCard>

          <GlassCard className="p-5">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Bulk Enroll</h3>
            <div className="space-y-2">
              <input type="text" placeholder="Course ID" value={bulkEnrollCourse} onChange={e => setBulkEnrollCourse(e.target.value)} className="input-glass text-sm" />
              <textarea value={bulkEnrollEmails} onChange={e => setBulkEnrollEmails(e.target.value)} rows={3} placeholder={"student1@uni.edu\nstudent2@uni.edu"} className="w-full input-glass font-mono text-xs resize-none" />
              <button onClick={bulkEnroll} disabled={!bulkEnrollCourse || !bulkEnrollEmails.trim()} className="btn-primary text-xs px-4 py-2 disabled:opacity-40">Enroll All</button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ═══════ USERS ═══════ */}
      {tab === 'users' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-semibold text-white">User Management ({users.length})</h3>
            <button onClick={exportUsers} className="btn-secondary text-xs px-3 py-1.5">Export CSV</button>
          </div>
          <GlassCard className="p-5">
            <div className="space-y-1.5">
              {users.map(u => (
                <div key={u.id} className="flex items-center gap-3 p-3 glass-subtle rounded-xl">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/15 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{u.name?.charAt(0)||'?'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white font-medium truncate">{u.name}</div>
                    <div className="text-[11px] text-gray-600 truncate">{u.email}</div>
                  </div>
                  <select value={u.role} onChange={e => toggleRole(u.id, e.target.value)} className="px-2 py-1 rounded-lg bg-white/5 border border-white/8 text-white text-xs focus:outline-none">
                    <option value="student">Student</option><option value="teacher">Teacher</option><option value="admin">Admin</option>
                  </select>
                  <div className="text-center flex-shrink-0"><div className="text-xs font-bold text-white">{u.sessions||0}</div><div className="text-[9px] text-gray-600">Sessions</div></div>
                  <button onClick={() => toggleStatus(u.id)} className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold ${u.is_active ? 'bg-green-500/15 text-green-400 border border-green-500/20' : 'bg-red-500/15 text-red-400 border border-red-500/20'}`}>{u.is_active ? 'Active' : 'Disabled'}</button>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}

      {/* ═══════ STATS (sub-tabbed) ═══════ */}
      {tab === 'stats' && (
        <div className="space-y-5 animate-fade-in">
          <div className="flex gap-2 flex-wrap">
            {STATS_SUB_TABS.map(t => (
              <button key={t.id} onClick={() => setStatsSubTab(t.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${statsSubTab === t.id ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20' : 'bg-white/3 text-gray-500 border border-white/5 hover:bg-white/5'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Institution */}
          {statsSubTab === 'institution' && institution && (
            <div className="space-y-4">
              <GlassCard className="p-5">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Course Engagement Rankings</h3>
                <div className="space-y-2">
                  {(institution.courses || []).map((c, i) => (
                    <div key={c.id} className="flex items-center gap-3 p-3 glass-subtle rounded-xl">
                      <span className="text-lg font-bold text-gray-700 w-7">#{i+1}</span>
                      <div className="flex-1"><div className="text-sm text-white font-medium">{c.name}</div><div className="text-[10px] text-gray-600">by {c.teacher} · {c.enrolled} students · {c.total_sessions} sessions</div></div>
                      <div className="w-28"><div className="flex justify-end mb-0.5"><span className="text-xs font-bold" style={{color:engColor(c.avg_engagement)}}>{c.avg_engagement}%</span></div><div className="h-1.5 bg-white/5 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{width:`${c.avg_engagement}%`, background:engColor(c.avg_engagement)}}/></div></div>
                    </div>
                  ))}
                </div>
              </GlassCard>
              {institution.daily_trend?.length > 0 && (
                <GlassCard className="p-5">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Daily Activity (30 Days)</h3>
                  <div className="flex items-end gap-[2px] h-28">{institution.daily_trend.map((d,i) => <div key={i} className="flex-1 rounded-t-sm" style={{height:`${Math.max(4,d.avg_engagement)}%`, background:engColor(d.avg_engagement)}} title={`${d.date}: ${d.sessions} sessions`}/>)}</div>
                </GlassCard>
              )}
            </div>
          )}

          {/* Model */}
          {statsSubTab === 'model' && modelPerf && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Total Detections', value: modelPerf.total_detections, color: 'text-white' },
                  { label: 'Avg Confidence', value: `${modelPerf.avg_confidence}%`, color: 'text-green-400' },
                  { label: 'High Conf', value: `${modelPerf.high_confidence_pct}%`, color: 'text-blue-400' },
                  { label: 'Low Conf', value: `${modelPerf.low_confidence_pct}%`, color: 'text-red-400' },
                ].map(s => (
                  <GlassCard key={s.label} className="p-4 text-center"><div className={`text-xl font-bold ${s.color}`}>{s.value}</div><div className="text-[10px] text-gray-600 mt-0.5">{s.label}</div></GlassCard>
                ))}
              </div>
              <GlassCard className="p-5">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Detection Distribution</h3>
                <div className="space-y-1.5">{Object.entries(modelPerf.emotion_distribution||{}).sort((a,b)=>b[1]-a[1]).map(([emo,cnt]) => { const pct = modelPerf.total_detections>0?(cnt/modelPerf.total_detections*100):0; return (
                  <div key={emo}><div className="flex justify-between text-xs mb-0.5"><span className="text-gray-400 capitalize">{emo}</span><span className="text-white font-bold">{cnt} ({pct.toFixed(1)}%)</span></div><div className="h-1.5 bg-white/5 rounded-full overflow-hidden"><div className="h-full rounded-full bg-indigo-500 transition-all" style={{width:`${pct}%`}}/></div></div>
                )})}</div>
              </GlassCard>
              <GlassCard className="p-5">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Sources</h3>
                <div className="flex gap-3">{Object.entries(modelPerf.source_breakdown||{}).map(([src,cnt]) => <div key={src} className="glass-subtle rounded-xl p-3 flex-1 text-center"><div className="text-lg font-bold text-white">{cnt}</div><div className="text-[10px] text-gray-600 capitalize">{src}</div></div>)}</div>
              </GlassCard>
            </div>
          )}

          {/* Streams */}
          {statsSubTab === 'streams' && (
            <div className="space-y-3">
              <div className="flex justify-end"><button onClick={loadStreams} className="btn-secondary text-xs px-3 py-1.5">Refresh</button></div>
              {Object.keys(streams).length === 0 ? <GlassCard className="p-8 text-center"><p className="text-gray-600">No active streams</p><code className="text-[10px] text-gray-700 mt-1 block">POST /api/streams/add</code></GlassCard> : (
                Object.entries(streams).map(([id,s]) => (
                  <GlassCard key={id} className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${s.status==='running'?'bg-green-500 animate-pulse-soft':s.status==='error'?'bg-red-500':'bg-gray-600'}`}/>
                      <div className="flex-1"><div className="text-sm text-white font-medium">{s.name||id}</div><div className="text-[10px] text-gray-600">{s.source}</div></div>
                      <div className="text-center"><div className="text-sm font-bold text-white">{s.frames||0}</div><div className="text-[9px] text-gray-600">Frames</div></div>
                      <span className={`badge ${s.status==='running'?'badge-success':'badge-danger'}`}>{s.status}</span>
                    </div>
                    {s.error && <div className="mt-2 text-xs text-red-400 bg-red-500/10 rounded-lg p-2">{s.error}</div>}
                  </GlassCard>
                ))
              )}
            </div>
          )}

          {/* Consent */}
          {statsSubTab === 'consent' && (
            <div className="space-y-4">
              {anonymization && (
                <div className="grid grid-cols-4 gap-3">
                  {[{l:'Students',v:anonymization.total_students,c:'text-white'},{l:'Consented',v:anonymization.consented,c:'text-green-400'},{l:'Not Consented',v:anonymization.not_consented,c:'text-red-400'},{l:'Rate',v:`${anonymization.consent_rate}%`,c:'text-indigo-400'}].map(s=>
                    <GlassCard key={s.l} className="p-4 text-center"><div className={`text-xl font-bold ${s.c}`}>{s.v}</div><div className="text-[10px] text-gray-600 mt-0.5">{s.l}</div></GlassCard>
                  )}
                </div>
              )}
              <GlassCard className="p-5">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Consent Records</h3>
                {consents.length === 0 ? <p className="text-gray-600 text-center py-6">No records</p> : (
                  <div className="space-y-1.5">{consents.map(c => (
                    <div key={c.id} className="flex items-center gap-3 p-3 glass-subtle rounded-xl">
                      <div className="flex-1"><div className="text-sm text-white">{c.student_name}</div><div className="text-[10px] text-gray-600">{c.student_email}</div></div>
                      <span className="text-[10px] text-gray-500 capitalize">{c.consent_type?.replace('_',' ')}</span>
                      <span className={`badge ${c.granted?'badge-success':'badge-danger'}`}>{c.granted?'Granted':'Revoked'}</span>
                      <span className="text-[10px] text-gray-700">{fmtDate(c.granted_at||c.revoked_at)}</span>
                    </div>
                  ))}</div>
                )}
              </GlassCard>
            </div>
          )}

          {/* Retention */}
          {statsSubTab === 'retention' && (
            <div className="space-y-4">
              {retention && (
                <div className="grid grid-cols-4 gap-3">
                  {[{l:'Emotion Logs',v:retention.total_emotion_logs},{l:'Sessions',v:retention.total_sessions},{l:'>30 Days',v:retention.logs_older_30_days},{l:'>90 Days',v:retention.logs_older_90_days}].map(s=>
                    <GlassCard key={s.l} className="p-4 text-center"><div className="text-xl font-bold text-white">{s.v}</div><div className="text-[10px] text-gray-600 mt-0.5">{s.l}</div></GlassCard>
                  )}
                </div>
              )}
              <GlassCard className="p-5">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Archive Old Data</h3>
                <p className="text-gray-600 text-xs mb-3">Remove old emotion logs while keeping session summaries.</p>
                <div className="flex gap-2">{[30,60,90,180].map(d => <button key={d} onClick={() => archiveData(d)} disabled={loading} className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/15 text-red-400 text-xs font-medium hover:bg-red-500/20 disabled:opacity-50 transition-all">Archive &gt; {d}d</button>)}</div>
              </GlassCard>
            </div>
          )}

          {/* Audit */}
          {statsSubTab === 'audit' && (
            <GlassCard className="p-5">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Audit Log ({auditLogs.length})</h3>
              {auditLogs.length === 0 ? <p className="text-gray-600 text-center py-6">No events</p> : (
                <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">{auditLogs.map(l => (
                  <div key={l.id} className="flex items-center gap-3 p-3 glass-subtle rounded-xl">
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                    <div className="flex-1 min-w-0"><div className="text-xs text-white"><span className="font-bold">{l.user}</span> <span className="text-indigo-400">{l.action}</span></div>{l.target && <div className="text-[10px] text-gray-600">Target: {l.target}</div>}</div>
                    <span className="text-[10px] text-gray-700 flex-shrink-0">{fmtDate(l.created_at)}</span>
                  </div>
                ))}</div>
              )}
            </GlassCard>
          )}

          {/* Announcements */}
          {statsSubTab === 'announcements' && (
            <div className="space-y-4">
              <GlassCard className="p-5">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Create Announcement</h3>
                <div className="space-y-2">
                  <input type="text" placeholder="Title" value={annForm.title} onChange={e => setAnnForm({...annForm, title:e.target.value})} className="input-glass text-sm" />
                  <textarea placeholder="Content" value={annForm.content} onChange={e => setAnnForm({...annForm, content:e.target.value})} rows={3} className="w-full input-glass text-sm resize-none" />
                  <div className="flex gap-2">
                    <select value={annForm.priority} onChange={e => setAnnForm({...annForm, priority:e.target.value})} className="input-glass text-xs w-auto"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option></select>
                    <select value={annForm.target_role} onChange={e => setAnnForm({...annForm, target_role:e.target.value})} className="input-glass text-xs w-auto"><option value="">All</option><option value="student">Students</option><option value="teacher">Teachers</option></select>
                    <button onClick={createAnnouncement} disabled={!annForm.title.trim()} className="btn-primary text-xs px-4 py-2 disabled:opacity-40">Publish</button>
                  </div>
                </div>
              </GlassCard>
              <GlassCard className="p-5">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Active ({announcements.length})</h3>
                {announcements.length === 0 ? <p className="text-gray-600 text-center py-4">None</p> : (
                  <div className="space-y-2">{announcements.map(a => (
                    <div key={a.id} className={`p-3 rounded-xl border ${a.priority==='critical'?'bg-red-500/8 border-red-500/15':a.priority==='high'?'bg-amber-500/8 border-amber-500/15':'glass-subtle'}`}>
                      <div className="flex justify-between items-start">
                        <div><div className="text-sm text-white font-medium">{a.title}</div><div className="text-xs text-gray-500 mt-0.5">{a.content}</div><div className="text-[10px] text-gray-700 mt-1">{fmtDate(a.created_at)} · {a.priority} · {a.target_role||'All'}</div></div>
                        <button onClick={() => deleteAnnouncement(a.id)} className="p-1 text-gray-600 hover:text-red-400 transition-colors"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
                      </div>
                    </div>
                  ))}</div>
                )}
              </GlassCard>
            </div>
          )}

          {/* Integrations */}
          {statsSubTab === 'integrations' && (
            <div className="grid grid-cols-2 gap-3">
              {integrations.map(i => (
                <GlassCard key={i.name} className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-white font-semibold text-sm">{i.name}</h4>
                    <span className={`badge ${i.status==='connected'?'badge-success':'badge-info'}`}>{i.status==='connected'?'Connected':'Not Connected'}</span>
                  </div>
                  <p className="text-gray-500 text-xs mb-3">{i.description}</p>
                  <button className="btn-secondary text-xs px-3 py-1.5 opacity-50 cursor-not-allowed">Coming Soon</button>
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      )}

      <ChatButton />
    </DashboardLayout>
  )
}
