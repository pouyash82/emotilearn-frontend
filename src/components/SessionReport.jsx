import { useState, useEffect } from 'react'
import GlassCard from './GlassCard'

const EMOTION_COLORS = {
  anger:     { hex: '#ef4444', label: 'Anger' },
  disgust:   { hex: '#8b5cf6', label: 'Disgust' },
  fear:      { hex: '#f97316', label: 'Fear' },
  happiness: { hex: '#22c55e', label: 'Happiness' },
  neutral:   { hex: '#6b7280', label: 'Neutral' },
  sadness:   { hex: '#3b82f6', label: 'Sadness' },
  surprise:  { hex: '#eab308', label: 'Surprise' },
}

const engColor = (v) => v >= 65 ? '#22c55e' : v >= 40 ? '#eab308' : '#ef4444'

export default function SessionReport({ sessionData, onClose }) {
  const [report, setReport] = useState(null)

  useEffect(() => { if (sessionData) generateReport(sessionData) }, [sessionData])
  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = 'auto' } }, [])

  const generateReport = (data) => {
    const { emotionHistory, duration, totalDetections } = data
    const emotionCounts = {}, emotionScores = {}
    emotionHistory.forEach(entry => {
      emotionCounts[entry.emotion] = (emotionCounts[entry.emotion] || 0) + 1
      if (entry.scores) Object.entries(entry.scores).forEach(([e, s]) => { if (!emotionScores[e]) emotionScores[e] = []; emotionScores[e].push(s) })
    })
    const total = emotionHistory.length || 1
    const emotionDistribution = {}
    Object.entries(emotionCounts).forEach(([e, c]) => { emotionDistribution[e] = Math.round((c / total) * 100) })
    const avgScores = {}
    Object.entries(emotionScores).forEach(([e, s]) => { avgScores[e] = Math.round(s.reduce((a, b) => a + b, 0) / s.length) })
    const dominantEmotion = Object.entries(emotionDistribution).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral'
    let positiveScore = 0
    ;['happiness', 'surprise'].forEach(e => positiveScore += (avgScores[e] || 0))
    const engagementScore = Math.min(100, Math.max(0, 50 + (positiveScore / 2)))
    const recommendations = []
    if (emotionDistribution.sadness > 20) recommendations.push('High sadness detected — consider taking breaks between sessions.')
    if (emotionDistribution.happiness > 30 && engagementScore > 70) recommendations.push('Excellent engagement! Keep this rhythm going.')
    if (emotionDistribution.neutral > 60) recommendations.push('Try more interactive content to boost engagement.')
    if (recommendations.length === 0) recommendations.push('Good session overall. Keep it up!')
    setReport({ duration, totalDetections, emotionDistribution, avgScores, dominantEmotion, engagementScore: Math.round(engagementScore), recommendations, timestamp: new Date().toLocaleString() })
  }

  const formatDuration = (s) => `${Math.floor(s / 60)}m ${s % 60}s`

  const downloadReport = () => {
    if (!report) return
    const text = `EMOTILEARN SESSION REPORT\n\nGenerated: ${report.timestamp}\nDuration: ${formatDuration(report.duration)}\nDetections: ${report.totalDetections}\nEngagement: ${report.engagementScore}%\nDominant: ${report.dominantEmotion}\n\nEMOTION DISTRIBUTION:\n${Object.entries(report.emotionDistribution).map(([e,p]) => `${e}: ${p}%`).join('\n')}\n\nRECOMMENDATIONS:\n${report.recommendations.join('\n')}`
    const blob = new Blob([text], { type: 'text/plain' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `EmotiLearn_Report_${new Date().toISOString().slice(0,10)}.txt`; a.click()
  }

  if (!report) return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="glass-heavy rounded-2xl p-8 flex items-center gap-3"><div className="w-5 h-5 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" /><span className="text-white text-sm">Generating report...</span></div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" style={{ overflowY: 'scroll', WebkitOverflowScrolling: 'touch' }}>
      <div className="flex justify-center px-4 py-8">
        <div className="w-full max-w-2xl animate-fade-in-up">
          <div className="glass-heavy rounded-2xl p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-white">Session Report</h2>
              <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              {[
                { label: 'Duration', value: formatDuration(report.duration) },
                { label: 'Detections', value: report.totalDetections },
                { label: 'Engagement', value: `${report.engagementScore}%`, color: engColor(report.engagementScore) },
                { label: 'Dominant', value: report.dominantEmotion, color: EMOTION_COLORS[report.dominantEmotion]?.hex },
              ].map(s => (
                <div key={s.label} className="glass-subtle rounded-xl p-3 text-center">
                  <div className="text-lg font-bold truncate capitalize" style={s.color ? { color: s.color } : { color: 'white' }}>{s.value}</div>
                  <div className="text-[10px] text-gray-600 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Distribution */}
            <div className="glass-subtle rounded-xl p-4 mb-5">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Emotion Distribution</h3>
              <div className="space-y-2">
                {Object.entries(report.emotionDistribution).sort((a,b) => b[1]-a[1]).map(([emotion, pct]) => (
                  <div key={emotion} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: EMOTION_COLORS[emotion]?.hex }} />
                    <span className="w-20 text-gray-400 capitalize text-xs">{emotion}</span>
                    <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: EMOTION_COLORS[emotion]?.hex }} />
                    </div>
                    <span className="w-10 text-right font-bold text-xs" style={{ color: EMOTION_COLORS[emotion]?.hex }}>{pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendations */}
            <div className="glass-subtle rounded-xl p-4 mb-5">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Recommendations</h3>
              <div className="space-y-2">
                {report.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" className="mt-0.5 flex-shrink-0"><path d="M9 18l6-6-6-6"/></svg>
                    {rec}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={downloadReport} className="flex-1 btn-primary py-3 text-sm flex items-center justify-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download Report
              </button>
              <button onClick={onClose} className="btn-secondary py-3 px-6 text-sm">Close</button>
            </div>
          </div>
          <div className="h-8" />
        </div>
      </div>
    </div>
  )
}
