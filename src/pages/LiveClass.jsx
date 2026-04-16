import { useState, useEffect, useRef, useCallback } from 'react'
import GlassCard from '../components/GlassCard'
import API from '../api'

const EMOTION_EMOJI = {
  anger: '😠', disgust: '🤢', fear: '😨',
  happiness: '😊', neutral: '😐',
  sadness: '😢', surprise: '😲',
}

const EMOTION_COLORS = {
  anger: '#ef4444', disgust: '#a855f7', fear: '#f97316',
  happiness: '#22c55e', neutral: '#6b7280',
  sadness: '#3b82f6', surprise: '#eab308',
}

const engColor = (v) =>
  v >= 65 ? '#22c55e' : v >= 40 ? '#eab308' : '#ef4444'

const engLabel = (v) =>
  v >= 65 ? 'High' : v >= 40 ? 'Medium' : 'Low'

export default function LiveClass() {
  const [sessionActive, setSessionActive] = useState(false)
  const [cameraOn, setCameraOn] = useState(false)
  const [faces, setFaces] = useState([])           // current frame faces
  const [classEng, setClassEng] = useState(0)      // live class avg
  const [isProcessing, setIsProcessing] = useState(false)
  const [profile, setProfile] = useState(null)     // persistent per-face data
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState('')

  const videoRef     = useRef(null)
  const canvasRef    = useRef(null)
  const streamRef    = useRef(null)
  const intervalRef  = useRef(null)
  const durationRef  = useRef(null)
  const analyzingRef = useRef(false)
  const startTimeRef = useRef(null)

  // ─── Cleanup on unmount ────────────────────────────────────────────────
  useEffect(() => () => stopEverything(), [])

  // ─── Duration ticker ───────────────────────────────────────────────────
  useEffect(() => {
    if (sessionActive && startTimeRef.current) {
      durationRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 1000)
    }
    return () => clearInterval(durationRef.current)
  }, [sessionActive])

  // ─── Start webcam ──────────────────────────────────────────────────────
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
      setError('Cannot access camera — check browser permissions')
      return false
    }
  }

  // ─── Start session ─────────────────────────────────────────────────────
  const startSession = async () => {
    setError('')
    try {
      await API.post('/session/multi/start')
    } catch {
      // keep going even if call fails
    }
    const ok = await startWebcam()
    if (!ok) return

    startTimeRef.current = Date.now()
    setDuration(0)
    setSessionActive(true)
    setProfile(null)
    setFaces([])

    // Analyze every 1.2s
    intervalRef.current = setInterval(captureAndAnalyze, 1200)
  }

  // ─── Stop everything ───────────────────────────────────────────────────
  const stopEverything = () => {
    clearInterval(intervalRef.current)
    clearInterval(durationRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOn(false)
  }

  // ─── End session + pull final profile ──────────────────────────────────
  const endSession = async () => {
    clearInterval(intervalRef.current)
    clearInterval(durationRef.current)
    stopEverything()
    setSessionActive(false)

    try {
      const res = await API.get('/session/multi/profile')
      setProfile(res.data)
    } catch {
      setError('Could not load final session profile')
    }
  }

  // ─── Frame capture ─────────────────────────────────────────────────────
  const captureAndAnalyze = useCallback(async () => {
    if (analyzingRef.current || !videoRef.current || !canvasRef.current) return
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (video.readyState !== 4) return

    analyzingRef.current = true
    setIsProcessing(true)

    try {
      const ctx = canvas.getContext('2d')
      canvas.width  = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)

      const blob = await new Promise(r =>
        canvas.toBlob(r, 'image/jpeg', 0.8))

      const fd = new FormData()
      fd.append('file', blob, 'frame.jpg')

      const controller = new AbortController()
      const timeoutId  = setTimeout(() => controller.abort(), 15000)

      const res = await API.post('/api/detect-emotion-multi', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal : controller.signal,
      })
      clearTimeout(timeoutId)

      if (res.data && res.data.success) {
        setFaces(res.data.faces || [])
        setClassEng(res.data.class_engagement || 0)
      } else {
        setFaces([])
        setClassEng(0)
      }
    } catch (err) {
      if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
        console.error('Multi-detect error:', err)
      }
    } finally {
      analyzingRef.current = false
      setIsProcessing(false)
    }
  }, [])

  // ─── Download CSV ──────────────────────────────────────────────────────
  const downloadCSV = async () => {
    try {
      const res = await API.get('/session/export/multi-csv', {
        responseType: 'blob',
      })
      const url  = URL.createObjectURL(new Blob([res.data]))
      const a    = document.createElement('a')
      a.href     = url
      a.download = `class_session_${Date.now()}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('CSV export failed — make sure a session has data')
    }
  }

  // ─── Download HTML report ──────────────────────────────────────────────
  const downloadReport = async () => {
    try {
      const res = await API.get('/session/export/multi-report', {
        responseType: 'blob',
      })
      const url  = URL.createObjectURL(new Blob([res.data]))
      const a    = document.createElement('a')
      a.href     = url
      a.download = `class_report_${Date.now()}.html`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Report export failed — make sure a session has data')
    }
  }

  const fmt = (s) => {
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${m}:${r.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* ═════════ Top control bar ═════════ */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-3 h-3 rounded-full ${
              sessionActive ? 'bg-green-400 animate-pulse' : 'bg-gray-500'
            }`} />
            <div>
              <div className="text-white font-bold text-lg">
                {sessionActive ? 'Live Class Session' : 'Session Idle'}
              </div>
              <div className="text-gray-400 text-sm">
                {sessionActive
                  ? `Duration: ${fmt(duration)} — tracking ${faces.length} face${faces.length === 1 ? '' : 's'}`
                  : 'Start a session to begin multi-face tracking'}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            {!sessionActive ? (
              <button
                onClick={startSession}
                className="px-6 py-3 rounded-2xl font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-lg shadow-amber-500/30 hover:scale-105 transition-all duration-300"
              >
                ▶️ Start Live Class
              </button>
            ) : (
              <button
                onClick={endSession}
                className="px-6 py-3 rounded-2xl font-bold text-white bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-400 hover:to-pink-400 shadow-lg shadow-red-500/30 hover:scale-105 transition-all duration-300"
              >
                ⏹ End Session
              </button>
            )}
            <button
              onClick={downloadCSV}
              disabled={sessionActive}
              className="px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300"
            >
              📄 CSV
            </button>
            <button
              onClick={downloadReport}
              disabled={sessionActive}
              className="px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300"
            >
              📊 Report
            </button>
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-3 gap-6">
        {/* ═════════ Video feed ═════════ */}
        <div className="col-span-2">
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="text-2xl">🎥</span> Live Class Feed
              </h2>
              {isProcessing && (
                <div className="flex items-center gap-2 text-amber-400 text-sm">
                  <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                  Analyzing
                </div>
              )}
            </div>

            <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${cameraOn ? '' : 'hidden'}`}
              />
              {!cameraOn && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-6xl mb-4">📹</div>
                    <p className="text-gray-500">Camera off</p>
                  </div>
                </div>
              )}

              {/* Bounding-box overlay */}
              {cameraOn && faces.length > 0 && (
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox={`0 0 ${videoRef.current?.videoWidth || 640} ${videoRef.current?.videoHeight || 480}`}
                  preserveAspectRatio="xMidYMid slice"
                >
                  {faces.map((f) => {
                    const [x, y, w, h] = f.bbox
                    const color = engColor(f.engagement)
                    return (
                      <g key={f.face_id}>
                        <rect
                          x={x} y={y} width={w} height={h}
                          stroke={color} strokeWidth="3"
                          fill="none" rx="6"
                        />
                        <rect
                          x={x} y={Math.max(0, y - 26)}
                          width={Math.min(w, 180)} height="22"
                          fill={color}
                        />
                        <text
                          x={x + 6} y={Math.max(16, y - 10)}
                          fill="white" fontSize="14" fontWeight="bold"
                        >
                          #{f.face_id} {f.emotion.toUpperCase()} · {Math.round(f.engagement)}%
                        </text>
                      </g>
                    )
                  })}
                </svg>
              )}

              <canvas ref={canvasRef} className="hidden" />
            </div>
          </GlassCard>
        </div>

        {/* ═════════ Class engagement panel ═════════ */}
        <div>
          <GlassCard className="p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="text-2xl">⚡</span> Class Engagement
            </h2>

            <div className="text-center py-6">
              <div
                className="text-6xl font-black"
                style={{ color: engColor(classEng) }}
              >
                {Math.round(classEng)}%
              </div>
              <div className="text-gray-400 mt-2">
                {engLabel(classEng)} engagement
              </div>
            </div>

            <div className="h-3 bg-white/5 rounded-full overflow-hidden mb-6">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(100, classEng)}%`,
                  background: engColor(classEng),
                }}
              />
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Faces in frame</span>
                <span className="text-white font-bold">{faces.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Session time</span>
                <span className="text-white font-bold">{fmt(duration)}</span>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* ═════════ Per-face live cards ═════════ */}
      {faces.length > 0 && (
        <GlassCard className="p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-2xl">👥</span>
            Per-Student Tracking
            <span className="text-sm font-normal text-gray-500 ml-2">
              (live from multi-face detection)
            </span>
          </h2>

          <div className="grid grid-cols-4 gap-4">
            {faces.map((f) => {
              const color = engColor(f.engagement)
              return (
                <div
                  key={f.face_id}
                  className="bg-white/5 border border-white/5 rounded-2xl p-4 hover:bg-white/10 transition-all duration-300"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-white font-bold">Face #{f.face_id}</div>
                    <div
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: `${color}20`,
                        color,
                        border: `1px solid ${color}`,
                      }}
                    >
                      {engLabel(f.engagement)}
                    </div>
                  </div>

                  <div className="text-center mb-3">
                    <div className="text-4xl mb-1">
                      {EMOTION_EMOJI[f.emotion] || '😐'}
                    </div>
                    <div
                      className="text-sm font-bold capitalize"
                      style={{ color: EMOTION_COLORS[f.emotion] }}
                    >
                      {f.emotion}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Engagement</span>
                      <span style={{ color }}>{Math.round(f.engagement)}%</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, f.engagement)}%`,
                          background: color,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </GlassCard>
      )}

      {/* ═════════ Post-session profile ═════════ */}
      {profile && profile.faces && profile.faces.length > 0 && (
        <GlassCard className="p-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <span className="text-2xl">📈</span> Session Summary
          </h2>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white/5 rounded-2xl p-4 text-center border border-white/5">
              <div className="text-3xl font-black text-white">
                {profile.face_count}
              </div>
              <div className="text-xs text-gray-400 mt-1">Students Tracked</div>
            </div>
            <div className="bg-white/5 rounded-2xl p-4 text-center border border-white/5">
              <div
                className="text-3xl font-black"
                style={{ color: engColor(profile.class_avg_engagement) }}
              >
                {profile.class_avg_engagement}%
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Class Avg ({profile.class_engagement_label})
              </div>
            </div>
            <div className="bg-white/5 rounded-2xl p-4 text-center border border-white/5">
              <div className="text-3xl font-black text-white">
                {profile.faces.reduce(
                  (sum, f) => sum + f.total_detections, 0)}
              </div>
              <div className="text-xs text-gray-400 mt-1">Total Detections</div>
            </div>
          </div>

          <div className="space-y-3">
            {profile.faces.map((f) => (
              <div
                key={f.face_id}
                className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white font-bold">
                  #{f.face_id}
                </div>
                <div className="flex-1">
                  <div className="text-white font-bold">Face #{f.face_id}</div>
                  <div className="text-gray-400 text-sm capitalize">
                    Dominant: {f.dominant_emotion} · {f.total_detections} detections
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className="font-bold text-lg"
                    style={{ color: engColor(f.avg_engagement) }}
                  >
                    {f.avg_engagement}%
                  </div>
                  <div className="text-xs text-gray-500">
                    {f.engagement_label} engagement
                  </div>
                </div>
                <div className="w-32">
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${f.avg_engagement}%`,
                        background: engColor(f.avg_engagement),
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  )
}
