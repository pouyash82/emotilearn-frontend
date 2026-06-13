import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import DashboardLayout from '../components/DashboardLayout'
import GlassCard from '../components/GlassCard'
import SessionReport from '../components/SessionReport'
import CompareWithClass from '../components/CompareWithClass'
import ChatButton from '../components/ChatButton'
import API from '../api'
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts'
import GazeTracker from '../gaze/GazeTracker'
import GazeOverlay from '../gaze/GazeOverlay'
import GazeCalibration from '../gaze/GazeCalibration'
import EngagementEngine from '../gaze/EngagementEngine'

const EMOTION_COLORS = {
  anger:     { hex: '#ef4444', label: 'Anger' },
  disgust:   { hex: '#8b5cf6', label: 'Disgust' },
  fear:      { hex: '#f97316', label: 'Fear' },
  happiness: { hex: '#22c55e', label: 'Happiness' },
  neutral:   { hex: '#94a3b8', label: 'Neutral' },
  sadness:   { hex: '#3b82f6', label: 'Sadness' },
  surprise:  { hex: '#eab308', label: 'Surprise' },
}

const EMOTION_LEGEND = [
  { key: 'happiness', color: '#22c55e', label: 'Focused' },
  { key: 'neutral',   color: '#94a3b8', label: 'Calm' },
  { key: 'fear',      color: '#f97316', label: 'Anxious' },
  { key: 'sadness',   color: '#8b5cf6', label: 'Confused' },
  { key: 'anger',     color: '#ef4444', label: 'Disengaged' },
]

