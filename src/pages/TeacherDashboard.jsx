import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import API from '../api'

const EMOTION_COLORS = {
  anger:'#ef4444', disgust:'#a855f7', fear:'#f97316',
  happiness:'#22c55e', neutral:'#6b7280',
  sadness:'#3b82f6', surprise:'#eab308',
}

export default function TeacherDashboard() {
  const { user }          = useAuth()
  const [analytics, setAnalytics] = useState([])
  const [courses,   setCourses  ] = useState([])
  const [newCourse, setNewCourse] = useState('')
  const [loading,   setLoading  ] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [ana, cou] = await Promise.all([
        API.get('/teacher/analytics'),
        API.get('/courses'),
      ])
      setAnalytics(ana.data)
      setCourses(cou.data)
    } catch {}
    setLoading(false)
  }

  const createCourse = async () => {
    if (!newCourse.trim()) return
    try {
      await API.post('/courses', { name: newCourse })
      setNewCourse('')
      loadData()
    } catch {}
  }

  const avgEng = analytics.length
    ? Math.round(analytics.reduce(
        (a,b) => a + b.avg_engagement, 0) / analytics.length)
    : 0

  return (
    <div className="min-h-screen bg-dark">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 py-6">

        <div className="mb-6">
          <h1 className="text-2xl font-bold">
            Teacher Dashboard 👨‍🏫
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Monitor student engagement across your classes
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Sessions', value: analytics.length },
            { label: 'Avg Engagement', value: avgEng + '%',
              color: avgEng>=65?'#22c55e':avgEng>=40?'#eab308':'#ef4444' },
            { label: 'Courses',        value: courses.length },
          ].map(s => (
            <div key={s.label}
                 className="bg-card border border-border
                            rounded-2xl p-5 text-center">
              <div className="text-3xl font-bold"
                   style={{ color: s.color || '#a78bfa' }}>
                {s.value}
              </div>
              <div className="text-gray-500 text-sm mt-1">
                {s.label}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6">

          {/* Courses */}
          <div className="bg-card border border-border
                          rounded-2xl p-5">
            <h2 className="text-purple-400 font-semibold mb-4">
              📚 Your Courses
            </h2>
            <div className="flex gap-2 mb-4">
              <input
                value={newCourse}
                onChange={e => setNewCourse(e.target.value)}
                onKeyDown={e => e.key==='Enter' && createCourse()}
                placeholder="New course name..."
                className="flex-1 bg-dark border border-border
                           rounded-lg px-3 py-2 text-sm
                           focus:outline-none focus:border-primary"
              />
              <button
                onClick={createCourse}
                className="bg-primary hover:bg-purple-700 text-white
                           px-3 py-2 rounded-lg text-sm transition-colors"
              >
                +
              </button>
            </div>
            {courses.length === 0 ? (
              <p className="text-gray-500 text-sm">
                No courses yet
              </p>
            ) : (
              <div className="space-y-2">
                {courses.map(c => (
                  <div key={c.id}
                       className="bg-dark rounded-lg px-3 py-2
                                  text-sm flex items-center gap-2">
                    <span className="text-purple-400">📖</span>
                    {c.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Student Sessions */}
          <div className="col-span-2 bg-card border border-border
                          rounded-2xl p-5">
            <h2 className="text-purple-400 font-semibold mb-4">
              📊 Recent Student Sessions
            </h2>
            {loading ? (
              <p className="text-gray-500 text-sm animate-pulse">
                Loading...
              </p>
            ) : analytics.length === 0 ? (
              <p className="text-gray-500 text-sm">
                No student sessions yet
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs
                                   border-b border-border">
                      <th className="text-left pb-3">Student</th>
                      <th className="text-left pb-3">Date</th>
                      <th className="text-left pb-3">Engagement</th>
                      <th className="text-left pb-3">Dominant</th>
                      <th className="text-left pb-3">Detections</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.map(row => {
                      const ec = row.avg_engagement>=65
                        ? '#22c55e' : row.avg_engagement>=40
                        ? '#eab308' : '#ef4444'
                      return (
                        <tr key={row.session_id}
                            className="border-b border-border/50
                                       hover:bg-dark/50">
                          <td className="py-3 font-medium">
                            {row.student_name}
                          </td>
                          <td className="py-3 text-gray-500">
                            {new Date(row.started_at)
                              .toLocaleDateString()}
                          </td>
                          <td className="py-3">
                            <span className="font-bold"
                                  style={{ color: ec }}>
                              {row.avg_engagement}%
                            </span>
                          </td>
                          <td className="py-3">
                            <span className="px-2 py-0.5
                                             rounded-full text-xs
                                             capitalize"
                                  style={{
                                    background: EMOTION_COLORS[row.dominant_emotion]+'20',
                                    color: EMOTION_COLORS[row.dominant_emotion],
                                  }}>
                              {row.dominant_emotion}
                            </span>
                          </td>
                          <td className="py-3 text-gray-400">
                            {row.total_detections}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}