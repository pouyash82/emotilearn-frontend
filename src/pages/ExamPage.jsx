import { useState, useEffect, useRef, useCallback } from 'react'
import API from '../api'

const focusColor = (s) => s >= 85 ? '#22c55e' : s >= 70 ? '#3b82f6' : s >= 50 ? '#eab308' : '#ef4444'

const EXAMS = {
  'emotilearn': {
    title: 'EmotiLearn System Quiz',
    course: 'Graduation Project',
    desc: 'Test your understanding of the EmotiLearn system.',
    time: 600,
    qs: [
      { q: "What is the primary architecture used in EmotiLearn for facial emotion recognition?", o: ["ResNet-50", "EfficientNet-B2", "VGG-16", "MobileNet-V3"], a: 1 },
      { q: "How many basic emotions does the system classify?", o: ["5", "6", "7", "8"], a: 2 },
      { q: "Which datasets were combined for training?", o: ["ImageNet + CIFAR", "FER-2013 + RAF-DB", "CelebA + AffectNet", "COCO + VGGFace"], a: 1 },
      { q: "What speech-to-text model provides live transcription?", o: ["Google Speech", "DeepSpeech", "OpenAI Whisper", "Amazon Transcribe"], a: 2 },
      { q: "What fusion weight is assigned to facial emotion?", o: ["30%", "40%", "50%", "60%"], a: 2 },
      { q: "Which model analyzes voice tone from audio?", o: ["BERT", "wav2vec2", "GPT-4", "YOLO"], a: 1 },
      { q: "What backend framework does EmotiLearn use?", o: ["Django", "Flask", "FastAPI", "Express.js"], a: 2 },
      { q: "Which face detection method is used?", o: ["MTCNN", "Haar Cascade", "RetinaFace", "BlazeFace"], a: 1 },
      { q: "What database stores session data?", o: ["MongoDB", "MySQL", "PostgreSQL", "SQLite"], a: 2 },
      { q: "What is the model's approximate accuracy?", o: ["65%", "72%", "82%", "95%"], a: 2 },
    ],
  },
  'ml-fundamentals': {
    title: 'Machine Learning Fundamentals',
    course: 'Computer Engineering',
    desc: 'Core ML concepts every engineer should know.',
    time: 480,
    qs: [
      { q: "What is overfitting?", o: ["Model too simple", "Model memorizes training data", "Model underfits", "Model has high bias"], a: 1 },
      { q: "Which is a supervised learning algorithm?", o: ["K-Means", "PCA", "Random Forest", "DBSCAN"], a: 2 },
      { q: "What does CNN stand for?", o: ["Central Neural Network", "Convolutional Neural Network", "Connected Node Network", "Computed Neural Net"], a: 1 },
      { q: "Purpose of a loss function?", o: ["Speed up training", "Measure prediction error", "Increase accuracy", "Reduce dataset"], a: 1 },
      { q: "What is transfer learning?", o: ["Training from scratch", "Using pre-trained model on new data", "Moving data between servers", "A clustering type"], a: 1 },
      { q: "Common output activation for classification?", o: ["ReLU", "Sigmoid", "Softmax", "Tanh"], a: 2 },
      { q: "What is an epoch?", o: ["A single batch", "One pass through entire dataset", "A learning rate step", "A network layer"], a: 1 },
      { q: "What does dropout prevent?", o: ["Underfitting", "Overfitting", "Gradient explosion", "Data leakage"], a: 1 },
    ],
  },
}

