import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import GlassCard from '../components/GlassCard'
import TypingText from '../components/TypingText'
import SessionReport from '../components/SessionReport'
import ExamMode from './ExamMode'
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
  const [transcribing, setTranscribing] = useState(false)
  const [voiceEmotion, setVoiceEmotion] = useState(null)

  // Session tracking
  const emotionHistoryRef = useRef([])
  const detectionCountRef = useRef(0)

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const intervalRef = useRef(null)
  const durationIntervalRef = useRef(null)
  const isAnalyzingRef = useRef(false)

  // ── Mic refs (records entire session in segments) ─────────────────────
  const audioStreamRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const audioIntervalRef = useRef(null)
  const allTranscriptsRef = useRef([])
  const allAudioBlobsRef = useRef([])     // saves all audio for final voice emotion
  const transcriptBoxRef = useRef(null)

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

      // Start microphone — records in 20-second segments for live transcription
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true }
        })
        audioStreamRef.current = audioStream
        startNewRecorder()
        setMicOn(true)

        // Every 20 seconds: stop recorder → transcribe → restart
        audioIntervalRef.current = setInterval(transcribeCurrentChunk, 20000)
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
    // Mic is stopped separately in stopSession to grab the audio blob
  }, [])

  const stopMic = useCallback(() => {
    if (audioIntervalRef.current) { clearInterval(audioIntervalRef.current); audioIntervalRef.current = null }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop() } catch {}
    }
    mediaRecorderRef.current = null
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(t => t.stop())
      audioStreamRef.current = null
    }
    setMicOn(false)
  }, [])

  // Start a fresh MediaRecorder on the existing audio stream
  const startNewRecorder = () => {
    if (!audioStreamRef.current) return
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus' : 'audio/webm'
    const recorder = new MediaRecorder(audioStreamRef.current, { mimeType })
    audioChunksRef.current = []
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data)
    }
    recorder.start()
    mediaRecorderRef.current = recorder
  }

  // Stop current recorder → grab complete audio → send to Whisper → append text → restart
  const transcribeCurrentChunk = async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return

    // Stop recorder and get complete audio blob
    const audioBlob = await new Promise((resolve) => {
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        audioChunksRef.current = []
        resolve(blob)
      }
      mediaRecorderRef.current.stop()
    })

    // Restart recorder immediately for next segment
    startNewRecorder()

    // Send to Whisper if there's meaningful audio
    if (audioBlob.size < 1000) return
    allAudioBlobsRef.current.push(audioBlob)  // save for voice emotion at end
    try {
      const form = new FormData()
      form.append('file', audioBlob, 'chunk.webm')
      const res = await API.post('/api/transcribe', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      })
      if (res.data && res.data.success && res.data.text && res.data.text.trim()) {
        allTranscriptsRef.current.push(res.data.text.trim())
        setTranscription(allTranscriptsRef.current.join(' '))
        // Auto-scroll transcript box
        setTimeout(() => {
          if (transcriptBoxRef.current) {
            transcriptBoxRef.current.scrollTop = transcriptBoxRef.current.scrollHeight
          }
        }, 100)
      }
    } catch (err) {
      console.log('Chunk transcription failed:', err.message)
    }
  }

  const stopEverything = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    if (durationIntervalRef.current) { clearInterval(durationIntervalRef.current); durationIntervalRef.current = null }
    stopWebcam()
    stopMic()
    audioChunksRef.current = []
    isAnalyzingRef.current = false
  }, [stopWebcam, stopMic])

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
    setTranscribing(false)
    allTranscriptsRef.current = []
    allAudioBlobsRef.current = []
    try { await API.post('/session/start') } catch {}
    intervalRef.current = setInterval(captureAndAnalyze, 3000)
    setTimeout(captureAndAnalyze, 500)
  }

  // ══════════════════════════════════════════════════════════════════════
  // Stop session: stop face detection → stop recorder → grab full audio
  // → send to Whisper → send text to RoBERTa → save everything
  // ══════════════════════════════════════════════════════════════════════
  const stopSession = async () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }

    // Stop camera
    stopWebcam()

    // Stop the periodic audio interval
    if (audioIntervalRef.current) { clearInterval(audioIntervalRef.current); audioIntervalRef.current = null }

    // ── Transcribe the final remaining audio chunk ───────────────────
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      setTranscribing(true)
      const finalBlob = await new Promise((resolve) => {
        mediaRecorderRef.current.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
          audioChunksRef.current = []
          resolve(blob)
        }
        mediaRecorderRef.current.stop()
      })

      if (finalBlob.size > 1000) {
        allAudioBlobsRef.current.push(finalBlob)  // save final chunk too
        try {
          const form = new FormData()
          form.append('file', finalBlob, 'final_chunk.webm')
          const res = await API.post('/api/transcribe', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 30000,
          })
          if (res.data && res.data.success && res.data.text && res.data.text.trim()) {
            allTranscriptsRef.current.push(res.data.text.trim())
            setTranscription(allTranscriptsRef.current.join(' '))
          }
        } catch (err) { console.log('Final chunk transcription failed:', err.message) }
      }
    }

    // Stop mic tracks
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(t => t.stop())
      audioStreamRef.current = null
    }
    mediaRecorderRef.current = null
    setMicOn(false)

    // ── Run RoBERTa on the FULL combined transcript ──────────────────
    const fullText = allTranscriptsRef.current.join(' ')
    if (fullText.trim()) {
      try {
        const robertaRes = await API.post('/api/text-emotion', { text: fullText })
        if (robertaRes.data && robertaRes.data.success) {
          setTextEmotion(robertaRes.data)
        }
      } catch (err) { console.log('Text emotion failed:', err.message) }
    }

    // ── Run wav2vec2 voice tone emotion on combined session audio ─────
    if (allAudioBlobsRef.current.length > 0) {
      try {
        const combinedAudio = new Blob(allAudioBlobsRef.current, { type: 'audio/webm' })
        const voiceForm = new FormData()
        voiceForm.append('file', combinedAudio, 'session_voice.webm')
        const voiceRes = await API.post('/api/voice-emotion', voiceForm, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 60000,
        })
        if (voiceRes.data && voiceRes.data.success) {
          setVoiceEmotion(voiceRes.data)
        }
      } catch (err) { console.log('Voice emotion failed:', err.message) }
    }

    setTranscribing(false)

    setIsSessionActive(false)

    // ── Compute aggregates ───────────────────────────────────────────
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

    const finalSessionData = {
      duration: sessionDuration, totalDetections: total,
      emotionHistory: history, avgEngagement: avgEng,
      transcription: allTranscriptsRef.current.join(' '),
      textEmotion: textEmotion,
      voiceEmotion: voiceEmotion,
    }
    setSessionData(finalSessionData)

    // ── Save to database ─────────────────────────────────────────────
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
  // Face-only detection every 3 seconds — same as original, untouched
  // ══════════════════════════════════════════════════════════════════════
  const captureAndAnalyze = async () => {
    if (isAnalyzingRef.current || !videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    if (video.readyState !== 4) return
    isAnalyzingRef.current = true
    setIsProcessing(true)
    try {
      const ctx = canvas.getContext('2d')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8))
      const formData = new FormData()
      formData.append('file', blob, 'frame.jpg')
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
        detectionCountRef.current += 1
        emotionHistoryRef.current.push({
          time: new Date().toISOString(), timestamp: sessionDuration,
          emotion: dominant, confidence: confidence || 50,
          scores: emotions || {}, engagement_score: eng || 0, source: 'vision',
        })
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
          {[{ id: 'live', label: '🎥 Live Session' }, { id: 'history', label: '📚 History' }, { id: 'exam', label: '🔒 Exam Mode' }].map(t => (
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
                <button onClick={startSession} disabled={transcribing}
                  className="px-8 py-4 rounded-2xl font-bold text-white bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 shadow-lg shadow-green-500/30 hover:scale-105 disabled:opacity-60 transition-all duration-300 flex items-center gap-2">
                  ▶ Start Session
                </button>
              ) : (
                <button onClick={stopSession} disabled={saving}
                  className="px-8 py-4 rounded-2xl font-bold text-white bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-400 hover:to-rose-400 shadow-lg shadow-red-500/30 hover:scale-105 disabled:opacity-60 transition-all duration-300 flex items-center gap-2">
                  ⏹ Stop Session
                </button>
              )}
              {saving && (
                <div className="flex items-center gap-2 text-amber-400 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <div className="w-3 h-3 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                  <span className="text-sm font-medium">Saving session...</span>
                </div>
              )}
              {transcribing && (
                <div className="flex items-center gap-2 text-purple-400 px-3 py-2 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                  <div className="w-3 h-3 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                  <span className="text-sm font-medium">Transcribing full session audio...</span>
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
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-gray-500">
                  <div className={`w-2 h-2 rounded-full ${cameraOn ? 'bg-green-500' : 'bg-gray-500'}`} />
                  <span className="text-sm">{cameraOn ? 'Camera On' : 'Camera Off'}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <div className={`w-2 h-2 rounded-full ${micOn ? 'bg-purple-500 animate-pulse' : 'bg-gray-500'}`} />
                  <span className="text-sm">{micOn ? 'Recording Audio' : 'Mic Off'}</span>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-2 gap-6">
              {/* Video Feed */}
              <GlassCard className="p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">📹 Face Emotion</h2>
                <div className="relative aspect-video bg-black/50 rounded-2xl overflow-hidden mb-4">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  <canvas ref={canvasRef} className="hidden" />
                  {!cameraOn && !transcribing && (
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
                  {/* Mic recording indicator on video */}
                  {micOn && (
                    <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-lg bg-purple-500/80 backdrop-blur-sm flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                      <span className="text-white text-xs font-medium">Recording voice</span>
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

              {/* Session Info */}
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
                        <div className="text-sm text-gray-500">Current Emotion</div>
                      </div>
                    )}

                    {/* ── Live transcript (like Teams captions) ──────── */}
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm">🎤</span>
                        <span className="text-purple-400 text-xs font-bold uppercase">Live Transcript</span>
                        <div className="ml-auto flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                          <span className="text-purple-400 text-xs">Recording</span>
                        </div>
                      </div>
                      <div ref={transcriptBoxRef} className="max-h-32 overflow-y-auto bg-black/20 rounded-lg p-3 min-h-[60px]">
                        {transcription ? (
                          <p className="text-gray-300 text-sm leading-relaxed">{transcription}</p>
                        ) : (
                          <p className="text-gray-600 text-sm italic">Listening... transcript appears every ~20 seconds</p>
                        )}
                      </div>
                      {allTranscriptsRef.current.length > 0 && (
                        <div className="text-right mt-1">
                          <span className="text-gray-600 text-xs">{allTranscriptsRef.current.length} segments</span>
                        </div>
                      )}
                    </div>

                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                      <p className="text-blue-300 text-sm">
                        💡 <strong>Tip:</strong> Face analysis runs every 3s. Speech is transcribed every 20s. Full text emotion analysis runs when you stop.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Post-session transcription results */}
                    {transcription && (
                      <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-lg">🎤</span>
                          <span className="text-purple-400 text-sm font-bold uppercase">Full Session Transcript</span>
                        </div>
                        <div className="max-h-40 overflow-y-auto bg-black/20 rounded-lg p-3">
                          <p className="text-gray-300 text-sm leading-relaxed">{transcription}</p>
                        </div>

                        {/* ── Tri-signal emotion summary ──────────────── */}
                        <div className="mt-3 space-y-2">
                          {textEmotion && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-400 flex items-center gap-1.5">
                                <span>📝</span> Text Emotion (what you said)
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 capitalize text-xs font-bold">
                                {textEmotion.emotion} ({Math.round((textEmotion.confidence || 0) * 100)}%)
                              </span>
                            </div>
                          )}
                          {voiceEmotion && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-400 flex items-center gap-1.5">
                                <span>🔊</span> Voice Emotion (how you sounded)
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 capitalize text-xs font-bold">
                                {voiceEmotion.emotion} ({Math.round((voiceEmotion.confidence || 0) * 100)}%)
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Per-emotion breakdown from all signals */}
                        {(textEmotion?.scores || voiceEmotion?.scores) && (
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            {textEmotion?.scores && (
                              <div>
                                <div className="text-xs text-gray-500 mb-1">📝 Text scores</div>
                                <div className="flex flex-wrap gap-1">
                                  {Object.entries(textEmotion.scores).sort((a,b) => b[1]-a[1]).slice(0,4).map(([e,s]) => (
                                    <span key={e} className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-gray-400 capitalize">
                                      {EMOTION_COLORS[e]?.emoji||'•'} {e}: {Math.round(s*100)}%
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {voiceEmotion?.scores && (
                              <div>
                                <div className="text-xs text-gray-500 mb-1">🔊 Voice scores</div>
                                <div className="flex flex-wrap gap-1">
                                  {Object.entries(voiceEmotion.scores).sort((a,b) => b[1]-a[1]).slice(0,4).map(([e,s]) => (
                                    <span key={e} className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-gray-400 capitalize">
                                      {EMOTION_COLORS[e]?.emoji||'•'} {e}: {Math.round(s*100)}%
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {!transcription && (
                      <div className="text-center py-12">
                        <div className="text-6xl mb-4">🎯</div>
                        <h3 className="text-xl font-bold text-white mb-2">Ready to Start?</h3>
                        <p className="text-gray-400 mb-6">Click "Start Session" to begin emotion tracking.<br />Camera + microphone for multimodal analysis.</p>
                      </div>
                    )}
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
                            <button onClick={() => openMyReport(s.id)} className="px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-all duration-300">📊 Report</button>
                            <button onClick={() => downloadMyCSV(s.id)} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-xs font-medium hover:bg-white/10 transition-all duration-300">📄 CSV</button>
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

        {tab === 'exam' && <ExamMode />}
      </div>
      {showReport && sessionData && <SessionReport sessionData={sessionData} onClose={() => setShowReport(false)} />}
    </div>
  )
}
