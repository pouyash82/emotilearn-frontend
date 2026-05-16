import { useState, useEffect } from 'react'
import GlassCard from '../components/GlassCard'
import API from '../api'

const engColor = (v) => v >= 65 ? '#22c55e' : v >= 40 ? '#eab308' : '#ef4444'

const LEVEL_CONFIG = {
  engaged:    { color: '#22c55e', bg: 'bg-green-500/10',  border: 'border-green-500/20', label: 'Engaged',    emoji: '🟢' },
  passive:    { color: '#eab308', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', label: 'Passive',    emoji: '🟡' },
  disengaged: { color: '#ef4444', bg: 'bg-red-500/10',    border: 'border-red-500/20',    label: 'Disengaged', emoji: '🔴' },
  absent:     { color: '#6b7280', bg: 'bg-gray-500/10',   border: 'border-gray-500/20',   label: 'Absent',     emoji: '⚪' },
}

const fmtDate = (iso) => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch { return '—' }
}

export default function AttendanceEngagement({ courses }) {
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selectedCourse) { setData(null); return }
    setLoading(true)
    API.get(`/teacher/attendance/${selectedCourse}`)
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
            onChange={(e) => setSelectedCourse(e.target.value ? parseInt(e.target.value) : null)}
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
          <div className="text-5xl mb-4">📋</div>
          <p className="text-gray-400">Select a course to view attendance and engagement data.</p>
        </GlassCard>
      )}

      {loading && (
        <GlassCard className="p-8 text-center">
          <div className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading attendance data...</p>
        </GlassCard>
      )}

      {data && !loading && (
        <>
          {/* ── Summary Stats ────────────────────────────────────── */}
          <div className="grid grid-cols-6 gap-3">
            <GlassCard className="p-4 text-center">
              <div className="text-2xl font-black text-white">{data.summary.total_enrolled}</div>
              <div className="text-[10px] text-gray-500">Enrolled</div>
            </GlassCard>
            <GlassCard className="p-4 text-center">
              <div className="text-2xl font-black text-green-400">{data.summary.engaged}</div>
              <div className="text-[10px] text-gray-500">Engaged</div>
            </GlassCard>
            <GlassCard className="p-4 text-center">
              <div className="text-2xl font-black text-yellow-400">{data.summary.passive}</div>
              <div className="text-[10px] text-gray-500">Passive</div>
            </GlassCard>
            <GlassCard className="p-4 text-center">
              <div className="text-2xl font-black text-red-400">{data.summary.disengaged}</div>
              <div className="text-[10px] text-gray-500">Disengaged</div>
            </GlassCard>
            <GlassCard className="p-4 text-center">
              <div className="text-2xl font-black text-gray-400">{data.summary.absent}</div>
              <div className="text-[10px] text-gray-500">Absent</div>
            </GlassCard>
            <GlassCard className="p-4 text-center">
              <div className="text-2xl font-black" style={{ color: engColor(data.summary.class_avg_engagement) }}>
                {data.summary.class_avg_engagement}%
              </div>
              <div className="text-[10px] text-gray-500">Class Avg</div>
            </GlassCard>
          </div>

          {/* ── Visual Breakdown Bar ──────────────────────────────── */}
          <GlassCard className="p-5">
            <h3 className="text-white font-bold mb-3 text-sm">{data.summary.course_name} — Engagement Breakdown</h3>
            <div className="flex h-6 rounded-full overflow-hidden">
              {['engaged', 'passive', 'disengaged', 'absent'].map(level => {
                const count = data.summary[level] || 0
                const pct = data.summary.total_enrolled > 0
                  ? (count / data.summary.total_enrolled) * 100 : 0
                if (pct === 0) return null
                return (
                  <div
                    key={level}
                    className="h-full flex items-center justify-center text-[10px] font-bold text-white transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: LEVEL_CONFIG[level].color,
                      minWidth: pct > 0 ? '20px' : '0',
                    }}
                    title={`${LEVEL_CONFIG[level].label}: ${count} (${Math.round(pct)}%)`}
                  >
                    {pct >= 10 ? `${Math.round(pct)}%` : ''}
                  </div>
                )
              })}
            </div>
            <div className="flex gap-4 mt-2">
              {['engaged', 'passive', 'disengaged', 'absent'].map(level => (
                <div key={level} className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: LEVEL_CONFIG[level].color }} />
                  <span className="text-[10px] text-gray-500">{LEVEL_CONFIG[level].label}</span>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* ── Student List ──────────────────────────────────────── */}
          <GlassCard className="p-6">
            <h3 className="text-white font-bold mb-4">Student Attendance & Engagement</h3>

            {data.attendance.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No enrolled students</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.attendance.map((s, i) => {
                  const cfg = LEVEL_CONFIG[s.level] || LEVEL_CONFIG.absent
                  return (
                    <div
                      key={s.id}
                      className={`flex items-center gap-4 p-4 rounded-2xl border ${cfg.border} ${cfg.bg} transition-all duration-300 animate-fade-in-up`}
                      style={{ animationDelay: `${i * 30}ms` }}
                    >
                      {/* Avatar */}
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shrink-0"
                        style={{ backgroundColor: `${cfg.color}40` }}
                      >
                        {s.name?.charAt(0) || '?'}
                      </div>

                      {/* Name & email */}
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium text-sm truncate">{s.name}</div>
                        <div className="text-gray-500 text-xs truncate">{s.email}</div>
                      </div>

                      {/* Sessions */}
                      <div className="text-center shrink-0">
                        <div className="text-white font-bold text-sm">{s.total_sessions}</div>
                        <div className="text-[10px] text-gray-500">Sessions</div>
                      </div>

                      {/* Engagement */}
                      <div className="text-center shrink-0 w-20">
                        <div className="font-bold text-sm" style={{ color: engColor(s.avg_engagement) }}>
                          {s.avg_engagement}%
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${s.avg_engagement}%`, backgroundColor: engColor(s.avg_engagement) }}
                          />
                        </div>
                      </div>

                      {/* Last emotion */}
                      <div className="text-center shrink-0 w-20">
                        <div className="text-sm font-medium text-blue-400 capitalize">
                          {s.last_emotion || '—'}
                        </div>
                        <div className="text-[10px] text-gray-500">Last Emotion</div>
                      </div>

                      {/* Status badge */}
                      <div
                        className="px-3 py-1 rounded-full text-xs font-bold shrink-0"
                        style={{ color: cfg.color, backgroundColor: `${cfg.color}20`, border: `1px solid ${cfg.color}30` }}
                      >
                        {cfg.emoji} {cfg.label}
                      </div>

                      {/* Last session */}
                      <div className="text-[10px] text-gray-600 shrink-0 w-24 text-right">
                        {fmtDate(s.last_session)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </GlassCard>
        </>
      )}
    </div>
  )
}
