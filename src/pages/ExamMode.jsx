import { useState, useEffect, useRef, useCallback } from 'react'
import GlassCard from '../components/GlassCard'
import API from '../api'

const EMOTION_COLORS = {
  anger: '#ef4444', disgust: '#a855f7', fear: '#f97316',
  happiness: '#22c55e', neutral: '#6b7280',
  sadness: '#3b82f6', surprise: '#eab308',
}

const REGION_LABELS = {
  center: '✅ Focused', top_left: '⚠️ Top-Left', top_right: '⚠️ Top-Right',
  bottom_left: '⚠️ Bottom-Left', bottom_right: '⚠️ Bottom-Right',
  top: '⚠️ Looking Up', bottom: '⚠️ Looking Down',
  left: '⚠️ Left', right: '⚠️ Right', absent: '🔴 Away',
}

const focusColor = (s) => s >= 85 ? '#22c55e' : s >= 70 ? '#3b82f6' : s >= 50 ? '#eab308' : '#ef4444'

export default function ExamMode() {
  const [examActive, setExamActive] = useState(false)
  const [cameraOn, setCameraOn] = useState(false)
  const [examId, setExamId] = useState('')
  const [duration, setDuration] = useState(0)
  const [currentEmotion, setCurrentEmotion] = useState(null)
  const [currentRegion, setCurrentRegion] = useState('center')
  const [focusScore, setFocusScore] = useState(100)
  const [isProcessing, setIsProcessing] = useState(false)
  const [report, setReport] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [detectionCount, setDetectionCount] = useState(0)
  const [interactionCount, setInteractionCount] = useState(0)
  const [warnings, setWarnings] = useState([])

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const intervalRef = useRef(null)
  const durationRef = useRef(null)
  const startTimeRef = useRef(null)
  const isAnalyzingRef = useRef(false)
  const examIdRef = useRef('')
  const lastInteractionRef = useRef(Date.now())
  const gazeBufferRef = useRef([])  // last N gaze readings for smoothing

  useEffect(() => () => stopEverything(), [])

  useEffect(() => {
    if (examActive) {
      durationRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 1000)
    }
    return () => clearInterval(durationRef.current)
  }, [examActive])

  // Track keyboard and mouse interactions
  useEffect(() => {
    if (!examActive) return
    const logInteraction = (type) => {
      const ts = Math.floor((Date.now() - startTimeRef.current) / 1000)
      lastInteractionRef.current = Date.now()
      setInteractionCount(c => c + 1)
      API.post('/api/exam/interaction', {
        exam_id: examIdRef.current,
        interactions: [{ timestamp: ts, type }],
      }).catch(() => {})
    }
    const onKey = () => logInteraction('keypress')
    const onClick = () => logInteraction('click')
    window.addEventListener('keydown', onKey)
    window.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('click', onClick)
    }
  }, [examActive])

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      })
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }
      streamRef.current = stream
      setCameraOn(true)
      return true
    } catch { alert('Camera access required for exam monitoring.'); return false }
  }

  const stopEverything = useCallback(() => {
    clearInterval(intervalRef.current)
    clearInterval(durationRef.current)
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOn(false)
    isAnalyzingRef.current = false
  }, [])

  const startExam = async () => {
    try {
      const res = await API.post('/api/exam/start', { exam_id: '', student_id: 0 })
      const id = res.data?.exam_id || `exam_${Date.now()}`
      setExamId(id)
      examIdRef.current = id
    } catch { const id = `exam_${Date.now()}`; setExamId(id); examIdRef.current = id }
    startTimeRef.current = Date.now()
    setDuration(0)
    setExamActive(true)  // renders the video element first
    setReport(null)
    setDetectionCount(0)
    setInteractionCount(0)
    setWarnings([])
    setFocusScore(100)
    gazeBufferRef.current = []
    // Camera starts via useEffect below after video element mounts
  }

  // Start camera once examActive is true and video element exists
  useEffect(() => {
    if (!examActive) return
    let cancelled = false
    const initCamera = async () => {
      // Small delay to let React render the video element
      await new Promise(r => setTimeout(r, 100))
      if (cancelled) return
      const ok = await startWebcam()
      if (ok && !cancelled) {
        intervalRef.current = setInterval(captureFrame, 3000)
        setTimeout(captureFrame, 500)
      }
    }
    initCamera()
    return () => { cancelled = true }
  }, [examActive])

  const endExam = async () => {
    clearInterval(intervalRef.current)
    clearInterval(durationRef.current)
    stopEverything()
    setExamActive(false)
    setGenerating(true)
    try {
      const res = await API.post('/api/exam/end', { exam_id: examIdRef.current })
      if (res.data) setReport(res.data)
    } catch (err) { console.error('Exam end failed:', err) }
    setGenerating(false)
  }

  // Classify which screen region the face is looking at based on bbox position
  const classifyGaze = (bbox, frameW, frameH) => {
    if (!bbox) return 'absent'
    const [x, y, w, h] = bbox
    const cx = (x + w / 2) / frameW   // 0-1 normalized
    const cy = (y + h / 2) / frameH
    const tol = 0.25

    if (cx >= 0.5 - tol && cx <= 0.5 + tol && cy >= 0.5 - tol && cy <= 0.5 + tol) return 'center'
    if (cy < 0.35) {
      if (cx < 0.35) return 'top_left'
      if (cx > 0.65) return 'top_right'
      return 'top'
    }
    if (cy > 0.65) {
      if (cx < 0.35) return 'bottom_left'
      if (cx > 0.65) return 'bottom_right'
      return 'bottom'
    }
    if (cx < 0.35) return 'left'
    if (cx > 0.65) return 'right'
    return 'center'
  }

  const captureFrame = async () => {
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
      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.8))
      const formData = new FormData()
      formData.append('file', blob, 'frame.jpg')

      const controller = new AbortController()
      const tid = setTimeout(() => controller.abort(), 15000)
      // Use exam-specific endpoint with head + eye gaze tracking
      const res = await API.post('/api/exam/detect-with-gaze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal: controller.signal,
      })
      clearTimeout(tid)

      const ts = Math.floor((Date.now() - startTimeRef.current) / 1000)
      let faceDetected = false
      let bbox = null
      let emotion = 'neutral'
      let engScore = 0
      const frameW = video.videoWidth || 640
      const frameH = video.videoHeight || 480

      if (res.data && res.data.success) {
        faceDetected = true
        emotion = res.data.emotion?.emotion || 'neutral'
        engScore = res.data.emotion?.engagement || 50
        bbox = res.data.head_position?.bbox || null
        setCurrentEmotion(emotion)

        const attention = res.data.attention || {}
        const attentionStatus = attention.status || 'distracted'
        const eyeDir = res.data.eye_gaze?.direction || 'away'

        // Push to buffer for smoothing
        gazeBufferRef.current.push(attentionStatus)
        if (gazeBufferRef.current.length > 3) gazeBufferRef.current.shift()

        // React if 2 out of last 3 readings agree (fast but filtered)
        const recent = gazeBufferRef.current
        const offCenterCount = recent.filter(s => s !== 'fully_focused').length
        const isConsistentlyOff = offCenterCount >= 2

        if (attentionStatus === 'fully_focused') {
          setCurrentRegion('center')
          // Slowly recover score when focused
          setFocusScore(s => Math.min(100, s + 0.5))
        } else if (isConsistentlyOff) {
          // Only penalize after consistent off-center readings
          if (attentionStatus === 'eyes_wandering') {
            setCurrentRegion(eyeDir === 'left' ? 'left' : eyeDir === 'right' ? 'right' : eyeDir === 'down' ? 'bottom' : eyeDir === 'up' ? 'top' : 'center')
            setFocusScore(s => Math.max(0, s - 2))
            setWarnings(w => {
              const nw = [...w, { time: ts, type: `Eyes looking ${eyeDir}` }]
              return nw.length > 20 ? nw.slice(-20) : nw
            })
          } else if (attentionStatus === 'head_turned') {
            const headDir = res.data.head_position?.region || 'away'
            setCurrentRegion(headDir)
            setFocusScore(s => Math.max(0, s - 2.5))
            setWarnings(w => {
              const nw = [...w, { time: ts, type: `Head turned ${headDir}` }]
              return nw.length > 20 ? nw.slice(-20) : nw
            })
          } else if (attentionStatus === 'eyes_closed_or_hidden') {
            setCurrentRegion('absent')
            setFocusScore(s => Math.max(0, s - 1.5))
            setWarnings(w => {
              const nw = [...w, { time: ts, type: 'Eyes not visible' }]
              return nw.length > 20 ? nw.slice(-20) : nw
            })
          } else if (attentionStatus === 'distracted') {
            setCurrentRegion(res.data.head_position?.region || 'away')
            setFocusScore(s => Math.max(0, s - 3))
            setWarnings(w => {
              const nw = [...w, { time: ts, type: `Distracted` }]
              return nw.length > 20 ? nw.slice(-20) : nw
            })
          }
        }
        // If not consistently off, keep current region but don't penalize (noise)
      } else {
        // No face detected
        faceDetected = false
        setCurrentEmotion(null)
        gazeBufferRef.current.push('absent')
        if (gazeBufferRef.current.length > 3) gazeBufferRef.current.shift()
        const absentCount = gazeBufferRef.current.filter(s => s === 'absent').length
        if (absentCount >= 2) {
          setCurrentRegion('absent')
          setFocusScore(s => Math.max(0, s - 3))
          setWarnings(w => {
            const nw = [...w, { time: ts, type: 'Face not detected' }]
            return nw.length > 20 ? nw.slice(-20) : nw
          })
        }
      }

      // Send detection to exam session backend
      await API.post('/api/exam/detection', {
        exam_id: examIdRef.current,
        timestamp: ts,
        bbox,
        face_detected: faceDetected,
        emotion,
        engagement_score: engScore,
        frame_size: [frameW, frameH],
      }).catch(() => {})

      setDetectionCount(c => c + 1)

      // Check interaction gap — no typing for 30+ seconds
      const gapSec = (Date.now() - lastInteractionRef.current) / 1000
      if (gapSec > 30) {
        setFocusScore(s => Math.max(0, s - 1))
      }
    } catch (err) {
      if (err.name !== 'AbortError') console.error('Exam frame error:', err)
    } finally {
      isAnalyzingRef.current = false
      setIsProcessing(false)
    }
  }

  const fmt = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Controls */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-3 h-3 rounded-full ${examActive ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`} />
            <div>
              <div className="text-white font-bold text-lg">{examActive ? '🔒 Exam in Progress' : 'Exam Monitor'}</div>
              <div className="text-gray-400 text-sm">
                {examActive ? `Duration: ${fmt(duration)} · ${detectionCount} checks · ${interactionCount} interactions` : 'Start exam monitoring to enable proctoring'}
              </div>
            </div>
          </div>
          {!examActive ? (
            <button onClick={startExam} disabled={generating}
              className="px-6 py-3 rounded-2xl font-bold text-white bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-400 hover:to-rose-400 shadow-lg shadow-red-500/30 hover:scale-105 disabled:opacity-50 transition-all duration-300">
              🔒 Start Exam Mode
            </button>
          ) : (
            <button onClick={endExam}
              className="px-6 py-3 rounded-2xl font-bold text-white bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-400 hover:to-gray-500 shadow-lg hover:scale-105 transition-all duration-300">
              ⏹ End Exam
            </button>
          )}
        </div>
        {generating && (
          <div className="mt-4 flex items-center gap-2 text-amber-400">
            <div className="w-3 h-3 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
            <span className="text-sm">Generating focus report...</span>
          </div>
        )}
      </GlassCard>

      {examActive && (
        <div className="grid grid-cols-3 gap-6">
          {/* Video feed */}
          <div className="col-span-2">
            <GlassCard className="p-6">
              <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">📹 Proctoring Feed</h2>
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <canvas ref={canvasRef} className="hidden" />
                {/* Status overlay */}
                <div className="absolute top-3 left-3 flex gap-2">
                  <div className={`px-3 py-1.5 rounded-lg text-xs font-bold ${currentRegion === 'center' ? 'bg-green-500/80' : currentRegion === 'absent' ? 'bg-red-500/80' : 'bg-yellow-500/80'} text-white backdrop-blur-sm`}>
                    {REGION_LABELS[currentRegion] || currentRegion}
                  </div>
                  {isProcessing && (
                    <div className="px-3 py-1.5 rounded-lg bg-black/60 text-blue-400 text-xs font-medium backdrop-blur-sm flex items-center gap-1">
                      <div className="w-2 h-2 border border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                      Checking
                    </div>
                  )}
                </div>
                {currentEmotion && (
                  <div className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white text-xs font-bold capitalize">
                    {currentEmotion}
                  </div>
                )}
                <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-red-500/80 backdrop-blur-sm flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span className="text-white text-xs font-bold">EXAM MODE</span>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Focus panel */}
          <div className="space-y-4">
            <GlassCard className="p-5">
              <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">Focus Score</h3>
              <div className="text-center py-3">
                <div className="text-5xl font-black" style={{ color: focusColor(focusScore) }}>{Math.round(focusScore)}</div>
                <div className="text-gray-400 text-sm mt-1">/ 100</div>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden mt-3">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${focusScore}%`, background: focusColor(focusScore) }} />
              </div>
            </GlassCard>

            <GlassCard className="p-5">
              <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">Live Stats</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-400">Checks</span><span className="text-white font-bold">{detectionCount}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Interactions</span><span className="text-white font-bold">{interactionCount}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Duration</span><span className="text-white font-bold">{fmt(duration)}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Gaze</span><span className="font-bold" style={{ color: currentRegion === 'center' ? '#22c55e' : '#ef4444' }}>{currentRegion}</span></div>
              </div>
            </GlassCard>

            {warnings.length > 0 && (
              <GlassCard className="p-5">
                <h3 className="text-sm font-bold text-red-400 uppercase mb-3">⚠️ Alerts ({warnings.length})</h3>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {warnings.slice(-8).map((w, i) => (
                    <div key={i} className="text-xs text-red-300 bg-red-500/10 rounded px-2 py-1">
                      {fmt(w.time)} — {w.type}
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}
          </div>
        </div>
      )}

      {/* Report */}
      {report && report.success && (
        <GlassCard className="p-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <span className="text-2xl">📋</span> Exam Focus Report
          </h2>

          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Focus Score', value: `${report.focus_score}/100`, color: focusColor(report.focus_score), icon: '🎯' },
              { label: 'Focus Level', value: report.focus_label, color: focusColor(report.focus_score), icon: '📊' },
              { label: 'Focused %', value: `${report.gaze_analysis?.focus_pct || 0}%`, icon: '👁' },
              { label: 'Away Time', value: `${report.absence_analysis?.absence_pct || 0}%`, color: '#ef4444', icon: '⏱' },
            ].map(s => (
              <div key={s.label} className="bg-white/5 rounded-xl p-4 text-center border border-white/5">
                <div className="text-xl mb-1">{s.icon}</div>
                <div className="text-2xl font-black" style={{ color: s.color || '#fff' }}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Gaze breakdown */}
          {report.gaze_analysis?.region_breakdown && (
            <div className="mb-6">
              <h3 className="text-white font-bold mb-3">Gaze Region Breakdown</h3>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(report.gaze_analysis.region_breakdown).sort((a,b) => b[1]-a[1]).map(([region, pct]) => (
                  <div key={region} className={`rounded-xl p-3 text-center border ${region === 'center' ? 'bg-green-500/10 border-green-500/20' : region === 'absent' ? 'bg-red-500/10 border-red-500/20' : 'bg-yellow-500/10 border-yellow-500/20'}`}>
                    <div className="text-lg font-bold" style={{ color: region === 'center' ? '#22c55e' : region === 'absent' ? '#ef4444' : '#eab308' }}>{pct}%</div>
                    <div className="text-xs text-gray-400 capitalize">{region.replace('_', ' ')}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Absence streaks */}
          {report.absence_analysis?.streaks?.length > 0 && (
            <div className="mb-6">
              <h3 className="text-white font-bold mb-3">Absence Streaks</h3>
              <div className="space-y-2">
                {report.absence_analysis.streaks.map((s, i) => (
                  <div key={i} className={`flex items-center gap-3 rounded-xl p-3 border ${s.severity === 'critical' ? 'bg-red-500/10 border-red-500/20' : s.severity === 'warning' ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-white/5 border-white/5'}`}>
                    <span className="text-lg">{s.severity === 'critical' ? '🔴' : s.severity === 'warning' ? '🟡' : '⚪'}</span>
                    <div className="flex-1 text-sm text-gray-300">Looked away for <strong>{s.duration_sec}s</strong></div>
                    <span className="text-xs text-gray-500">{s.severity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Distraction events */}
          {report.distraction_events?.length > 0 && (
            <div>
              <h3 className="text-white font-bold mb-3">Distraction Events</h3>
              <div className="space-y-2">
                {report.distraction_events.map((d, i) => (
                  <div key={i} className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-3">
                    <span className="text-lg">⚠️</span>
                    <div className="flex-1">
                      <div className="text-sm text-gray-300">At {fmt(d.start_sec)} — away for {d.duration_sec}s {d.was_typing ? '(was typing)' : '(no interaction)'}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${d.severity === 'critical' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{d.severity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </GlassCard>
      )}
    </div>
  )
}
