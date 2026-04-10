import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import GlassCard from '../components/GlassCard'
import TypingText from '../components/TypingText'
import API from '../api'

const EMOTION_COLORS = {
  anger    : { color: '#ef4444', gradient: 'from-red-500 to-orange-500' },
  disgust  : { color: '#a855f7', gradient: 'from-purple-500 to-violet-500' },
  fear     : { color: '#f97316', gradient: 'from-orange-500 to-amber-500' },
  happiness: { color: '#22c55e', gradient: 'from-green-500 to-emerald-500' },
  neutral  : { color: '#6b7280', gradient: 'from-gray-500 to-slate-500' },
  sadness  : { color: '#3b82f6', gradient: 'from-blue-500 to-cyan-500' },
  surprise : { color: '#eab308', gradient: 'from-yellow-500 to-amber-500' },
}

export default function StudentDashboard() {
  const { user } = useAuth()
  const [tab, setTab] = useState('live')
  const [sessionActive, setActive] = useState(false)
  const [profile, setProfile] = useState(null)
  const [sessions, setSessions] = useState([])
  const [stats, setStats] = useState(null)
  const [cameraStatus, setCameraStatus] = useState('off')
  const [currentEmotion, setCurrent] = useState(null)
  const [engagement, setEngagement] = useState(0)
  const [recording, setRecording] = useState(false)
  const [speechResult, setSpeechResult] = useState(null)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState('')

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const intervalRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const profileInterval = useRef(null)

  useEffect(() => {
    loadSessions()
    loadStats()
    return () => stopWebcam()
  }, [])

  const loadSessions = async () => {
    try {
      const res = await API.get('/students/sessions')
      setSessions(res.data)
    } catch {}
  }

  const loadStats = async () => {
    try {
      const res = await API.get('/students/stats')
      setStats(res.data)
    } catch {}
  }

  const loadProfile = async () => {
    try {
      const res = await API.get('/session/profile')
      if (!res.data.error) setProfile(res.data)
    } catch {}
  }

  const startSession = async () => {
    setError('')
    await API.post('/session/start')
    setActive(true)
    await startWebcam()
    profileInterval.current = setInterval(loadProfile, 3000)
  }

  const stopSession = async () => {
    stopWebcam()
    setActive(false)
    clearInterval(profileInterval.current)
    if (profile) {
      try {
        await API.post('/sessions/save', {
          avg_engagement: profile.avg_engagement,
          overall_engagement: profile.overall_engagement,
          dominant_emotion: profile.dominant_emotion,
          total_detections: profile.total_detections,
          unique_emotions: profile.unique_emotions,
          distribution: profile.distribution,
          emotion_logs: profile.timeline || [],
        })
        loadSessions()
        loadStats()
      } catch {}
    }
  }

  const startWebcam = async () => {
    try {
      setCameraStatus('starting')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraStatus('connected')
      intervalRef.current = setInterval(captureAndAnalyze, 500)
    } catch (err) {
      setError('Camera access denied. Please allow camera permissions.')
      setCameraStatus('error')
    }
  }

  const stopWebcam = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraStatus('off')
  }

  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return
    if (videoRef.current.readyState !== 4) return
    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)
    const base64 = canvas.toDataURL('image/jpeg', 0.8)
    try {
      const res = await API.post('/api/detect-emotion', { image: base64 })
      if (res.data.success) {
        setCurrent({
          emotion: res.data.dominant,
          scores: Object.fromEntries(
            Object.entries(res.data.emotions).map(([k, v]) => [k, v / 100])
          )
        })
        setEngagement(res.data.engagement || 0)
      }
    } catch {}
  }, [])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)
      audioChunksRef.current = []
      mediaRecorderRef.current.ondataavailable = e => audioChunksRef.current.push(e.data)
      mediaRecorderRef.current.start()
      setRecording(true)
    } catch {}
  }

  const stopRecording = () => {
    if (!mediaRecorderRef.current) return
    mediaRecorderRef.current.stop()
    mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop())
    setRecording(false)
    mediaRecorderRef.current.onstop = async () => {
      const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
      const form = new FormData()
      form.append('file', blob, 'audio.wav')
      try {
        const res = await API.post('/predict/audio', form)
        setSpeechResult(res.data)
        setTranscript(res.data.transcription || '')
      } catch {}
    }
  }

  const engColor = engagement >= 65 ? '#22c55e' : engagement >= 40 ? '#eab308' : '#ef4444'
  const engLabel = engagement >= 65 ? 'High' : engagement >= 40 ? 'Medium' : 'Low'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Floating orbs */}
      <div className="fixed top-20 left-10 w-72 h-72 bg-purple-600/20 rounded-full blur-3xl animate-float pointer-events-none" />
      <div className="fixed bottom-20 right-10 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl animate-float-delayed pointer-events-none" />
      <div className="fixed top-1/2 left-1/2 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl animate-float-slow pointer-events-none" />
      
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 py-8 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-fade-in-up">
          <div>
            <h1 className="text-3xl font-black text-white mb-2">
              Welcome back, <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">{user?.name}</span> 👋
            </h1>
            <p className="text-gray-400">
              <TypingText
                texts={['Track your emotions', 'Boost engagement', 'Learn smarter', 'AI-powered insights']}
                speed={60}
                className="text-purple-400"
              />
            </p>
          </div>

          {/* Stats */}
          {stats && (
            <div className="flex gap-4">
              {[
                { label: 'Sessions', value: stats.total_sessions, icon: '📊' },
                { label: 'Avg Engage', value: `${stats.avg_engagement}%`, icon: '⚡' },
                { label: 'Detections', value: stats.total_detections, icon: '🎯' },
              ].map((s, i) => (
                <GlassCard key={s.label} className="px-5 py-4 text-center animate-fade-in-up" style={{ animationDelay: `${i * 100}ms` }}>
                  <div className="text-2xl mb-1">{s.icon}</div>
                  <div className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    {s.value}
                  </div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </GlassCard>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-3 mb-8">
          {['live', 'history'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-3 rounded-2xl font-medium transition-all duration-300 ${
                tab === t
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30'
                  : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {t === 'live' ? '🎥 Live Session' : '📊 History'}
            </button>
          ))}
        </div>

        {error && (
          <GlassCard className="p-4 mb-6 border-red-500/30 bg-red-500/10">
            <p className="text-red-400">{error}</p>
          </GlassCard>
        )}

        {/* LIVE TAB */}
        {tab === 'live' && (
          <div className="space-y-6 animate-fade-in">
            {/* Controls */}
            <div className="flex gap-4 items-center">
              {!sessionActive ? (
                <button
                  onClick={startSession}
                  className="px-8 py-4 rounded-2xl font-bold text-white
                           bg-gradient-to-r from-green-500 to-emerald-500
                           hover:from-green-400 hover:to-emerald-400
                           shadow-lg shadow-green-500/30 hover:shadow-green-500/50
                           hover:scale-105 transition-all duration-300"
                >
                  ▶ Start Session
                </button>
              ) : (
                <button
                  onClick={stopSession}
                  className="px-8 py-4 rounded-2xl font-bold text-white
                           bg-gradient-to-r from-red-500 to-pink-500
                           hover:from-red-400 hover:to-pink-400
                           shadow-lg shadow-red-500/30 hover:shadow-red-500/50
                           hover:scale-105 transition-all duration-300 animate-pulse"
                >
                  ⏹ Stop & Save
                </button>
              )}
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
                cameraStatus === 'connected' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  cameraStatus === 'connected' ? 'bg-green-400 animate-pulse' : 'bg-gray-500'
                }`} />
                {cameraStatus === 'connected' ? 'Camera Active' : 'Camera Off'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Webcam */}
              <GlassCard className="p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <span className="text-2xl">📷</span> Face Emotion
                </h2>
                <div className="relative bg-black/50 rounded-2xl overflow-hidden aspect-video mb-4 border border-white/10">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  
                  {sessionActive && engagement > 0 && (
                    <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-xl rounded-2xl px-4 py-3 border border-white/10">
                      <div style={{ color: engColor }} className="font-bold text-lg">{engLabel}</div>
                      <div className="w-24 h-2 bg-gray-700 rounded-full mt-1 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${engagement}%`, background: engColor }}
                        />
                      </div>
                      <div className="text-gray-400 text-sm mt-1">{engagement.toFixed(0)}%</div>
                    </div>
                  )}
                  
                  {cameraStatus === 'off' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-5xl mb-3 animate-bounce-slow">📷</div>
                        <div className="text-gray-400">Camera off</div>
                        <div className="text-gray-600 text-sm">Click "Start Session"</div>
                      </div>
                    </div>
                  )}
                </div>

                {currentEmotion && (
                  <div className="space-y-3">
                    <div 
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-gradient-to-r ${EMOTION_COLORS[currentEmotion.emotion]?.gradient} text-white shadow-lg`}
                    >
                      {currentEmotion.emotion.toUpperCase()}
                    </div>
                    <div className="space-y-2">
                      {Object.entries(currentEmotion.scores)
                        .sort((a, b) => b[1] - a[1])
                        .map(([e, s]) => (
                          <div key={e} className="flex items-center gap-3">
                            <span className="w-20 text-gray-400 text-sm capitalize">{e}</span>
                            <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${s * 100}%`, background: EMOTION_COLORS[e]?.color }}
                              />
                            </div>
                            <span className="w-12 text-gray-500 text-sm text-right">{(s * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </GlassCard>

              {/* Speech */}
              <GlassCard className="p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <span className="text-2xl">🎙️</span> Speech Emotion
                </h2>
                <div className="mb-4">
                  {!recording ? (
                    <button
                      onClick={startRecording}
                      className="px-6 py-3 rounded-2xl font-medium text-white
                               bg-gradient-to-r from-purple-600 to-pink-600
                               hover:from-purple-500 hover:to-pink-500
                               shadow-lg shadow-purple-500/30 hover:scale-105
                               transition-all duration-300"
                    >
                      🎤 Start Recording
                    </button>
                  ) : (
                    <button
                      onClick={stopRecording}
                      className="px-6 py-3 rounded-2xl font-medium text-white
                               bg-gradient-to-r from-red-500 to-pink-500
                               shadow-lg shadow-red-500/30 animate-pulse
                               transition-all duration-300"
                    >
                      ⏹ Stop & Analyze
                    </button>
                  )}
                </div>

                {transcript && (
                  <div className="bg-white/5 rounded-2xl p-4 mb-4 border border-white/10">
                    <p className="text-gray-300 italic">"{transcript}"</p>
                  </div>
                )}

                {speechResult && (
                  <div className="space-y-3">
                    <div
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-gradient-to-r ${EMOTION_COLORS[speechResult.final_emotion]?.gradient} text-white shadow-lg`}
                    >
                      {speechResult.final_emotion.toUpperCase()}
                    </div>
                    <p className="text-gray-500 text-sm">
                      Text: {speechResult.text_emotion} | Audio: {speechResult.audio_emotion}
                    </p>
                    <div className="space-y-2">
                      {Object.entries(speechResult.fused_scores || {})
                        .sort((a, b) => b[1] - a[1])
                        .map(([e, s]) => (
                          <div key={e} className="flex items-center gap-3">
                            <span className="w-20 text-gray-400 text-sm capitalize">{e}</span>
                            <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${s * 100}%`, background: EMOTION_COLORS[e]?.color }}
                              />
                            </div>
                            <span className="w-12 text-gray-500 text-sm text-right">{(s * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </GlassCard>
            </div>

            {/* Learning Profile */}
            {profile && (
              <GlassCard className="p-6 animate-fade-in-up">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <span className="text-2xl">📊</span> Learning Profile
                </h2>
                <div className="grid grid-cols-4 gap-4 mb-6">
                  {[
                    { label: 'Dominant', value: profile.dominant_emotion?.toUpperCase(), icon: '🎭' },
                    { label: 'Engagement', value: `${profile.avg_engagement}%`, icon: '⚡', color: engColor },
                    { label: 'Variety', value: `${profile.unique_emotions}/7`, icon: '🌈' },
                    { label: 'Detections', value: profile.total_detections, icon: '🎯' },
                  ].map(s => (
                    <div key={s.label} className="bg-white/5 rounded-2xl p-4 text-center border border-white/5">
                      <div className="text-2xl mb-2">{s.icon}</div>
                      <div className="text-xl font-bold" style={{ color: s.color || '#a78bfa' }}>
                        {s.value}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  {Object.entries(profile.distribution || {})
                    .sort((a, b) => b[1] - a[1])
                    .map(([e, pct]) => (
                      <div key={e} className="flex items-center gap-4">
                        <span className="w-24 text-gray-400 capitalize">{e}</span>
                        <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${pct}%`, background: EMOTION_COLORS[e]?.color }}
                          />
                        </div>
                        <span className="w-12 text-gray-500 text-right">{pct}%</span>
                      </div>
                    ))}
                </div>
              </GlassCard>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {tab === 'history' && (
          <GlassCard className="p-6 animate-fade-in">
            <h2 className="text-xl font-bold text-white mb-6">Past Sessions</h2>
            {sessions.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">📭</div>
                <p className="text-gray-400">No sessions yet. Start your first session!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sessions.map((s, i) => (
                  <div
                    key={s.id}
                    className="bg-white/5 rounded-2xl p-5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all duration-300 animate-fade-in-up"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white font-medium">Session #{s.id}</div>
                        <div className="text-gray-500 text-sm">
                          {new Date(s.started_at).toLocaleDateString()} — {new Date(s.started_at).toLocaleTimeString()}
                        </div>
                      </div>
                      <div className="flex gap-6">
                        <div className="text-center">
                          <div className="font-bold" style={{
                            color: s.avg_engagement >= 65 ? '#22c55e' : s.avg_engagement >= 40 ? '#eab308' : '#ef4444'
                          }}>
                            {s.avg_engagement}%
                          </div>
                          <div className="text-xs text-gray-500">Engagement</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-purple-400 capitalize">{s.dominant_emotion}</div>
                          <div className="text-xs text-gray-500">Dominant</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-white">{s.total_detections}</div>
                          <div className="text-xs text-gray-500">Detections</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        )}
      </div>
    </div>
  )
}
