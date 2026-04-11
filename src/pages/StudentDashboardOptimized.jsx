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

  // Session tracking
  const emotionHistoryRef = useRef([])
  const detectionCountRef = useRef(0)

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const intervalRef = useRef(null)
  const durationIntervalRef = useRef(null)
  const isAnalyzingRef = useRef(false)

  useEffect(() => {
    loadStats()
    loadSessions()
    return () => {
      stopEverything()
    }
  }, [])

  // Update duration timer
  useEffect(() => {
    if (isSessionActive && sessionStartTime) {
      durationIntervalRef.current = setInterval(() => {
        setSessionDuration(Math.floor((Date.now() - sessionStartTime) / 1000))
      }, 1000)
    }
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
      }
    }
  }, [isSessionActive, sessionStartTime])

  const loadStats = async () => {
    try {
      const res = await API.get('/students/stats')
      setStats(res.data)
    } catch (err) {
      console.log('Stats not available')
    }
  }

  const loadSessions = async () => {
    try {
      const res = await API.get('/students/sessions')
      setSessions(res.data || [])
    } catch (err) {
      console.log('Sessions not available')
    }
  }

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      
      streamRef.current = stream
      setCameraOn(true)
      return true
    } catch (err) {
      console.error('Camera error:', err)
      alert('Could not access camera. Please allow camera permissions.')
      return false
    }
  }

  const stopWebcam = useCallback(() => {
    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop()
      })
      streamRef.current = null
    }
    
    // Clear video element
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    
    setCameraOn(false)
  }, [])

  const stopEverything = useCallback(() => {
    // Clear intervals
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current)
      durationIntervalRef.current = null
    }
    
    // Stop webcam
    stopWebcam()
    
    // Reset flags
    isAnalyzingRef.current = false
  }, [stopWebcam])

  const startSession = async () => {
    const cameraStarted = await startWebcam()
    if (!cameraStarted) return

    // Reset session data
    emotionHistoryRef.current = []
    detectionCountRef.current = 0
    setSessionStartTime(Date.now())
    setSessionDuration(0)
    setIsSessionActive(true)

    // Notify backend
    try {
      await API.post('/session/start')
    } catch (err) {
      console.log('Session start notification failed')
    }

    // Start emotion detection loop - 3 seconds between each (for slow server)
    intervalRef.current = setInterval(captureAndAnalyze, 3000)
    
    // Capture first frame immediately
    setTimeout(captureAndAnalyze, 500)
  }

  const stopSession = async () => {
    // Stop detection loop
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    // Prepare session data for report
    const finalSessionData = {
      duration: sessionDuration,
      totalDetections: detectionCountRef.current,
      emotionHistory: emotionHistoryRef.current,
      avgEngagement: engagement
    }
    setSessionData(finalSessionData)

    // Stop camera
    stopWebcam()
    setIsSessionActive(false)

    // Save session to backend
    try {
      await API.post('/session/end', {
        duration: sessionDuration,
        detections: detectionCountRef.current,
        avgEngagement: engagement
      })
    } catch (err) {
      console.log('Session end notification failed')
    }

    // Show report
    setShowReport(true)

    // Reload stats
    loadStats()
    loadSessions()
  }

  const captureAndAnalyze = async () => {
    // Prevent overlapping requests
    if (isAnalyzingRef.current || !videoRef.current || !canvasRef.current) {
      return
    }

    const video = videoRef.current
    const canvas = canvasRef.current
    
    if (video.readyState !== 4) return

    isAnalyzingRef.current = true
    setIsProcessing(true)

    try {
      // Capture frame
      const ctx = canvas.getContext('2d')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)
      
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8))
      
      const formData = new FormData()
      formData.append('file', blob, 'frame.jpg')

      // Send to backend with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15s timeout

      const res = await API.post('/api/detect-emotion', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (res.data) {
        const { dominant, confidence, emotions, engagement: eng } = res.data
        
        setCurrentEmotion(dominant)
        setEmotionScores(emotions || {})
        setEngagement(eng || confidence || 50)

        // Track history
        detectionCountRef.current += 1
        emotionHistoryRef.current.push({
          timestamp: sessionDuration,
          emotion: dominant,
          confidence: confidence || 50,
          scores: emotions || {}
        })
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Request timed out, will retry')
      } else {
        console.error('Detection error:', err)
      }
    } finally {
      isAnalyzingRef.current = false
      setIsProcessing(false)
    }
  }

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Background effects */}
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
            <TypingText
              texts={['Track your emotions', 'Improve your focus', 'Learn smarter']}
              speed={60}
              className="text-gray-400"
            />
          </div>

          {/* Stats */}
          <div className="flex gap-4">
            {[
              { label: 'Sessions', value: stats.sessions || 0, icon: '📊' },
              { label: 'Avg Engage', value: `${Math.round(stats.avgEngagement || 0)}%`, icon: '⚡' },
              { label: 'Detections', value: stats.detections || 0, icon: '🎯' },
            ].map((stat, i) => (
              <GlassCard key={stat.label} className="px-5 py-4 text-center">
                <div className="text-2xl mb-1">{stat.icon}</div>
                <div className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-xs text-gray-500">{stat.label}</div>
              </GlassCard>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-3 mb-6">
          {[
            { id: 'live', label: '🎥 Live Session' },
            { id: 'history', label: '📚 History' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-6 py-3 rounded-2xl font-medium transition-all duration-300 ${
                tab === t.id
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg'
                  : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'live' && (
          <div className="space-y-6">
            {/* Session Controls */}
            <div className="flex items-center gap-4">
              {!isSessionActive ? (
                <button
                  onClick={startSession}
                  className="px-8 py-4 rounded-2xl font-bold text-white bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 shadow-lg shadow-green-500/30 hover:scale-105 transition-all duration-300 flex items-center gap-2"
                >
                  ▶ Start Session
                </button>
              ) : (
                <button
                  onClick={stopSession}
                  className="px-8 py-4 rounded-2xl font-bold text-white bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-400 hover:to-rose-400 shadow-lg shadow-red-500/30 hover:scale-105 transition-all duration-300 flex items-center gap-2"
                >
                  ⏹ Stop Session
                </button>
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

              <div className="flex items-center gap-2 text-gray-500">
                <div className={`w-2 h-2 rounded-full ${cameraOn ? 'bg-green-500' : 'bg-gray-500'}`} />
                <span className="text-sm">{cameraOn ? 'Camera On' : 'Camera Off'}</span>
              </div>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-2 gap-6">
              {/* Video Feed */}
              <GlassCard className="p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  📹 Face Emotion
                </h2>
                
                <div className="relative aspect-video bg-black/50 rounded-2xl overflow-hidden mb-4">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  
                  {!cameraOn && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="text-5xl mb-3">📷</div>
                      <p className="text-gray-400">Camera off</p>
                      <p className="text-gray-500 text-sm">Click "Start Session"</p>
                    </div>
                  )}

                  {/* Current Emotion Overlay */}
                  {currentEmotion && cameraOn && (
                    <div className="absolute top-4 left-4 px-4 py-2 rounded-xl bg-black/60 backdrop-blur-sm border border-white/10">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{EMOTION_COLORS[currentEmotion]?.emoji}</span>
                        <span className="text-white font-bold capitalize">{currentEmotion}</span>
                      </div>
                    </div>
                  )}

                  {/* Engagement Overlay */}
                  {isSessionActive && (
                    <div className="absolute top-4 right-4 px-4 py-2 rounded-xl bg-black/60 backdrop-blur-sm border border-white/10">
                      <div className="text-center">
                        <div className="text-xl font-bold" style={{ 
                          color: engagement >= 60 ? '#22c55e' : engagement >= 40 ? '#eab308' : '#ef4444' 
                        }}>
                          {Math.round(engagement)}%
                        </div>
                        <div className="text-xs text-gray-400">Engagement</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Emotion Bars */}
                {currentEmotion && (
                  <div className="space-y-2">
                    {Object.entries(emotionScores)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 5)
                      .map(([emotion, score]) => (
                        <div key={emotion} className="flex items-center gap-2">
                          <span className="w-6 text-center">{EMOTION_COLORS[emotion]?.emoji}</span>
                          <span className="w-20 text-gray-400 text-sm capitalize">{emotion}</span>
                          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${score}%`, background: EMOTION_COLORS[emotion]?.hex }}
                            />
                          </div>
                          <span className="w-12 text-right text-gray-500 text-sm">{Math.round(score)}%</span>
                        </div>
                      ))}
                  </div>
                )}
              </GlassCard>

              {/* Session Info */}
              <GlassCard className="p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  📊 Session Info
                </h2>

                {isSessionActive ? (
                  <div className="space-y-6">
                    {/* Live Stats */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/5 rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-white">{detectionCountRef.current}</div>
                        <div className="text-sm text-gray-500">Detections</div>
                      </div>
                      <div className="bg-white/5 rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold" style={{
                          color: engagement >= 60 ? '#22c55e' : engagement >= 40 ? '#eab308' : '#ef4444'
                        }}>
                          {Math.round(engagement)}%
                        </div>
                        <div className="text-sm text-gray-500">Engagement</div>
                      </div>
                    </div>

                    {/* Current Dominant */}
                    {currentEmotion && (
                      <div className="bg-white/5 rounded-xl p-5 text-center">
                        <div className="text-4xl mb-2">{EMOTION_COLORS[currentEmotion]?.emoji}</div>
                        <div className="text-xl font-bold text-white capitalize">{currentEmotion}</div>
                        <div className="text-sm text-gray-500">Current Emotion</div>
                      </div>
                    )}

                    {/* Tip */}
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                      <p className="text-blue-300 text-sm">
                        💡 <strong>Tip:</strong> Analysis runs every 3 seconds. 
                        Stay still for best results. Click "Stop Session" to see your full report!
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🎯</div>
                    <h3 className="text-xl font-bold text-white mb-2">Ready to Start?</h3>
                    <p className="text-gray-400 mb-6">
                      Click "Start Session" to begin emotion tracking.<br />
                      You'll get a detailed report when you finish!
                    </p>
                  </div>
                )}
              </GlassCard>
            </div>
          </div>
        )}

        {tab === 'history' && (
          <GlassCard className="p-6">
            <h2 className="text-xl font-bold text-white mb-6">📚 Session History</h2>
            {sessions.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">📊</div>
                <p className="text-gray-400">No sessions yet. Start your first session!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sessions.map((s, i) => (
                  <div key={s.id || i} className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white font-medium">
                          Session #{sessions.length - i}
                        </div>
                        <div className="text-gray-500 text-sm">
                          {new Date(s.created_at || s.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex gap-6">
                        <div className="text-center">
                          <div className="text-lg font-bold text-white">{s.duration || 0}s</div>
                          <div className="text-xs text-gray-500">Duration</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-blue-400">{s.detections || 0}</div>
                          <div className="text-xs text-gray-500">Detections</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold" style={{
                            color: (s.avg_engagement || 0) >= 60 ? '#22c55e' : '#eab308'
                          }}>
                            {Math.round(s.avg_engagement || 0)}%
                          </div>
                          <div className="text-xs text-gray-500">Engagement</div>
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

      {/* Session Report Modal */}
      {showReport && sessionData && (
        <SessionReport
          sessionData={sessionData}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  )
}
