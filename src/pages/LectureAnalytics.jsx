import { useState, useRef } from 'react'
import GlassCard from '../components/GlassCard'
import API from '../api'

const EMOTION_COLORS = {
  anger: '#ef4444', disgust: '#a855f7', fear: '#f97316',
  happiness: '#22c55e', neutral: '#6b7280',
  sadness: '#3b82f6', surprise: '#eab308',
}

const engColor = (v) => v >= 65 ? '#22c55e' : v >= 40 ? '#eab308' : '#ef4444'
const engLabel = (v) => v >= 65 ? 'High' : v >= 40 ? 'Medium' : 'Low'

const STATE_COLORS = {
  flow: '#22c55e', attentive: '#3b82f6', boredom: '#f97316',
  productive_struggle: '#eab308', confusion: '#a855f7', disengagement: '#ef4444',
}

export default function LectureAnalytics() {
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('single') // single or multi
  const fileRef = useRef(null)

  const analyzeVideo = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) { setError('Please select a video file'); return }

    const maxSize = 100 * 1024 * 1024 // 100MB
    if (file.size > maxSize) { setError('File too large (max 100MB)'); return }

    setAnalyzing(true)
    setError('')
    setResult(null)
    setProgress('Uploading video...')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const endpoint = mode === 'multi'
        ? '/api/lecture/analyze-multi'
        : '/api/lecture/analyze'

      setProgress('Analyzing frames with EfficientNet-B2...')
      const res = await API.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000, // 5 min for long videos
      })

      if (res.data && res.data.success) {
        setResult(res.data)
        setProgress('')
      } else {
        setError(res.data?.error || 'Analysis failed')
      }
    } catch (err) {
      setError(`Analysis failed: ${err.message}`)
    }
    setAnalyzing(false)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Upload section */}
      <GlassCard className="p-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <span className="text-2xl">🎬</span> Lecture Recording Analysis
        </h2>
        <p className="text-gray-400 text-sm mb-6">
          Upload a recorded lecture video — the system extracts frames every 2 seconds, runs each through EfficientNet-B2, and generates a complete engagement timeline.
        </p>

        <div className="flex gap-4 items-end flex-wrap">
          <div className="flex-1 min-w-[250px]">
            <label className="text-gray-400 text-sm mb-2 block">Select video file</label>
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              disabled={analyzing}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-amber-500/20 file:text-amber-400 file:font-medium file:cursor-pointer hover:file:bg-amber-500/30 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="text-gray-400 text-sm mb-2 block">Mode</label>
            <div className="flex gap-2">
              <button onClick={() => setMode('single')}
                className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${mode === 'single' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white/5 text-gray-500 border border-white/10'}`}>
                👤 Single Face
              </button>
              <button onClick={() => setMode('multi')}
                className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${mode === 'multi' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white/5 text-gray-500 border border-white/10'}`}>
                👥 Multi Face
              </button>
            </div>
          </div>

          <button onClick={analyzeVideo} disabled={analyzing}
            className="px-8 py-3 rounded-2xl font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-lg shadow-amber-500/30 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 transition-all duration-300">
            {analyzing ? '⏳ Analyzing...' : '🔍 Analyze'}
          </button>
        </div>

        {progress && (
          <div className="mt-4 flex items-center gap-3 text-amber-400">
            <div className="w-4 h-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
            <span className="text-sm">{progress}</span>
          </div>
        )}
        {error && (
          <div className="mt-4 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">{error}</div>
        )}
      </GlassCard>

      {/* Results */}
      {result && result.success && (
        <>
          {/* Video info + summary */}
          <div className="grid grid-cols-2 gap-6">
            <GlassCard className="p-6">
              <h3 className="text-lg font-bold text-white mb-4">📊 Summary</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Duration', value: result.video_info?.duration_fmt || '—', icon: '⏱' },
                  { label: 'Frames Analyzed', value: result.video_info?.frames_analyzed || 0, icon: '🎞' },
                  { label: 'Avg Engagement', value: `${result.summary?.avg_engagement || 0}%`, icon: '⚡', color: engColor(result.summary?.avg_engagement || 0) },
                  { label: 'Dominant Emotion', value: result.summary?.dominant_emotion || 'N/A', icon: '🎭' },
                ].map(s => (
                  <div key={s.label} className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
                    <div className="text-lg mb-1">{s.icon}</div>
                    <div className="text-xl font-bold" style={{ color: s.color || '#fff' }}>{s.value}</div>
                    <div className="text-xs text-gray-500">{s.label}</div>
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard className="p-6">
              <h3 className="text-lg font-bold text-white mb-4">🎭 Emotion Distribution</h3>
              <div className="space-y-2">
                {result.summary?.distribution && Object.entries(result.summary.distribution)
                  .sort((a, b) => b[1] - a[1])
                  .map(([emo, pct]) => (
                    <div key={emo}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-300 capitalize">{emo}</span>
                        <span className="text-white font-bold">{pct}%</span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: EMOTION_COLORS[emo] || '#7c3aed' }} />
                      </div>
                    </div>
                  ))}
              </div>
            </GlassCard>
          </div>

          {/* Engagement timeline */}
          <GlassCard className="p-6">
            <h3 className="text-lg font-bold text-white mb-4">📈 Engagement Timeline</h3>
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <div className="flex items-end gap-[2px] h-32">
                {(result.timeline || []).filter(t => t.emotion).map((t, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end group relative">
                    <div className="w-full rounded-sm transition-all duration-200 group-hover:opacity-80"
                      style={{ height: `${Math.max(4, t.engagement)}%`, background: engColor(t.engagement) }}
                      title={`${t.timestamp_fmt} — ${t.emotion} (${t.engagement}%)`} />
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-600">
                <span>{result.timeline?.[0]?.timestamp_fmt || '0:00'}</span>
                <span>{result.timeline?.[result.timeline.length - 1]?.timestamp_fmt || '—'}</span>
              </div>
            </div>
          </GlassCard>

          {/* Engagement states */}
          {result.engagement_states && result.engagement_states.length > 0 && (
            <GlassCard className="p-6">
              <h3 className="text-lg font-bold text-white mb-4">🧠 Engagement States Timeline</h3>
              <div className="space-y-2">
                {result.engagement_states.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/5">
                    <span className="text-xl">{s.icon}</span>
                    <div className="flex-1">
                      <div className="text-white font-medium text-sm">{s.label}</div>
                      <div className="text-gray-500 text-xs">{s.from_time} → {s.to_time}</div>
                    </div>
                    <div className="text-sm font-bold" style={{ color: STATE_COLORS[s.state] || '#6b7280' }}>
                      {Math.round(s.confidence * 100)}%
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Engagement segments */}
          {result.engagement_segments && result.engagement_segments.length > 0 && (
            <GlassCard className="p-6">
              <h3 className="text-lg font-bold text-white mb-4">📊 Engagement Segments</h3>
              <div className="flex gap-1 h-8 rounded-lg overflow-hidden">
                {result.engagement_segments.map((seg, i) => (
                  <div key={i} className="flex-1 flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: seg.level === 'high' ? '#22c55e' : seg.level === 'medium' ? '#eab308' : '#ef4444' }}
                    title={`${seg.from} → ${seg.to}: ${seg.level}`}>
                    {seg.level.charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-600">
                <span>{result.engagement_segments[0]?.from || ''}</span>
                <span>{result.engagement_segments[result.engagement_segments.length - 1]?.to || ''}</span>
              </div>
            </GlassCard>
          )}

          {/* Multi-face profile (if multi mode) */}
          {result.profile && result.profile.faces && result.profile.faces.length > 0 && (
            <GlassCard className="p-6">
              <h3 className="text-lg font-bold text-white mb-4">👥 Per-Student Breakdown</h3>
              <div className="space-y-3">
                {result.profile.faces.map(f => (
                  <div key={f.face_id} className="bg-white/5 rounded-xl p-4 border border-white/5 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white font-bold">
                      #{f.face_id}
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-medium">Face #{f.face_id}</div>
                      <div className="text-gray-500 text-xs">{f.total_detections} detections · Dominant: {f.dominant_emotion}</div>
                    </div>
                    <div className="text-lg font-bold" style={{ color: engColor(f.avg_engagement) }}>
                      {f.avg_engagement}%
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </>
      )}
    </div>
  )
}
