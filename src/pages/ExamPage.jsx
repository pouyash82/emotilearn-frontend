import { useState, useEffect, useRef, useCallback } from 'react'
import API from '../api'

const focusColor = (s) => s >= 85 ? '#22c55e' : s >= 70 ? '#3b82f6' : s >= 50 ? '#eab308' : '#ef4444'

const SAMPLE_EXAMS = {
  'emotilearn-quiz': {
    title: 'EmotiLearn System Quiz',
    description: 'Test your understanding of the EmotiLearn facial emotion recognition system.',
    timeLimit: 600, // 10 minutes
    questions: [
      { q: "What is the primary architecture used in EmotiLearn for facial emotion recognition?", opts: ["ResNet-50", "EfficientNet-B2", "VGG-16", "MobileNet-V3"], ans: 1 },
      { q: "How many basic emotions does the system classify?", opts: ["5", "6", "7", "8"], ans: 2 },
      { q: "Which datasets were combined for training the emotion model?", opts: ["ImageNet + CIFAR", "FER-2013 + RAF-DB", "CelebA + AffectNet", "COCO + VGGFace"], ans: 1 },
      { q: "What speech-to-text model is used for live transcription?", opts: ["Google Speech API", "DeepSpeech", "OpenAI Whisper", "Amazon Transcribe"], ans: 2 },
      { q: "What fusion weight is assigned to facial emotion in the tri-signal system?", opts: ["30%", "40%", "50%", "60%"], ans: 2 },
      { q: "Which model analyzes voice tone emotion from audio waveforms?", opts: ["BERT", "wav2vec2", "GPT-4", "YOLO"], ans: 1 },
      { q: "What framework is the EmotiLearn backend built with?", opts: ["Django", "Flask", "FastAPI", "Express.js"], ans: 2 },
      { q: "Which face detection method does EmotiLearn use?", opts: ["MTCNN", "Haar Cascade", "RetinaFace", "BlazeFace"], ans: 1 },
      { q: "What database is used for session persistence?", opts: ["MongoDB", "MySQL", "PostgreSQL", "SQLite"], ans: 2 },
      { q: "What is the approximate accuracy of the fine-tuned model?", opts: ["65%", "72%", "82%", "95%"], ans: 2 },
    ],
  },
  'ml-basics': {
    title: 'Machine Learning Basics',
    description: 'A quick quiz on fundamental machine learning concepts.',
    timeLimit: 480,
    questions: [
      { q: "What is overfitting?", opts: ["Model is too simple", "Model memorizes training data", "Model is underfitting", "Model has high bias"], ans: 1 },
      { q: "Which is a supervised learning algorithm?", opts: ["K-Means", "PCA", "Random Forest", "DBSCAN"], ans: 2 },
      { q: "What does CNN stand for?", opts: ["Central Neural Network", "Convolutional Neural Network", "Connected Node Network", "Computed Neural Network"], ans: 1 },
      { q: "What is the purpose of a loss function?", opts: ["Speed up training", "Measure prediction error", "Increase accuracy", "Reduce dataset size"], ans: 1 },
      { q: "What is transfer learning?", opts: ["Training from scratch", "Using a pre-trained model on new data", "Transferring data between servers", "A type of clustering"], ans: 1 },
      { q: "What activation function is commonly used in output layers for classification?", opts: ["ReLU", "Sigmoid", "Softmax", "Tanh"], ans: 2 },
      { q: "What is an epoch in training?", opts: ["A single batch", "One pass through the entire dataset", "A learning rate step", "A layer in the network"], ans: 1 },
      { q: "What does dropout do?", opts: ["Increases learning rate", "Randomly disables neurons to prevent overfitting", "Removes data samples", "Compresses the model"], ans: 1 },
    ],
  },
}

