import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import API from '../api'

const EMOTION_COLORS = {
  anger    : '#ef4444',
  disgust  : '#a855f7',
  fear     : '#f97316',
  happiness: '#22c55e',
  neutral  : '#6b7280',
  sadness  : '#3b82f6',
  surprise : '#eab308',
}

export default function StudentDashboard() {
  const { user }                  = useAuth()
  const [tab, setTab]             = useState('live')
  const [sessionActive, setActive]= useState(false)
  const [profile, setProfile]     = useState(null)
  const [sessions, setSessions]   = useState([])
  const [stats, setStats]         = useState(null)
  const [cameraStatus, setCameraStatus] = useState('off')
  const [currentEmotion, setCurrent] = useState(null)
  const [engagement, setEngagement]  = useState(0)
  const [recording, setRecording]    = useState(false)
  const [speechResult, setSpeechResult] = useState(null)
  const [transcript, setTranscript]     = useState('')
  const [error, setError]               = useState('')

  const videoRef         = useRef(null)
  const canvasRef        = useRef(null)
  const streamRef        = useRef(null)
  const intervalRef      = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef   = useRef([])
  const profileInterval  = useRef(null)

  // Load history and stats on mount
  useEffect(() => {
    loadSessions()
    loadStats()
    return () => {
      // Cleanup on unmount
      stopWebcam()
    }
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
    // Save session to DB
    if (profile) {
      try {
        await API.post('/sessions/save', {
          avg_engagement    : profile.avg_engagement,
          overall_engagement: profile.overall_engagement,
          dominant_emotion  : profile.dominant_emotion,
          total_detections  : profile.total_detections,
          unique_emotions   : profile.unique_emotions,
          distribution      : profile.distribution,
          emotion_logs      : profile.timeline || [],
        })
        loadSessions()
        loadStats()
      } catch {}
    }
  }

  // Start browser webcam
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
      
      // Start sending frames to API
      intervalRef.current = setInterval(captureAndAnalyze, 500) // 2 FPS
      
    } catch (err) {
      console.error('Webcam error:', err)
      setError('Camera access denied. Please allow camera permissions.')
      setCameraStatus('error')
    }
  }

  // Stop webcam
  const stopWebcam = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraStatus('off')
  }

  // Capture frame and send to API
  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return
    if (videoRef.current.readyState !== 4) return // Video not ready
    
    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    // Set canvas size to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    
    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0)
    
    // Convert to base64
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
    } catch (err) {
      console.error('Detection error:', err)
    }
  }, [])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        { audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)
      audioChunksRef.current   = []
      mediaRecorderRef.current.ondataavailable = e =>
        audioChunksRef.current.push(e.data)
      mediaRecorderRef.current.start()
      setRecording(true)
    } catch {}
  }

  const stopRecording = () => {
    if (!mediaRecorderRef.current) return
    mediaRecorderRef.current.stop()
    mediaRecorderRef.current.stream
      .getTracks().forEach(t => t.stop())
    setRecording(false)
    mediaRecorderRef.current.onstop = async () => {
      const blob = new Blob(audioChunksRef.current,
                            { type: 'audio/wav' })
      const form = new FormData()
      form.append('file', blob, 'audio.wav')
      try {
        const res = await API.post('/predict/audio', form)
        setSpeechResult(res.data)
        setTranscript(res.data.transcription || '')
      } catch {}
    }
  }

  const engColor = engagement >= 65 ? '#22c55e'
                 : engagement >= 40 ? '#eab308' : '#ef4444'
  const engLabel = engagement >= 65 ? 'High'
                 : engagement >= 40 ? 'Medium' : 'Low'

  return (
    <div className="min-h-screen bg-dark">
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">
              Welcome back, {user?.name} 👋
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Track your emotions and engagement during learning
            </p>
          </div>

          {/* Stats row */}
          {stats && (
            <div className="flex gap-4">
              {[
                { label: 'Sessions',   value: stats.total_sessions },
                { label: 'Avg Engage', value: stats.avg_engagement + '%' },
                { label: 'Detections', value: stats.total_detections },
              ].map(s => (
                <div key={s.label}
                     className="bg-card border border-border
                                rounded-xl px-4 py-3 text-center">
                  <div className="text-xl font-bold text-purple-400">
                    {s.value}
                  </div>
                  <div className="text-xs text-gray-500">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {['live', 'history'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg font-medium
                          capitalize transition-colors text-sm
                          ${tab === t
                            ? 'bg-primary text-white'
                            : 'bg-card border border-border text-gray-400 hover:border-primary'
                          }`}
            >
              {t === 'live' ? '🎥 Live Session' : '📊 History'}
            </button>
          ))}
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 
                          rounded-lg p-4 mb-6 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* ── LIVE TAB ── */}
        {tab === 'live' && (
          <div className="space-y-6">

            {/* Session controls */}
            <div className="flex gap-3 items-center">
              {!sessionActive ? (
                <button
                  onClick={startSession}
                  className="bg-primary hover:bg-purple-700 text-white
                             px-6 py-2.5 rounded-lg font-medium
                             transition-colors"
                >
                  ▶ Start Session
                </button>
              ) : (
                <button
                  onClick={stopSession}
                  className="bg-red-600 hover:bg-red-700 text-white
                             px-6 py-2.5 rounded-lg font-medium
                             transition-colors"
                >
                  ⏹ Stop & Save Session
                </button>
              )}
              <span className={`text-sm flex items-center gap-2
                ${cameraStatus === 'connected'
                  ? 'text-green-400' : 'text-gray-500'}`}>
                <span className={`w-2 h-2 rounded-full inline-block
                  ${cameraStatus === 'connected'
                    ? 'bg-green-400 animate-pulse' 
                    : cameraStatus === 'starting'
                    ? 'bg-yellow-400 animate-pulse'
                    : 'bg-gray-600'}`}>
                </span>
                {cameraStatus === 'connected' ? 'Camera streaming' 
                 : cameraStatus === 'starting' ? 'Starting camera...'
                 : 'Camera off'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-6">

              {/* Webcam */}
              <div className="bg-card border border-border
                              rounded-2xl p-5">
                <h2 className="text-purple-400 font-semibold mb-4">
                  📷 Face Emotion
                </h2>
                <div className="relative bg-black rounded-xl
                                overflow-hidden aspect-video mb-4">
                  {/* Live video element */}
                  <video 
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover mirror"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                  {/* Hidden canvas for frame capture */}
                  <canvas ref={canvasRef} className="hidden" />
                  
                  {/* Engagement overlay */}
                  {sessionActive && engagement > 0 && (
                    <div className="absolute bottom-3 right-3
                                    bg-black/80 rounded-lg px-3
                                    py-2 text-xs text-center">
                      <div style={{ color: engColor }}
                           className="font-bold text-base">
                        {engLabel}
                      </div>
                      <div className="w-20 h-1.5 bg-gray-700
                                      rounded-full mt-1">
                        <div className="h-full rounded-full
                                        transition-all duration-500"
                             style={{ width: engagement + '%',
                                      background: engColor }}>
                        </div>
                      </div>
                      <div className="text-gray-400 mt-0.5">
                        {engagement.toFixed(0)}%
                      </div>
                    </div>
                  )}
                  
                  {/* Camera off placeholder */}
                  {cameraStatus === 'off' && (
                    <div className="absolute inset-0 flex items-center 
                                    justify-center text-gray-500">
                      <div className="text-center">
                        <div className="text-4xl mb-2">📷</div>
                        <div className="text-sm">Camera off</div>
                        <div className="text-xs text-gray-600 mt-1">
                          Click "Start Session" to begin
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {currentEmotion && (
                  <div>
                    <div className="inline-block px-4 py-1.5
                                    rounded-full text-sm font-bold mb-3"
                         style={{
                           background: EMOTION_COLORS[currentEmotion.emotion] + '20',
                           color     : EMOTION_COLORS[currentEmotion.emotion],
                           border    : `1px solid ${EMOTION_COLORS[currentEmotion.emotion]}`,
                         }}>
                      {currentEmotion.emotion.toUpperCase()}
                    </div>
                    <div className="space-y-1.5">
                      {Object.entries(currentEmotion.scores)
                        .sort((a,b) => b[1]-a[1])
                        .map(([e,s]) => (
                          <div key={e}
                               className="flex items-center gap-2 text-xs">
                            <span className="w-20 text-gray-400 truncate">
                              {e}
                            </span>
                            <div className="flex-1 h-1.5 bg-gray-700
                                            rounded-full overflow-hidden">
                              <div className="h-full rounded-full"
                                   style={{
                                     width     : s*100+'%',
                                     background: EMOTION_COLORS[e]
                                   }}>
                              </div>
                            </div>
                            <span className="text-gray-500 w-8
                                             text-right">
                              {(s*100).toFixed(0)}%
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Speech */}
              <div className="bg-card border border-border
                              rounded-2xl p-5">
                <h2 className="text-purple-400 font-semibold mb-4">
                  🎙️ Speech Emotion
                </h2>
                <div className="flex gap-3 mb-4">
                  {!recording ? (
                    <button
                      onClick={startRecording}
                      className="bg-primary hover:bg-purple-700
                                 text-white px-4 py-2 rounded-lg
                                 text-sm font-medium transition-colors"
                    >
                      🎤 Start Recording
                    </button>
                  ) : (
                    <button
                      onClick={stopRecording}
                      className="bg-red-600 hover:bg-red-700
                                 text-white px-4 py-2 rounded-lg
                                 text-sm font-medium transition-colors
                                 animate-pulse"
                    >
                      ⏹ Stop & Analyze
                    </button>
                  )}
                </div>

                {transcript && (
                  <div className="bg-dark rounded-lg p-3 mb-4
                                  text-sm text-gray-300 italic">
                    "{transcript}"
                  </div>
                )}

                {speechResult && (
                  <div>
                    <div className="inline-block px-4 py-1.5
                                    rounded-full text-sm font-bold mb-3"
                         style={{
                           background: EMOTION_COLORS[speechResult.final_emotion]+'20',
                           color     : EMOTION_COLORS[speechResult.final_emotion],
                           border    : `1px solid ${EMOTION_COLORS[speechResult.final_emotion]}`,
                         }}>
                      {speechResult.final_emotion.toUpperCase()}
                    </div>
                    <div className="text-xs text-gray-500 mb-3">
                      Text: {speechResult.text_emotion} |
                      Audio: {speechResult.audio_emotion}
                    </div>
                    <div className="space-y-1.5">
                      {Object.entries(speechResult.fused_scores||{})
                        .sort((a,b) => b[1]-a[1])
                        .map(([e,s]) => (
                          <div key={e}
                               className="flex items-center gap-2 text-xs">
                            <span className="w-20 text-gray-400">
                              {e}
                            </span>
                            <div className="flex-1 h-1.5 bg-gray-700
                                            rounded-full overflow-hidden">
                              <div className="h-full rounded-full"
                                   style={{
                                     width     : s*100+'%',
                                     background: EMOTION_COLORS[e]
                                   }}>
                              </div>
                            </div>
                            <span className="text-gray-500 w-8
                                             text-right">
                              {(s*100).toFixed(0)}%
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Learning Profile */}
            {profile && (
              <div className="bg-card border border-border
                              rounded-2xl p-5">
                <h2 className="text-purple-400 font-semibold mb-4">
                  📊 Learning Profile
                </h2>
                <div className="grid grid-cols-4 gap-4 mb-6">
                  {[
                    { label: 'Dominant',   value: profile.dominant_emotion?.toUpperCase() },
                    { label: 'Engagement', value: profile.avg_engagement + '%',
                      color: engColor },
                    { label: 'Variety',    value: profile.unique_emotions + '/7' },
                    { label: 'Detections', value: profile.total_detections },
                  ].map(s => (
                    <div key={s.label}
                         className="bg-dark rounded-xl p-4 text-center">
                      <div className="text-xl font-bold"
                           style={{ color: s.color || '#a78bfa' }}>
                        {s.value}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Distribution */}
                <div className="space-y-2">
                  {Object.entries(profile.distribution||{})
                    .sort((a,b) => b[1]-a[1])
                    .map(([e, pct]) => (
                      <div key={e}
                           className="flex items-center gap-3 text-sm">
                        <span className="w-24 text-gray-400 capitalize">
                          {e}
                        </span>
                        <div className="flex-1 h-2 bg-gray-700
                                        rounded-full overflow-hidden">
                          <div className="h-full rounded-full"
                               style={{
                                 width     : pct + '%',
                                 background: EMOTION_COLORS[e]
                               }}>
                          </div>
                        </div>
                        <span className="text-gray-500 w-10
                                         text-right text-xs">
                          {pct}%
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === 'history' && (
          <div className="bg-card border border-border
                          rounded-2xl p-5">
            <h2 className="text-purple-400 font-semibold mb-4">
              Past Sessions
            </h2>
            {sessions.length === 0 ? (
              <p className="text-gray-500 text-sm">
                No sessions yet. Start your first session!
              </p>
            ) : (
              <div className="space-y-3">
                {sessions.map(s => (
                  <div key={s.id}
                       className="bg-dark rounded-xl p-4 flex
                                  items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">
                        Session #{s.id}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {new Date(s.started_at).toLocaleDateString()} —
                        {new Date(s.started_at).toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="flex gap-4 items-center">
                      <div className="text-center">
                        <div className="text-sm font-bold"
                             style={{
                               color: s.avg_engagement >= 65
                                 ? '#22c55e'
                                 : s.avg_engagement >= 40
                                 ? '#eab308' : '#ef4444'
                             }}>
                          {s.avg_engagement}%
                        </div>
                        <div className="text-xs text-gray-500">
                          Engagement
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-bold
                                        text-purple-400 capitalize">
                          {s.dominant_emotion}
                        </div>
                        <div className="text-xs text-gray-500">
                          Dominant
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-bold text-white">
                          {s.total_detections}
                        </div>
                        <div className="text-xs text-gray-500">
                          Detections
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
