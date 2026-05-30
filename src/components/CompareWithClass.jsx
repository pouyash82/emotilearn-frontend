import { useState, useEffect } from 'react'
import GlassCard from './GlassCard'
import API from '../api'

const EMOTION_COLORS = { anger:'#ef4444', disgust:'#8b5cf6', fear:'#f97316', happiness:'#22c55e', neutral:'#6b7280', sadness:'#3b82f6', surprise:'#eab308' }
const engColor = (v) => v >= 65 ? '#22c55e' : v >= 40 ? '#eab308' : '#ef4444'

export default function CompareWithClass() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { API.get('/students/compare-class').then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false)) }, [])

  if (loading) return (
    <GlassCard className="p-8 text-center">
      <div className="w-5 h-5 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin mx-auto mb-3" />
      <p className="text-gray-500 text-sm">Loading comparison...</p>
    </GlassCard>
  )

  if (!data || !data.student || data.student.total_sessions === 0) return (
    <GlassCard className="p-8 text-center">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="1.5" className="mx-auto mb-3"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
      <p className="text-gray-500">Complete at least one session to see class comparison.</p>
    </GlassCard>
  )

  const { student, class_average } = data
  const engDiff = student.avg_engagement - class_average.avg_engagement
  const engDiffLabel = engDiff > 0 ? `+${engDiff.toFixed(1)}% above` : engDiff < 0 ? `${engDiff.toFixed(1)}% below` : 'Equal to'
  const allEmotions = [...new Set([...Object.keys(student.distribution || {}), ...Object.keys(class_average.distribution || {})])].sort()

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header stats */}
      <div className="grid grid-cols-3 gap-4">
        <GlassCard variant="stat" accent="indigo" className="p-5 text-center">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Your Engagement</span>
          <div className="text-3xl font-bold text-gradient mt-2">{student.avg_engagement}%</div>
          <div className={`text-xs font-semibold mt-2 px-2.5 py-1 rounded-lg inline-block ${engDiff >= 0 ? 'bg-green-500/10 text-green-400 border border-green-500/15' : 'bg-red-500/10 text-red-400 border border-red-500/15'}`}>
            {engDiffLabel} class avg
          </div>
        </GlassCard>

        <GlassCard variant="stat" accent="teal" className="p-5 text-center">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Class Average</span>
          <div className="text-3xl font-bold text-gray-300 mt-2">{class_average.avg_engagement}%</div>
          <div className="text-xs text-gray-600 mt-2">{class_average.total_students} students</div>
        </GlassCard>

        <GlassCard variant="stat" accent="amber" className="p-5 text-center">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Your Rank</span>
          <div className="text-3xl font-bold text-gradient-warm mt-2">#{student.rank}</div>
          <div className="text-xs text-gray-600 mt-2">of {class_average.total_students} students</div>
        </GlassCard>
      </div>

      {/* Engagement comparison bar */}
      <GlassCard className="p-5">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Engagement Comparison</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs mb-1"><span className="text-indigo-400 font-medium">You</span><span className="text-indigo-400 font-bold">{student.avg_engagement}%</span></div>
            <div className="h-3 bg-white/5 rounded-full overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-1000" style={{ width: `${Math.min(100, student.avg_engagement)}%` }} /></div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1"><span className="text-gray-500 font-medium">Class Average</span><span className="text-gray-500 font-bold">{class_average.avg_engagement}%</span></div>
            <div className="h-3 bg-white/5 rounded-full overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-gray-600 to-gray-500 transition-all duration-1000" style={{ width: `${Math.min(100, class_average.avg_engagement)}%` }} /></div>
          </div>
        </div>
      </GlassCard>

      {/* Emotion distribution comparison */}
      <GlassCard className="p-5">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Emotion Distribution — You vs Class</h3>
        <div className="space-y-3">
          {allEmotions.map(emo => {
            const myPct = student.distribution?.[emo] || 0
            const classPct = class_average.distribution?.[emo] || 0
            const maxPct = Math.max(myPct, classPct, 1)
            return (
              <div key={emo}>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full" style={{ background: EMOTION_COLORS[emo] }} />
                  <span className="text-xs text-white font-medium capitalize w-20">{emo}</span>
                  <span className="text-indigo-400 text-xs font-bold ml-auto">{myPct}%</span>
                  <span className="text-gray-600 text-xs">vs</span>
                  <span className="text-gray-500 text-xs font-bold">{classPct}%</span>
                </div>
                <div className="flex gap-1">
                  <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${(myPct / maxPct) * 100}%`, background: EMOTION_COLORS[emo] }} /></div>
                  <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${(classPct / maxPct) * 100}%`, background: EMOTION_COLORS[emo], opacity: 0.3 }} /></div>
                </div>
                <div className="flex text-[9px] text-gray-700 mt-0.5"><span className="flex-1">You</span><span className="flex-1">Class</span></div>
              </div>
            )
          })}
        </div>
      </GlassCard>

      {/* Session stats */}
      <GlassCard className="p-5">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Session Stats</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Your Sessions', value: student.total_sessions, color: 'text-white' },
            { label: 'Class Total', value: class_average.total_sessions, color: 'text-gray-400' },
            { label: 'Your Detections', value: student.total_detections, color: 'text-white' },
            { label: 'Class Total', value: class_average.total_detections, color: 'text-gray-400' },
          ].map(s => (
            <div key={s.label} className="glass-subtle rounded-xl p-3">
              <div className="text-[10px] text-gray-600">{s.label}</div>
              <div className={`text-xl font-bold ${s.color} mt-0.5`}>{s.value}</div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Engagement trend */}
      {student.trend?.length > 1 && (
        <GlassCard className="p-5">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Your Engagement Trend (Last 10)</h3>
          <div className="flex items-end gap-1.5 h-28">
            {student.trend.map((p, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <span className="text-[9px] text-gray-600">{p.engagement}%</span>
                <div className="w-full rounded-t-sm transition-all duration-500" style={{ height: `${Math.max(5, p.engagement)}%`, background: engColor(p.engagement) }} />
                <span className="text-[8px] text-gray-700">{p.date ? new Date(p.date).toLocaleDateString('en', { month:'short', day:'numeric' }) : ''}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-600">
            <div className="w-6 h-px bg-gray-600" />
            Class avg: {class_average.avg_engagement}%
          </div>
        </GlassCard>
      )}
    </div>
  )
}
