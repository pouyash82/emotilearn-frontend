import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import GlassCard from '../components/GlassCard'
import TypingText from '../components/TypingText'
import LiveClass from './LiveClass'
import API from '../api'

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

export default function TeacherDashboard() {
  const { user } = useAuth()
  const [tab, setTab] = useState('overview')
  const [courses, setCourses] = useState([])
  const [students, setStudents] = useState([])
  const [newCourse, setNewCourse] = useState({ name: '', description: '' })
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState(null)
  const [selectedStudent, setSelectedStudent] = useState(null)

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
            { id: 'courses',  label: '📚 Courses' },
            { id: 'students', label: '🎓 Students' },
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
                      {students.slice(0, 4).map(s => (
                        <div key={s.id} className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {s.name?.charAt(0) || '?'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-white text-sm truncate">{s.name}</div>
                            <div className="text-gray-500 text-xs">Session completed</div>
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

        {/* ═════════ COURSES TAB ═════════ */}
        {tab === 'courses' && (
          <div className="space-y-6 animate-fade-in">
            <GlassCard className="p-6">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <span className="text-2xl">➕</span> Create New Course
              </h2>
              <form onSubmit={createCourse} className="flex gap-4">
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
                  type="submit"
                  disabled={loading || !newCourse.name.trim()}
                  className="px-8 py-4 rounded-2xl font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-lg shadow-amber-500/30 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 transition-all duration-300"
                >
                  {loading ? 'Creating...' : 'Create'}
                </button>
              </form>
            </GlassCard>

            <GlassCard className="p-6">
              <h2 className="text-xl font-bold text-white mb-6">Your Courses</h2>
              {courses.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">📚</div>
                  <p className="text-gray-400">No courses yet. Create your first course!</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {courses.map((c, i) => (
                    <div
                      key={c.id}
                      className="bg-white/5 rounded-2xl p-5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all duration-300 animate-fade-in-up group"
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-white font-bold text-lg mb-1">{c.name}</h3>
                          <p className="text-gray-500 text-sm">{c.description || 'No description'}</p>
                          <div className="flex gap-4 mt-3">
                            <span className="text-xs text-gray-600">{c.students?.length || 0} students</span>
                            <span className="text-xs text-gray-600">Code: {c.code}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => deleteCourse(c.id)}
                          className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all duration-300"
                        >
                          🗑️
                        </button>
                      </div>
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
            <h2 className="text-xl font-bold text-white mb-6">Student Progress</h2>
            {students.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">🎓</div>
                <p className="text-gray-400">No students enrolled yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {students.map((s, i) => {
                  const c = engColor(s.avg_engagement || 0)
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
                          <div className="text-white font-medium">{s.name}</div>
                          <div className="text-gray-500 text-sm">{s.email}</div>
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
      </div>

      {/* ═════════ STUDENT ANALYTICS MODAL ═════════ */}
      {selectedStudent && (
        <StudentAnalyticsModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────── */
/*   Student analytics drill-down modal                                    */
/* ──────────────────────────────────────────────────────────────────────── */
function StudentAnalyticsModal({ student, onClose }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const c = engColor(student.avg_engagement || 0)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await API.get(`/teacher/students/${student.id}/profile`)
        setProfile(res.data)
      } catch {
        setProfile(null)
      }
      setLoading(false)
    }
    load()
  }, [student.id])

  const dist = profile?.distribution || {}

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="max-w-3xl w-full max-h-[90vh] overflow-y-auto bg-slate-900 border border-white/10 rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
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
                Detailed profile not available for this student yet.
                <br />
                Their distribution will appear here after they complete a session.
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

          {/* Engagement trend */}
          {profile?.engagement_trend && profile.engagement_trend.length > 0 && (
            <div>
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <span className="text-xl">📈</span> Recent Engagement Trend
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
        </div>
      </div>
    </div>
  )
}
