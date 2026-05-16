import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import GlassCard from '../components/GlassCard'
import TypingText from '../components/TypingText'
import LiveClass from './LiveClass'
import LectureAnalytics from './LectureAnalytics'
import EngagementHeatmap from './EngagementHeatmap'
import AttendanceEngagement from './AttendanceEngagement'
import StudentProgress from './StudentProgress'
import API from '../api'

const BACKEND = 'https://web-production-3a26e.up.railway.app'

const EMOTION_COLORS = {
  anger    : '#ef4444',
  disgust  : '#a855f7',
  fear     : '#f97316',
  happiness: '#22c55e',
  neutral  : '#6b7280',
  sadness  : '#3b82f6',
  surprise : '#eab308',
}

const engColor = (v) =>
  v >= 65 ? '#22c55e' : v >= 40 ? '#eab308' : '#ef4444'

const engLabel = (v) =>
  v >= 65 ? 'High' : v >= 40 ? 'Medium' : 'Low'

const fmtDate = (iso) => {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      month : 'short',
      day   : 'numeric',
      hour  : '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

export default function TeacherDashboard() {
  const { user } = useAuth()
  const [tab, setTab] = useState('overview')
  const [courses, setCourses] = useState([])
  const [students, setStudents] = useState([])
  const [newCourse, setNewCourse] = useState({ name: '', description: '' })
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState(null)
  const [selectedStudent, setSelectedStudent] = useState(null)

  // ── Exam management ──────────────────────────────────────────────
  const [expandedCourse, setExpandedCourse] = useState(null)
  const [courseExams, setCourseExams] = useState([])
  const [showExamForm, setShowExamForm] = useState(false)
  const [examForm, setExamForm] = useState({ title: '', description: '', time_limit: 10, questions: [{ q: '', o: ['', '', '', ''], a: 0 }] })
  const [viewingSubs, setViewingSubs] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [viewingDetail, setViewingDetail] = useState(null)

  useEffect(() => {
    loadCourses()
    loadStudents()
    loadStats()
  }, [])

  const loadCourses = async () => {
    try {
      const res = await API.get('/teacher/courses')
      setCourses(res.data)
    } catch {}
  }

  const loadStudents = async () => {
    try {
      const res = await API.get('/teacher/students')
      setStudents(res.data)
    } catch {}
  }

  const loadStats = async () => {
    try {
      const res = await API.get('/teacher/stats')
      setStats(res.data)
    } catch {}
  }

  const createCourse = async (e) => {
    e.preventDefault()
    if (!newCourse.name.trim()) return
    setLoading(true)
    try {
      await API.post('/teacher/courses', newCourse)
      setNewCourse({ name: '', description: '' })
      loadCourses()
    } catch {}
    setLoading(false)
  }

  const deleteCourse = async (id) => {
    if (!confirm('Delete this course?')) return
    try {
      await API.delete(`/teacher/courses/${id}`)
      loadCourses()
    } catch {}
  }

  // ── Exam management functions ──────────────────────────────────
  const loadCourseExams = async (courseId) => {
    try {
      const res = await API.get(`/courses/${courseId}/exams`)
      setCourseExams(res.data.exams || [])
    } catch { setCourseExams([]) }
  }

  const toggleCourse = (courseId) => {
    if (expandedCourse === courseId) { setExpandedCourse(null); return }
    setExpandedCourse(courseId)
    loadCourseExams(courseId)
  }

  const createExam = async (courseId) => {
    try {
      await API.post('/exams', {
        course_id: courseId, title: examForm.title,
        description: examForm.description,
        time_limit: examForm.time_limit * 60,
        questions: examForm.questions, is_proctored: true,
      })
      setShowExamForm(false)
      setExamForm({ title: '', description: '', time_limit: 10, questions: [{ q: '', o: ['', '', '', ''], a: 0 }] })
      loadCourseExams(courseId)
    } catch (e) { alert(e.response?.data?.detail || 'Failed to create exam') }
  }

  const addQuestion = () => {
    setExamForm(f => ({ ...f, questions: [...f.questions, { q: '', o: ['', '', '', ''], a: 0 }] }))
  }

  const updateQuestion = (qi, field, value) => {
    setExamForm(f => {
      const qs = [...f.questions]
      if (field === 'q') qs[qi] = { ...qs[qi], q: value }
      else if (field === 'a') qs[qi] = { ...qs[qi], a: parseInt(value) }
      else { const o = [...qs[qi].o]; o[parseInt(field)] = value; qs[qi] = { ...qs[qi], o } }
      return { ...f, questions: qs }
    })
  }

  const removeQuestion = (qi) => {
    setExamForm(f => ({ ...f, questions: f.questions.filter((_, i) => i !== qi) }))
  }

  const loadSubmissions = async (examId, examTitle) => {
    try {
      const res = await API.get(`/exams/${examId}/submissions`)
      setSubmissions(res.data.submissions || [])
      setViewingSubs({ id: examId, title: examTitle, avg_score: res.data.avg_score, avg_focus: res.data.avg_focus, total: res.data.total_submissions })
    } catch { setSubmissions([]) }
  }

  const loadSubmissionDetail = async (subId) => {
    try {
      const res = await API.get(`/teacher/submissions/${subId}`)
      setViewingDetail(res.data)
    } catch {}
  }

  const topEmotions = (() => {
    const counts = {}
    students.forEach(s => {
      if (s.dominant_emotion) {
        counts[s.dominant_emotion] = (counts[s.dominant_emotion] || 0) + 1
      }
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
  })()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Floating orbs */}
      <div className="fixed top-20 right-20 w-72 h-72 bg-amber-600/20 rounded-full blur-3xl animate-float pointer-events-none" />
      <div className="fixed bottom-40 left-20 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-float-delayed pointer-events-none" />
      <div className="fixed top-1/3 left-1/3 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl animate-float-slow pointer-events-none" />

      <Navbar />

      <div className="max-w-7xl mx-auto px-6 py-8 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-fade-in-up">
          <div>
            <h1 className="text-3xl font-black text-white mb-2">
              Welcome, <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">Professor {user?.name}</span> 👨‍🏫
            </h1>
            <p className="text-gray-400">
              <TypingText
                texts={['Monitor students', 'Track engagement', 'Analyze emotions', 'Improve learning']}
                speed={60}
                className="text-amber-400"
              />
            </p>
          </div>

          {/* Quick stats */}
          <div className="flex gap-4">
            {[
              { label: 'Courses',  value: stats?.total_courses  ?? courses.length,  icon: '📚' },
              { label: 'Students', value: stats?.total_students ?? students.length, icon: '🎓' },
              { label: 'Sessions', value: stats?.total_sessions ?? 0,                icon: '📊' },
            ].map((s, i) => (
              <GlassCard key={s.label} className="px-5 py-4 text-center animate-fade-in-up" style={{ animationDelay: `${i * 100}ms` }}>
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                  {s.value}
                </div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </GlassCard>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-3 mb-8 flex-wrap">
          {[
            { id: 'overview', label: '📊 Overview' },
            { id: 'live',     label: '🎥 Live Class' },
            { id: 'heatmap',  label: '🗺️ Heatmap' },
            { id: 'attendance', label: '📋 Attendance' },
            { id: 'progress', label: '📈 Progress' },
            { id: 'courses',  label: '📚 Courses' },
            { id: 'students', label: '🎓 Students' },
            { id: 'lecture',  label: '🎬 Lecture Analytics' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-6 py-3 rounded-2xl font-medium transition-all duration-300 ${
                tab === t.id
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30'
                  : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ═════════ OVERVIEW TAB ═════════ */}
        {tab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            <GlassCard className="p-6">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <span className="text-2xl">⚡</span> Class Engagement Overview
              </h2>

              {students.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-5xl mb-4">👨‍🎓</div>
                  <p className="text-gray-400 mb-4">No student data yet</p>
                  <button
                    onClick={() => setTab('live')}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium hover:scale-105 transition-all duration-300"
                  >
                    🎥 Start a Live Class Session
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-6">
                  {/* Engagement distribution */}
                  <div className="bg-white/5 rounded-2xl p-5 border border-white/5">
                    <h3 className="text-gray-400 text-sm mb-4">Engagement Levels</h3>
                    <div className="space-y-3">
                      {[
                        { level: 'High',   color: '#22c55e', count: students.filter(s => (s.avg_engagement || 0) >= 65).length },
                        { level: 'Medium', color: '#eab308', count: students.filter(s => (s.avg_engagement || 0) >= 40 && (s.avg_engagement || 0) < 65).length },
                        { level: 'Low',    color: '#ef4444', count: students.filter(s => (s.avg_engagement || 0) < 40).length },
                      ].map(l => (
                        <div key={l.level} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ background: l.color }} />
                            <span className="text-gray-300">{l.level}</span>
                          </div>
                          <span className="font-bold" style={{ color: l.color }}>{l.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Common emotions */}
                  <div className="bg-white/5 rounded-2xl p-5 border border-white/5">
                    <h3 className="text-gray-400 text-sm mb-4">Common Emotions</h3>
                    <div className="space-y-2">
                      {topEmotions.length === 0 ? (
                        <p className="text-gray-500 text-sm">No data yet</p>
                      ) : topEmotions.map(([emo, cnt]) => (
                        <div key={emo} className="flex items-center justify-between">
                          <span className="text-gray-300 capitalize">{emo}</span>
                          <div
                            className="px-2 py-0.5 rounded-full text-xs font-bold"
                            style={{
                              background: `${EMOTION_COLORS[emo]}20`,
                              color: EMOTION_COLORS[emo],
                            }}
                          >
                            {cnt}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent activity */}
                  <div className="bg-white/5 rounded-2xl p-5 border border-white/5">
                    <h3 className="text-gray-400 text-sm mb-4">Recent Activity</h3>
                    <div className="space-y-2">
                      {students
                        .filter(s => s.total_sessions > 0)
                        .slice(0, 4)
                        .map(s => (
                          <div key={s.id} className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {s.name?.charAt(0) || '?'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-white text-sm truncate">{s.name}</div>
                              <div className="text-gray-500 text-xs">{fmtDate(s.last_active)}</div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </GlassCard>

            {/* Quick actions */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Live Class',      icon: '🎥', action: () => setTab('live')     },
                { label: 'Create Course',   icon: '➕', action: () => setTab('courses')  },
                { label: 'View Students',   icon: '👁️', action: () => setTab('students') },
                { label: 'Export Report',   icon: '📄', action: () => setTab('live')     },
              ].map((a, i) => (
                <button
                  key={a.label}
                  onClick={a.action}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-2xl p-6 text-center transition-all duration-300 hover:scale-[1.02] animate-fade-in-up"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className="text-3xl mb-2">{a.icon}</div>
                  <div className="text-white font-medium">{a.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═════════ LIVE CLASS TAB ═════════ */}
        {tab === 'live' && <LiveClass />}

        {/* ═════════ ENGAGEMENT HEATMAP TAB ═════════ */}
        {tab === 'heatmap' && <EngagementHeatmap courses={courses} />}

        {/* ═════════ ATTENDANCE + ENGAGEMENT TAB ═════════ */}
        {tab === 'attendance' && <AttendanceEngagement courses={courses} />}

        {/* ═════════ STUDENT PROGRESS TAB ═════════ */}
        {tab === 'progress' && <StudentProgress courses={courses} />}

        {/* ═════════ COURSES TAB ═════════ */}
        {tab === 'courses' && (
          <div className="space-y-6 animate-fade-in">
            <GlassCard className="p-6">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <span className="text-2xl">➕</span> Create New Course
              </h2>
              <div className="flex gap-4">
                <input
                  type="text"
                  placeholder="Course name"
                  value={newCourse.name}
                  onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })}
                  className="flex-1 px-5 py-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 focus:bg-white/10 transition-all duration-300"
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={newCourse.description}
                  onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                  className="flex-1 px-5 py-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 focus:bg-white/10 transition-all duration-300"
                />
                <button
                  onClick={createCourse}
                  disabled={loading || !newCourse.name.trim()}
                  className="px-8 py-4 rounded-2xl font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-lg shadow-amber-500/30 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 transition-all duration-300"
                >
                  {loading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </GlassCard>

            <GlassCard className="p-6">
              <h2 className="text-xl font-bold text-white mb-6">Your Courses</h2>
              {courses.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">📚</div>
                  <p className="text-gray-400">No courses yet. Create your first course!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {courses.map((c, i) => (
                    <div key={c.id} className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden animate-fade-in-up" style={{ animationDelay: `${i * 50}ms` }}>
                      <div className="p-5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-all" onClick={() => toggleCourse(c.id)}>
                        <div>
                          <h3 className="text-white font-bold text-lg">{c.name}</h3>
                          <p className="text-gray-500 text-sm">{c.description || 'No description'}</p>
                          <span className="text-xs text-gray-600">{c.students?.length || 0} students</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button onClick={(e) => { e.stopPropagation(); deleteCourse(c.id) }}
                            className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all">🗑️</button>
                          <span className={`text-gray-500 transition-transform ${expandedCourse === c.id ? 'rotate-180' : ''}`}>▼</span>
                        </div>
                      </div>

                      {expandedCourse === c.id && (
                        <div className="border-t border-white/5 p-5 space-y-4">
                          {/* Create exam button */}
                          {!showExamForm ? (
                            <button onClick={() => setShowExamForm(true)}
                              className="w-full py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 font-medium hover:bg-amber-500/20 transition-all">
                              + Create Exam for {c.name}
                            </button>
                          ) : (
                            <div className="bg-white/5 rounded-xl p-5 border border-white/10 space-y-3">
                              <h4 className="text-white font-bold">New Exam</h4>
                              <input type="text" placeholder="Exam title" value={examForm.title} onChange={e => setExamForm(f => ({ ...f, title: e.target.value }))}
                                className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50 text-sm" />
                              <div className="flex gap-3">
                                <input type="text" placeholder="Description" value={examForm.description} onChange={e => setExamForm(f => ({ ...f, description: e.target.value }))}
                                  className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none text-sm" />
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500 text-xs">Time:</span>
                                  <input type="number" value={examForm.time_limit} onChange={e => setExamForm(f => ({ ...f, time_limit: parseInt(e.target.value) || 10 }))}
                                    className="w-16 px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm text-center" />
                                  <span className="text-gray-500 text-xs">min</span>
                                </div>
                              </div>
                              {/* Questions */}
                              <div className="space-y-3 max-h-64 overflow-y-auto">
                                {examForm.questions.map((q, qi) => (
                                  <div key={qi} className="bg-white/5 rounded-lg p-3 border border-white/5">
                                    <div className="flex justify-between items-center mb-2">
                                      <span className="text-gray-400 text-xs font-bold">Q{qi + 1}</span>
                                      {examForm.questions.length > 1 && <button onClick={() => removeQuestion(qi)} className="text-red-400 text-xs hover:text-red-300">Remove</button>}
                                    </div>
                                    <input type="text" placeholder="Question text" value={q.q} onChange={e => updateQuestion(qi, 'q', e.target.value)}
                                      className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-600 text-sm mb-2" />
                                    <div className="grid grid-cols-2 gap-2">
                                      {q.o.map((opt, oi) => (
                                        <div key={oi} className="flex items-center gap-1">
                                          <input type="radio" name={`ans-${qi}`} checked={q.a === oi} onChange={() => updateQuestion(qi, 'a', oi)} className="accent-amber-500" />
                                          <input type="text" placeholder={`Option ${String.fromCharCode(65 + oi)}`} value={opt} onChange={e => updateQuestion(qi, String(oi), e.target.value)}
                                            className="flex-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-white placeholder-gray-600 text-xs" />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <button onClick={addQuestion} className="text-sm text-blue-400 hover:text-blue-300">+ Add Question</button>
                              <div className="flex gap-2 pt-2">
                                <button onClick={() => setShowExamForm(false)} className="flex-1 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm">Cancel</button>
                                <button onClick={() => createExam(c.id)} disabled={!examForm.title.trim() || examForm.questions.some(q => !q.q.trim())}
                                  className="flex-1 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm disabled:opacity-40">Create Exam</button>
                              </div>
                            </div>
                          )}

                          {/* Exam list */}
                          {courseExams.length === 0 ? (
                            <p className="text-gray-600 text-sm text-center py-3">No exams for this course yet</p>
                          ) : (
                            <div className="space-y-2">
                              {courseExams.map(ex => (
                                <div key={ex.id} className="bg-white/5 rounded-xl p-3 border border-white/5 flex items-center justify-between">
                                  <div>
                                    <div className="text-white font-medium text-sm flex items-center gap-2">
                                      {ex.is_proctored && <span className="text-red-400 text-[10px]">🔒</span>}
                                      {ex.title}
                                    </div>
                                    <div className="text-gray-500 text-xs">{ex.question_count}q · {Math.floor(ex.time_limit / 60)}min</div>
                                  </div>
                                  <button onClick={() => loadSubmissions(ex.id, ex.title)}
                                    className="px-3 py-1 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-bold hover:bg-blue-500/30">
                                    View Submissions
                                  </button>
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

        {/* ═════════ STUDENTS TAB ═════════ */}
        {tab === 'students' && (
          <GlassCard className="p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Student Progress</h2>
              <div className="text-sm text-gray-500">
                Click any student to see their sessions and reports
              </div>
            </div>

            {students.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">🎓</div>
                <p className="text-gray-400">No students enrolled yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {students.map((s, i) => {
                  const c = engColor(s.avg_engagement || 0)
                  const hasData = (s.total_sessions || 0) > 0
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedStudent(s)}
                      className="w-full text-left bg-white/5 rounded-2xl p-5 border border-white/5 hover:bg-white/10 hover:border-amber-500/30 transition-all duration-300 animate-fade-in-up"
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-blue-500/20">
                          {s.name?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1">
                          <div className="text-white font-medium flex items-center gap-2">
                            {s.name}
                            {hasData && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="text-gray-500 text-sm">{s.email}</div>
                          {s.last_active && (
                            <div className="text-gray-600 text-xs mt-0.5">
                              Last session: {fmtDate(s.last_active)}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-8">
                          <div className="text-center">
                            <div className="font-bold text-white">{s.total_sessions || 0}</div>
                            <div className="text-xs text-gray-500">Sessions</div>
                          </div>
                          <div className="text-center">
                            <div className="font-bold" style={{ color: c }}>
                              {s.avg_engagement || 0}%
                            </div>
                            <div className="text-xs text-gray-500">Engagement</div>
                          </div>
                          <div className="text-center">
                            <div className="font-bold text-blue-400 capitalize">
                              {s.dominant_emotion || 'N/A'}
                            </div>
                            <div className="text-xs text-gray-500">Dominant</div>
                          </div>
                        </div>
                        <div className="w-32">
                          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${s.avg_engagement || 0}%`, background: c }}
                            />
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </GlassCard>
        )}

        {/* ═════════ LECTURE ANALYTICS TAB ═════════ */}
        {tab === 'lecture' && <LectureAnalytics />}
      </div>

      {/* ═════════ STUDENT ANALYTICS MODAL ═════════ */}
      {selectedStudent && (
        <StudentAnalyticsModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}

      {/* ═════════ EXAM SUBMISSIONS MODAL ═════════ */}
      {viewingSubs && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setViewingSubs(null); setViewingDetail(null) }}>
          <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-auto p-6" onClick={e => e.stopPropagation()}>
            {!viewingDetail ? (
              <>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-white font-bold text-xl">{viewingSubs.title}</h3>
                    <p className="text-gray-500 text-sm">{viewingSubs.total} submissions · Avg: {viewingSubs.avg_score}% · Focus: {viewingSubs.avg_focus}%</p>
                  </div>
                  <button onClick={() => { setViewingSubs(null); setViewingDetail(null) }} className="text-gray-400 hover:text-white text-xl">✕</button>
                </div>
                {submissions.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No submissions yet</p>
                ) : (
                  <div className="space-y-2">
                    {submissions.map(s => (
                      <div key={s.id} onClick={() => loadSubmissionDetail(s.id)}
                        className="flex items-center justify-between bg-white/5 rounded-xl p-4 border border-white/5 cursor-pointer hover:bg-white/10 transition-all">
                        <div>
                          <div className="text-white font-medium">{s.student_name}</div>
                          <div className="text-gray-500 text-xs">{s.student_email} · {s.submitted_at ? new Date(s.submitted_at).toLocaleString() : ''}</div>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <div className="text-center"><div className="font-bold" style={{ color: s.score >= 70 ? '#22c55e' : s.score >= 50 ? '#eab308' : '#ef4444' }}>{s.score}%</div><div className="text-gray-600 text-[10px]">Score</div></div>
                          <div className="text-center"><div className="font-bold" style={{ color: s.focus_score >= 85 ? '#22c55e' : s.focus_score >= 50 ? '#eab308' : '#ef4444' }}>{s.focus_score}%</div><div className="text-gray-600 text-[10px]">Focus</div></div>
                          <div className="text-center"><div className="font-bold text-yellow-400">{s.alerts_count}</div><div className="text-gray-600 text-[10px]">Alerts</div></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-white font-bold text-lg">{viewingDetail.student?.name}'s Submission</h3>
                    <p className="text-gray-500 text-xs">{viewingDetail.exam?.title}</p>
                  </div>
                  <button onClick={() => setViewingDetail(null)} className="text-gray-400 hover:text-white text-sm">← Back</button>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-white/5 rounded-xl p-3 text-center"><div className="text-2xl font-black" style={{ color: viewingDetail.submission?.score >= 70 ? '#22c55e' : '#ef4444' }}>{viewingDetail.submission?.score}%</div><div className="text-xs text-gray-500">Score</div></div>
                  <div className="bg-white/5 rounded-xl p-3 text-center"><div className="text-2xl font-black" style={{ color: viewingDetail.submission?.focus_score >= 85 ? '#22c55e' : '#eab308' }}>{viewingDetail.submission?.focus_score}%</div><div className="text-xs text-gray-500">Focus</div></div>
                  <div className="bg-white/5 rounded-xl p-3 text-center"><div className="text-2xl font-black text-white">{Math.floor((viewingDetail.submission?.duration_sec||0)/60)}:{((viewingDetail.submission?.duration_sec||0)%60).toString().padStart(2,'0')}</div><div className="text-xs text-gray-500">Duration</div></div>
                </div>
                <div className="mb-4">
                  <a href={`${BACKEND}/api/exam/video/${viewingDetail.submission?.id || 0}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm hover:bg-blue-500/20 transition-all">
                    📹 Download Session Recording
                  </a>
                </div>
                {viewingDetail.submission?.focus_log?.length > 0 && (
                  <div className="mb-4"><h4 className="text-gray-400 text-xs font-bold uppercase mb-2">Focus Timeline</h4>
                    <div className="flex gap-[1px] h-6 rounded-lg overflow-hidden">
                      {viewingDetail.submission.focus_log.map((e,i) => <div key={i} className="flex-1" style={{ background: e.c || (e.s==='focused'?'#22c55e':e.s==='absent'?'#ef4444':'#eab308') }} />)}
                    </div></div>
                )}
                {viewingDetail.submission?.alerts?.length > 0 && (
                  <div className="mb-4"><h4 className="text-gray-400 text-xs font-bold uppercase mb-2">Alerts ({viewingDetail.submission.alerts.length})</h4>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {viewingDetail.submission.alerts.map((a,i) => <div key={i} className="text-xs text-red-300 bg-red-500/10 rounded px-3 py-1">{Math.floor(a.t/60)}:{(a.t%60).toString().padStart(2,'0')} — {a.m}</div>)}
                    </div></div>
                )}
                <div><h4 className="text-gray-400 text-xs font-bold uppercase mb-2">Answers</h4>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {(viewingDetail.exam?.questions||[]).map((q,i) => {
                      const sa = viewingDetail.submission?.answers?.[String(i)], ok = sa===q.a
                      return <div key={i} className={`text-xs rounded-lg px-3 py-2 ${ok?'bg-green-500/10 text-green-300':'bg-red-500/10 text-red-300'}`}>
                        <span className="font-bold mr-1">{ok?'✓':'✗'}</span> Q{i+1}: {q.q}
                        {!ok && sa!==undefined && <span className="ml-2 text-green-400">Correct: {q.o[q.a]}</span>}
                      </div>
                    })}
                  </div></div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════ */
/*   Student analytics drill-down modal                                    */
/*   — shows aggregate profile + full session list + per-session downloads */
/* ════════════════════════════════════════════════════════════════════════ */
function StudentAnalyticsModal({ student, onClose }) {
  const [profile, setProfile]     = useState(null)
  const [sessions, setSessions]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [downloading, setDownloading] = useState(null) // session id being downloaded
  const c = engColor(student.avg_engagement || 0)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [p, s] = await Promise.all([
          API.get(`/teacher/students/${student.id}/profile`),
          API.get(`/teacher/students/${student.id}/sessions`),
        ])
        setProfile(p.data)
        setSessions(s.data || [])
      } catch {
        setProfile(null)
        setSessions([])
      }
      setLoading(false)
    }
    load()
  }, [student.id])

  const dist = profile?.distribution || {}

  /* Open HTML report in a new tab — fetch via axios so the JWT header
     is included, then create a blob URL the browser can open. */
  const openReport = async (sessionId) => {
    setDownloading(`report-${sessionId}`)
    try {
      const res = await API.get(
        `/teacher/sessions/${sessionId}/report`,
        { responseType: 'blob' },
      )
      const blob = new Blob([res.data], { type: 'text/html' })
      const url  = URL.createObjectURL(blob)
      window.open(url, '_blank')
      // Give the new tab a minute to render before revoking
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      alert('Could not load report for this session.')
    }
    setDownloading(null)
  }

  /* Download CSV for a specific session. */
  const downloadCSV = async (sessionId) => {
    setDownloading(`csv-${sessionId}`)
    try {
      const res = await API.get(
        `/teacher/sessions/${sessionId}/csv`,
        { responseType: 'blob' },
      )
      const url = URL.createObjectURL(new Blob([res.data]))
      const a   = document.createElement('a')
      a.href    = url
      a.download = `session_${sessionId}_${student.name.replace(/\s+/g, '_')}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Could not download CSV for this session.')
    }
    setDownloading(null)
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="max-w-4xl w-full max-h-[90vh] overflow-y-auto bg-slate-900 border border-white/10 rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between sticky top-0 bg-slate-900 z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-2xl font-bold">
              {student.name?.charAt(0) || '?'}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{student.name}</h2>
              <p className="text-gray-500 text-sm">{student.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all duration-300"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center">
              <div className="text-3xl font-black text-white">
                {student.total_sessions || 0}
              </div>
              <div className="text-xs text-gray-400 mt-1">Sessions</div>
            </div>
            <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center">
              <div className="text-3xl font-black" style={{ color: c }}>
                {student.avg_engagement || 0}%
              </div>
              <div className="text-xs text-gray-400 mt-1">Avg Engagement</div>
            </div>
            <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center">
              <div className="text-3xl font-black text-blue-400 capitalize">
                {student.dominant_emotion || 'N/A'}
              </div>
              <div className="text-xs text-gray-400 mt-1">Dominant Emotion</div>
            </div>
          </div>

          {/* Emotion distribution */}
          <div>
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <span className="text-xl">📊</span> Emotion Distribution
            </h3>
            {loading ? (
              <p className="text-gray-500 text-sm">Loading profile...</p>
            ) : Object.keys(dist).length === 0 ? (
              <div className="bg-white/5 rounded-2xl p-6 text-center text-gray-500 text-sm">
                No distribution data yet — this student hasn't completed a session.
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(dist).sort((a, b) => b[1] - a[1]).map(([emo, pct]) => (
                  <div key={emo}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-300 capitalize">{emo}</span>
                      <span className="text-white font-bold">{pct}%</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          background: EMOTION_COLORS[emo] || '#7c3aed',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Engagement trend sparkline */}
          {profile?.engagement_trend && profile.engagement_trend.length > 0 && (
            <div>
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <span className="text-xl">📈</span> Engagement Trend (per session)
              </h3>
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <div className="flex items-end gap-1 h-24">
                  {profile.engagement_trend.slice(-30).map((e, i) => {
                    const h = Math.max(4, e.score * 100)
                    return (
                      <div
                        key={i}
                        className="flex-1 rounded-sm transition-all duration-300"
                        style={{
                          height: `${h}%`,
                          background: engColor(e.score * 100),
                        }}
                        title={`${Math.round(e.score * 100)}%`}
                      />
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ═════════ SESSION LIST WITH PER-SESSION DOWNLOADS ═════════ */}
          <div>
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <span className="text-xl">📋</span> Session History
              <span className="text-sm font-normal text-gray-500">
                ({sessions.length})
              </span>
            </h3>

            {loading ? (
              <p className="text-gray-500 text-sm">Loading sessions...</p>
            ) : sessions.length === 0 ? (
              <div className="bg-white/5 rounded-2xl p-6 text-center text-gray-500 text-sm">
                No sessions recorded yet.
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.map((s) => {
                  const sc = engColor(s.avg_engagement || 0)
                  const isReportLoading = downloading === `report-${s.id}`
                  const isCsvLoading    = downloading === `csv-${s.id}`
                  return (
                    <div
                      key={s.id}
                      className="bg-white/5 border border-white/5 hover:border-amber-500/20 rounded-2xl p-4 transition-all duration-300"
                    >
                      <div className="flex items-center gap-4 flex-wrap">
                        {/* Session badge */}
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                          #{s.id}
                        </div>

                        {/* Date */}
                        <div className="min-w-0 flex-1">
                          <div className="text-white text-sm font-medium">
                            {fmtDate(s.started_at)}
                          </div>
                          <div className="text-gray-500 text-xs">
                            {s.total_detections || 0} detections
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="flex gap-6 shrink-0">
                          <div className="text-center">
                            <div className="text-sm font-bold" style={{ color: sc }}>
                              {s.avg_engagement || 0}%
                            </div>
                            <div className="text-[10px] text-gray-500 uppercase">
                              {engLabel(s.avg_engagement || 0)}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm font-bold text-blue-400 capitalize">
                              {s.dominant_emotion || '—'}
                            </div>
                            <div className="text-[10px] text-gray-500 uppercase">
                              Dominant
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => openReport(s.id)}
                            disabled={isReportLoading}
                            className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium hover:bg-amber-500/20 disabled:opacity-50 transition-all duration-300"
                            title="Open HTML report in new tab"
                          >
                            {isReportLoading ? '...' : '📊 Report'}
                          </button>
                          <button
                            onClick={() => downloadCSV(s.id)}
                            disabled={isCsvLoading}
                            className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-xs font-medium hover:bg-white/10 disabled:opacity-50 transition-all duration-300"
                            title="Download CSV"
                          >
                            {isCsvLoading ? '...' : '📄 CSV'}
                          </button>
                        </div>
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
