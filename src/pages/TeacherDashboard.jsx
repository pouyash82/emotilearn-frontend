import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import DashboardLayout from '../components/DashboardLayout'
import GlassCard from '../components/GlassCard'
import LiveClass from './LiveClass'
import LectureAnalytics from './LectureAnalytics'
import EngagementHeatmap from './EngagementHeatmap'
import AttendanceEngagement from './AttendanceEngagement'
import StudentProgress from './StudentProgress'
import ChatButton from '../components/ChatButton'
import API from '../api'

const BACKEND = 'https://web-production-3a26e.up.railway.app'

const EMOTION_COLORS = { anger:'#ef4444', disgust:'#a855f7', fear:'#f97316', happiness:'#22c55e', neutral:'#6b7280', sadness:'#3b82f6', surprise:'#eab308' }
const engColor = (v) => v >= 65 ? '#22c55e' : v >= 40 ? '#eab308' : '#ef4444'
const engLabel = (v) => v >= 65 ? 'High' : v >= 40 ? 'Medium' : 'Low'
const fmtDate = (iso) => { if (!iso) return '—'; try { return new Date(iso).toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) } catch { return '—' } }

export default function TeacherDashboard() {
  const { user } = useAuth()
  const [tab, setTab] = useState('overview')
  const [courses, setCourses] = useState([])
  const [students, setStudents] = useState([])
  const [newCourse, setNewCourse] = useState({ name: '', description: '' })
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState(null)
  const [selectedStudent, setSelectedStudent] = useState(null)

  const [expandedCourse, setExpandedCourse] = useState(null)
  const [courseExams, setCourseExams] = useState([])
  const [showExamForm, setShowExamForm] = useState(false)
  const [examForm, setExamForm] = useState({ title: '', description: '', time_limit: 10, questions: [{ q: '', o: ['','','',''], a: 0 }] })
  const [viewingSubs, setViewingSubs] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [viewingDetail, setViewingDetail] = useState(null)

  useEffect(() => { loadCourses(); loadStudents(); loadStats() }, [])

  const loadCourses = () => API.get('/teacher/courses').then(r => setCourses(r.data)).catch(() => {})
  const loadStudents = () => API.get('/teacher/students').then(r => setStudents(r.data)).catch(() => {})
  const loadStats = () => API.get('/teacher/stats').then(r => setStats(r.data)).catch(() => {})

  const createCourse = async (e) => {
    e.preventDefault(); if (!newCourse.name.trim()) return; setLoading(true)
    try { await API.post('/teacher/courses', newCourse); setNewCourse({ name: '', description: '' }); loadCourses() } catch {}
    setLoading(false)
  }
  const deleteCourse = async (id) => { if (!confirm('Delete this course?')) return; try { await API.delete(`/teacher/courses/${id}`); loadCourses() } catch {} }

  const loadCourseExams = async (courseId) => { try { const r = await API.get(`/courses/${courseId}/exams`); setCourseExams(r.data.exams || []) } catch { setCourseExams([]) } }
  const toggleCourse = (courseId) => { if (expandedCourse === courseId) { setExpandedCourse(null); return }; setExpandedCourse(courseId); loadCourseExams(courseId) }
  const createExam = async (courseId) => {
    try { await API.post('/exams', { course_id: courseId, title: examForm.title, description: examForm.description, time_limit: examForm.time_limit * 60, questions: examForm.questions, is_proctored: true })
      setShowExamForm(false); setExamForm({ title: '', description: '', time_limit: 10, questions: [{ q: '', o: ['','','',''], a: 0 }] }); loadCourseExams(courseId)
    } catch (e) { alert(e.response?.data?.detail || 'Failed') }
  }
  const addQuestion = () => setExamForm(f => ({ ...f, questions: [...f.questions, { q: '', o: ['','','',''], a: 0 }] }))
  const updateQuestion = (qi, field, value) => {
    setExamForm(f => { const qs = [...f.questions]; if (field === 'q') qs[qi] = { ...qs[qi], q: value }; else if (field === 'a') qs[qi] = { ...qs[qi], a: parseInt(value) }; else { const o = [...qs[qi].o]; o[parseInt(field)] = value; qs[qi] = { ...qs[qi], o } }; return { ...f, questions: qs } })
  }
  const removeQuestion = (qi) => setExamForm(f => ({ ...f, questions: f.questions.filter((_, i) => i !== qi) }))
  const loadSubmissions = async (examId, examTitle) => { try { const r = await API.get(`/exams/${examId}/submissions`); setSubmissions(r.data.submissions || []); setViewingSubs({ id: examId, title: examTitle, avg_score: r.data.avg_score, avg_focus: r.data.avg_focus, total: r.data.total_submissions }) } catch { setSubmissions([]) } }
  const loadSubmissionDetail = async (subId) => { try { const r = await API.get(`/teacher/submissions/${subId}`); setViewingDetail(r.data) } catch {} }

  const topEmotions = (() => { const c = {}; students.forEach(s => { if (s.dominant_emotion) c[s.dominant_emotion] = (c[s.dominant_emotion] || 0) + 1 }); return Object.entries(c).sort((a,b) => b[1] - a[1]).slice(0, 4) })()

  /* ── Map sidebar tabs to sub-views ── */
  const analyticsSubTabs = [
    { id: 'live', label: 'Live Class' },
    { id: 'heatmap', label: 'Heatmap' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'progress', label: 'Progress' },
    { id: 'lecture', label: 'Lecture' },
  ]
  const [analyticsSubTab, setAnalyticsSubTab] = useState('live')

  return (
    <DashboardLayout activeTab={tab} onTabChange={setTab} title={`Dashboard / ${user?.name || 'Teacher'}`}
      headerRight={<span className="badge badge-warning uppercase text-[10px]">Teacher</span>}>

      {/* ═══════ OVERVIEW ═══════ */}
      {tab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Courses', value: stats?.total_courses ?? courses.length, accent: 'amber' },
              { label: 'Students', value: stats?.total_students ?? students.length, accent: 'indigo' },
              { label: 'Sessions', value: stats?.total_sessions ?? 0, accent: 'teal' },
            ].map(s => (
              <GlassCard key={s.label} variant="stat" accent={s.accent} className="p-5">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{s.label}</span>
                <div className="text-3xl font-bold text-white mt-2">{s.value}</div>
              </GlassCard>
            ))}
          </div>

          <GlassCard className="p-6">
            <h3 className="text-base font-semibold text-white mb-5">Class Engagement Overview</h3>
            {students.length === 0 ? (
              <div className="text-center py-8">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="1.5" className="mx-auto mb-3"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                <p className="text-gray-500 mb-3">No student data yet</p>
                <button onClick={() => { setTab('analytics'); setAnalyticsSubTab('live') }} className="btn-primary text-sm px-5 py-2">Start a Live Class</button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-5">
                <div className="glass-subtle rounded-xl p-4">
                  <span className="text-xs text-gray-500 font-medium">Engagement Levels</span>
                  <div className="mt-3 space-y-2.5">
                    {[
                      { level: 'High', color: '#22c55e', count: students.filter(s => (s.avg_engagement||0) >= 65).length },
                      { level: 'Medium', color: '#eab308', count: students.filter(s => (s.avg_engagement||0) >= 40 && (s.avg_engagement||0) < 65).length },
                      { level: 'Low', color: '#ef4444', count: students.filter(s => (s.avg_engagement||0) < 40).length },
                    ].map(l => (
                      <div key={l.level} className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ background: l.color }} /><span className="text-sm text-gray-300">{l.level}</span></div>
                        <span className="font-bold text-sm" style={{ color: l.color }}>{l.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="glass-subtle rounded-xl p-4">
                  <span className="text-xs text-gray-500 font-medium">Common Emotions</span>
                  <div className="mt-3 space-y-2">
                    {topEmotions.length === 0 ? <p className="text-gray-600 text-sm">No data</p> : topEmotions.map(([emo, cnt]) => (
                      <div key={emo} className="flex items-center justify-between">
                        <span className="text-sm text-gray-300 capitalize">{emo}</span>
                        <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: `${EMOTION_COLORS[emo]}18`, color: EMOTION_COLORS[emo] }}>{cnt}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="glass-subtle rounded-xl p-4">
                  <span className="text-xs text-gray-500 font-medium">Recent Activity</span>
                  <div className="mt-3 space-y-2">
                    {students.filter(s => s.total_sessions > 0).sort((a,b) => new Date(b.last_active||0) - new Date(a.last_active||0)).slice(0, 4).map(s => (
                      <div key={s.id} className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500/30 to-blue-500/30 flex items-center justify-center text-white text-[10px] font-bold">{s.name?.charAt(0)||'?'}</div>
                        <div className="min-w-0 flex-1"><div className="text-sm text-white truncate">{s.name}</div><div className="text-[10px] text-gray-600">{fmtDate(s.last_active)}</div></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </GlassCard>

          {/* Quick actions */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Live Class', icon: 'M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 010-7.072m-2.828 9.9a9 9 0 010-12.728', action: () => { setTab('analytics'); setAnalyticsSubTab('live') } },
              { label: 'Create Course', icon: 'M12 4v16m8-8H4', action: () => setTab('courses') },
              { label: 'View Students', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2', action: () => setTab('students') },
              { label: 'Exams', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', action: () => setTab('exams') },
            ].map(a => (
              <button key={a.label} onClick={a.action} className="glass-subtle hover:bg-white/5 rounded-xl p-5 text-center transition-all group">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2 group-hover:stroke-indigo-400 transition-colors"><path d={a.icon}/></svg>
                <div className="text-sm text-gray-400 font-medium group-hover:text-white transition-colors">{a.label}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══════ STUDENTS ═══════ */}
      {tab === 'students' && (
        <GlassCard className="p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-semibold text-white">Student Progress</h3>
            <span className="text-xs text-gray-600">Click a student to view details</span>
          </div>
          {students.length === 0 ? (
            <div className="text-center py-12"><p className="text-gray-500">No students enrolled yet</p></div>
          ) : (
            <div className="space-y-2">
              {students.map(s => {
                const c = engColor(s.avg_engagement || 0)
                return (
                  <button key={s.id} onClick={() => setSelectedStudent(s)}
                    className="w-full text-left flex items-center gap-4 p-4 rounded-xl glass-subtle hover:bg-white/5 hover:border-indigo-500/20 transition-all">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/30 to-blue-500/30 border border-indigo-500/15 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">{s.name?.charAt(0)||'?'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white font-medium flex items-center gap-2">{s.name}
                        {(s.total_sessions || 0) > 0 && <span className="badge badge-success text-[9px]">Active</span>}
                      </div>
                      <div className="text-xs text-gray-600">{s.email}{s.last_active && ` · Last: ${fmtDate(s.last_active)}`}</div>
                    </div>
                    <div className="flex gap-6 flex-shrink-0">
                      <div className="text-center"><div className="text-sm font-bold text-white">{s.total_sessions||0}</div><div className="text-[10px] text-gray-600">Sessions</div></div>
                      <div className="text-center"><div className="text-sm font-bold" style={{color:c}}>{s.avg_engagement||0}%</div><div className="text-[10px] text-gray-600">Engage</div></div>
                      <div className="text-center"><div className="text-sm font-bold text-blue-400 capitalize">{s.dominant_emotion||'—'}</div><div className="text-[10px] text-gray-600">Dominant</div></div>
                    </div>
                    <div className="w-24 flex-shrink-0"><div className="h-1.5 bg-white/5 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{width:`${s.avg_engagement||0}%`, background:c}}/></div></div>
                  </button>
                )
              })}
            </div>
          )}
        </GlassCard>
      )}

      {/* ═══════ COURSES + EXAMS ═══════ */}
      {(tab === 'courses' || tab === 'exams') && (
        <div className="space-y-5 animate-fade-in">
          <GlassCard className="p-5">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Create Course</h3>
            <div className="flex gap-3">
              <input type="text" placeholder="Course name" value={newCourse.name} onChange={e => setNewCourse({...newCourse, name: e.target.value})} className="input-glass flex-1" />
              <input type="text" placeholder="Description" value={newCourse.description} onChange={e => setNewCourse({...newCourse, description: e.target.value})} className="input-glass flex-1" />
              <button onClick={createCourse} disabled={loading || !newCourse.name.trim()} className="btn-primary px-6 text-sm disabled:opacity-40">{loading ? '...' : 'Create'}</button>
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Your Courses</h3>
            {courses.length === 0 ? <p className="text-gray-600 text-center py-8">No courses yet</p> : (
              <div className="space-y-3">
                {courses.map(c => (
                  <div key={c.id} className="glass-subtle rounded-xl overflow-hidden">
                    <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/3 transition-all" onClick={() => toggleCourse(c.id)}>
                      <div>
                        <h4 className="text-white font-semibold">{c.name}</h4>
                        <p className="text-gray-600 text-xs">{c.description || 'No description'} · {c.students?.length || 0} students</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={e => { e.stopPropagation(); deleteCourse(c.id) }} className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" className={`transition-transform ${expandedCourse===c.id?'rotate-180':''}`}><polyline points="6 9 12 15 18 9"/></svg>
                      </div>
                    </div>
                    {expandedCourse === c.id && (
                      <div className="border-t border-white/5 p-4 space-y-3">
                        {!showExamForm ? (
                          <button onClick={() => setShowExamForm(true)} className="w-full py-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium hover:bg-indigo-500/20 transition-all">+ Create Exam</button>
                        ) : (
                          <div className="glass-subtle rounded-xl p-4 space-y-3">
                            <h4 className="text-white font-semibold text-sm">New Exam</h4>
                            <input type="text" placeholder="Exam title" value={examForm.title} onChange={e => setExamForm(f => ({...f, title: e.target.value}))} className="input-glass text-sm" />
                            <div className="flex gap-3">
                              <input type="text" placeholder="Description" value={examForm.description} onChange={e => setExamForm(f => ({...f, description: e.target.value}))} className="input-glass flex-1 text-sm" />
                              <div className="flex items-center gap-2"><span className="text-gray-600 text-xs">Time:</span>
                                <input type="number" value={examForm.time_limit} onChange={e => setExamForm(f => ({...f, time_limit: parseInt(e.target.value)||10}))} className="w-14 input-glass text-sm text-center" /><span className="text-gray-600 text-xs">min</span></div>
                            </div>
                            <div className="space-y-2 max-h-56 overflow-y-auto">
                              {examForm.questions.map((q, qi) => (
                                <div key={qi} className="bg-white/3 rounded-lg p-3 border border-white/5">
                                  <div className="flex justify-between items-center mb-1.5"><span className="text-gray-500 text-[10px] font-bold">Q{qi+1}</span>{examForm.questions.length > 1 && <button onClick={() => removeQuestion(qi)} className="text-red-400 text-[10px]">Remove</button>}</div>
                                  <input type="text" placeholder="Question" value={q.q} onChange={e => updateQuestion(qi,'q',e.target.value)} className="w-full px-3 py-1.5 rounded-lg bg-white/3 border border-white/5 text-white text-xs mb-1.5 focus:outline-none" />
                                  <div className="grid grid-cols-2 gap-1.5">
                                    {q.o.map((opt, oi) => (
                                      <div key={oi} className="flex items-center gap-1">
                                        <input type="radio" name={`ans-${qi}`} checked={q.a===oi} onChange={() => updateQuestion(qi,'a',oi)} className="accent-indigo-500" />
                                        <input type="text" placeholder={`Option ${String.fromCharCode(65+oi)}`} value={opt} onChange={e => updateQuestion(qi,String(oi),e.target.value)} className="flex-1 px-2 py-1 rounded bg-white/3 border border-white/5 text-white text-[11px] focus:outline-none" />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <button onClick={addQuestion} className="text-xs text-indigo-400 hover:text-indigo-300">+ Add Question</button>
                            <div className="flex gap-2">
                              <button onClick={() => setShowExamForm(false)} className="btn-secondary flex-1 text-xs py-2">Cancel</button>
                              <button onClick={() => createExam(c.id)} disabled={!examForm.title.trim()} className="btn-primary flex-1 text-xs py-2 disabled:opacity-40">Create</button>
                            </div>
                          </div>
                        )}
                        {courseExams.length === 0 ? <p className="text-gray-700 text-xs text-center py-2">No exams yet</p> : (
                          <div className="space-y-1.5">
                            {courseExams.map(ex => (
                              <div key={ex.id} className="flex items-center justify-between glass-subtle rounded-lg p-3">
                                <div><div className="text-sm text-white font-medium">{ex.is_proctored && <span className="text-red-400 text-[10px] mr-1">Proctored</span>}{ex.title}</div><div className="text-gray-600 text-xs">{ex.question_count}q · {Math.floor(ex.time_limit/60)}min</div></div>
                                <button onClick={() => loadSubmissions(ex.id, ex.title)} className="px-3 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 text-xs font-medium hover:bg-indigo-500/20 transition-all">Submissions</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* ═══════ ANALYTICS (sub-tabbed) ═══════ */}
      {tab === 'analytics' && (
        <div className="space-y-5 animate-fade-in">
          <div className="flex gap-2">
            {analyticsSubTabs.map(t => (
              <button key={t.id} onClick={() => setAnalyticsSubTab(t.id)}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${analyticsSubTab === t.id ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20' : 'bg-white/3 text-gray-500 border border-white/5 hover:bg-white/5'}`}>
                {t.label}
              </button>
            ))}
          </div>
          {analyticsSubTab === 'live' && <LiveClass />}
          {analyticsSubTab === 'heatmap' && <EngagementHeatmap courses={courses} />}
          {analyticsSubTab === 'attendance' && <AttendanceEngagement courses={courses} />}
          {analyticsSubTab === 'progress' && <StudentProgress courses={courses} />}
          {analyticsSubTab === 'lecture' && <LectureAnalytics />}
        </div>
      )}

      {/* ═══════ STUDENT ANALYTICS MODAL ═══════ */}
      {selectedStudent && <StudentAnalyticsModal student={selectedStudent} onClose={() => setSelectedStudent(null)} />}

      {/* ═══════ EXAM SUBMISSIONS MODAL ═══════ */}
      {viewingSubs && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setViewingSubs(null); setViewingDetail(null) }}>
          <div className="glass-heavy rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-auto p-6" onClick={e => e.stopPropagation()}>
            {!viewingDetail ? (
              <>
                <div className="flex justify-between items-center mb-5">
                  <div><h3 className="text-white font-bold text-lg">{viewingSubs.title}</h3><p className="text-gray-500 text-xs">{viewingSubs.total} submissions · Avg: {viewingSubs.avg_score}% · Focus: {viewingSubs.avg_focus}%</p></div>
                  <button onClick={() => { setViewingSubs(null); setViewingDetail(null) }} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
                {submissions.length === 0 ? <p className="text-gray-600 text-center py-8">No submissions yet</p> : (
                  <div className="space-y-2">
                    {submissions.map(s => (
                      <div key={s.id} onClick={() => loadSubmissionDetail(s.id)} className="flex items-center justify-between glass-subtle rounded-xl p-4 cursor-pointer hover:bg-white/5 transition-all">
                        <div><div className="text-white font-medium text-sm">{s.student_name}</div><div className="text-gray-600 text-xs">{s.student_email} · {s.submitted_at ? new Date(s.submitted_at).toLocaleString() : ''}</div></div>
                        <div className="flex gap-4 text-sm">
                          <div className="text-center"><div className="font-bold" style={{color: s.score>=70?'#22c55e':s.score>=50?'#eab308':'#ef4444'}}>{s.score}%</div><div className="text-[10px] text-gray-600">Score</div></div>
                          <div className="text-center"><div className="font-bold" style={{color: s.focus_score>=85?'#22c55e':s.focus_score>=50?'#eab308':'#ef4444'}}>{s.focus_score}%</div><div className="text-[10px] text-gray-600">Focus</div></div>
                          <div className="text-center"><div className="font-bold text-amber-400">{s.alerts_count}</div><div className="text-[10px] text-gray-600">Alerts</div></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex justify-between items-center mb-4">
                  <div><h3 className="text-white font-bold">{viewingDetail.student?.name}'s Submission</h3><p className="text-gray-600 text-xs">{viewingDetail.exam?.title}</p></div>
                  <button onClick={() => setViewingDetail(null)} className="text-indigo-400 text-xs hover:text-indigo-300">&larr; Back</button>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="glass-subtle rounded-xl p-3 text-center"><div className="text-xl font-bold" style={{color:viewingDetail.submission?.score>=70?'#22c55e':'#ef4444'}}>{viewingDetail.submission?.score}%</div><div className="text-[10px] text-gray-600">Score</div></div>
                  <div className="glass-subtle rounded-xl p-3 text-center"><div className="text-xl font-bold" style={{color:viewingDetail.submission?.focus_score>=85?'#22c55e':'#eab308'}}>{viewingDetail.submission?.focus_score}%</div><div className="text-[10px] text-gray-600">Focus</div></div>
                  <div className="glass-subtle rounded-xl p-3 text-center"><div className="text-xl font-bold text-white">{Math.floor((viewingDetail.submission?.duration_sec||0)/60)}:{((viewingDetail.submission?.duration_sec||0)%60).toString().padStart(2,'0')}</div><div className="text-[10px] text-gray-600">Duration</div></div>
                </div>
                <a href={`${BACKEND}/api/exam/video/${viewingDetail.submission?.id||0}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm hover:bg-indigo-500/20 transition-all mb-4">Download Recording</a>
                {viewingDetail.submission?.focus_log?.length > 0 && (
                  <div className="mb-4"><span className="text-[10px] font-semibold text-gray-500 uppercase">Focus Timeline</span><div className="flex gap-[1px] h-5 rounded-lg overflow-hidden mt-1">{viewingDetail.submission.focus_log.map((e,i) => <div key={i} className="flex-1" style={{background:e.c||(e.s==='focused'?'#22c55e':e.s==='absent'?'#ef4444':'#eab308')}}/>)}</div></div>
                )}
                {viewingDetail.submission?.alerts?.length > 0 && (
                  <div className="mb-4"><span className="text-[10px] font-semibold text-gray-500 uppercase">Alerts ({viewingDetail.submission.alerts.length})</span><div className="max-h-28 overflow-y-auto space-y-1 mt-1">{viewingDetail.submission.alerts.map((a,i) => <div key={i} className="text-xs text-red-300 bg-red-500/10 rounded px-3 py-1">{Math.floor(a.t/60)}:{(a.t%60).toString().padStart(2,'0')} — {a.m}</div>)}</div></div>
                )}
                <div><span className="text-[10px] font-semibold text-gray-500 uppercase">Answers</span><div className="space-y-1 max-h-40 overflow-y-auto mt-1">{(viewingDetail.exam?.questions||[]).map((q,i) => { const sa = viewingDetail.submission?.answers?.[String(i)], ok = sa===q.a; return <div key={i} className={`text-xs rounded-lg px-3 py-2 ${ok?'bg-green-500/10 text-green-300':'bg-red-500/10 text-red-300'}`}><span className="font-bold mr-1">{ok?'✓':'✗'}</span> Q{i+1}: {q.q}{!ok && sa!==undefined && <span className="ml-2 text-green-400">Correct: {q.o[q.a]}</span>}</div> })}</div></div>
              </>
            )}
          </div>
        </div>
      )}

      <ChatButton />
    </DashboardLayout>
  )
}

/* ════════════════════════════════════════════════════════════════════════ */
function StudentAnalyticsModal({ student, onClose }) {
  const [profile, setProfile] = useState(null)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(null)
  const c = engColor(student.avg_engagement || 0)

  useEffect(() => {
    (async () => {
      setLoading(true)
      try { const [p, s] = await Promise.all([API.get(`/teacher/students/${student.id}/profile`), API.get(`/teacher/students/${student.id}/sessions`)]); setProfile(p.data); setSessions(s.data || []) }
      catch { setProfile(null); setSessions([]) }
      setLoading(false)
    })()
  }, [student.id])

  const dist = profile?.distribution || {}

  const openReport = async (sid) => { setDownloading(`r-${sid}`); try { const r = await API.get(`/teacher/sessions/${sid}/report`, { responseType:'blob' }); const u = URL.createObjectURL(new Blob([r.data],{type:'text/html'})); window.open(u,'_blank'); setTimeout(()=>URL.revokeObjectURL(u),60000) } catch { alert('Could not load report.') }; setDownloading(null) }
  const downloadCSV = async (sid) => { setDownloading(`c-${sid}`); try { const r = await API.get(`/teacher/sessions/${sid}/csv`,{responseType:'blob'}); const u=URL.createObjectURL(new Blob([r.data])); const a=document.createElement('a'); a.href=u; a.download=`session_${sid}_${student.name.replace(/\s+/g,'_')}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u) } catch { alert('Could not download CSV.') }; setDownloading(null) }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="glass-heavy rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-white/5 flex items-center justify-between sticky top-0 z-10" style={{background:'rgba(17,24,39,0.95)', backdropFilter:'blur(20px)'}}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500/30 to-blue-500/30 border border-indigo-500/15 flex items-center justify-center text-white text-lg font-bold">{student.name?.charAt(0)||'?'}</div>
            <div><h2 className="text-lg font-bold text-white">{student.name}</h2><p className="text-gray-600 text-xs">{student.email}</p></div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="glass-subtle rounded-xl p-4 text-center"><div className="text-2xl font-bold text-white">{student.total_sessions||0}</div><div className="text-xs text-gray-500 mt-0.5">Sessions</div></div>
            <div className="glass-subtle rounded-xl p-4 text-center"><div className="text-2xl font-bold" style={{color:c}}>{student.avg_engagement||0}%</div><div className="text-xs text-gray-500 mt-0.5">Avg Engagement</div></div>
            <div className="glass-subtle rounded-xl p-4 text-center"><div className="text-2xl font-bold text-blue-400 capitalize">{student.dominant_emotion||'N/A'}</div><div className="text-xs text-gray-500 mt-0.5">Dominant</div></div>
          </div>

          {loading ? <p className="text-gray-600 text-sm">Loading...</p> : Object.keys(dist).length > 0 && (
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Emotion Distribution</span>
              <div className="mt-2 space-y-1.5">
                {Object.entries(dist).sort((a,b) => b[1]-a[1]).map(([emo, pct]) => (
                  <div key={emo}><div className="flex justify-between text-xs mb-0.5"><span className="text-gray-400 capitalize">{emo}</span><span className="text-white font-bold">{pct}%</span></div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{width:`${pct}%`, background:EMOTION_COLORS[emo]||'#7c3aed'}}/></div></div>
                ))}
              </div>
            </div>
          )}

          {profile?.engagement_trend?.length > 0 && (
            <div><span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Engagement Trend</span>
              <div className="glass-subtle rounded-xl p-3 mt-2"><div className="flex items-end gap-[2px] h-20">{profile.engagement_trend.slice(-30).map((e,i) => <div key={i} className="flex-1 rounded-sm transition-all" style={{height:`${Math.max(4,e.score*100)}%`, background:engColor(e.score*100)}} title={`${Math.round(e.score*100)}%`}/>)}</div></div></div>
          )}

          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sessions ({sessions.length})</span>
            {loading ? <p className="text-gray-600 text-sm mt-2">Loading...</p> : sessions.length === 0 ? <p className="text-gray-600 text-sm mt-2">No sessions recorded.</p> : (
              <div className="mt-2 space-y-1.5">
                {sessions.map(s => {
                  const sc = engColor(s.avg_engagement||0)
                  return (
                    <div key={s.id} className="flex items-center gap-3 p-3 glass-subtle rounded-xl">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">#{s.id}</div>
                      <div className="flex-1 min-w-0"><div className="text-xs text-white">{fmtDate(s.started_at)}</div><div className="text-[10px] text-gray-600">{s.total_detections||0} detections</div></div>
                      <div className="text-center flex-shrink-0"><div className="text-xs font-bold" style={{color:sc}}>{s.avg_engagement||0}%</div></div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button onClick={() => openReport(s.id)} disabled={downloading===`r-${s.id}`} className="px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 text-[10px] font-medium hover:bg-indigo-500/20 disabled:opacity-50 transition-all">Report</button>
                        <button onClick={() => downloadCSV(s.id)} disabled={downloading===`c-${s.id}`} className="px-2 py-1 rounded-lg bg-white/5 text-gray-400 text-[10px] font-medium hover:bg-white/10 disabled:opacity-50 transition-all">CSV</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
