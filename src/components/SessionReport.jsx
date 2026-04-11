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
  /*
    sessionData = {
      duration: 300, // seconds
      totalDetections: 45,
      emotionHistory: [
        { timestamp: 0, emotion: 'neutral', confidence: 85, scores: {...} },
        { timestamp: 5, emotion: 'happiness', confidence: 72, scores: {...} },
        ...
      ],
      avgEngagement: 68.5
    }
  */

  const [report, setReport] = useState(null)

  useEffect(() => {
    if (sessionData) {
      generateReport(sessionData)
    }
  }, [sessionData])

  const generateReport = (data) => {
    const { emotionHistory, duration, totalDetections } = data

    // Calculate emotion distribution
    const emotionCounts = {}
    const emotionScores = {}
    
    emotionHistory.forEach(entry => {
      // Count dominant emotions
      emotionCounts[entry.emotion] = (emotionCounts[entry.emotion] || 0) + 1
      
      // Aggregate all emotion scores
      if (entry.scores) {
        Object.entries(entry.scores).forEach(([emotion, score]) => {
          if (!emotionScores[emotion]) emotionScores[emotion] = []
          emotionScores[emotion].push(score)
        })
      }
    })

    // Calculate percentages
    const total = emotionHistory.length || 1
    const emotionDistribution = {}
    Object.entries(emotionCounts).forEach(([emotion, count]) => {
      emotionDistribution[emotion] = Math.round((count / total) * 100)
    })

    // Calculate average scores
    const avgScores = {}
    Object.entries(emotionScores).forEach(([emotion, scores]) => {
      avgScores[emotion] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    })

    // Find dominant emotion
    const dominantEmotion = Object.entries(emotionDistribution)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral'

    // Calculate engagement score
    const positiveEmotions = ['happiness', 'surprise']
    const negativeEmotions = ['sadness', 'anger', 'fear', 'disgust']
    
    let positiveScore = 0
    let negativeScore = 0
    positiveEmotions.forEach(e => positiveScore += (avgScores[e] || 0))
    negativeEmotions.forEach(e => negativeScore += (avgScores[e] || 0))
    
    const engagementScore = Math.min(100, Math.max(0, 
      50 + (positiveScore / 2) - (negativeScore / 4)
    ))

    // Generate timeline data (group by 30-second intervals)
    const timeline = []
    const intervalSeconds = 30
    for (let t = 0; t < duration; t += intervalSeconds) {
      const intervalEntries = emotionHistory.filter(
        e => e.timestamp >= t && e.timestamp < t + intervalSeconds
      )
      if (intervalEntries.length > 0) {
        const avgEng = intervalEntries.reduce((sum, e) => sum + (e.confidence || 50), 0) / intervalEntries.length
        const dominantInInterval = intervalEntries.reduce((acc, e) => {
          acc[e.emotion] = (acc[e.emotion] || 0) + 1
          return acc
        }, {})
        const topEmotion = Object.entries(dominantInInterval).sort((a, b) => b[1] - a[1])[0]?.[0]
        
        timeline.push({
          time: t,
          engagement: Math.round(avgEng),
          emotion: topEmotion
        })
      }
    }

    // Generate recommendations
    const recommendations = []
    if (emotionDistribution.sadness > 20) {
      recommendations.push("High sadness detected - consider taking breaks or reviewing difficult topics")
    }
    if (emotionDistribution.confusion > 25 || emotionDistribution.fear > 15) {
      recommendations.push("Signs of confusion/anxiety - the material may need review")
    }
    if (emotionDistribution.happiness > 30 && engagementScore > 70) {
      recommendations.push("Excellent engagement! This learning style seems effective")
    }
    if (emotionDistribution.neutral > 60) {
      recommendations.push("Mostly neutral - try more interactive content to boost engagement")
    }
    if (engagementScore < 40) {
      recommendations.push("Low engagement detected - consider shorter sessions or different study methods")
    }
    if (recommendations.length === 0) {
      recommendations.push("Good session overall - keep up the consistent focus!")
    }

    setReport({
      duration,
      totalDetections,
      emotionDistribution,
      avgScores,
      dominantEmotion,
      engagementScore: Math.round(engagementScore),
      timeline,
      recommendations,
      timestamp: new Date().toLocaleString()
    })
  }

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  const downloadReport = () => {
    if (!report) return
    
    const reportText = `
═══════════════════════════════════════════════════
       EMOTILEARN SESSION REPORT
═══════════════════════════════════════════════════

📅 Generated: ${report.timestamp}
⏱️ Session Duration: ${formatDuration(report.duration)}
📊 Total Detections: ${report.totalDetections}

───────────────────────────────────────────────────
                ENGAGEMENT SCORE
───────────────────────────────────────────────────

   ⚡ ${report.engagementScore}% Overall Engagement

───────────────────────────────────────────────────
              EMOTION DISTRIBUTION
───────────────────────────────────────────────────

${Object.entries(report.emotionDistribution)
  .sort((a, b) => b[1] - a[1])
  .map(([emotion, pct]) => `   ${EMOTION_COLORS[emotion]?.emoji || '•'} ${emotion.charAt(0).toUpperCase() + emotion.slice(1)}: ${pct}%`)
  .join('\n')}

───────────────────────────────────────────────────
             AVERAGE EMOTION SCORES
───────────────────────────────────────────────────

${Object.entries(report.avgScores)
  .sort((a, b) => b[1] - a[1])
  .map(([emotion, score]) => `   ${emotion.charAt(0).toUpperCase() + emotion.slice(1)}: ${score}%`)
  .join('\n')}

───────────────────────────────────────────────────
           DOMINANT EMOTION: ${report.dominantEmotion.toUpperCase()}
───────────────────────────────────────────────────

───────────────────────────────────────────────────
               RECOMMENDATIONS
───────────────────────────────────────────────────

${report.recommendations.map((r, i) => `   ${i + 1}. ${r}`).join('\n')}

═══════════════════════════════════════════════════
         EmotiLearn - Smart Education
═══════════════════════════════════════════════════
    `

    const blob = new Blob([reportText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `EmotiLearn_Report_${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!report) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <GlassCard className="p-8 max-w-md">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white">Generating report...</p>
          </div>
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-auto">
      <GlassCard className="p-6 max-w-3xl w-full max-h-[90vh] overflow-auto animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              📊 Session Report
            </h2>
            <p className="text-gray-400 text-sm">{report.timestamp}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Duration', value: formatDuration(report.duration), icon: '⏱️' },
            { label: 'Detections', value: report.totalDetections, icon: '📸' },
            { label: 'Engagement', value: `${report.engagementScore}%`, icon: '⚡', color: report.engagementScore >= 60 ? '#22c55e' : report.engagementScore >= 40 ? '#eab308' : '#ef4444' },
            { label: 'Dominant', value: report.dominantEmotion, icon: EMOTION_COLORS[report.dominantEmotion]?.emoji || '😐' },
          ].map((stat, i) => (
            <div key={stat.label} className="bg-white/5 rounded-xl p-4 text-center">
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className="text-xl font-bold text-white" style={{ color: stat.color }}>
                {stat.value}
              </div>
              <div className="text-xs text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Emotion Distribution */}
        <div className="bg-white/5 rounded-xl p-5 mb-6">
          <h3 className="text-lg font-bold text-white mb-4">🎭 Emotion Distribution</h3>
          <div className="space-y-3">
            {Object.entries(report.emotionDistribution)
              .sort((a, b) => b[1] - a[1])
              .map(([emotion, pct]) => (
                <div key={emotion} className="flex items-center gap-3">
                  <span className="text-xl">{EMOTION_COLORS[emotion]?.emoji}</span>
                  <span className="w-24 text-gray-300 capitalize">{emotion}</span>
                  <div className="flex-1 h-4 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ 
                        width: `${pct}%`, 
                        background: EMOTION_COLORS[emotion]?.hex 
                      }}
                    />
                  </div>
                  <span className="w-12 text-right font-bold" style={{ color: EMOTION_COLORS[emotion]?.hex }}>
                    {pct}%
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Average Scores */}
        <div className="bg-white/5 rounded-xl p-5 mb-6">
          <h3 className="text-lg font-bold text-white mb-4">📈 Average Emotion Scores</h3>
          <div className="grid grid-cols-4 gap-3">
            {Object.entries(report.avgScores)
              .sort((a, b) => b[1] - a[1])
              .map(([emotion, score]) => (
                <div 
                  key={emotion}
                  className="bg-white/5 rounded-lg p-3 text-center border border-white/5"
                >
                  <div className="text-2xl mb-1">{EMOTION_COLORS[emotion]?.emoji}</div>
                  <div className="font-bold text-white">{score}%</div>
                  <div className="text-xs text-gray-500 capitalize">{emotion}</div>
                </div>
              ))}
          </div>
        </div>

        {/* Recommendations */}
        <div className="bg-white/5 rounded-xl p-5 mb-6">
          <h3 className="text-lg font-bold text-white mb-4">💡 Recommendations</h3>
          <div className="space-y-2">
            {report.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-3 bg-white/5 rounded-lg p-3">
                <span className="text-blue-400">•</span>
                <p className="text-gray-300">{rec}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={downloadReport}
            className="flex-1 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 transition-all duration-300 flex items-center justify-center gap-2"
          >
            📥 Download Report
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-xl font-medium text-gray-400 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-all duration-300"
          >
            Close
          </button>
        </div>
      </GlassCard>
    </div>
  )
}