export default function ExamPage() {
  const [phase, setPhase] = useState('select') // select | info | exam | results
  const [selectedExam, setSelectedExam] = useState(null)
  const [studentName, setStudentName] = useState('')
  const [answers, setAnswers] = useState({})
  const [currentQ, setCurrentQ] = useState(0)
  const [examScore, setExamScore] = useState(0)
  const [duration, setDuration] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)

  // Proctoring
  const [cameraOn, setCameraOn] = useState(false)
  const [currentEmotion, setCurrentEmotion] = useState(null)
  const [currentRegion, setCurrentRegion] = useState('center')
  const [focusScore, setFocusScore] = useState(100)
  const [isProcessing, setIsProcessing] = useState(false)
  const [detectionCount, setDetectionCount] = useState(0)
  const [interactionCount, setInteractionCount] = useState(0)
  const [warnings, setWarnings] = useState([])
  const [faceDistance, setFaceDistance] = useState(null)
  const [focusLog, setFocusLog] = useState([])

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const intervalRef = useRef(null)
  const durationRef = useRef(null)
  const timerRef = useRef(null)
  const startTimeRef = useRef(null)
  const isAnalyzingRef = useRef(false)
  const lastInteractionRef = useRef(Date.now())
  const gazeBufferRef = useRef([])
  const baselineFaceRef = useRef(null)

  useEffect(() => () => cleanup(), [])

  useEffect(() => {
    if (phase === 'exam' && selectedExam) {
      durationRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
        setDuration(elapsed)
        const remaining = Math.max(0, selectedExam.timeLimit - elapsed)
        setTimeLeft(remaining)
        if (remaining <= 0) submitExam()
      }, 1000)
    }
    return () => clearInterval(durationRef.current)
  }, [phase])

  useEffect(() => {
    if (phase !== 'exam') return
    const log = () => { lastInteractionRef.current = Date.now(); setInteractionCount(c => c + 1) }
    window.addEventListener('keydown', log)
    return () => window.removeEventListener('keydown', log)
  }, [phase])

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } })
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }
      streamRef.current = stream; setCameraOn(true); return true
    } catch { alert('Camera access is REQUIRED for this proctored exam.'); return false }
  }

  const cleanup = useCallback(() => {
    clearInterval(intervalRef.current); clearInterval(durationRef.current)
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOn(false); isAnalyzingRef.current = false
  }, [])

  const beginExam = () => {
    if (!studentName.trim()) { alert('Please enter your name'); return }
    setPhase('exam')
    setAnswers({}); setCurrentQ(0); setExamScore(0)
    setDuration(0); setTimeLeft(selectedExam.timeLimit)
    setDetectionCount(0); setInteractionCount(0); setWarnings([]); setFocusScore(100); setFocusLog([])
    gazeBufferRef.current = []; baselineFaceRef.current = null
    startTimeRef.current = Date.now(); lastInteractionRef.current = Date.now()
  }

  useEffect(() => {
    if (phase !== 'exam') return
    let cancelled = false
    const init = async () => {
      await new Promise(r => setTimeout(r, 200))
      if (cancelled) return
      const ok = await startWebcam()
      if (ok && !cancelled) {
        intervalRef.current = setInterval(captureFrame, 3000)
        setTimeout(captureFrame, 600)
      }
    }
    init()
    return () => { cancelled = true }
  }, [phase])

  const selectAnswer = (qIdx, optIdx) => {
    setAnswers(prev => ({ ...prev, [qIdx]: optIdx }))
    lastInteractionRef.current = Date.now()
    setInteractionCount(c => c + 1)
  }

  const submitExam = () => {
    clearInterval(intervalRef.current); clearInterval(durationRef.current); cleanup()
    let correct = 0
    selectedExam.questions.forEach((q, i) => { if (answers[i] === q.ans) correct++ })
    setExamScore(Math.round((correct / selectedExam.questions.length) * 100))
    setPhase('results')
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
      const frameW = video.videoWidth || 640

      if (res.data && res.data.faces && res.data.faces.length > 0) {
        const face = res.data.faces[0], bbox = face.bbox || []
        setCurrentEmotion(face.emotion || 'neutral'); setDetectionCount(c => c + 1)
        if (bbox.length === 4) {
          const [bx, by, bw] = bbox
          if (!baselineFaceRef.current && bw > 30) baselineFaceRef.current = { w: bw, cx: (bx + bw/2) / frameW }
          const baseline = baselineFaceRef.current || { w: bw, cx: 0.5 }
          setFaceDistance(`${Math.round((baseline.w * 35) / Math.max(1, bw))}cm`)
          const widthRatio = bw / Math.max(1, baseline.w)
          const cx = (bx + bw / 2) / frameW, shiftX = Math.abs(cx - baseline.cx)
          let region = 'center', penalty = 0
          if (widthRatio < 0.6) { region = cx < 0.5 ? 'left' : 'right'; penalty = 3 }
          else if (widthRatio < 0.8) { region = cx < 0.5 ? 'left' : 'right'; penalty = 1.5 }
          else if (shiftX > 0.12) { region = cx < baseline.cx ? 'left' : 'right'; penalty = 1 }
          gazeBufferRef.current.push(region)
          if (gazeBufferRef.current.length > 3) gazeBufferRef.current.shift()
          const offCount = gazeBufferRef.current.filter(r => r !== 'center').length
          if (region === 'center') { setCurrentRegion('center'); setFocusScore(s => Math.min(100, s + 0.5)) }
          else if (offCount >= 2) {
            setCurrentRegion(region); setFocusScore(s => Math.max(0, s - penalty))
            const d = widthRatio < 0.8 ? `Head turned ${region} (${Math.round(widthRatio*100)}%)` : `Looking ${region}`
            setWarnings(w => { const nw = [...w, { time: ts, type: d }]; return nw.length > 30 ? nw.slice(-30) : nw })
          }
          setFocusLog(prev => [...prev, { ts, region, wr: Math.round(widthRatio*100) }])
        }
      } else {
        setCurrentEmotion(null); setFaceDistance(null); setDetectionCount(c => c + 1)
        gazeBufferRef.current.push('absent')
        if (gazeBufferRef.current.length > 3) gazeBufferRef.current.shift()
        if (gazeBufferRef.current.filter(r => r === 'absent').length >= 2) {
          setCurrentRegion('absent'); setFocusScore(s => Math.max(0, s - 3))
          setWarnings(w => { const nw = [...w, { time: ts, type: 'Face not detected' }]; return nw.length > 30 ? nw.slice(-30) : nw })
        }
        setFocusLog(prev => [...prev, { ts, region: 'absent', wr: 0 }])
      }
      if ((Date.now() - lastInteractionRef.current) / 1000 > 30) setFocusScore(s => Math.max(0, s - 1))
    } catch (err) {
      if (err.name !== 'AbortError') console.error('Exam error:', err)
    } finally { isAnalyzingRef.current = false; setIsProcessing(false) }
  }

  const fmt = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`
  const total = selectedExam?.questions.length || 0
  const answered = Object.keys(answers).length

  // ════════════════════ SELECT EXAM ════════════════════
  if (phase === 'select') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full space-y-6">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-3xl font-black text-white mb-2">EmotiLearn Proctored Exams</h1>
          <p className="text-gray-400">Select an exam to begin. Camera will be required.</p>
        </div>
        {Object.entries(SAMPLE_EXAMS).map(([id, exam]) => (
          <button key={id} onClick={() => { setSelectedExam(exam); setPhase('info') }}
            className="w-full text-left bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 hover:border-blue-500/30 transition-all duration-300 group">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-white font-bold text-lg group-hover:text-blue-400 transition-colors">{exam.title}</h2>
                <p className="text-gray-400 text-sm mt-1">{exam.description}</p>
                <div className="flex gap-4 mt-3 text-xs text-gray-500">
                  <span>📝 {exam.questions.length} questions</span>
                  <span>⏱ {Math.floor(exam.timeLimit / 60)} minutes</span>
                  <span>📹 Proctored</span>
                </div>
              </div>
              <div className="text-2xl text-gray-600 group-hover:text-blue-400 transition-colors">→</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )

  // ════════════════════ EXAM INFO + NAME ════════════════════
  if (phase === 'info') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white/5 border border-white/10 rounded-2xl p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">📋</div>
          <h2 className="text-2xl font-black text-white">{selectedExam.title}</h2>
          <p className="text-gray-400 text-sm mt-2">{selectedExam.description}</p>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
            <div className="text-white font-bold">{selectedExam.questions.length}</div>
            <div className="text-xs text-gray-500">Questions</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
            <div className="text-white font-bold">{Math.floor(selectedExam.timeLimit / 60)} min</div>
            <div className="text-xs text-gray-500">Time Limit</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
            <div className="text-white font-bold">Required</div>
            <div className="text-xs text-gray-500">Camera</div>
          </div>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 text-sm text-red-300">
          ⚠️ <strong>Proctoring Notice:</strong> Your camera will be active during the exam. Head movement, face distance, and interaction timing will be tracked. Ensure your face is clearly visible.
        </div>
        <div className="mb-4">
          <label className="text-gray-400 text-sm mb-2 block">Your Full Name</label>
          <input type="text" value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="Enter your name..."
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:border-blue-500/50 focus:outline-none transition-all" />
        </div>
        <div className="flex gap-3">
          <button onClick={() => setPhase('select')} className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 transition-all">← Back</button>
          <button onClick={beginExam} disabled={!studentName.trim()}
            className="flex-1 py-3 rounded-xl font-bold bg-gradient-to-r from-red-500 to-rose-500 text-white hover:from-red-400 hover:to-rose-400 disabled:opacity-40 transition-all">
            🔒 Begin Exam
          </button>
        </div>
      </div>
    </div>
  )

  // ════════════════════ EXAM IN PROGRESS ════════════════════
  if (phase === 'exam') {
    const q = selectedExam.questions[currentQ]
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4 bg-white/5 rounded-xl px-4 py-3 border border-white/10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /><span className="text-red-400 font-mono text-sm font-bold">{fmt(duration)}</span></div>
            <span className="text-gray-600">|</span>
            <span className="text-gray-400 text-sm">{studentName}</span>
            <span className="text-gray-600">|</span>
            <span className="text-gray-400 text-sm">{answered}/{total} answered</span>
          </div>
          <div className="flex items-center gap-4">
            <div className={`text-sm font-bold ${timeLeft < 60 ? 'text-red-400 animate-pulse' : 'text-gray-400'}`}>⏱ {fmt(timeLeft)} left</div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold" style={{ color: focusColor(focusScore) }}>Focus: {Math.round(focusScore)}%</span>
              <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${focusScore}%`, background: focusColor(focusScore) }} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {/* Questions — 3 cols */}
          <div className="col-span-3 space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold text-lg">Question {currentQ + 1} of {total}</h3>
                <div className="flex gap-1">
                  {selectedExam.questions.map((_, i) => (
                    <button key={i} onClick={() => setCurrentQ(i)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${i === currentQ ? 'bg-blue-500 text-white' : answers[i] !== undefined ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/5 text-gray-500 border border-white/10'}`}>
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-gray-200 text-lg mb-6">{q.q}</p>
              <div className="space-y-3">
                {q.opts.map((opt, i) => (
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
                  className="px-5 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 disabled:opacity-30 transition-all">← Previous</button>
                {currentQ < total - 1 ? (
                  <button onClick={() => setCurrentQ(currentQ + 1)}
                    className="px-5 py-2 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30 transition-all">Next →</button>
                ) : (
                  <button onClick={submitExam} disabled={answered < total}
                    className="px-6 py-2 rounded-xl font-bold bg-gradient-to-r from-green-500 to-emerald-500 text-white disabled:opacity-40 transition-all">✓ Submit ({answered}/{total})</button>
                )}
              </div>
            </div>
          </div>

          {/* Camera — 1 col */}
          <div className="space-y-3">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-2">
              <div className="relative rounded-xl overflow-hidden bg-black aspect-[3/4]">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute top-2 left-2">
                  <div className={`px-2 py-1 rounded text-[10px] font-bold ${currentRegion === 'center' ? 'bg-green-500/80' : currentRegion === 'absent' ? 'bg-red-500/80' : 'bg-yellow-500/80'} text-white`}>
                    {currentRegion === 'center' ? '✅' : '⚠️'} {currentRegion}
                  </div>
                </div>
                {currentEmotion && <div className="absolute top-2 right-2 px-2 py-1 rounded bg-black/60 text-white text-[10px] font-bold capitalize">{currentEmotion}</div>}
                <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-red-500/80 flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /><span className="text-white text-[10px] font-bold">REC</span>
                </div>
                {faceDistance && <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/60 text-white text-[10px]">📏{faceDistance}</div>}
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <div className="text-2xl font-black" style={{ color: focusColor(focusScore) }}>{Math.round(focusScore)}%</div>
              <div className="text-[10px] text-gray-500">Focus Score</div>
              <div className="h-1 bg-white/5 rounded-full overflow-hidden mt-2">
                <div className="h-full rounded-full transition-all" style={{ width: `${focusScore}%`, background: focusColor(focusScore) }} />
              </div>
            </div>
            {warnings.length > 0 && (
              <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-2">
                <div className="text-[10px] text-red-400 font-bold mb-1">⚠️ {warnings.length} alerts</div>
                <div className="max-h-20 overflow-y-auto space-y-0.5">
                  {warnings.slice(-4).map((w, i) => <div key={i} className="text-[9px] text-red-300">{fmt(w.time)} {w.type}</div>)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ════════════════════ RESULTS ════════════════════
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center bg-white/5 border border-white/10 rounded-2xl p-8">
          <h2 className="text-2xl font-black text-white mb-2">📋 Exam Results</h2>
          <p className="text-gray-400 mb-6">{studentName} · {selectedExam.title}</p>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white/5 rounded-xl p-5 border border-white/5">
              <div className="text-4xl font-black" style={{ color: examScore >= 70 ? '#22c55e' : examScore >= 50 ? '#eab308' : '#ef4444' }}>{examScore}%</div>
              <div className="text-gray-400 text-sm mt-1">Exam Score</div>
              <div className="text-xs text-gray-500">{Object.entries(answers).filter(([i, a]) => a === selectedExam.questions[parseInt(i)].ans).length}/{total} correct</div>
            </div>
            <div className="bg-white/5 rounded-xl p-5 border border-white/5">
              <div className="text-4xl font-black" style={{ color: focusColor(focusScore) }}>{Math.round(focusScore)}%</div>
              <div className="text-gray-400 text-sm mt-1">Focus Score</div>
              <div className="text-xs text-gray-500">{focusScore >= 85 ? 'Excellent' : focusScore >= 70 ? 'Good' : focusScore >= 50 ? 'Moderate' : 'Poor'}</div>
            </div>
            <div className="bg-white/5 rounded-xl p-5 border border-white/5">
              <div className="text-4xl font-black text-white">{fmt(duration)}</div>
              <div className="text-gray-400 text-sm mt-1">Duration</div>
              <div className="text-xs text-gray-500">{warnings.length} alerts</div>
            </div>
          </div>
        </div>

        {/* Focus timeline */}
        {focusLog.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="text-white font-bold mb-3">Focus Timeline</h3>
            <div className="flex gap-[1px] h-8 rounded-lg overflow-hidden">
              {focusLog.map((e, i) => <div key={i} className="flex-1" style={{ background: e.region === 'center' ? '#22c55e' : e.region === 'absent' ? '#ef4444' : '#eab308' }} title={`${fmt(e.ts)} — ${e.region}`} />)}
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-600">
              <span>Start</span>
              <span className="flex gap-3"><span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-sm" />Focused</span><span className="flex items-center gap-1"><span className="w-2 h-2 bg-yellow-500 rounded-sm" />Turned</span><span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-sm" />Away</span></span>
              <span>End</span>
            </div>
          </div>
        )}

        {/* Answer review */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-bold mb-4">Answer Review</h3>
          <div className="space-y-2">
            {selectedExam.questions.map((q, i) => {
              const sel = answers[i], ok = sel === q.ans
              return (
                <div key={i} className={`rounded-xl p-3 border ${ok ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                  <div className="flex items-start gap-2">
                    <span className={`text-sm font-bold ${ok ? 'text-green-400' : 'text-red-400'}`}>{ok ? '✓' : '✗'}</span>
                    <div className="flex-1">
                      <div className="text-gray-200 text-sm">Q{i+1}: {q.q}</div>
                      <div className="text-xs mt-1">
                        <span className={ok ? 'text-green-400' : 'text-red-400'}>Your answer: {sel !== undefined ? q.opts[sel] : 'Not answered'}</span>
                        {!ok && <span className="text-green-400 ml-2">Correct: {q.opts[q.ans]}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {warnings.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="text-white font-bold mb-3">⚠️ Proctoring Alerts ({warnings.length})</h3>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {warnings.map((w, i) => <div key={i} className="text-sm text-red-300 bg-red-500/10 rounded-lg px-3 py-2">{fmt(w.time)} — {w.type}</div>)}
            </div>
          </div>
        )}

        <div className="text-center">
          <button onClick={() => { setPhase('select'); setSelectedExam(null); setAnswers({}); setWarnings([]); setFocusLog([]) }}
            className="px-8 py-3 rounded-2xl font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 shadow-lg transition-all">← Take Another Exam</button>
        </div>
      </div>
    </div>
  )
}