export default function StudentDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('overview')
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
  const [myCourses, setMyCourses] = useState([])
  const [availableCourses, setAvailableCourses] = useState([])
  const [myExams, setMyExams] = useState([])
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showBrowse, setShowBrowse] = useState(false)
  const [micOn, setMicOn] = useState(false)
  const [transcription, setTranscription] = useState('')
  const [textEmotion, setTextEmotion] = useState(null)
  const [transcribing, setTranscribing] = useState(false)
  const [voiceEmotion, setVoiceEmotion] = useState(null)
  const [detectionMode, setDetectionMode] = useState('single') // 'single' or 'multi'
  const [faces, setFaces] = useState([])
  const [classEng, setClassEng] = useState(0)
  const [multiProfile, setMultiProfile] = useState(null)

  const emotionHistoryRef = useRef([])
  const detectionCountRef = useRef(0)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const intervalRef = useRef(null)
  const durationIntervalRef = useRef(null)
  const isAnalyzingRef = useRef(false)
  const audioStreamRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const audioIntervalRef = useRef(null)
  const allTranscriptsRef = useRef([])
  const allAudioBlobsRef = useRef([])
  const transcriptBoxRef = useRef(null)

  // ── Gaze tracking state ──
  const [gazeResult, setGazeResult] = useState(null)
  const [isCalibrating, setIsCalibrating] = useState(false)
  const [isGazeCalibrated, setIsGazeCalibrated] = useState(false)
  const [showGazeOverlay, setShowGazeOverlay] = useState(true)
  const [engDimensions, setEngDimensions] = useState(null)
  const gazeTrackerRef = useRef(null)
  const engagementEngineRef = useRef(null)
  const faceLandmarkerRef = useRef(null)
  const gazeLoopRef = useRef(null)
  const latestLandmarksRef = useRef(null)

  useEffect(() => { loadStats(); loadSessions(); return () => { stopEverything() } }, [])
  useEffect(() => {
    if (isSessionActive && sessionStartTime) { durationIntervalRef.current = setInterval(() => { setSessionDuration(Math.floor((Date.now() - sessionStartTime) / 1000)) }, 1000) }
    return () => { if (durationIntervalRef.current) clearInterval(durationIntervalRef.current) }
  }, [isSessionActive, sessionStartTime])
  useEffect(() => {
    if (tab === 'courses') { API.get('/students/courses').then(r => setMyCourses(r.data.courses || [])).catch(() => {}); API.get('/students/exams').then(r => setMyExams(r.data.exams || [])).catch(() => {}) }
    if (tab === 'notifications') { API.get('/notifications').then(r => { setNotifications(r.data.notifications || []); setUnreadCount(r.data.unread || 0) }).catch(() => {}) }
  }, [tab])
  useEffect(() => { API.get('/notifications').then(r => setUnreadCount(r.data.unread || 0)).catch(() => {}) }, [])

  // ── Initialize gaze system ──
  useEffect(() => {
    gazeTrackerRef.current = new GazeTracker(window.innerWidth, window.innerHeight)
    engagementEngineRef.current = new EngagementEngine()
    // Try restore saved calibration
    try {
      const saved = localStorage.getItem('emotilearn_gaze_calibration')
      if (saved) {
        const data = JSON.parse(saved)
        if (data.screenWidth === window.innerWidth && data.screenHeight === window.innerHeight) {
          if (gazeTrackerRef.current.importCalibration(data)) setIsGazeCalibrated(true)
        }
      }
    } catch (e) {}
    // Load MediaPipe FaceLandmarker for gaze
    ;(async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm')
        faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task', delegate: 'GPU' },
          runningMode: 'VIDEO', numFaces: 1, outputFacialTransformationMatrixes: false, outputFaceBlendshapes: false,
        })
      } catch (e) { console.warn('FaceLandmarker load failed:', e) }
    })()
    return () => { if (gazeLoopRef.current) cancelAnimationFrame(gazeLoopRef.current) }
  }, [])

  /* ── Derived metrics ── */
  const derivedMetrics = (() => {
    if (sessions.length === 0) return { avgDuration: 0, bestHour: null, weeklyData: [], engTrend: [] }
    let totalDur = 0, hourEngMap = {}, weekMap = {}
    const now = new Date(); const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const engTrend = []
    sessions.forEach((s, i) => {
      totalDur += (s.duration || 0)
      if (i < 10) engTrend.unshift({ name: `S${sessions.length - i}`, eng: Math.round(s.avg_engagement || 0) })
      if (s.started_at) {
        const d = new Date(s.started_at); const h = d.getHours()
        if (!hourEngMap[h]) hourEngMap[h] = []; hourEngMap[h].push(s.avg_engagement || 0)
        if (d >= weekAgo) { const dayKey = d.toLocaleDateString('en-US', { weekday: 'short' }); if (!weekMap[dayKey]) weekMap[dayKey] = { sessions: [], date: d }; weekMap[dayKey].sessions.push(s) }
      }
    })
    const avgDuration = sessions.length > 0 ? Math.round(totalDur / sessions.length) : 0
    let bestHour = null, bestAvg = 0
    Object.entries(hourEngMap).forEach(([h, engs]) => { const avg = engs.reduce((a, b) => a + b, 0) / engs.length; if (avg > bestAvg) { bestAvg = avg; bestHour = parseInt(h) } })
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const weeklyData = days.map(d => {
      const entry = weekMap[d]
      if (!entry) return { day: d, sessions: 0, engagement: 0, duration: 0, emotions: {} }
      const ss = entry.sessions; const avgEng = ss.reduce((a, s) => a + (s.avg_engagement || 0), 0) / ss.length; const totDur = ss.reduce((a, s) => a + (s.duration || 0), 0)
      const emotions = {}; ss.forEach(s => { if (s.dominant_emotion) emotions[s.dominant_emotion] = (emotions[s.dominant_emotion] || 0) + 1 })
      return { day: d, date: entry.date, sessions: ss.length, engagement: Math.round(avgEng), duration: totDur, emotions }
    })
    return { avgDuration, bestHour, bestAvg: Math.round(bestAvg), weeklyData, engTrend }
  })()

  const formatDuration = (s) => { const m = Math.floor(s / 60); return `${m}:${(s % 60).toString().padStart(2, '0')}` }
  const formatMinSec = (s) => { const m = Math.floor(s / 60); const sec = s % 60; return `${m}:${sec.toString().padStart(2, '0')}` }
  const formatHour = (h) => { if (h === null) return '--'; const ampm = h >= 12 ? 'PM' : 'AM'; return `${h % 12 || 12}–${(h + 1) % 12 || 12} ${ampm}` }
  const engColor = (v) => v >= 65 ? 'var(--engage-high)' : v >= 40 ? 'var(--engage-medium)' : 'var(--engage-low)'

  /* ═══════════ All session logic (unchanged) ═══════════ */
  const loadStats = async () => { try { const res = await API.get('/students/stats'); setStats({ sessions: res.data.total_sessions ?? 0, avgEngagement: res.data.avg_engagement ?? 0, detections: res.data.total_detections ?? 0 }) } catch {} }
  const loadSessions = async () => { try { const res = await API.get('/students/sessions'); setSessions(res.data || []) } catch {} }
  const loadAvailableCourses = () => { API.get('/courses/available').then(r => { setAvailableCourses(r.data.courses || []); setShowBrowse(true) }).catch(() => {}) }
  const enrollInCourse = async (courseId) => { try { await API.post(`/courses/${courseId}/enroll`); setShowBrowse(false); API.get('/students/courses').then(r => setMyCourses(r.data.courses || [])).catch(() => {}); API.get('/students/exams').then(r => setMyExams(r.data.exams || [])).catch(() => {}) } catch (e) { alert(e.response?.data?.detail || 'Enrollment failed') } }
  const markRead = async (id) => { await API.post(`/notifications/${id}/read`).catch(() => {}); setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n)); setUnreadCount(c => Math.max(0, c - 1)) }

  const startWebcam = async () => {
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } })
      if (videoRef.current) { videoRef.current.srcObject = videoStream; await videoRef.current.play() }
      streamRef.current = videoStream; setCameraOn(true)
      try { const audioStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); audioStreamRef.current = audioStream; startNewRecorder(); setMicOn(true); audioIntervalRef.current = setInterval(transcribeCurrentChunk, 20000) }
      catch (micErr) { setMicOn(false) }
      return true
    } catch { alert('Could not access camera.'); return false }
  }
  const stopWebcam = useCallback(() => { if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }; if (videoRef.current) videoRef.current.srcObject = null; setCameraOn(false) }, [])
  const stopMic = useCallback(() => { if (audioIntervalRef.current) { clearInterval(audioIntervalRef.current); audioIntervalRef.current = null }; if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') { try { mediaRecorderRef.current.stop() } catch {} }; mediaRecorderRef.current = null; if (audioStreamRef.current) { audioStreamRef.current.getTracks().forEach(t => t.stop()); audioStreamRef.current = null }; setMicOn(false) }, [])
  const startNewRecorder = () => { if (!audioStreamRef.current) return; const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'; const recorder = new MediaRecorder(audioStreamRef.current, { mimeType }); audioChunksRef.current = []; recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }; recorder.start(); mediaRecorderRef.current = recorder }
  const transcribeCurrentChunk = async () => { if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return; const audioBlob = await new Promise((resolve) => { mediaRecorderRef.current.onstop = () => { resolve(new Blob(audioChunksRef.current, { type: 'audio/webm' })); audioChunksRef.current = [] }; mediaRecorderRef.current.stop() }); startNewRecorder(); if (audioBlob.size < 1000) return; allAudioBlobsRef.current.push(audioBlob); try { const form = new FormData(); form.append('file', audioBlob, 'chunk.webm'); const res = await API.post('/api/transcribe', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 30000 }); if (res.data?.success && res.data.text?.trim()) { allTranscriptsRef.current.push(res.data.text.trim()); setTranscription(allTranscriptsRef.current.join(' ')); setTimeout(() => { if (transcriptBoxRef.current) transcriptBoxRef.current.scrollTop = transcriptBoxRef.current.scrollHeight }, 100) } } catch {} }
  const stopEverything = useCallback(() => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }; if (durationIntervalRef.current) { clearInterval(durationIntervalRef.current); durationIntervalRef.current = null }; stopWebcam(); stopMic(); audioChunksRef.current = []; isAnalyzingRef.current = false; if (gazeLoopRef.current) { cancelAnimationFrame(gazeLoopRef.current); gazeLoopRef.current = null } }, [stopWebcam, stopMic])

  // ── Gaze processing loop (runs at ~30fps alongside the 3s backend calls) ──
  const startGazeLoop = useCallback(() => {
    const processGaze = () => {
      const video = videoRef.current
      const fl = faceLandmarkerRef.current
      const tracker = gazeTrackerRef.current
      if (video && fl && tracker && video.readyState >= 2) {
        try {
          const result = fl.detectForVideo(video, performance.now())
          if (result?.faceLandmarks?.[0]) {
            latestLandmarksRef.current = result.faceLandmarks[0]
            const gaze = tracker.processLandmarks(result.faceLandmarks[0], video.videoWidth, video.videoHeight)
            if (gaze) setGazeResult(gaze)
          }
        } catch (e) {}
      }
      gazeLoopRef.current = requestAnimationFrame(processGaze)
    }
    gazeLoopRef.current = requestAnimationFrame(processGaze)
  }, [])

  const stopGazeLoop = useCallback(() => {
    if (gazeLoopRef.current) { cancelAnimationFrame(gazeLoopRef.current); gazeLoopRef.current = null }
  }, [])

  const startSession = async () => {
    const ok = await startWebcam(); if (!ok) return
    emotionHistoryRef.current = []; detectionCountRef.current = 0; setSessionStartTime(Date.now()); setSessionDuration(0); setIsSessionActive(true); setCurrentEmotion(null); setEmotionScores({}); setEngagement(0); setTranscription(''); setTextEmotion(null); setTranscribing(false); allTranscriptsRef.current = []; allAudioBlobsRef.current = []; setFaces([]); setClassEng(0); setMultiProfile(null)
    if (engagementEngineRef.current) engagementEngineRef.current.reset()
    if (gazeTrackerRef.current) gazeTrackerRef.current.clearHeatmap()
    startGazeLoop()
    try { await API.post(detectionMode === 'multi' ? '/session/multi/start' : '/session/start') } catch {}
    intervalRef.current = setInterval(captureAndAnalyze, detectionMode === 'multi' ? 1200 : 3000); setTimeout(captureAndAnalyze, 500)
  }

  const stopSession = async () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }; stopWebcam()
    stopGazeLoop()
    if (audioIntervalRef.current) { clearInterval(audioIntervalRef.current); audioIntervalRef.current = null }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      setTranscribing(true)
      const finalBlob = await new Promise((resolve) => { mediaRecorderRef.current.onstop = () => { resolve(new Blob(audioChunksRef.current, { type: 'audio/webm' })); audioChunksRef.current = [] }; mediaRecorderRef.current.stop() })
      if (finalBlob.size > 1000) { allAudioBlobsRef.current.push(finalBlob); try { const form = new FormData(); form.append('file', finalBlob, 'final_chunk.webm'); const res = await API.post('/api/transcribe', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 30000 }); if (res.data?.success && res.data.text?.trim()) { allTranscriptsRef.current.push(res.data.text.trim()); setTranscription(allTranscriptsRef.current.join(' ')) } } catch {} }
    }
    if (audioStreamRef.current) { audioStreamRef.current.getTracks().forEach(t => t.stop()); audioStreamRef.current = null }; mediaRecorderRef.current = null; setMicOn(false)
    const fullText = allTranscriptsRef.current.join(' ')
    if (fullText.trim()) { try { const r = await API.post('/api/text-emotion', { text: fullText }); if (r.data?.success) setTextEmotion(r.data) } catch {} }
    if (allAudioBlobsRef.current.length > 0) { try { const combined = new Blob(allAudioBlobsRef.current, { type: 'audio/webm' }); const vf = new FormData(); vf.append('file', combined, 'session_voice.webm'); const vr = await API.post('/api/voice-emotion', vf, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 }); if (vr.data?.success) setVoiceEmotion(vr.data) } catch {} }
    setTranscribing(false); setIsSessionActive(false)
    const history = emotionHistoryRef.current; const total = history.length
    let avgEng = 0, dominant = 'neutral', distribution = {}, uniqueCount = 0
    if (total > 0) { avgEng = Math.round((history.reduce((s, h) => s + (h.engagement_score || 0), 0) / total) * 10) / 10; const counts = {}; history.forEach(h => { counts[h.emotion] = (counts[h.emotion] || 0) + 1 }); dominant = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b); Object.entries(counts).forEach(([emo, cnt]) => { distribution[emo] = Math.round((cnt / total) * 1000) / 10 }); uniqueCount = Object.keys(counts).length }
    setSessionData({ duration: sessionDuration, totalDetections: total, emotionHistory: history, avgEngagement: avgEng, transcription: allTranscriptsRef.current.join(' '), textEmotion, voiceEmotion })
    if (total > 0) { setSaving(true); try { await API.post('/sessions/save', { lecture_id: null, avg_engagement: avgEng, overall_engagement: avgEng, dominant_emotion: dominant, total_detections: total, unique_emotions: uniqueCount, distribution, emotion_logs: history.map(h => ({ time: h.time || new Date().toISOString(), emotion: h.emotion, confidence: (h.confidence || 0) / 100, source: h.source || 'vision', scores: Object.fromEntries(Object.entries(h.scores || {}).map(([k, v]) => [k, (v || 0) / 100])), engagement_score: (h.engagement_score || 0) / 100 })) }) } catch {}; setSaving(false) }
    try { await API.post('/session/end', { duration: sessionDuration, detections: total, avgEngagement: avgEng }) } catch {}
    if (detectionMode === 'multi') { try { const mp = await API.get('/session/multi/profile'); setMultiProfile(mp.data) } catch {} }
    setShowReport(true); loadStats(); loadSessions()
  }

  const captureAndAnalyze = async () => {
    if (isAnalyzingRef.current || !videoRef.current || !canvasRef.current) return; const video = videoRef.current; const canvas = canvasRef.current; if (video.readyState !== 4) return
    isAnalyzingRef.current = true; setIsProcessing(true)
    try { const ctx = canvas.getContext('2d'); canvas.width = video.videoWidth; canvas.height = video.videoHeight; ctx.drawImage(video, 0, 0); const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8)); const fd = new FormData(); fd.append('file', blob, 'frame.jpg'); const controller = new AbortController(); const tid = setTimeout(() => controller.abort(), 15000)
      if (detectionMode === 'multi') {
        const res = await API.post('/api/detect-emotion-multi', fd, { headers: { 'Content-Type': 'multipart/form-data' }, signal: controller.signal }); clearTimeout(tid)
        if (res.data && res.data.success) { setFaces(res.data.faces || []); setClassEng(res.data.class_engagement || 0); const ff = res.data.faces || []; if (ff.length > 0) { const top = ff[0]; setCurrentEmotion(top.emotion); setEngagement(res.data.class_engagement || 0); detectionCountRef.current += 1; emotionHistoryRef.current.push({ time: new Date().toISOString(), timestamp: sessionDuration, emotion: top.emotion, confidence: top.confidence || 50, scores: {}, engagement_score: res.data.class_engagement || 0, source: 'vision-multi', face_count: ff.length }) } }
        else { setFaces([]); setClassEng(0) }
      } else {
        const res = await API.post('/api/detect-emotion', fd, { headers: { 'Content-Type': 'multipart/form-data' }, signal: controller.signal }); clearTimeout(tid); if (res.data) { const { dominant, confidence, emotions, engagement: eng } = res.data; setCurrentEmotion(dominant); setEmotionScores(emotions || {});
          // Three-dimensional engagement via EngagementEngine
          const ee = engagementEngineRef.current; const gr = gazeResult
          if (ee) {
            const engResult = ee.update({
              faceEmotion: dominant, faceConfidence: (confidence || 50) / 100,
              faceProbabilities: emotions ? Object.fromEntries(Object.entries(emotions).map(([k,v]) => [k, v/100])) : null,
              voiceValence: voiceEmotion?.valence ?? null, textSentiment: textEmotion?.confidence ? (textEmotion.emotion === 'positive' ? textEmotion.confidence : textEmotion.emotion === 'negative' ? -textEmotion.confidence : 0) : null,
              attentionScore: gr?.attention?.score ?? null,
              headYaw: gr?.headPose?.yaw ?? null, headPitch: gr?.headPose?.pitch ?? null,
              fixationStability: gr?.attention?.fixStability ?? null,
              saccadeRate: gr?.saccadeRate ? gr.saccadeRate / 10 : null,
            })
            setEngagement(Math.round(engResult.overallEngagement * 100))
            setEngDimensions(engResult)
          } else { setEngagement(eng || confidence || 50) }
          detectionCountRef.current += 1; emotionHistoryRef.current.push({ time: new Date().toISOString(), timestamp: sessionDuration, emotion: dominant, confidence: confidence || 50, scores: emotions || {}, engagement_score: engagementEngineRef.current ? Math.round(engagementEngineRef.current.getDimensions().overall * 100) : (eng || 0), engagement_state: engDimensions?.engagementState || null, source: 'vision' }) }
      }
    }
    catch {} finally { isAnalyzingRef.current = false; setIsProcessing(false) }
  }

  const openMyReport = async (sid) => { try { const res = await API.get(`/students/sessions/${sid}/report`, { responseType: 'blob' }); const url = URL.createObjectURL(new Blob([res.data], { type: 'text/html' })); window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 60000) } catch { alert('Could not load report.') } }
  const downloadMyCSV = async (sid) => { try { const res = await API.get(`/students/sessions/${sid}/csv`, { responseType: 'blob' }); const url = URL.createObjectURL(new Blob([res.data])); const a = document.createElement('a'); a.href = url; a.download = `session_${sid}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url) } catch { alert('Could not download CSV.') } }

  /* ── Custom tooltip for charts ── */
  const ChartTooltip = ({ active, payload }) => {
    if (active && payload?.length) return (
      <div className="bg-white rounded-lg shadow-lg border border-gray-100 px-3 py-1.5 text-xs"><span className="font-semibold text-slate-700">{payload[0].value}%</span></div>
    ); return null
  }

  return (
    <DashboardLayout activeTab={tab} onTabChange={setTab} unreadCount={unreadCount} title={`Overview / ${user?.name || 'Student'}`}
      headerRight={isSessionActive ? (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-recording" />
          <span className="text-red-600 font-mono text-sm font-semibold">{formatDuration(sessionDuration)}</span>
        </div>
      ) : ( <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">No session</span> )}
    >
      {/* ═══════════ OVERVIEW ═══════════ */}
      {tab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          <GlassCard className="p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-white text-xl font-bold shadow-md shadow-indigo-200">
                  {user?.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wider font-medium">Student Profile &middot; {stats.sessions} sessions</div>
                  <h2 className="text-2xl font-bold text-slate-800 mt-0.5">Welcome back, {user?.name?.split(' ')[0]}.</h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {stats.avgEngagement >= 65 ? 'Your focus has been strong lately. Keep it up.'
                      : stats.avgEngagement >= 40 ? 'Solid progress. A few more focused sessions would help.'
                        : stats.sessions > 0 ? 'Try longer sessions to build engagement momentum.'
                          : 'Start your first session to begin tracking.'}
                  </p>
                </div>
              </div>
              <button onClick={() => setTab('live')} className="btn-primary flex items-center gap-2 text-sm px-5 py-2.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Start session
              </button>
            </div>
          </GlassCard>

          {/* Stat cards with charts */}
          <div className="grid grid-cols-3 gap-4">
            <GlassCard variant="stat" accent="indigo" className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Engagement Score</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
              </div>
              <div className="text-3xl font-bold text-slate-800">{Math.round(stats.avgEngagement || 0)}%</div>
              <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${stats.avgEngagement || 0}%`, background: engColor(stats.avgEngagement) }} />
              </div>
              {derivedMetrics.engTrend.length > 2 && (
                <div className="mt-3 -mx-2 -mb-1">
                  <ResponsiveContainer width="100%" height={60}>
                    <AreaChart data={derivedMetrics.engTrend}>
                      <defs><linearGradient id="engGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.3}/><stop offset="100%" stopColor="#6366f1" stopOpacity={0.02}/></linearGradient></defs>
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="eng" stroke="#6366f1" strokeWidth={2} fill="url(#engGrad)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </GlassCard>

            <GlassCard variant="stat" accent="teal" className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Focus Duration</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <div className="text-3xl font-bold text-slate-800">{formatMinSec(derivedMetrics.avgDuration)}</div>
              <div className="text-xs text-gray-400 mt-1">avg per session</div>
            </GlassCard>

            <GlassCard variant="stat" accent="amber" className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Best Performance</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </div>
              <div className="text-3xl font-bold text-slate-800">{formatHour(derivedMetrics.bestHour)}</div>
              <div className="text-xs text-gray-400 mt-1">{derivedMetrics.bestHour !== null ? `Peak focus · ${derivedMetrics.bestAvg}% avg` : 'No data yet'}</div>
            </GlassCard>
          </div>

          {/* Weekly pattern */}
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-semibold text-slate-800">This week's pattern</h3>
                <p className="text-xs text-gray-400 mt-0.5">{derivedMetrics.weeklyData.filter(d => d.sessions > 0).length} active days{stats.avgEngagement > 0 && `, avg ${Math.round(stats.avgEngagement)}% engagement`}</p>
              </div>
              <div className="flex items-center gap-4">
                {EMOTION_LEGEND.map(l => (<div key={l.key} className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ background: l.color }} /><span className="text-[11px] text-gray-400">{l.label}</span></div>))}
              </div>
            </div>
            <div className="grid grid-cols-7 gap-3">
              {derivedMetrics.weeklyData.map((d) => (
                <div key={d.day} className={`rounded-xl p-3 text-center transition-all ${d.sessions > 0 ? 'bg-gray-50 hover:bg-gray-100 border border-gray-100' : 'opacity-40'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-500">{d.day}</span>
                    {d.sessions > 0 && <span className="text-xs font-bold text-slate-700">{d.engagement}%</span>}
                  </div>
                  {d.sessions > 0 ? (
                    <>
                      <div className="text-[11px] text-gray-400 mb-1">{d.date?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                      <div className="flex gap-px h-8 items-end justify-center">
                        {Object.entries(d.emotions).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([emo, count]) => (
                          <div key={emo} className="emotion-bar rounded-sm" style={{ width: '6px', height: `${Math.max(20, (count / d.sessions) * 100)}%`, background: EMOTION_COLORS[emo]?.hex || '#94a3b8' }} />
                        ))}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1.5">{d.sessions} session{d.sessions > 1 ? 's' : ''}</div>
                    </>
                  ) : (<div className="text-[11px] text-gray-300 mt-4">Rest day</div>)}
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Recent sessions */}
          {sessions.length > 0 && (
            <GlassCard className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-800">Recent sessions</h3>
                <button onClick={() => setTab('history')} className="text-xs text-indigo-600 hover:text-indigo-500 transition-colors">View all &rarr;</button>
              </div>
              <div className="space-y-2">
                {sessions.slice(0, 3).map(s => { const eng = s.avg_engagement || 0; return (
                  <div key={s.id} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-100 transition-all">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-100 to-blue-100 border border-indigo-200 flex items-center justify-center text-indigo-600 text-xs font-bold">#{s.id}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-700 font-medium">{s.started_at ? new Date(s.started_at).toLocaleString() : 'Unknown'}</div>
                      <div className="text-xs text-gray-400 capitalize">{s.dominant_emotion || 'N/A'} &middot; {s.total_detections || 0} detections</div>
                    </div>
                    <div className="text-right"><div className="text-sm font-bold" style={{ color: engColor(eng) }}>{Math.round(eng)}%</div><div className="text-[10px] text-gray-400">engagement</div></div>
                    <button onClick={() => openMyReport(s.id)} className="px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 text-xs font-medium hover:bg-indigo-100 transition-all">Report</button>
                  </div>
                )})}
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {/* ═══════════ LIVE SESSION ═══════════ */}
      {tab === 'live' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex items-center gap-4 flex-wrap">
            {!isSessionActive ? (
              <button onClick={startSession} disabled={transcribing} className="btn-success flex items-center gap-2 px-6 py-3"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>Start Session</button>
            ) : (
              <button onClick={stopSession} disabled={saving} className="btn-danger flex items-center gap-2 px-6 py-3"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>Stop Session</button>
            )}
            {/* Detection Mode Toggle */}
            {!isSessionActive && (
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-1">
                <button onClick={() => setDetectionMode('single')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${detectionMode === 'single' ? 'bg-white text-indigo-600 border border-indigo-200 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  <span className="flex items-center gap-1.5"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>Single Face</span>
                </button>
                <button onClick={() => setDetectionMode('multi')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${detectionMode === 'multi' ? 'bg-white text-indigo-600 border border-indigo-200 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  <span className="flex items-center gap-1.5"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>Multi-Face</span>
                </button>
              </div>
            )}
            {isSessionActive && detectionMode === 'multi' && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <span className="text-amber-700 text-xs font-medium">Multi-face · {faces.length} detected</span>
              </div>
            )}
            {saving && <div className="flex items-center gap-2 text-amber-600 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm"><div className="w-3 h-3 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin" /> Saving...</div>}
            {transcribing && <div className="flex items-center gap-2 text-indigo-600 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-sm"><div className="w-3 h-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" /> Transcribing...</div>}
            {isSessionActive && (
              <div className="flex items-center gap-2">
                <button onClick={() => setIsCalibrating(true)} className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 text-xs font-medium hover:bg-blue-100 transition-all flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="10"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>
                  {isGazeCalibrated ? 'Recalibrate' : 'Calibrate Gaze'}
                </button>
                {isGazeCalibrated && (
                  <button onClick={() => setShowGazeOverlay(v => !v)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${showGazeOverlay ? 'bg-green-50 border border-green-200 text-green-600' : 'bg-gray-50 border border-gray-200 text-gray-500'}`}>
                    {showGazeOverlay ? '👁 Gaze On' : '👁 Gaze Off'}
                  </button>
                )}
              </div>
            )}
            <div className="flex items-center gap-4 ml-auto">
              <div className="flex items-center gap-2 text-xs text-gray-500"><div className={`w-2 h-2 rounded-full ${cameraOn ? 'bg-green-500' : 'bg-gray-300'}`} />{cameraOn ? 'Camera' : 'Off'}</div>
              <div className="flex items-center gap-2 text-xs text-gray-500"><div className={`w-2 h-2 rounded-full ${micOn ? 'bg-indigo-500 animate-pulse-soft' : 'bg-gray-300'}`} />{micOn ? 'Recording' : 'Mic off'}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <GlassCard className="p-5">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Face Emotion</h3>
              <div className="relative aspect-video bg-gray-100 rounded-xl overflow-hidden mb-4">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <canvas ref={canvasRef} className="hidden" />
                {!cameraOn && !transcribing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    <p className="text-gray-400 text-sm">Click "Start Session"</p>
                  </div>
                )}
                {currentEmotion && cameraOn && (
                  <div className="absolute top-3 left-3 px-3 py-1.5 rounded-lg bg-white/80 backdrop-blur-sm border border-gray-200 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: EMOTION_COLORS[currentEmotion]?.hex }} />
                    <span className="text-slate-700 text-xs font-semibold capitalize">{currentEmotion}</span>
                  </div>
                )}
                {isSessionActive && (
                  <div className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-white/80 backdrop-blur-sm border border-gray-200 text-center">
                    <div className="text-lg font-bold" style={{ color: engColor(engagement) }}>{Math.round(engagement)}%</div>
                    <div className="text-[10px] text-gray-500">Engagement</div>
                  </div>
                )}
                {micOn && <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-md bg-indigo-500 flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse-soft" /><span className="text-white text-[10px] font-medium">Voice</span></div>}
                {/* Multi-face bounding box overlay */}
                {detectionMode === 'multi' && cameraOn && faces.length > 0 && videoRef.current && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${videoRef.current.videoWidth || 640} ${videoRef.current.videoHeight || 480}`} preserveAspectRatio="xMidYMid slice">
                    {faces.map((f) => { const [x, y, w, h] = f.bbox; const color = f.engagement >= 65 ? '#22c55e' : f.engagement >= 40 ? '#eab308' : '#ef4444'; return (
                      <g key={f.face_id}><rect x={x} y={y} width={w} height={h} stroke={color} strokeWidth="3" fill="none" rx="6" /><rect x={x} y={Math.max(0, y - 26)} width={Math.min(w, 180)} height="22" fill={color} /><text x={x + 6} y={Math.max(16, y - 10)} fill="white" fontSize="14" fontWeight="bold">#{f.face_id} {f.emotion.toUpperCase()} · {Math.round(f.engagement)}%</text></g>
                    )})}
                  </svg>
                )}
              </div>
              {currentEmotion && (
                <div className="space-y-1.5">
                  {Object.entries(emotionScores).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([emotion, score]) => (
                    <div key={emotion} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: EMOTION_COLORS[emotion]?.hex }} />
                      <span className="w-16 text-gray-500 text-xs capitalize">{emotion}</span>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${score}%`, background: EMOTION_COLORS[emotion]?.hex }} /></div>
                      <span className="w-10 text-right text-gray-500 text-xs">{Math.round(score)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>

            <GlassCard className="p-5">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Session Info</h3>
              {isSessionActive ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100"><div className="text-2xl font-bold text-slate-700">{detectionCountRef.current}</div><div className="text-xs text-gray-400 mt-0.5">Detections</div></div>
                    <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100"><div className="text-2xl font-bold" style={{ color: engColor(engagement) }}>{Math.round(engagement)}%</div><div className="text-xs text-gray-400 mt-0.5">Engagement</div></div>
                  </div>
                  {/* Three-dimensional engagement breakdown */}
                  {engDimensions && (
                    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-4 border border-indigo-100 space-y-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Engagement Dimensions</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white border border-indigo-200 text-indigo-600">{engDimensions.engagementState}</span>
                      </div>
                      {[
                        { label: 'Emotional', value: engDimensions.emotionalScore, color: '#ef4444', icon: '❤️' },
                        { label: 'Behavioral', value: engDimensions.behavioralScore, color: '#3b82f6', icon: '👁' },
                        { label: 'Cognitive', value: engDimensions.cognitiveScore, color: '#8b5cf6', icon: '🧠' },
                      ].map(d => (
                        <div key={d.label} className="flex items-center gap-2">
                          <span className="text-xs w-4 text-center">{d.icon}</span>
                          <span className="text-xs text-gray-500 w-16">{d.label}</span>
                          <div className="flex-1 h-1.5 bg-white rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${(d.value||0)*100}%`, background: d.color }} /></div>
                          <span className="text-xs text-gray-500 w-8 text-right">{Math.round((d.value||0)*100)}%</span>
                        </div>
                      ))}
                      {engDimensions.trend && engDimensions.trend !== 'stable' && (
                        <div className="text-[10px] text-gray-400 text-center mt-1">Trend: {engDimensions.trend === 'rising' ? '📈 Rising' : '📉 Falling'}</div>
                      )}
                    </div>
                  )
                  </div>
                  {currentEmotion && (
                    <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
                      <div className="w-3 h-3 rounded-full mx-auto mb-2" style={{ background: EMOTION_COLORS[currentEmotion]?.hex }} />
                      <div className="text-lg font-bold text-slate-700 capitalize">{currentEmotion}</div><div className="text-xs text-gray-400">Current Emotion</div>
                    </div>
                  )}
                  <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                    <div className="flex items-center gap-2 mb-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
                      <span className="text-indigo-600 text-xs font-semibold uppercase tracking-wide">Live Transcript</span>
                    </div>
                    <div ref={transcriptBoxRef} className="max-h-28 overflow-y-auto bg-white rounded-lg p-3 min-h-[48px] border border-indigo-100">
                      {transcription ? <p className="text-gray-600 text-xs leading-relaxed">{transcription}</p> : <p className="text-gray-300 text-xs italic">Listening... transcript appears every ~20s</p>}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {transcription && (
                    <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                      <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-2">Full Session Transcript</div>
                      <div className="max-h-36 overflow-y-auto bg-white rounded-lg p-3 border border-indigo-100"><p className="text-gray-600 text-xs leading-relaxed">{transcription}</p></div>
                      <div className="mt-3 space-y-1.5">
                        {textEmotion && <div className="flex items-center justify-between text-xs"><span className="text-gray-500">Text Emotion</span><span className="badge badge-primary capitalize">{textEmotion.emotion} ({Math.round((textEmotion.confidence || 0) * 100)}%)</span></div>}
                        {voiceEmotion && <div className="flex items-center justify-between text-xs"><span className="text-gray-500">Voice Emotion</span><span className="badge badge-info capitalize">{voiceEmotion.emotion} ({Math.round((voiceEmotion.confidence || 0) * 100)}%)</span></div>}
                      </div>
                    </div>
                  )}
                  {!transcription && (
                    <div className="text-center py-10">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" className="mx-auto mb-3"><circle cx="12" cy="12" r="3"/><path d="M16.95 7.05a7 7 0 0 1 0 9.9"/><path d="M7.05 16.95a7 7 0 0 1 0-9.9"/></svg>
                      <h3 className="text-lg font-semibold text-slate-700 mb-1">Ready to start?</h3>
                      <p className="text-gray-400 text-sm">Camera + microphone for multimodal analysis.</p>
                    </div>
                  )}
                </div>
              )}
            </GlassCard>
          </div>

          {/* Multi-face per-student cards */}
          {detectionMode === 'multi' && isSessionActive && faces.length > 0 && (
            <GlassCard className="p-5">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                Per-Face Tracking <span className="text-xs font-normal text-gray-400 ml-1">({faces.length} detected)</span>
              </h3>
              <div className={`grid gap-3 ${faces.length <= 2 ? 'grid-cols-2' : faces.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
                {faces.map((f) => { const color = f.engagement >= 65 ? '#22c55e' : f.engagement >= 40 ? '#eab308' : '#ef4444'; return (
                  <div key={f.face_id} className="bg-gray-50 border border-gray-100 rounded-xl p-4 hover:bg-gray-100 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-700 font-bold text-sm">Face #{f.face_id}</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>{f.engagement >= 65 ? 'High' : f.engagement >= 40 ? 'Medium' : 'Low'}</span>
                    </div>
                    <div className="text-center mb-2">
                      <div className="text-2xl mb-0.5">{{'anger':'😠','disgust':'🤢','fear':'😨','happiness':'😊','neutral':'😐','sadness':'😢','surprise':'😲'}[f.emotion] || '😐'}</div>
                      <div className="text-xs font-bold capitalize" style={{ color: EMOTION_COLORS[f.emotion]?.hex || '#6b7280' }}>{f.emotion}</div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1"><span>Engagement</span><span style={{ color }}>{Math.round(f.engagement)}%</span></div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, f.engagement)}%`, background: color }} /></div>
                  </div>
                )})}
              </div>
            </GlassCard>
          )}

          {/* Multi-face class engagement summary */}
          {detectionMode === 'multi' && isSessionActive && (
            <GlassCard className="p-5">
              <div className="flex items-center justify-between">
                <div><h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Class Engagement</h3><p className="text-xs text-gray-400 mt-0.5">{faces.length} faces in frame</p></div>
                <div className="text-right"><div className="text-3xl font-bold" style={{ color: classEng >= 65 ? '#22c55e' : classEng >= 40 ? '#eab308' : '#ef4444' }}>{Math.round(classEng)}%</div><div className="text-xs text-gray-400">{classEng >= 65 ? 'High' : classEng >= 40 ? 'Medium' : 'Low'} engagement</div></div>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-3"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, classEng)}%`, background: classEng >= 65 ? '#22c55e' : classEng >= 40 ? '#eab308' : '#ef4444' }} /></div>
            </GlassCard>
          )}

          {/* Multi-face post-session summary */}
          {detectionMode === 'multi' && !isSessionActive && multiProfile && multiProfile.faces?.length > 0 && (
            <GlassCard className="p-5">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                Multi-Face Session Summary
              </h3>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100"><div className="text-2xl font-bold text-slate-700">{multiProfile.face_count}</div><div className="text-xs text-gray-400 mt-0.5">Faces Tracked</div></div>
                <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100"><div className="text-2xl font-bold" style={{ color: engColor(multiProfile.class_avg_engagement) }}>{multiProfile.class_avg_engagement}%</div><div className="text-xs text-gray-400 mt-0.5">Class Avg</div></div>
                <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100"><div className="text-2xl font-bold text-slate-700">{multiProfile.faces.reduce((sum, f) => sum + f.total_detections, 0)}</div><div className="text-xs text-gray-400 mt-0.5">Total Detections</div></div>
              </div>
              <div className="space-y-2">
                {multiProfile.faces.map((f) => (
                  <div key={f.face_id} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 border border-amber-200 flex items-center justify-center text-amber-700 font-bold text-sm flex-shrink-0">#{f.face_id}</div>
                    <div className="flex-1"><div className="text-sm text-slate-700 font-medium">Face #{f.face_id}</div><div className="text-xs text-gray-400 capitalize">Dominant: {f.dominant_emotion} · {f.total_detections} detections</div></div>
                    <div className="text-right"><div className="text-sm font-bold" style={{ color: engColor(f.avg_engagement) }}>{f.avg_engagement}%</div><div className="text-[10px] text-gray-400">{f.engagement_label}</div></div>
                    <div className="w-24 flex-shrink-0"><div className="h-1.5 bg-gray-200 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${f.avg_engagement}%`, background: engColor(f.avg_engagement) }} /></div></div>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {/* ═══════════ HISTORY ═══════════ */}
      {tab === 'history' && (
        <div className="animate-fade-in">
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-5"><h3 className="text-base font-semibold text-slate-800">Session History</h3><button onClick={loadSessions} className="btn-secondary text-xs px-3 py-1.5">Refresh</button></div>
            {sessions.length === 0 ? (
              <div className="text-center py-12"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" className="mx-auto mb-3"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><p className="text-gray-400">No sessions yet.</p></div>
            ) : (
              <div className="space-y-2">
                {sessions.map((s) => { const eng = s.avg_engagement || 0; return (
                  <div key={s.id} className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-100 transition-all">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-100 to-blue-100 border border-indigo-200 flex items-center justify-center text-indigo-600 text-xs font-bold flex-shrink-0">#{s.id}</div>
                    <div className="flex-1 min-w-0"><div className="text-sm text-slate-700 font-medium">{s.started_at ? new Date(s.started_at).toLocaleString() : 'Unknown'}</div><div className="text-xs text-gray-400 capitalize">Dominant: {s.dominant_emotion || 'N/A'}</div></div>
                    <div className="flex items-center gap-5"><div className="text-center"><div className="text-sm font-bold text-blue-600">{s.total_detections || 0}</div><div className="text-[10px] text-gray-400">Detections</div></div><div className="text-center"><div className="text-sm font-bold" style={{ color: engColor(eng) }}>{Math.round(eng)}%</div><div className="text-[10px] text-gray-400">Engagement</div></div></div>
                    <div className="flex gap-2">
                      <button onClick={() => openMyReport(s.id)} className="px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 text-xs font-medium hover:bg-indigo-100 transition-all">Report</button>
                      <button onClick={() => downloadMyCSV(s.id)} className="px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 text-xs font-medium hover:bg-gray-100 transition-all">CSV</button>
                    </div>
                  </div>
                )})}
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* ═══════════ COURSES ═══════════ */}
      {tab === 'courses' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-between items-center"><h3 className="text-base font-semibold text-slate-800">My Courses</h3><button onClick={loadAvailableCourses} className="btn-secondary text-xs px-3 py-1.5">+ Browse &amp; Enroll</button></div>
          {showBrowse && (
            <GlassCard className="p-5">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Available Courses</h4>
              {availableCourses.length === 0 ? <p className="text-gray-400 text-sm">No courses available</p> : (
                <div className="space-y-2">{availableCourses.map(c => (
                  <div key={c.id} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl p-3">
                    <div><div className="text-slate-700 font-medium text-sm">{c.name}</div><div className="text-gray-400 text-xs">by {c.teacher_name}</div></div>
                    {c.enrolled ? <span className="badge badge-success">Enrolled</span> : <button onClick={() => enrollInCourse(c.id)} className="px-3 py-1 rounded-lg bg-green-50 text-green-600 text-xs font-semibold hover:bg-green-100 border border-green-200 transition-all">Enroll</button>}
                  </div>
                ))}</div>
              )}
              <button onClick={() => setShowBrowse(false)} className="text-gray-400 text-xs mt-3 hover:text-gray-600 transition-colors">Close</button>
            </GlassCard>
          )}
          {myCourses.length === 0 ? (
            <GlassCard className="p-8 text-center"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" className="mx-auto mb-3"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg><p className="text-gray-400">Not enrolled in any courses yet.</p><button onClick={loadAvailableCourses} className="mt-3 btn-secondary text-xs px-4 py-2">Browse Courses</button></GlassCard>
          ) : (
            myCourses.map(course => {
              const courseExams = myExams.filter(e => e.course_id === course.id)
              return (
                <GlassCard key={course.id} className="p-5">
                  <h4 className="text-slate-700 font-semibold">{course.name}</h4>
                  <p className="text-gray-400 text-xs">by {course.teacher_name}</p>
                  {course.description && <p className="text-gray-500 text-sm mt-2">{course.description}</p>}
                  {courseExams.length === 0 ? <p className="text-gray-300 text-xs mt-3">No exams posted yet</p> : (
                    <div className="mt-3 space-y-2">
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Exams</span>
                      {courseExams.map(ex => (
                        <div key={ex.id} className={`flex items-center justify-between rounded-xl p-3 ${ex.submitted ? 'bg-green-50 border border-green-100' : 'bg-gray-50 border border-gray-100'}`}>
                          <div className="flex-1"><div className="text-sm text-slate-700 font-medium">{ex.is_proctored && <span className="text-red-500 text-[10px] mr-1">Proctored</span>}{ex.title}</div><div className="text-xs text-gray-400 mt-0.5">{ex.question_count} questions &middot; {Math.floor(ex.time_limit / 60)} min{ex.due_date && ` · Due: ${new Date(ex.due_date).toLocaleDateString()}`}</div></div>
                          {ex.submitted ? (<div className="text-right"><div className="text-sm font-bold text-green-600">{ex.score}%</div><div className="text-[10px] text-gray-400">Focus: {ex.focus_score}%</div></div>) : (<button onClick={() => navigate(`/exam?id=${ex.id}`)} className="btn-danger text-xs px-3 py-1.5">Take Exam</button>)}
                        </div>
                      ))}
                    </div>
                  )}
                </GlassCard>
              )
            })
          )}
        </div>
      )}

      {tab === 'compare' && <CompareWithClass />}

      {/* ═══════════ NOTIFICATIONS ═══════════ */}
      {tab === 'notifications' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-semibold text-slate-800">Notifications</h3>
            {unreadCount > 0 && (<button onClick={() => { API.post('/notifications/read-all').then(() => { setUnreadCount(0); setNotifications(prev => prev.map(n => ({ ...n, is_read: true }))) }).catch(() => {}) }} className="text-xs text-indigo-600 hover:text-indigo-500 transition-colors">Mark all read</button>)}
          </div>
          {notifications.length === 0 ? (
            <GlassCard className="p-8 text-center"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" className="mx-auto mb-3"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg><p className="text-gray-400">No notifications yet</p></GlassCard>
          ) : (
            <div className="space-y-2">{notifications.map(n => (
              <GlassCard key={n.id} hover={false} className={`p-4 cursor-pointer transition-all hover:bg-gray-50 ${n.is_read ? 'opacity-50' : 'border-l-2 border-l-indigo-500'}`} onClick={() => { markRead(n.id); if (n.link) navigate(n.link) }}>
                <div className="flex justify-between items-start">
                  <div><div className="text-slate-700 font-medium text-sm">{n.title}</div><div className="text-gray-400 text-xs mt-0.5">{n.message}</div></div>
                  <span className="text-gray-300 text-[10px] whitespace-nowrap ml-3">{n.created_at ? new Date(n.created_at).toLocaleDateString() : ''}</span>
                </div>
              </GlassCard>
            ))}</div>
          )}
        </div>
      )}

      {showReport && sessionData && <SessionReport sessionData={sessionData} onClose={() => setShowReport(false)} />}
      {/* Gaze visualization overlay */}
      <GazeOverlay
        gazeResult={gazeResult}
        gazeTracker={gazeTrackerRef.current}
        visible={isSessionActive && showGazeOverlay && !isCalibrating && isGazeCalibrated}
        showHeatmap={true}
        showCircle={true}
        showScanpath={false}
        opacity={0.5}
      />
      {/* Gaze calibration overlay */}
      {isCalibrating && (
        <GazeCalibration
          gazeTracker={gazeTrackerRef.current}
          getLandmarks={() => latestLandmarksRef.current ? ({ landmarks: latestLandmarksRef.current, imageWidth: videoRef.current?.videoWidth || 640, imageHeight: videoRef.current?.videoHeight || 480 }) : null}
          onComplete={(success) => { setIsCalibrating(false); setIsGazeCalibrated(success) }}
          onCancel={() => setIsCalibrating(false)}
        />
      )}
      <ChatButton />
    </DashboardLayout>
  )
}
