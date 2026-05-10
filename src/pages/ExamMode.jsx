import { useState, useEffect, useRef, useCallback } from 'react'
import GlassCard from '../components/GlassCard'
import API from '../api'

const REGION_LABELS = {
  center: '✅ Focused', left: '⚠️ Left', right: '⚠️ Right',
  top: '⚠️ Up', bottom: '⚠️ Down', absent: '🔴 Away',
}
const focusColor = (s) => s >= 85 ? '#22c55e' : s >= 70 ? '#3b82f6' : s >= 50 ? '#eab308' : '#ef4444'

export default function ExamMode() {
  const [examActive, setExamActive] = useState(false)
  const [cameraOn, setCameraOn] = useState(false)
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
  const [faceDistance, setFaceDistance] = useState(null)

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const intervalRef = useRef(null)
  const durationRef = useRef(null)
  const startTimeRef = useRef(null)
  const isAnalyzingRef = useRef(false)
  const examIdRef = useRef('')
  const lastInteractionRef = useRef(Date.now())
  const gazeBufferRef = useRef([])
  const baselineFaceRef = useRef(null)

  useEffect(() => () => stopEverything(), [])

  useEffect(() => {
    if (examActive) {
      durationRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 1000)
    }
    return () => clearInterval(durationRef.current)
  }, [examActive])

  useEffect(() => {
    if (!examActive) return
    const log = () => { lastInteractionRef.current = Date.now(); setInteractionCount(c => c + 1) }
    window.addEventListener('keydown', log)
    window.addEventListener('click', log)
    return () => { window.removeEventListener('keydown', log); window.removeEventListener('click', log) }
  }, [examActive])

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } })
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }
      streamRef.current = stream; setCameraOn(true); return true
    } catch { alert('Camera access required.'); return false }
  }

  const stopEverything = useCallback(() => {
    clearInterval(intervalRef.current); clearInterval(durationRef.current)
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOn(false); isAnalyzingRef.current = false
  }, [])

  const startExam = async () => {
    examIdRef.current = `exam_${Date.now()}`
    startTimeRef.current = Date.now()
    setDuration(0); setExamActive(true); setReport(null)
    setDetectionCount(0); setInteractionCount(0); setWarnings([])
    setFocusScore(100); gazeBufferRef.current = []; baselineFaceRef.current = null
    try { await API.post('/api/exam/start', { exam_id: examIdRef.current, student_id: 0 }) } catch {}
  }

  useEffect(() => {
    if (!examActive) return
    let cancelled = false
    const init = async () => {
      await new Promise(r => setTimeout(r, 150))
      if (cancelled) return
      const ok = await startWebcam()
      if (ok && !cancelled) {
        intervalRef.current = setInterval(captureFrame, 3000)
        setTimeout(captureFrame, 500)
      }
    }
    init()
    return () => { cancelled = true }
  }, [examActive])

  const endExam = async () => {
    clearInterval(intervalRef.current); clearInterval(durationRef.current)
    stopEverything(); setExamActive(false); setGenerating(true)
    try { const res = await API.post('/api/exam/end', { exam_id: examIdRef.current }); if (res.data) setReport(res.data) } catch {}
    setGenerating(false)
  }

  const captureFrame = async () => {
    if (isAnalyzingRef.current || !videoRef.current || !canvasRef.current) return
    const video = videoRef.current, canvas = canvasRef.current
    if (video.readyState !== 4) return
    isAnalyzingRef.current = true; setIsProcessing(true)

    try {
      const ctx = canvas.getContext('2d')
      canvas.width = video.videoWidth; canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)
      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.8))
      const formData = new FormData()
      formData.append('file', blob, 'frame.jpg')

      const controller = new AbortController()
      const tid = setTimeout(() => controller.abort(), 10000)
      const res = await API.post('/api/detect-emotion-multi', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }, signal: controller.signal,
      })
      clearTimeout(tid)

      const ts = Math.floor((Date.now() - startTimeRef.current) / 1000)
      const frameW = video.videoWidth || 640, frameH = video.videoHeight || 480

      if (res.data && res.data.faces && res.data.faces.length > 0) {
        const face = res.data.faces[0]
        const bbox = face.bbox || []
        setCurrentEmotion(face.emotion || 'neutral')
        setDetectionCount(c => c + 1)

        if (bbox.length === 4) {
          const [bx, by, bw, bh] = bbox
          if (!baselineFaceRef.current && bw > 30) baselineFaceRef.current = bw
          const dist = Math.round(((baselineFaceRef.current || 300) * 35) / Math.max(1, bw))
          setFaceDistance(`${dist}cm`)

          const cx = (bx + bw / 2) / frameW, cy = (by + bh / 2) / frameH
          let region = 'center'
          if (cx < 0.22) region = 'left'
          else if (cx > 0.78) region = 'right'
          else if (cy < 0.22) region = 'top'
          else if (cy > 0.78) region = 'bottom'

          gazeBufferRef.current.push(region)
          if (gazeBufferRef.current.length > 3) gazeBufferRef.current.shift()
          const offCount = gazeBufferRef.current.filter(r => r !== 'center').length

          if (region === 'center') {
            setCurrentRegion('center'); setFocusScore(s => Math.min(100, s + 0.5))
          } else if (offCount >= 2) {
            setCurrentRegion(region); setFocusScore(s => Math.max(0, s - 2))
            setWarnings(w => { const nw = [...w, { time: ts, type: `Looking ${region}` }]; return nw.length > 20 ? nw.slice(-20) : nw })
          }
          if (dist > 55 || dist < 20) setFocusScore(s => Math.max(0, s - 1))

          API.post('/api/exam/detection', {
            exam_id: examIdRef.current, timestamp: ts, bbox, face_detected: true,
            emotion: face.emotion, engagement_score: face.engagement || 50, frame_size: [frameW, frameH],
          }).catch(() => {})
        }
      } else {
        setCurrentEmotion(null); setFaceDistance(null); setDetectionCount(c => c + 1)
        gazeBufferRef.current.push('absent')
        if (gazeBufferRef.current.length > 3) gazeBufferRef.current.shift()
        if (gazeBufferRef.current.filter(r => r === 'absent').length >= 2) {
          setCurrentRegion('absent'); setFocusScore(s => Math.max(0, s - 3))
          setWarnings(w => { const nw = [...w, { time: ts, type: 'Face not detected' }]; return nw.length > 20 ? nw.slice(-20) : nw })
        }
        API.post('/api/exam/detection', {
          exam_id: examIdRef.current, timestamp: ts, bbox: null, face_detected: false,
          emotion: 'neutral', engagement_score: 0, frame_size: [frameW, frameH],
        }).catch(() => {})
      }

      if ((Date.now() - lastInteractionRef.current) / 1000 > 30) setFocusScore(s => Math.max(0, s - 1))
    } catch (err) {
      if (err.name !== 'AbortError' && err.name !== 'CanceledError') console.error('Exam error:', err)
    } finally { isAnalyzingRef.current = false; setIsProcessing(false) }
  }

  const fmt = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`

  return (
    <div className="space-y-6 animate-fade-in">
      <GlassCard className="p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-3 h-3 rounded-full ${examActive ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`} />
            <div>
              <div className="text-white font-bold text-lg">{examActive ? '🔒 Exam in Progress' : 'Exam Monitor'}</div>
              <div className="text-gray-400 text-sm">{examActive ? `${fmt(duration)} · ${detectionCount} checks · ${interactionCount} interactions` : 'Start exam monitoring to enable proctoring'}</div>
            </div>
          </div>
          {!examActive ? (
            <button onClick={startExam} disabled={generating} className="px-6 py-3 rounded-2xl font-bold text-white bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-400 hover:to-rose-400 shadow-lg shadow-red-500/30 hover:scale-105 disabled:opacity-50 transition-all duration-300">🔒 Start Exam Mode</button>
          ) : (
            <button onClick={endExam} className="px-6 py-3 rounded-2xl font-bold text-white bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-400 hover:to-gray-500 shadow-lg hover:scale-105 transition-all duration-300">⏹ End Exam</button>
          )}
        </div>
        {generating && <div className="mt-4 flex items-center gap-2 text-amber-400"><div className="w-3 h-3 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" /><span className="text-sm">Generating report...</span></div>}
      </GlassCard>

      {examActive && (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2">
            <GlassCard className="p-6">
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute top-3 left-3 flex gap-2">
                  <div className={`px-3 py-1.5 rounded-lg text-xs font-bold ${currentRegion === 'center' ? 'bg-green-500/80' : currentRegion === 'absent' ? 'bg-red-500/80' : 'bg-yellow-500/80'} text-white backdrop-blur-sm`}>{REGION_LABELS[currentRegion] || currentRegion}</div>
                  {isProcessing && <div className="px-3 py-1.5 rounded-lg bg-black/60 text-blue-400 text-xs backdrop-blur-sm flex items-center gap-1"><div className="w-2 h-2 border border-blue-400/30 border-t-blue-400 rounded-full animate-spin" /> Checking</div>}
                </div>
                {currentEmotion && <div className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white text-xs font-bold capitalize">{currentEmotion}</div>}
                <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-red-500/80 backdrop-blur-sm flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-white animate-pulse" /><span className="text-white text-xs font-bold">EXAM MODE</span></div>
                {faceDistance && <div className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white text-xs font-bold">📏 {faceDistance}</div>}
              </div>
            </GlassCard>
          </div>
          <div className="space-y-4">
            <GlassCard className="p-5">
              <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">Focus Score</h3>
              <div className="text-center py-2">
                <div className="text-5xl font-black" style={{ color: focusColor(focusScore) }}>{Math.round(focusScore)}</div>
                <div className="text-gray-400 text-sm mt-1">/ 100</div>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden mt-3">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${focusScore}%`, background: focusColor(focusScore) }} />
              </div>
            </GlassCard>
            <GlassCard className="p-5">
              <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">Stats</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-400">Checks</span><span className="text-white font-bold">{detectionCount}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Interactions</span><span className="text-white font-bold">{interactionCount}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Duration</span><span className="text-white font-bold">{fmt(duration)}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Position</span><span className="font-bold" style={{ color: currentRegion === 'center' ? '#22c55e' : '#ef4444' }}>{currentRegion}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Distance</span><span className="text-white font-bold">{faceDistance || '—'}</span></div>
              </div>
            </GlassCard>
            {warnings.length > 0 && (
              <GlassCard className="p-5">
                <h3 className="text-sm font-bold text-red-400 uppercase mb-3">⚠️ Alerts ({warnings.length})</h3>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {warnings.slice(-8).map((w, i) => <div key={i} className="text-xs text-red-300 bg-red-500/10 rounded px-2 py-1">{fmt(w.time)} — {w.type}</div>)}
                </div>
              </GlassCard>
            )}
          </div>
        </div>
      )}

      {report && report.success && (
        <GlassCard className="p-6">
          <h2 className="text-xl font-bold text-white mb-6">📋 Exam Focus Report</h2>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Focus', value: `${report.focus_score}/100`, color: focusColor(report.focus_score), icon: '🎯' },
              { label: 'Level', value: report.focus_label, color: focusColor(report.focus_score), icon: '📊' },
              { label: 'Focused', value: `${report.gaze_analysis?.focus_pct || 0}%`, icon: '👁' },
              { label: 'Away', value: `${report.absence_analysis?.absence_pct || 0}%`, color: '#ef4444', icon: '⏱' },
            ].map(s => (
              <div key={s.label} className="bg-white/5 rounded-xl p-4 text-center border border-white/5">
                <div className="text-xl mb-1">{s.icon}</div>
                <div className="text-2xl font-black" style={{ color: s.color || '#fff' }}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  )
}
