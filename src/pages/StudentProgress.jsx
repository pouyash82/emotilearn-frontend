import { useState, useEffect } from 'react'
import GlassCard from '../components/GlassCard'
import API from '../api'

const engColor = (v) => v >= 65 ? '#22c55e' : v >= 40 ? '#eab308' : '#ef4444'

export default function StudentProgress({ courses }) {
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [expandedStudent, setExpandedStudent] = useState(null)

  useEffect(() => {
    if (!selectedCourse) { setData(null); return }
    setLoading(true)
    API.get(`/teacher/progress/${selectedCourse}`)
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [selectedCourse])

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Course Selector ──────────────────────────────────────── */}
      <GlassCard className="p-5">
        <div className="flex items-center gap-4">
          <h3 className="text-white font-bold">Select Course:</h3>
          <select
            value={selectedCourse || ''}
            onChange={(e) => {
              setSelectedCourse(e.target.value ? parseInt(e.target.value) : null)
              setExpandedStudent(null)
            }}
            className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-amber-500/50 flex-1 max-w-sm"
          >
            <option value="">— Choose a course —</option>
            {(courses || []).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </GlassCard>

      {!selectedCourse && (
        <GlassCard className="p-12 text-center">
          <div className="text-5xl mb-4">📈</div>
          <p className="text-gray-400">Select a course to track student progress over time.</p>
        </GlassCard>
      )}

      {loading && (
        <GlassCard className="p-8 text-center">
          <div className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading progress data...</p>
        </GlassCard>
      )}

      {data && !loading && (
        <>
          {/* ── Course Header ────────────────────────────────────── */}
          <GlassCard className="p-5">
            <h2 className="text-xl font-bold text-white mb-1">{data.course_name}</h2>
            <p className="text-gray-500 text-sm">{data.students.length} enrolled students · Engagement progress over time</p>
          </GlassCard>

          {/* ── Student Progress Cards ────────────────────────────── */}
          {data.students.length === 0 ? (
            <GlassCard className="p-12 text-center">
              <div className="text-5xl mb-4">🎓</div>
              <p className="text-gray-400">No enrolled students with session data.</p>
            </GlassCard>
          ) : (
            <div className="space-y-3">
              {data.students.map((s, i) => {
                const isExpanded = expandedStudent === s.id
                const improvementColor = s.improvement > 0 ? '#22c55e'
                  : s.improvement < 0 ? '#ef4444' : '#6b7280'
                const improvementLabel = s.improvement > 0
                  ? `↑ +${s.improvement}%`
                  : s.improvement < 0
                    ? `↓ ${s.improvement}%`
                    : '→ No change'

                return (
                  <GlassCard
                    key={s.id}
                    className="overflow-hidden animate-fade-in-up"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    {/* ── Main Row ──────────────────────────────── */}
                    <button
                      onClick={() => setExpandedStudent(isExpanded ? null : s.id)}
                      className="w-full text-left p-5 flex items-center gap-4 hover:bg-white/5 transition-all"
                    >
                      {/* Avatar */}
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold shrink-0"
                        style={{
                          background: `linear-gradient(135deg, ${engColor(s.avg_engagement)}80, ${engColor(s.avg_engagement)}40)`,
                        }}
                      >
                        {s.name?.charAt(0) || '?'}
                      </div>

                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium">{s.name}</div>
                        <div className="text-gray-500 text-xs">{s.email}</div>
                      </div>

                      {/* Stats */}
                      <div className="flex gap-6 shrink-0">
                        <div className="text-center">
                          <div className="text-sm font-bold text-white">{s.total_sessions}</div>
                          <div className="text-[10px] text-gray-500">Sessions</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-bold" style={{ color: engColor(s.avg_engagement) }}>
                            {s.avg_engagement}%
                          </div>
                          <div className="text-[10px] text-gray-500">Avg Engage</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-bold" style={{ color: improvementColor }}>
                            {improvementLabel}
                          </div>
                          <div className="text-[10px] text-gray-500">Improvement</div>
                        </div>
                      </div>

                      {/* Mini sparkline */}
                      {s.trend.length > 0 && (
                        <div className="flex items-end gap-[2px] h-8 w-24 shrink-0">
                          {s.trend.slice(-10).map((t, ti) => (
                            <div
                              key={ti}
                              className="flex-1 rounded-sm transition-all"
                              style={{
                                height: `${Math.max(4, t.engagement)}%`,
                                backgroundColor: engColor(t.engagement),
                              }}
                            />
                          ))}
                        </div>
                      )}

                      {/* Expand arrow */}
                      <span className={`text-gray-500 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                        ▼
                      </span>
                    </button>

                    {/* ── Expanded Detail ───────────────────────── */}
                    {isExpanded && (
                      <div className="border-t border-white/5 p-5 space-y-4">
                        {/* Full trend chart */}
                        {s.trend.length > 0 ? (
                          <div>
                            <h4 className="text-gray-400 text-xs font-bold uppercase mb-3">
                              Engagement Over Time ({s.trend.length} sessions)
                            </h4>
                            <div className="flex items-end gap-2 h-36">
                              {s.trend.map((t, ti) => {
                                const height = Math.max(5, t.engagement)
                                return (
                                  <div key={ti} className="flex-1 flex flex-col items-center gap-1">
                                    <span className="text-[9px] text-gray-500">{t.engagement}%</span>
                                    <div
                                      className="w-full rounded-t-lg transition-all duration-500"
                                      style={{
                                        height: `${height}%`,
                                        background: `linear-gradient(to top, ${engColor(t.engagement)}80, ${engColor(t.engagement)})`,
                                      }}
                                      title={`${t.engagement}% — ${t.emotion || 'N/A'}`}
                                    />
                                    <span className="text-[8px] text-gray-600 -rotate-45 origin-top-left w-12 truncate">
                                      {t.date ? new Date(t.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : ''}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-6 text-gray-500 text-sm">
                            No session data yet for this student.
                          </div>
                        )}

                        {/* Improvement analysis */}
                        {s.trend.length >= 2 && (
                          <div className="grid grid-cols-3 gap-3">
                            <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
                              <div className="text-sm font-bold" style={{ color: engColor(s.trend[0]?.engagement || 0) }}>
                                {s.trend[0]?.engagement || 0}%
                              </div>
                              <div className="text-[10px] text-gray-500">First Session</div>
                            </div>
                            <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
                              <div className="text-sm font-bold" style={{ color: engColor(s.trend[s.trend.length - 1]?.engagement || 0) }}>
                                {s.trend[s.trend.length - 1]?.engagement || 0}%
                              </div>
                              <div className="text-[10px] text-gray-500">Latest Session</div>
                            </div>
                            <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
                              <div className="text-sm font-bold" style={{ color: improvementColor }}>
                                {improvementLabel}
                              </div>
                              <div className="text-[10px] text-gray-500">Overall Trend</div>
                            </div>
                          </div>
                        )}

                        {/* Emotion breakdown per session */}
                        {s.trend.length > 0 && (
                          <div>
                            <h4 className="text-gray-400 text-xs font-bold uppercase mb-2">
                              Dominant Emotions Over Sessions
                            </h4>
                            <div className="flex gap-1 flex-wrap">
                              {s.trend.map((t, ti) => {
                                const EMOJIS = {
                                  anger: '😠', disgust: '🤢', fear: '😨',
                                  happiness: '😊', neutral: '😐', sadness: '😢', surprise: '😲',
                                }
                                return (
                                  <div
                                    key={ti}
                                    className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-sm"
                                    title={`Session ${ti + 1}: ${t.emotion || 'N/A'} (${t.engagement}%)`}
                                  >
                                    {EMOJIS[t.emotion] || '❓'}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </GlassCard>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
