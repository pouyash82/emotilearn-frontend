import { useState, useEffect } from 'react'
import GlassCard from './GlassCard'

const EMOTION_COLORS = {
  anger: { bg: 'bg-red-500', hex: '#ef4444', emoji: '😠' },
  disgust: { bg: 'bg-violet-500', hex: '#8b5cf6', emoji: '🤢' },
  fear: { bg: 'bg-orange-500', hex: '#f97316', emoji: '😨' },
  happiness: { bg: 'bg-green-500', hex: '#22c55e', emoji: '😊' },
  neutral: { bg: 'bg-gray-500', hex: '#6b7280', emoji: '😐' },
  sadness: { bg: 'bg-blue-500', hex: '#3b82f6', emoji: '😢' },
  surprise: { bg: 'bg-yellow-500', hex: '#eab308', emoji: '😲' },
}

export default function SessionReport({ sessionData, onClose }) {
  const [report, setReport] = useState(null)

  useEffect(() => {
    if (sessionData) generateReport(sessionData)
  }, [sessionData])

  const generateReport = (data) => {
    const { emotionHistory, duration, totalDetections } = data
    const emotionCounts = {}
    const emotionScores = {}
    
    emotionHistory.forEach(entry => {
      emotionCounts[entry.emotion] = (emotionCounts[entry.emotion] || 0) + 1
      if (entry.scores) {
        Object.entries(entry.scores).forEach(([emotion, score]) => {
          if (!emotionScores[emotion]) emotionScores[emotion] = []
          emotionScores[emotion].push(score)
        })
      }
    })

    const total = emotionHistory.length || 1
    const emotionDistribution = {}
    Object.entries(emotionCounts).forEach(([emotion, count]) => {
      emotionDistribution[emotion] = Math.round((count / total) * 100)
    })

    const avgScores = {}
    Object.entries(emotionScores).forEach(([emotion, scores]) => {
      avgScores[emotion] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    })

    const dominantEmotion = Object.entries(emotionDistribution)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral'

    const positiveEmotions = ['happiness', 'surprise']
    let positiveScore = 0
    positiveEmotions.forEach(e => positiveScore += (avgScores[e] || 0))
    const engagementScore = Math.min(100, Math.max(0, 50 + (positiveScore / 2)))

    const recommendations = []
    if (emotionDistribution.sadness > 20) recommendations.push("High sadness detected - consider taking breaks")
    if (emotionDistribution.happiness > 30 && engagementScore > 70) recommendations.push("Excellent engagement! Keep it up!")
    if (emotionDistribution.neutral > 60) recommendations.push("Try more interactive content to boost engagement")
    if (recommendations.length === 0) recommendations.push("Good session overall!")

    setReport({
      duration, totalDetections, emotionDistribution, avgScores,
      dominantEmotion, engagementScore: Math.round(engagementScore),
      recommendations, timestamp: new Date().toLocaleString()
    })
  }

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  const downloadReport = () => {
    if (!report) return
    const text = `EMOTILEARN SESSION REPORT\n\nGenerated: ${report.timestamp}\nDuration: ${formatDuration(report.duration)}\nDetections: ${report.totalDetections}\nEngagement: ${report.engagementScore}%\nDominant: ${report.dominantEmotion}\n\nEMOTION DISTRIBUTION:\n${Object.entries(report.emotionDistribution).map(([e,p]) => `${e}: ${p}%`).join('\n')}\n\nRECOMMENDATIONS:\n${report.recommendations.join('\n')}`
    const blob = new Blob([text], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `EmotiLearn_Report_${new Date().toISOString().slice(0,10)}.txt`
    a.click()
  }

  if (!report) return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <GlassCard className="p-8"><div className="text-white">Generating report...</div></GlassCard>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-auto">
      <GlassCard className="p-6 max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="flex justify-between mb-6">
          <h2 className="text-2xl font-black text-white">📊 Session Report</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Duration', value: formatDuration(report.duration), icon: '⏱️' },
            { label: 'Detections', value: report.totalDetections, icon: '📸' },
            { label: 'Engagement', value: `${report.engagementScore}%`, icon: '⚡' },
            { label: 'Dominant', value: report.dominantEmotion, icon: EMOTION_COLORS[report.dominantEmotion]?.emoji || '😐' },
          ].map(stat => (
            <div key={stat.label} className="bg-white/5 rounded-xl p-4 text-center">
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className="text-xl font-bold text-white">{stat.value}</div>
              <div className="text-xs text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-white/5 rounded-xl p-5 mb-6">
          <h3 className="text-lg font-bold text-white mb-4">🎭 Emotion Distribution</h3>
          <div className="space-y-3">
            {Object.entries(report.emotionDistribution).sort((a,b) => b[1]-a[1]).map(([emotion, pct]) => (
              <div key={emotion} className="flex items-center gap-3">
                <span className="text-xl">{EMOTION_COLORS[emotion]?.emoji}</span>
                <span className="w-24 text-gray-300 capitalize">{emotion}</span>
                <div className="flex-1 h-4 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: EMOTION_COLORS[emotion]?.hex }}/>
                </div>
                <span className="w-12 text-right font-bold" style={{ color: EMOTION_COLORS[emotion]?.hex }}>{pct}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white/5 rounded-xl p-5 mb-6">
          <h3 className="text-lg font-bold text-white mb-4">💡 Recommendations</h3>
          {report.recommendations.map((rec, i) => (
            <div key={i} className="bg-white/5 rounded-lg p-3 mb-2 text-gray-300">{rec}</div>
          ))}
        </div>

        <div className="flex gap-4">
          <button onClick={downloadReport} className="flex-1 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-500">📥 Download Report</button>
          <button onClick={onClose} className="px-6 py-3 rounded-xl text-gray-400 bg-white/5 border border-white/10">Close</button>
        </div>
      </GlassCard>
    </div>
  )
}
