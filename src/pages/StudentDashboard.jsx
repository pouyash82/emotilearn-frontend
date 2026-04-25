import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import GlassCard from '../components/GlassCard'
import TypingText from '../components/TypingText'
import SessionReport from '../components/SessionReport'
import API from '../api'

const EMOTION_COLORS = {
  anger: { bg: 'bg-red-500', hex: '#ef4444', emoji: '😠' },
  disgust: { bg: 'bg-violet-500', hex: '#8b5cf6', emoji: '🤢' },
  fear: { bg: 'bg-orange-500', hex: '#f97316', emoji: '😨' },
  happiness: { bg: 'bg-green-500', hex: '#22c55e', emoji: '😊' },
  neutral: { bg: 'bg-gray-500', hex: '#6b7280', emoji: '😐' },
  sadness: { bg: 'bg-blue-500', hex: '#3b82f6', emoji: '😢' },
  surprise: { bg: 'bg-yellow-500', hex: '#eab308', emoji: '😲' },
}

export default function StudentDashboard() {
  const { user } = useAuth()
  const [tab, setTab] = useState('live')
  const [isSessionActive, setIsSessionActive] = useState(false)
  const [cameraOn, setCameraOn] = useState(false)
  const [currentEmotion, setCurrentEmotion] = useState(null)
  const [emotionScores, setEmotionScores] = useState({})
  const [engagement, setEngagement] = useState(0)
  const [stats, setStats] = useState({ sessions: 0, avgEngagement: 0, detections: 0 })
  const [sessions, setSessions] = useState([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [sessionStartTime, setSessionStartTime] = useState(null)
  const [sessionDuration, setSessionDuration] = useState(0)
  const [showReport, setShowReport] = useState(false)
  const [sessionData, setSessionData] = useState(null)
  const [saving, setSaving] = useState(false)

  // ── Multimodal state ─────────────────────────────────────────────────
  const [micOn, setMicOn] = useState(false)
  const [transcription, setTranscription] = useState('')
  const [textEmotion, setTextEmotion] = useState(null)
  const [modalities, setModalities] = useState({ face: false, audio: false })

  // Session tracking
  const emotionHistoryRef = useRef([])
  const detectionCountRef = useRef(0)

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const intervalRef = useRef(null)
  const durationIntervalRef = useRef(null)
  const isAnalyzingRef = useRef(false)

  // ── Mic refs ─────────────────────────────────────────────────────────
  const audioStreamRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const captureCountRef = useRef(0)        // tracks cycles for audio timing
  const allTranscriptsRef = useRef([])     // accumulates all transcriptions

  useEffect(() => {
    loadStats()
    loadSessions()
    return () => { stopEverything() }
  }, [])

  useEffect(() => {
    if (isSessionActive && sessionStartTime) {
      durationIntervalRef.current = setInterval(() => {
        setSessionDuration(Math.floor((Date.now() - sessionStartTime) / 1000))
      }, 1000)
    }
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current)
    }
  }, [isSessionActive, sessionStartTime])

  const loadStats = async () => {
    try {
      const res = await API.get('/students/stats')
      setStats({
        sessions      : res.data.total_sessions   ?? 0,
        avgEngagement : res.data.avg_engagement   ?? 0,
        detections    : res.data.total_detections ?? 0,
      })
    } catch (err) { console.log('Stats not available') }
  }

  const loadSessions = async () => {
    try {
      const res = await API.get('/students/sessions')
      setSessions(res.data || [])
    } catch (err) { console.log('Sessions not available') }
  }

  // ── Start webcam + microphone ────────────────────────────────────────
  const startWebcam = async () => {
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      })
      if (videoRef.current) {
        videoRef.current.srcObject = videoStream
        await videoRef.current.play()
      }
      streamRef.current = videoStream
      setCameraOn(true)

      // Request microphone separately so camera still works if mic fails
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true }
        })
        audioStreamRef.current = audioStream
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus' : 'audio/webm'
        const recorder = new MediaRecorder(audioStream, { mimeType })
        audioChunksRef.current = []
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data)
        }
        recorder.start()  // continuous recording — we stop/restart every ~12s
        mediaRecorderRef.current = recorder
        setMicOn(true)
      } catch (micErr) {
        console.log('Mic not available — face-only mode:', micErr.message)
        setMicOn(false)
      }
      return true
    } catch (err) {
      console.error('Camera error:', err)
      alert('Could not access camera. Please allow camera permissions.')
      return false
    }
  }

  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOn(false)

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop() } catch {}
    }
    mediaRecorderRef.current = null
    audioChunksRef.current = []
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(t => t.stop())
      audioStreamRef.current = null
    }
    setMicOn(false)
  }, [])

  const stopEverything = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    if (durationIntervalRef.current) { clearInterval(durationIntervalRef.current); durationIntervalRef.current = null }
    stopWebcam()
    isAnalyzingRef.current = false
  }, [stopWebcam])

  const startSession = async () => {
    const cameraStarted = await startWebcam()
    if (!cameraStarted) return
    emotionHistoryRef.current = []
    detectionCountRef.current = 0
    setSessionStartTime(Date.now())
    setSessionDuration(0)
    setIsSessionActive(true)
    setCurrentEmotion(null)
    setEmotionScores({})
    setEngagement(0)
    setTranscription('')
    setTextEmotion(null)
    setModalities({ face: false, audio: false })
    captureCountRef.current = 0
    allTranscriptsRef.current = []
    try { await API.post('/session/start') } catch {}
    intervalRef.current = setInterval(captureAndAnalyze, 3000)
    setTimeout(captureAndAnalyze, 500)
  }

  const stopSession = async () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    const history = emotionHistoryRef.current
    const total = history.length
    let avgEng = 0, dominant = 'neutral', distribution = {}, uniqueCount = 0
    if (total > 0) {
      const sumEng = history.reduce((s, h) => s + (h.engagement_score || 0), 0)
      avgEng = Math.round((sumEng / total) * 10) / 10
      const counts = {}
      history.forEach(h => { counts[h.emotion] = (counts[h.emotion] || 0) + 1 })
      dominant = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b)
      Object.entries(counts).forEach(([emo, cnt]) => {
        distribution[emo] = Math.round((cnt / total) * 1000) / 10
      })
      uniqueCount = Object.keys(counts).length
    }
    const finalSessionData = { duration: sessionDuration, totalDetections: total, emotionHistory: history, avgEngagement: avgEng }
    setSessionData(finalSessionData)
    stopWebcam()
    setIsSessionActive(false)
    if (total > 0) {
      setSaving(true)
      try {
        await API.post('/sessions/save', {
          lecture_id: null, avg_engagement: avgEng, overall_engagement: avgEng,
          dominant_emotion: dominant, total_detections: total, unique_emotions: uniqueCount,
          distribution: distribution,
          emotion_logs: history.map(h => ({
            time: h.time || new Date().toISOString(), emotion: h.emotion,
            confidence: (h.confidence || 0) / 100, source: h.source || 'vision',
            scores: Object.fromEntries(Object.entries(h.scores || {}).map(([k, v]) => [k, (v || 0) / 100])),
            engagement_score: (h.engagement_score || 0) / 100,
          })),
        })
      } catch (err) { console.error('Failed to save session to DB:', err) }
      setSaving(false)
    }
    try { await API.post('/session/end', { duration: sessionDuration, detections: total, avgEngagement: avgEng }) } catch {}
    setShowReport(true)
    loadStats()
    loadSessions()
  }

  // ══════════════════════════════════════════════════════════════════════
  // Dual-cycle capture:
  //   • Every 3s: face frame → /api/detect-emotion (fast, local)
  //   • Every 4th cycle (~12s): stop recorder → grab full audio clip
  //     → send face+audio to /api/multimodal-detect → restart recorder
  // This gives Whisper a proper 12s clip instead of choppy 3s fragments.
  // ══════════════════════════════════════════════════════════════════════
  const captureAndAnalyze = async () => {
    if (isAnalyzingRef.current || !videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    if (video.readyState !== 4) return
    isAnalyzingRef.current = true
    setIsProcessing(true)

    captureCountRef.current += 1
    const isAudioCycle = micOn && captureCountRef.current % 4 === 0

    try {
      // ── Capture video frame (every cycle) ─────────────────────────
      const ctx = canvas.getContext('2d')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)
      const imageBlob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.8))

      if (isAudioCycle && mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        // ── AUDIO CYCLE: stop recorder → get complete blob → send multimodal ──
        const audioBlob = await new Promise((resolve) => {
          const recorder = mediaRecorderRef.current
          recorder.onstop = () => {
            const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
            audioChunksRef.current = []
            resolve(blob)
          }
          recorder.stop()
        })

        // Restart recorder immediately for next cycle
        if (audioStreamRef.current) {
          const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus' : 'audio/webm'
          const newRecorder = new MediaRecorder(audioStreamRef.current, { mimeType })
          newRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunksRef.current.push(e.data)
          }
          newRecorder.start()
          mediaRecorderRef.current = newRecorder
        }

        // Send face + audio to multimodal endpoint
        const formData = new FormData()
        formData.append('image', imageBlob, 'frame.jpg')
        if (audioBlob.size > 1000) {
          formData.append('audio', audioBlob, 'audio.webm')
        }

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 25000)
        const res = await API.post('/api/multimodal-detect', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        if (res.data) {
          const d = res.data
          const result = d.fused || d.face || {}
          const dom = result.dominant || result.emotion || 'neutral'
          const scores = result.scores || {}
          const conf = result.confidence || 0
          const eng = result.engagement || 0
          const displayScores = {}
          Object.entries(scores).forEach(([k, v]) => { displayScores[k] = v > 1 ? v : Math.round(v * 100) })
          setCurrentEmotion(dom)
          setEmotionScores(displayScores)
          setEngagement(eng || conf * 100 || 50)

          // Accumulate transcription
          if (d.transcription && d.transcription.trim()) {
            allTranscriptsRef.current.push(d.transcription.trim())
            setTranscription(allTranscriptsRef.current.join(' '))
          }
          if (d.text_emotion && d.text_emotion.success) setTextEmotion(d.text_emotion)
          if (d.modalities_used) setModalities(d.modalities_used)

          detectionCountRef.current += 1
          emotionHistoryRef.current.push({
            time: new Date().toISOString(), timestamp: sessionDuration, emotion: dom,
            confidence: conf > 1 ? conf : conf * 100, scores: displayScores,
            engagement_score: eng || 0, source: 'multimodal',
          })
        }
      } else {
        // ── FACE-ONLY CYCLE: fast detection, no audio ───────────────
        const formData = new FormData()
        formData.append('file', imageBlob, 'frame.jpg')

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000)
        const res = await API.post('/api/detect-emotion', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        if (res.data) {
          const { dominant, confidence, emotions, engagement: eng } = res.data
          setCurrentEmotion(dominant)
          setEmotionScores(emotions || {})
          setEngagement(eng || confidence || 50)
          setModalities(prev => ({ ...prev, face: true }))

          detectionCountRef.current += 1
          emotionHistoryRef.current.push({
            time: new Date().toISOString(), timestamp: sessionDuration, emotion: dominant,
            confidence: confidence || 50, scores: emotions || {},
            engagement_score: eng || 0, source: 'vision',
          })
        }
      }
    } catch (err) {
      if (err.name === 'AbortError' || err.name === 'CanceledError') console.log('Request timed out')
      else console.error('Detection error:', err)
    } finally {
      isAnalyzingRef.current = false
      setIsProcessing(false)
    }
  }

  const formatDuration = (s) => { const m = Math.floor(s/60); return `${m}:${(s%60).toString().padStart(2,'0')}` }

  const openMyReport = async (sid) => {
    try {
      const res = await API.get(`/students/sessions/${sid}/report`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/html' }))
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch { alert('Could not load report.') }
  }
  const downloadMyCSV = async (sid) => {
    try {
      const res = await API.get(`/students/sessions/${sid}/csv`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a'); a.href = url; a.download = `session_${sid}.csv`
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
    } catch { alert('Could not download CSV.') }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="fixed top-20 left-10 w-72 h-72 bg-blue-600/20 rounded-full blur-3xl animate-float pointer-events-none" />
      <div className="fixed bottom-20 right-10 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl animate-float-delayed pointer-events-none" />
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 py-8 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-fade-in-up">
          <div>
            <h1 className="text-3xl font-black text-white mb-2">
              Welcome back, <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">{user?.name}</span> 👋
            </h1>
            <TypingText texts={['Track your emotions', 'Improve your focus', 'Learn smarter']} speed={60} className="text-gray-400" />
          </div>
          <div className="flex gap-4">
            {[
              { label: 'Sessions', value: stats.sessions || 0, icon: '📊' },
              { label: 'Avg Engage', value: `${Math.round(stats.avgEngagement || 0)}%`, icon: '⚡' },
              { label: 'Detections', value: stats.detections || 0, icon: '🎯' },
            ].map((stat) => (
              <GlassCard key={stat.label} className="px-5 py-4 text-center">
                <div className="text-2xl mb-1">{stat.icon}</div>
                <div className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">{stat.value}</div>
                <div className="text-xs text-gray-500">{stat.label}</div>
              </GlassCard>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-3 mb-6">
          {[{ id: 'live', label: '🎥 Live Session' }, { id: 'history', label: '📚 History' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-6 py-3 rounded-2xl font-medium transition-all duration-300 ${tab === t.id ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg' : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'live' && (
          <div className="space-y-6">
            {/* Session Controls */}
            <div className="flex items-center gap-4 flex-wrap">
              {!isSessionActive ? (
                <button onClick={startSession} className="px-8 py-4 rounded-2xl font-bold text-white bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 shadow-lg shadow-green-500/30 hover:scale-105 transition-all duration-300 flex items-center gap-2">
                  ▶ Start Session
                </button>
              ) : (
                <button onClick={stopSession} disabled={saving} className="px-8 py-4 rounded-2xl font-bold text-white bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-400 hover:to-rose-400 shadow-lg shadow-red-500/30 hover:scale-105 disabled:opacity-60 transition-all duration-300 flex items-center gap-2">
                  ⏹ Stop Session
                </button>
              )}
              {saving && (
                <div className="flex items-center gap-2 text-amber-400 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <div className="w-3 h-3 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                  <span className="text-sm font-medium">Saving session...</span>
                </div>
              )}
              {isSessionActive && (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/30">
                    <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-red-400 font-mono font-bold">{formatDuration(sessionDuration)}</span>
                  </div>
                  {isProcessing && (
                    <div className="flex items-center gap-2 text-blue-400">
                      <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                      <span className="text-sm">Analyzing...</span>
                    </div>
                  )}
                </div>
              )}
              {/* Camera + Mic indicators */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-gray-500">
                  <div className={`w-2 h-2 rounded-full ${cameraOn ? 'bg-green-500' : 'bg-gray-500'}`} />
                  <span className="text-sm">{cameraOn ? 'Camera On' : 'Camera Off'}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <div className={`w-2 h-2 rounded-full ${micOn ? 'bg-purple-500 animate-pulse' : 'bg-gray-500'}`} />
                  <span className="text-sm">{micOn ? 'Mic On' : 'Mic Off'}</span>
                </div>
              </div>
            </div>

            {/* Modality badges */}
            {isSessionActive && (
              <div className="flex gap-2">
                <div className={`px-3 py-1 rounded-full text-xs font-medium border ${modalities.face ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-white/5 text-gray-500 border-white/10'}`}>
                  👁 Face {modalities.face ? '✓' : '—'}
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium border ${modalities.audio ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' : 'bg-white/5 text-gray-500 border-white/10'}`}>
                  🎤 Voice {modalities.audio ? '✓' : '—'}
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium border ${modalities.face && modalities.audio ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-white/5 text-gray-500 border-white/10'}`}>
                  🔗 Fused {modalities.face && modalities.audio ? '✓' : '—'}
                </div>
              </div>
            )}

            {/* Main Content */}
            <div className="grid grid-cols-2 gap-6">
              {/* Video Feed */}
              <GlassCard className="p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">📹 Face Emotion</h2>
                <div className="relative aspect-video bg-black/50 rounded-2xl overflow-hidden mb-4">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  <canvas ref={canvasRef} className="hidden" />
                  {!cameraOn && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="text-5xl mb-3">📷</div>
                      <p className="text-gray-400">Camera off</p>
                      <p className="text-gray-500 text-sm">Click "Start Session"</p>
                    </div>
                  )}
                  {currentEmotion && cameraOn && (
                    <div className="absolute top-4 left-4 px-4 py-2 rounded-xl bg-black/60 backdrop-blur-sm border border-white/10">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{EMOTION_COLORS[currentEmotion]?.emoji}</span>
                        <span className="text-white font-bold capitalize">{currentEmotion}</span>
                      </div>
                    </div>
                  )}
                  {isSessionActive && (
                    <div className="absolute top-4 right-4 px-4 py-2 rounded-xl bg-black/60 backdrop-blur-sm border border-white/10">
                      <div className="text-center">
                        <div className="text-xl font-bold" style={{ color: engagement >= 60 ? '#22c55e' : engagement >= 40 ? '#eab308' : '#ef4444' }}>
                          {Math.round(engagement)}%
                        </div>
                        <div className="text-xs text-gray-400">Engagement</div>
                      </div>
                    </div>
                  )}
                </div>
                {currentEmotion && (
                  <div className="space-y-2">
                    {Object.entries(emotionScores).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([emotion, score]) => (
                      <div key={emotion} className="flex items-center gap-2">
                        <span className="w-6 text-center">{EMOTION_COLORS[emotion]?.emoji}</span>
                        <span className="w-20 text-gray-400 text-sm capitalize">{emotion}</span>
                        <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${score}%`, background: EMOTION_COLORS[emotion]?.hex }} />
                        </div>
                        <span className="w-12 text-right text-gray-500 text-sm">{Math.round(score)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>

              {/* Session Info + Multimodal */}
              <GlassCard className="p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">📊 Session Info</h2>
                {isSessionActive ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/5 rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-white">{detectionCountRef.current}</div>
                        <div className="text-sm text-gray-500">Detections</div>
                      </div>
                      <div className="bg-white/5 rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold" style={{ color: engagement >= 60 ? '#22c55e' : engagement >= 40 ? '#eab308' : '#ef4444' }}>
                          {Math.round(engagement)}%
                        </div>
                        <div className="text-sm text-gray-500">Engagement</div>
                      </div>
                    </div>
                    {currentEmotion && (
                      <div className="bg-white/5 rounded-xl p-5 text-center">
                        <div className="text-4xl mb-2">{EMOTION_COLORS[currentEmotion]?.emoji}</div>
                        <div className="text-xl font-bold text-white capitalize">{currentEmotion}</div>
                        <div className="text-sm text-gray-500">{modalities.face && modalities.audio ? 'Fused Emotion' : 'Current Emotion'}</div>
                      </div>
                    )}

                    {/* Transcription bubble — shows accumulated speech */}
                    {transcription && (
                      <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm">🎤</span>
                          <span className="text-purple-400 text-xs font-bold uppercase">Speech Transcript</span>
                          {textEmotion && (
                            <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 capitalize">
                              {textEmotion.emotion}
                            </span>
                          )}
                        </div>
                        <div className="max-h-24 overflow-y-auto">
                          <p className="text-gray-300 text-sm leading-relaxed">{transcription}</p>
                        </div>
                        <div className="text-right mt-1">
                          <span className="text-gray-600 text-xs">{allTranscriptsRef.current.length} segments captured</span>
                        </div>
                      </div>
                    )}

                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                      <p className="text-blue-300 text-sm">
                        💡 <strong>Tip:</strong> Analysis runs every 3 seconds.
                        {micOn ? ' Microphone is active — speech is analyzed alongside your face.' : ' Session saves automatically when you stop.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🎯</div>
                    <h3 className="text-xl font-bold text-white mb-2">Ready to Start?</h3>
                    <p className="text-gray-400 mb-6">Click "Start Session" to begin emotion tracking.<br />Camera + microphone for multimodal analysis.</p>
                  </div>
                )}
              </GlassCard>
            </div>
          </div>
        )}

        {tab === 'history' && (
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <h2 className="text-xl font-bold text-white">📚 Session History</h2>
              <button onClick={loadSessions} className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm hover:bg-white/10 transition-all duration-300">🔄 Refresh</button>
            </div>
            {sessions.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">📊</div>
                <p className="text-gray-400">No sessions yet. Start your first session!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((s) => {
                  const eng = s.avg_engagement || 0
                  const engC = eng >= 65 ? '#22c55e' : eng >= 40 ? '#eab308' : '#ef4444'
                  return (
                    <div key={s.id} className="bg-white/5 rounded-xl p-4 border border-white/5 hover:bg-white/10 hover:border-blue-500/30 transition-all duration-300">
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-sm font-bold shrink-0">#{s.id}</div>
                          <div>
                            <div className="text-white font-medium">{s.started_at ? new Date(s.started_at).toLocaleString() : 'Unknown date'}</div>
                            <div className="text-gray-500 text-sm capitalize">Dominant: {s.dominant_emotion || 'N/A'}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 flex-wrap">
                          <div className="flex gap-6">
                            <div className="text-center">
                              <div className="text-lg font-bold text-blue-400">{s.total_detections || 0}</div>
                              <div className="text-xs text-gray-500">Detections</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-bold" style={{ color: engC }}>{Math.round(eng)}%</div>
                              <div className="text-xs text-gray-500">Engagement</div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => openMyReport(s.id)} className="px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-all duration-300" title="Open HTML report">📊 Report</button>
                            <button onClick={() => downloadMyCSV(s.id)} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-xs font-medium hover:bg-white/10 transition-all duration-300" title="Download CSV">📄 CSV</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </GlassCard>
        )}
      </div>
      {showReport && sessionData && <SessionReport sessionData={sessionData} onClose={() => setShowReport(false)} />}
    </div>
  )
}
