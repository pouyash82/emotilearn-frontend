import { useState, useEffect } from 'react'
import GlassCard from '../components/GlassCard'
import API from '../api'

const EMOTION_COLORS = {
  anger:     { bg: 'bg-red-500',    hex: '#ef4444', emoji: '😠' },
  disgust:   { bg: 'bg-violet-500', hex: '#8b5cf6', emoji: '🤢' },
  fear:      { bg: 'bg-orange-500', hex: '#f97316', emoji: '😨' },
  happiness: { bg: 'bg-green-500',  hex: '#22c55e', emoji: '😊' },
  neutral:   { bg: 'bg-gray-500',   hex: '#6b7280', emoji: '😐' },
  sadness:   { bg: 'bg-blue-500',   hex: '#3b82f6', emoji: '😢' },
  surprise:  { bg: 'bg-yellow-500', hex: '#eab308', emoji: '😲' },
}

const engColor = (v) => v >= 65 ? '#22c55e' : v >= 40 ? '#eab308' : '#ef4444'
const statusColor = (s) => s === 'active' ? 'bg-green-500' : s === 'recent' ? 'bg-yellow-500' : 'bg-gray-600'
const statusLabel = (s) => s === 'active' ? 'Active Now' : s === 'recent' ? 'Today' : 'Inactive'

export default function EngagementHeatmap({ courses }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(false)

  const loadHeatmap = (courseId) => {
    setLoading(true)
    const url = courseId ? `/teacher/heatmap?course_id=${courseId}` : '/teacher/heatmap'
    API.get(url)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadHeatmap(selectedCourse)
  }, [selectedCourse])

  // Auto-refresh every 10 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => loadHeatmap(selectedCourse), 10000)
    return () => clearInterval(interval)
  }, [autoRefresh, selectedCourse])

  if (loading && !data) {
    return (
      <GlassCard className="p-8 text-center">
        <div className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-400 text-sm">Loading engagement heatmap...</p>
      </GlassCard>
    )
  }

  const summary = data?.summary || {}
  const students = data?.students || []

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Controls ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Course filter */}
        <select
          value={selectedCourse || ''}
          onChange={(e) => setSelectedCourse(e.target.value ? parseInt(e.target.value) : null)}
          className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-amber-500/50"
        >
          <option value="">All Students</option>
          {(courses || []).map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Auto-refresh toggle */}
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            autoRefresh
              ? 'bg-green-500/20 border border-green-500/30 text-green-400'
              : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
          }`}
        >
          {autoRefresh ? '🔴 Live (10s)' : '⏸ Auto-refresh Off'}
        </button>

        {/* Manual refresh */}
        <button
          onClick={() => loadHeatmap(selectedCourse)}
          className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm hover:bg-white/10 transition-all"
        >
          🔄 Refresh
        </button>
      </div>

      {/* ── Summary Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-4">
        <GlassCard className="p-4 text-center">
          <div className="text-2xl font-black text-white">{summary.total || 0}</div>
          <div className="text-xs text-gray-500">Total Students</div>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <div className="text-2xl font-black text-green-400">{summary.active || 0}</div>
          <div className="text-xs text-gray-500">Active Now</div>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <div className="text-2xl font-black" style={{ color: engColor(summary.avg_engagement || 0) }}>
            {summary.avg_engagement || 0}%
          </div>
          <div className="text-xs text-gray-500">Avg Engagement</div>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <div className="text-2xl font-black text-green-400">{summary.engaged || 0}</div>
          <div className="text-xs text-gray-500">Engaged</div>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <div className="text-2xl font-black text-red-400">{summary.confused || 0}</div>
          <div className="text-xs text-gray-500">Confused/Struggling</div>
        </GlassCard>
      </div>

      {/* ── Emotion Breakdown ────────────────────────────────────── */}
      {summary.emotion_breakdown && Object.keys(summary.emotion_breakdown).length > 0 && (
        <GlassCard className="p-5">
          <h3 className="text-white font-bold mb-3 text-sm">Class Emotion Breakdown</h3>
          <div className="flex gap-3 flex-wrap">
            {Object.entries(summary.emotion_breakdown)
              .sort((a, b) => b[1] - a[1])
              .map(([emo, count]) => (
                <div
                  key={emo}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full border"
                  style={{
                    backgroundColor: `${EMOTION_COLORS[emo]?.hex || '#6b7280'}15`,
                    borderColor: `${EMOTION_COLORS[emo]?.hex || '#6b7280'}30`,
                  }}
                >
                  <span className="text-sm">{EMOTION_COLORS[emo]?.emoji || '❓'}</span>
                  <span className="text-xs capitalize" style={{ color: EMOTION_COLORS[emo]?.hex }}>{emo}</span>
                  <span className="text-xs font-bold text-white">{count}</span>
                </div>
              ))}
          </div>
        </GlassCard>
      )}

      {/* ── Student Grid (Heatmap) ───────────────────────────────── */}
      <GlassCard className="p-6">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
          🗺️ Student Engagement Heatmap
        </h3>

        {students.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">👨‍🎓</div>
            <p className="text-gray-400">No students found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {students.map(s => {
              const ec = engColor(s.engagement || 0)
              const emoInfo = EMOTION_COLORS[s.emotion] || EMOTION_COLORS.neutral
              const borderColor = s.status === 'active'
                ? 'border-green-500/40'
                : s.status === 'recent'
                  ? 'border-amber-500/20'
                  : 'border-white/5'

              return (
                <div
                  key={s.id}
                  className={`relative bg-white/5 rounded-2xl p-4 border ${borderColor} hover:bg-white/10 transition-all duration-300 group`}
                  style={{
                    boxShadow: s.engagement >= 65
                      ? '0 0 20px rgba(34, 197, 94, 0.1)'
                      : s.engagement < 40
                        ? '0 0 20px rgba(239, 68, 68, 0.1)'
                        : 'none',
                  }}
                >
                  {/* Status dot */}
                  <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${statusColor(s.status)}`}
                    title={statusLabel(s.status)} />

                  {/* Avatar */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold mx-auto mb-2"
                    style={{
                      background: `linear-gradient(135deg, ${emoInfo.hex}80, ${emoInfo.hex}40)`,
                    }}
                  >
                    {s.name?.charAt(0) || '?'}
                  </div>

                  {/* Name */}
                  <div className="text-white text-sm font-medium text-center truncate">{s.name}</div>

                  {/* Emotion */}
                  <div className="text-center mt-1">
                    <span className="text-lg">{emoInfo.emoji}</span>
                    <span className="text-xs capitalize ml-1" style={{ color: emoInfo.hex }}>
                      {s.emotion || 'N/A'}
                    </span>
                  </div>

                  {/* Engagement bar */}
                  <div className="mt-2">
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${s.engagement || 0}%`, backgroundColor: ec }}
                      />
                    </div>
                    <div className="text-center mt-1">
                      <span className="text-xs font-bold" style={{ color: ec }}>
                        {s.engagement || 0}%
                      </span>
                    </div>
                  </div>

                  {/* Hover: extra info */}
                  <div className="text-[10px] text-gray-600 text-center mt-1">
                    {s.total_sessions} sessions
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </GlassCard>
    </div>
  )
}