export default function ExamPage() {
  const [phase, setPhase] = useState('select')
  const [examKey, setExamKey] = useState(null)
  const [name, setName] = useState('')
  const [answers, setAnswers] = useState({})
  const [currentQ, setCurrentQ] = useState(0)
  const [duration, setDuration] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)

  // Focus tracking
  const [cameraOn, setCameraOn] = useState(false)
  const [facePresent, setFacePresent] = useState(true)
  const [currentEmotion, setCurrentEmotion] = useState(null)
  const [focusScore, setFocusScore] = useState(100)
  const [detections, setDetections] = useState(0)
  const [absenceStreak, setAbsenceStreak] = useState(0)
  const [warnings, setWarnings] = useState([])
  const [focusLog, setFocusLog] = useState([])
  const [isProcessing, setIsProcessing] = useState(false)

  // Answer timing
  const [answerTimes, setAnswerTimes] = useState({})
  const [lastAnswerTime, setLastAnswerTime] = useState(null)
  const [answerGapWarnings, setAnswerGapWarnings] = useState([])

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const intervalRef = useRef(null)
  const timerRef = useRef(null)
  const startRef = useRef(null)
  const isAnalyzingRef = useRef(false)
  const absenceRef = useRef(0)

  const exam = examKey ? EXAMS[examKey] : null
  const total = exam?.qs.length || 0
  const answered = Object.keys(answers).length

  useEffect(() => () => cleanup(), [])

  useEffect(() => {
    if (phase !== 'exam') return
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000)
      setDuration(elapsed)
      setTimeLeft(Math.max(0, exam.time - elapsed))
      if (elapsed >= exam.time) submitExam()
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [phase])

  const startWebcam = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } })
      if (videoRef.current) { videoRef.current.srcObject = s; await videoRef.current.play() }
      streamRef.current = s; setCameraOn(true); return true
    } catch { alert('Camera is REQUIRED for this proctored exam.'); return false }
  }

  const cleanup = useCallback(() => {
    clearInterval(intervalRef.current); clearInterval(timerRef.current)
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOn(false); isAnalyzingRef.current = false
  }, [])

  const beginExam = () => {
    if (!name.trim()) { alert('Please enter your name'); return }
    setPhase('exam'); setAnswers({}); setCurrentQ(0); setDuration(0)
    setFocusScore(100); setDetections(0); setAbsenceStreak(0)
    setWarnings([]); setFocusLog([]); setAnswerTimes({}); setAnswerGapWarnings([])
    setLastAnswerTime(null); absenceRef.current = 0
    startRef.current = Date.now()
  }

  useEffect(() => {
    if (phase !== 'exam') return
    let c = false
    const init = async () => {
      await new Promise(r => setTimeout(r, 200))
      if (c) return
      const ok = await startWebcam()
      if (ok && !c) {
        intervalRef.current = setInterval(checkFocus, 3000)
        setTimeout(checkFocus, 500)
      }
    }
    init()
    return () => { c = true }
  }, [phase])

  const selectAnswer = (qIdx, optIdx) => {
    const now = Date.now()
    const ts = Math.floor((now - startRef.current) / 1000)

    // Track per-question answer time
    setAnswerTimes(prev => ({ ...prev, [qIdx]: ts }))

    // Check gap since last answer
    if (lastAnswerTime) {
      const gap = (now - lastAnswerTime) / 1000
      if (gap > 45) {
        setAnswerGapWarnings(prev => [...prev, { q: qIdx + 1, gap: Math.round(gap), time: ts }])
        setFocusScore(s => Math.max(0, s - 2))
        setWarnings(w => {
          const nw = [...w, { time: ts, type: `${Math.round(gap)}s gap before Q${qIdx + 1}` }]
          return nw.length > 30 ? nw.slice(-30) : nw
        })
      }
    }
    setLastAnswerTime(now)
    setAnswers(prev => ({ ...prev, [qIdx]: optIdx }))
  }

  const submitExam = () => {
    clearInterval(intervalRef.current); clearInterval(timerRef.current); cleanup()
    setPhase('results')
  }

  // ══════════════════════════════════════════════════════════════════
  // FOCUS CHECK — simple and reliable:
  // Face detected = focused (+0.5). Face gone = not focused (-3).
  // Uses /api/detect-emotion-multi — same endpoint as Live Session.
  // ══════════════════════════════════════════════════════════════════
  const checkFocus = async () => {
    if (isAnalyzingRef.current || !videoRef.current || !canvasRef.current) return
    const video = videoRef.current, canvas = canvasRef.current
    if (video.readyState !== 4) return
    isAnalyzingRef.current = true; setIsProcessing(true)

    try {
      const ctx = canvas.getContext('2d')
      canvas.width = video.videoWidth; canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)
      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.8))
      const fd = new FormData(); fd.append('file', blob, 'frame.jpg')

      const ctrl = new AbortController()
      const tid = setTimeout(() => ctrl.abort(), 10000)
      const res = await API.post('/api/detect-emotion-multi', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }, signal: ctrl.signal,
      })
      clearTimeout(tid)

      const ts = Math.floor((Date.now() - startRef.current) / 1000)
      setDetections(c => c + 1)

      if (res.data && res.data.faces && res.data.faces.length > 0) {
        // FACE DETECTED → student is present and facing camera
        const face = res.data.faces[0]
        setFacePresent(true)
        setCurrentEmotion(face.emotion || 'neutral')
        absenceRef.current = 0
        setAbsenceStreak(0)
        setFocusScore(s => Math.min(100, s + 0.5))
        setFocusLog(prev => [...prev, { ts, status: 'present', emotion: face.emotion }])
      } else {
        // FACE NOT DETECTED → student looked away, left, or turned head
        setFacePresent(false)
        setCurrentEmotion(null)
        absenceRef.current += 1
        const streak = absenceRef.current
        setAbsenceStreak(streak)

        // Progressive penalty: longer absence = bigger penalty
        let penalty = 2
        if (streak >= 3) penalty = 4       // 9+ seconds away
        if (streak >= 5) penalty = 6       // 15+ seconds away

        setFocusScore(s => Math.max(0, s - penalty))
        setFocusLog(prev => [...prev, { ts, status: 'absent', emotion: null }])

        if (streak >= 2) {
          setWarnings(w => {
            const nw = [...w, { time: ts, type: `Face absent for ${streak * 3}s` }]
            return nw.length > 30 ? nw.slice(-30) : nw
          })
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') console.error('Focus check error:', err)
    } finally { isAnalyzingRef.current = false; setIsProcessing(false) }
  }

  const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  // ════════════════════ SELECT ════════════════════
  if (phase === 'select') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full space-y-6">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-3xl font-black text-white mb-2">EmotiLearn Proctored Exams</h1>
          <p className="text-gray-400">Select an exam. Your camera will monitor focus during the test.</p>
        </div>
        {Object.entries(EXAMS).map(([id, ex]) => (
          <button key={id} onClick={() => { setExamKey(id); setPhase('info') }}
            className="w-full text-left bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 hover:border-blue-500/30 transition-all group">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-blue-400 font-bold uppercase mb-1">{ex.course}</div>
                <h2 className="text-white font-bold text-lg group-hover:text-blue-400 transition-colors">{ex.title}</h2>
                <p className="text-gray-400 text-sm mt-1">{ex.desc}</p>
                <div className="flex gap-4 mt-3 text-xs text-gray-500">
                  <span>📝 {ex.qs.length} questions</span>
                  <span>⏱ {Math.floor(ex.time / 60)} min</span>
                  <span>📹 Proctored</span>
                </div>
              </div>
              <div className="text-2xl text-gray-600 group-hover:text-blue-400">→</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )

  // ════════════════════ INFO ════════════════════
  if (phase === 'info') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white/5 border border-white/10 rounded-2xl p-8">
        <div className="text-center mb-6">
          <div className="text-xs text-blue-400 font-bold uppercase">{exam.course}</div>
          <h2 className="text-2xl font-black text-white mt-1">{exam.title}</h2>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { v: exam.qs.length, l: 'Questions' },
            { v: `${Math.floor(exam.time / 60)} min`, l: 'Time Limit' },
            { v: 'Required', l: 'Camera' },
          ].map(s => (
            <div key={s.l} className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
              <div className="text-white font-bold">{s.v}</div><div className="text-xs text-gray-500">{s.l}</div>
            </div>
          ))}
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 text-sm text-red-300 space-y-2">
          <div>⚠️ <strong>Anti-Cheat Monitoring Active:</strong></div>
          <div className="text-xs text-red-400 space-y-1 ml-5">
            <div>• Camera tracks face presence continuously</div>
            <div>• Looking away for 6+ seconds triggers warnings</div>
            <div>• Time between answers is monitored (45s+ gap = flagged)</div>
            <div>• Final report shows focus score + all alerts</div>
          </div>
        </div>
        <div className="mb-4">
          <label className="text-gray-400 text-sm mb-2 block">Your Full Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Enter your name..."
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:border-blue-500/50 focus:outline-none" />
        </div>
        <div className="flex gap-3">
          <button onClick={() => setPhase('select')} className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10">← Back</button>
          <button onClick={beginExam} disabled={!name.trim()}
            className="flex-1 py-3 rounded-xl font-bold bg-gradient-to-r from-red-500 to-rose-500 text-white disabled:opacity-40">🔒 Begin Exam</button>
        </div>
      </div>
    </div>
  )

  // ════════════════════ EXAM ════════════════════
  if (phase === 'exam') {
    const q = exam.qs[currentQ]
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4 bg-white/5 rounded-xl px-4 py-2.5 border border-white/10 text-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /><span className="text-red-400 font-mono font-bold">{fmt(duration)}</span></div>
            <span className="text-gray-600">|</span>
            <span className="text-gray-400">{name}</span>
            <span className="text-gray-600">|</span>
            <span className="text-gray-400">{answered}/{total} answered</span>
          </div>
          <div className="flex items-center gap-4">
            <span className={`font-mono font-bold ${timeLeft < 60 ? 'text-red-400 animate-pulse' : 'text-gray-400'}`}>⏱ {fmt(timeLeft)}</span>
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${facePresent ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
              <span className="text-sm font-bold" style={{ color: focusColor(focusScore) }}>{Math.round(focusScore)}%</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {/* Questions — 3 cols */}
          <div className="col-span-3">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-bold text-lg">Question {currentQ + 1} <span className="text-gray-500 font-normal">of {total}</span></h3>
                <div className="flex gap-1">
                  {exam.qs.map((_, i) => (
                    <button key={i} onClick={() => setCurrentQ(i)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${i === currentQ ? 'bg-blue-500 text-white' : answers[i] !== undefined ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/5 text-gray-600 border border-white/10'}`}>
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-gray-100 text-lg mb-6 leading-relaxed">{q.q}</p>
              <div className="space-y-3">
                {q.o.map((opt, i) => (
                  <button key={i} onClick={() => selectAnswer(currentQ, i)}
                    className={`w-full text-left px-5 py-4 rounded-xl border transition-all ${answers[currentQ] === i ? 'bg-blue-500/20 border-blue-500/50 text-blue-200' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-sm font-bold ${answers[currentQ] === i ? 'border-blue-400 bg-blue-500/30 text-blue-300' : 'border-gray-600 text-gray-500'}`}>
                        {String.fromCharCode(65 + i)}
                      </div>
                      <span>{opt}</span>
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex justify-between mt-6">
                <button onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} disabled={currentQ === 0}
                  className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 disabled:opacity-30">← Prev</button>
                {currentQ < total - 1 ? (
                  <button onClick={() => setCurrentQ(currentQ + 1)}
                    className="px-5 py-2.5 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30">Next →</button>
                ) : (
                  <button onClick={submitExam} disabled={answered < total}
                    className="px-6 py-2.5 rounded-xl font-bold bg-gradient-to-r from-green-500 to-emerald-500 text-white disabled:opacity-40">✓ Submit ({answered}/{total})</button>
                )}
              </div>
            </div>
          </div>

          {/* Camera panel — 1 col */}
          <div className="space-y-3">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-2">
              <div className={`relative rounded-xl overflow-hidden bg-black aspect-[3/4] border-2 ${facePresent ? 'border-green-500/30' : 'border-red-500/50'}`}>
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute top-2 left-2">
                  <div className={`px-2 py-1 rounded text-[10px] font-bold ${facePresent ? 'bg-green-500/80' : 'bg-red-500/80'} text-white`}>
                    {facePresent ? '✅ Present' : '🔴 Away'}
                  </div>
                </div>
                {currentEmotion && <div className="absolute top-2 right-2 px-2 py-1 rounded bg-black/60 text-white text-[10px] font-bold capitalize">{currentEmotion}</div>}
                <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-red-500/80 flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /><span className="text-white text-[10px] font-bold">REC</span>
                </div>
                {!facePresent && absenceStreak >= 2 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-red-900/40">
                    <div className="text-center">
                      <div className="text-3xl">⚠️</div>
                      <div className="text-red-200 text-xs font-bold mt-1">Look at screen!</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <div className="text-2xl font-black" style={{ color: focusColor(focusScore) }}>{Math.round(focusScore)}%</div>
              <div className="text-[10px] text-gray-500">Focus Score</div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mt-2">
                <div className="h-full rounded-full transition-all" style={{ width: `${focusScore}%`, background: focusColor(focusScore) }} />
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-xs space-y-1.5">
              <div className="flex justify-between"><span className="text-gray-500">Checks</span><span className="text-white font-bold">{detections}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Absence</span><span className={`font-bold ${absenceStreak > 0 ? 'text-red-400' : 'text-green-400'}`}>{absenceStreak > 0 ? `${absenceStreak * 3}s` : 'None'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Alerts</span><span className="text-yellow-400 font-bold">{warnings.length}</span></div>
            </div>

            {warnings.length > 0 && (
              <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-2">
                <div className="max-h-20 overflow-y-auto space-y-0.5">
                  {warnings.slice(-4).map((w, i) => <div key={i} className="text-[9px] text-red-300">{fmt(w.time)} — {w.type}</div>)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ════════════════════ RESULTS ════════════════════
  const correct = exam.qs.filter((q, i) => answers[i] === q.a).length
  const examPct = Math.round((correct / total) * 100)
  const focusedFrames = focusLog.filter(f => f.status === 'present').length
  const focusPct = focusLog.length > 0 ? Math.round((focusedFrames / focusLog.length) * 100) : 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Scores */}
        <div className="text-center bg-white/5 border border-white/10 rounded-2xl p-8">
          <div className="text-xs text-blue-400 font-bold uppercase">{exam.course}</div>
          <h2 className="text-2xl font-black text-white mt-1 mb-2">{exam.title} — Results</h2>
          <p className="text-gray-400 text-sm mb-6">{name} · Completed in {fmt(duration)}</p>
          <div className="grid grid-cols-4 gap-4">
            {[
              { v: `${examPct}%`, l: 'Exam Score', sub: `${correct}/${total} correct`, c: examPct >= 70 ? '#22c55e' : examPct >= 50 ? '#eab308' : '#ef4444' },
              { v: `${Math.round(focusScore)}%`, l: 'Focus Score', sub: focusScore >= 85 ? 'Excellent' : focusScore >= 70 ? 'Good' : focusScore >= 50 ? 'Moderate' : 'Poor', c: focusColor(focusScore) },
              { v: `${focusPct}%`, l: 'Present', sub: `${focusedFrames}/${focusLog.length} checks`, c: focusPct >= 90 ? '#22c55e' : '#eab308' },
              { v: `${warnings.length}`, l: 'Alerts', sub: `${answerGapWarnings.length} timing flags`, c: warnings.length === 0 ? '#22c55e' : warnings.length <= 3 ? '#eab308' : '#ef4444' },
            ].map(s => (
              <div key={s.l} className="bg-white/5 rounded-xl p-4 border border-white/5">
                <div className="text-3xl font-black" style={{ color: s.c }}>{s.v}</div>
                <div className="text-gray-400 text-sm mt-1">{s.l}</div>
                <div className="text-xs text-gray-500">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Focus timeline */}
        {focusLog.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="text-white font-bold mb-3">Focus Timeline</h3>
            <div className="flex gap-[1px] h-8 rounded-lg overflow-hidden">
              {focusLog.map((e, i) => <div key={i} className="flex-1" style={{ background: e.status === 'present' ? '#22c55e' : '#ef4444' }} title={`${fmt(e.ts)} — ${e.status}`} />)}
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-600">
              <span>Start</span>
              <span className="flex gap-3">
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-sm" />Present</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-sm" />Away</span>
              </span>
              <span>End</span>
            </div>
          </div>
        )}

        {/* Answer timing */}
        {answerGapWarnings.length > 0 && (
          <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-2xl p-6">
            <h3 className="text-yellow-400 font-bold mb-3">⏱ Answer Timing Flags</h3>
            <div className="space-y-2">
              {answerGapWarnings.map((g, i) => (
                <div key={i} className="text-sm text-yellow-300 bg-yellow-500/10 rounded-xl px-4 py-2 flex justify-between">
                  <span>Question {g.q}: {g.gap}s delay before answering</span>
                  <span className="text-yellow-500 text-xs">{fmt(g.time)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Answer review */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-bold mb-4">Answer Review</h3>
          <div className="space-y-2">
            {exam.qs.map((q, i) => {
              const sel = answers[i], ok = sel === q.a
              return (
                <div key={i} className={`rounded-xl p-3 border flex items-start gap-2 ${ok ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                  <span className={`text-sm font-bold mt-0.5 ${ok ? 'text-green-400' : 'text-red-400'}`}>{ok ? '✓' : '✗'}</span>
                  <div className="flex-1">
                    <div className="text-gray-200 text-sm">Q{i + 1}: {q.q}</div>
                    <div className="text-xs mt-1">
                      <span className={ok ? 'text-green-400' : 'text-red-400'}>
                        {sel !== undefined ? q.o[sel] : 'Not answered'}
                      </span>
                      {!ok && sel !== undefined && <span className="text-green-400 ml-2">· Correct: {q.o[q.a]}</span>}
                      {answerTimes[i] && <span className="text-gray-600 ml-2">at {fmt(answerTimes[i])}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Alerts */}
        {warnings.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="text-white font-bold mb-3">⚠️ All Proctoring Alerts ({warnings.length})</h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {warnings.map((w, i) => <div key={i} className="text-sm text-red-300 bg-red-500/10 rounded-lg px-3 py-2">{fmt(w.time)} — {w.type}</div>)}
            </div>
          </div>
        )}

        <div className="text-center">
          <button onClick={() => { setPhase('select'); setExamKey(null); setAnswers({}); setWarnings([]); setFocusLog([]) }}
            className="px-8 py-3 rounded-2xl font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 shadow-lg transition-all">← Take Another Exam</button>
        </div>
      </div>
    </div>
  )
}
