import { useState, useEffect } from 'react'
import GlassCard from './GlassCard'
import API from '../api'

const EMOTION_COLORS = {
  anger:     '#ef4444',
  disgust:   '#8b5cf6',
  fear:      '#f97316',
  happiness: '#22c55e',
  neutral:   '#6b7280',
  sadness:   '#3b82f6',
  surprise:  '#eab308',
}

const EMOTION_EMOJIS = {
  anger: '😠', disgust: '🤢', fear: '😨',
  happiness: '😊', neutral: '😐', sadness: '😢', surprise: '😲',
}

export default function CompareWithClass() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    API.get('/students/compare-class')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <GlassCard className="p-8 text-center">
        <div className="w-6 h-6 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-400 text-sm">Loading class comparison...</p>
      </GlassCard>
    )
  }

  if (!data || !data.student || data.student.total_sessions === 0) {
    return (
      <GlassCard className="p-8 text-center">
        <div className="text-4xl mb-3">📊</div>
        <p className="text-gray-400">Complete at least one session to see how you compare with the class.</p>
      </GlassCard>
    )
  }

  const { student, class_average } = data
  const engDiff = student.avg_engagement - class_average.avg_engagement
  const engDiffLabel = engDiff > 0
    ? `+${engDiff.toFixed(1)}% above`
    : engDiff < 0
      ? `${engDiff.toFixed(1)}% below`
      : 'Equal to'

  const allEmotions = [...new Set([
    ...Object.keys(student.distribution || {}),
    ...Object.keys(class_average.distribution || {}),
  ])].sort()

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header Stats ────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <GlassCard className="p-5 text-center">
          <div className="text-3xl font-black bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            {student.avg_engagement}%
          </div>
          <div className="text-xs text-gray-500 mt-1">Your Engagement</div>
          <div className={`text-xs font-bold mt-2 px-2 py-1 rounded-full inline-block ${
            engDiff >= 0
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            {engDiffLabel} class avg
          </div>
        </GlassCard>

        <GlassCard className="p-5 text-center">
          <div className="text-3xl font-black text-gray-300">
            {class_average.avg_engagement}%
          </div>
          <div className="text-xs text-gray-500 mt-1">Class Average</div>
          <div className="text-xs text-gray-600 mt-2">
            {class_average.total_students} students
          </div>
        </GlassCard>

        <GlassCard className="p-5 text-center">
          <div className="text-3xl font-black bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
            #{student.rank}
          </div>
          <div className="text-xs text-gray-500 mt-1">Your Rank</div>
          <div className="text-xs text-gray-600 mt-2">
            of {class_average.total_students} students
          </div>
        </GlassCard>
      </div>

      {/* ── Engagement Comparison Bar ───────────────────────────── */}
      <GlassCard className="p-6">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
          ⚡ Engagement Comparison
        </h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-blue-400 font-medium">You</span>
              <span className="text-blue-400 font-bold">{student.avg_engagement}%</span>
            </div>
            <div className="w-full h-4 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-1000"
                style={{ width: `${Math.min(100, student.avg_engagement)}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400 font-medium">Class Average</span>
              <span className="text-gray-400 font-bold">{class_average.avg_engagement}%</span>
            </div>
            <div className="w-full h-4 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-gray-500 to-gray-400 transition-all duration-1000"
                style={{ width: `${Math.min(100, class_average.avg_engagement)}%` }}
              />
            </div>
          </div>
        </div>
      </GlassCard>

      {/* ── Emotion Distribution Comparison ─────────────────────── */}
      <GlassCard className="p-6">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
          🎭 Emotion Distribution — You vs Class
        </h3>
        <div className="space-y-3">
          {allEmotions.map(emo => {
            const myPct = student.distribution?.[emo] || 0
            const classPct = class_average.distribution?.[emo] || 0
            const maxPct = Math.max(myPct, classPct, 1)
            return (
              <div key={emo}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{EMOTION_EMOJIS[emo] || '❓'}</span>
                  <span className="text-white text-sm font-medium capitalize w-20">{emo}</span>
                  <span className="text-blue-400 text-xs font-bold ml-auto">{myPct}%</span>
                  <span className="text-gray-500 text-xs">vs</span>
                  <span className="text-gray-400 text-xs font-bold">{classPct}%</span>
                </div>
                <div className="flex gap-1 items-center">
                  <div className="flex-1 h-2.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${(myPct / maxPct) * 100}%`,
                        backgroundColor: EMOTION_COLORS[emo] || '#6b7280',
                        opacity: 1,
                      }}
                    />
                  </div>
                  <div className="flex-1 h-2.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${(classPct / maxPct) * 100}%`,
                        backgroundColor: EMOTION_COLORS[emo] || '#6b7280',
                        opacity: 0.35,
                      }}
                    />
                  </div>
                </div>
                <div className="flex text-[10px] text-gray-600 mt-0.5">
                  <span className="flex-1">You</span>
                  <span className="flex-1">Class</span>
                </div>
              </div>
            )
          })}
        </div>
      </GlassCard>

      {/* ── Session Stats ───────────────────────────────────────── */}
      <GlassCard className="p-6">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
          📈 Session Stats
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
            <div className="text-xs text-gray-500 mb-1">Your Sessions</div>
            <div className="text-2xl font-bold text-white">{student.total_sessions}</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
            <div className="text-xs text-gray-500 mb-1">Class Total Sessions</div>
            <div className="text-2xl font-bold text-gray-400">{class_average.total_sessions}</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
            <div className="text-xs text-gray-500 mb-1">Your Detections</div>
            <div className="text-2xl font-bold text-white">{student.total_detections}</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
            <div className="text-xs text-gray-500 mb-1">Class Total Detections</div>
            <div className="text-2xl font-bold text-gray-400">{class_average.total_detections}</div>
          </div>
        </div>
      </GlassCard>

      {/* ── Engagement Trend ────────────────────────────────────── */}
      {student.trend && student.trend.length > 1 && (
        <GlassCard className="p-6">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2">
            📉 Your Engagement Trend (Last 10 Sessions)
          </h3>
          <div className="flex items-end gap-2 h-32">
            {student.trend.map((point, i) => {
              const height = Math.max(5, point.engagement)
              const color = point.engagement >= 65
                ? 'from-green-500 to-emerald-500'
                : point.engagement >= 40
                  ? 'from-yellow-500 to-amber-500'
                  : 'from-red-500 to-rose-500'
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-gray-500">{point.engagement}%</span>
                  <div
                    className={`w-full rounded-t-lg bg-gradient-to-t ${color} transition-all duration-500`}
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-[9px] text-gray-600">
                    {point.date ? new Date(point.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : ''}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
            <div className="w-8 h-0.5 bg-gray-500" />
            <span>Class avg: {class_average.avg_engagement}%</span>
          </div>
        </GlassCard>
      )}
    </div>
  )
}
