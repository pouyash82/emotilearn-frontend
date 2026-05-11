import { useState, useEffect, useRef, useCallback } from 'react'

const BACKEND = 'https://web-production-3a26e.up.railway.app'
const focusColor = (s) => s >= 85 ? '#22c55e' : s >= 70 ? '#3b82f6' : s >= 50 ? '#eab308' : '#ef4444'

const EXAMS = [
  {
    id: 'emotilearn',
    title: 'EmotiLearn System Quiz',
    course: 'Graduation Project',
    desc: 'Test your understanding of the EmotiLearn system.',
    time: 600,
    qs: [
      { q: "What architecture does EmotiLearn use for facial emotion recognition?", o: ["ResNet-50", "EfficientNet-B2", "VGG-16", "MobileNet-V3"], a: 1 },
      { q: "How many emotions does the system classify?", o: ["5", "6", "7", "8"], a: 2 },
      { q: "Which datasets were combined for training?", o: ["ImageNet + CIFAR", "FER-2013 + RAF-DB", "CelebA + AffectNet", "COCO + VGGFace"], a: 1 },
      { q: "What model provides live speech transcription?", o: ["Google Speech", "DeepSpeech", "OpenAI Whisper", "Amazon Transcribe"], a: 2 },
      { q: "What fusion weight does facial emotion get?", o: ["30%", "40%", "50%", "60%"], a: 2 },
      { q: "Which model analyzes voice tone from audio?", o: ["BERT", "wav2vec2", "GPT-4", "YOLO"], a: 1 },
      { q: "What backend framework is used?", o: ["Django", "Flask", "FastAPI", "Express.js"], a: 2 },
      { q: "Which face detection method is used?", o: ["MTCNN", "Haar Cascade", "RetinaFace", "BlazeFace"], a: 1 },
      { q: "What database stores sessions?", o: ["MongoDB", "MySQL", "PostgreSQL", "SQLite"], a: 2 },
      { q: "What is the model's approximate accuracy?", o: ["65%", "72%", "82%", "95%"], a: 2 },
    ],
  },
  {
    id: 'ml-basics',
    title: 'Machine Learning Basics',
    course: 'Computer Engineering',
    desc: 'Core ML concepts.',
    time: 480,
    qs: [
      { q: "What is overfitting?", o: ["Model too simple", "Model memorizes training data", "Model underfits", "High bias"], a: 1 },
      { q: "Which is supervised learning?", o: ["K-Means", "PCA", "Random Forest", "DBSCAN"], a: 2 },
      { q: "What does CNN stand for?", o: ["Central Neural Network", "Convolutional Neural Network", "Connected Node Net", "Computed Neural Net"], a: 1 },
      { q: "Purpose of a loss function?", o: ["Speed up training", "Measure prediction error", "Increase accuracy", "Reduce dataset"], a: 1 },
      { q: "What is transfer learning?", o: ["Training from scratch", "Using pre-trained model on new data", "Moving data", "A clustering type"], a: 1 },
      { q: "Output activation for multi-class classification?", o: ["ReLU", "Sigmoid", "Softmax", "Tanh"], a: 2 },
      { q: "What is an epoch?", o: ["A single batch", "One full pass through dataset", "A learning rate step", "A layer"], a: 1 },
      { q: "What does dropout prevent?", o: ["Underfitting", "Overfitting", "Gradient explosion", "Data leakage"], a: 1 },
    ],
  },
]

export default function ExamPage() {
  const [phase, setPhase] = useState('select')
  const [exam, setExam] = useState(null)
  const [name, setName] = useState('')
  const [answers, setAnswers] = useState({})
  const [curQ, setCurQ] = useState(0)
  const [dur, setDur] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [camOn, setCamOn] = useState(false)
  const [faceOk, setFaceOk] = useState(true)
  const [emotion, setEmotion] = useState(null)
  const [focus, setFocus] = useState(100)
  const [checks, setChecks] = useState(0)
  const [streak, setStreak] = useState(0)
  const [warns, setWarns] = useState([])
  const [log, setLog] = useState([])
  const [answerTs, setAnswerTs] = useState({})
  const [gapWarns, setGapWarns] = useState([])
  const [processing, setProcessing] = useState(false)

  const vidRef = useRef(null)
  const canRef = useRef(null)
  const strRef = useRef(null)
  const intRef = useRef(null)
  const tmrRef = useRef(null)
  const t0Ref = useRef(null)
  const busyRef = useRef(false)
  const streakRef = useRef(0)
  const lastAnsRef = useRef(null)

  useEffect(() => () => stop(), [])

  // Timer
  useEffect(() => {
    if (phase !== 'exam' || !exam) return
    tmrRef.current = setInterval(() => {
      const el = Math.floor((Date.now() - t0Ref.current) / 1000)
      setDur(el)
      const rem = Math.max(0, exam.time - el)
      setTimeLeft(rem)
      if (rem <= 0) submit()
    }, 1000)
    return () => clearInterval(tmrRef.current)
  }, [phase])

  const startCam = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } })
      if (vidRef.current) { vidRef.current.srcObject = s; await vidRef.current.play() }
      strRef.current = s; setCamOn(true); return true
    } catch { alert('Camera is required for this exam.'); return false }
  }

  const stop = useCallback(() => {
    clearInterval(intRef.current); clearInterval(tmrRef.current)
    if (strRef.current) { strRef.current.getTracks().forEach(t => t.stop()); strRef.current = null }
    if (vidRef.current) vidRef.current.srcObject = null
    setCamOn(false); busyRef.current = false
  }, [])

  const begin = () => {
    if (!name.trim()) { alert('Enter your name'); return }
    setPhase('exam'); setAnswers({}); setCurQ(0); setDur(0)
    setFocus(100); setChecks(0); setStreak(0); streakRef.current = 0
    setWarns([]); setLog([]); setAnswerTs({}); setGapWarns([])
    lastAnsRef.current = null; t0Ref.current = Date.now()
  }

  // Start camera after render
  useEffect(() => {
    if (phase !== 'exam') return
    let dead = false
    ;(async () => {
      await new Promise(r => setTimeout(r, 300))
      if (dead) return
      const ok = await startCam()
      if (ok && !dead) {
        intRef.current = setInterval(checkFace, 3000)
        setTimeout(checkFace, 800)
      }
    })()
    return () => { dead = true }
  }, [phase])

  const pickAnswer = (qi, oi) => {
    const now = Date.now()
    const ts = Math.floor((now - t0Ref.current) / 1000)
    setAnswerTs(p => ({ ...p, [qi]: ts }))
    if (lastAnsRef.current) {
      const gap = Math.round((now - lastAnsRef.current) / 1000)
      if (gap > 45) {
        setGapWarns(p => [...p, { q: qi + 1, gap, ts }])
        setFocus(s => Math.max(0, s - 2))
        setWarns(w => [...w.slice(-29), { t: ts, m: `${gap}s gap before Q${qi + 1}` }])
      }
    }
    lastAnsRef.current = now
    setAnswers(p => ({ ...p, [qi]: oi }))
  }

  const submit = () => { clearInterval(intRef.current); clearInterval(tmrRef.current); stop(); setPhase('results') }

  // ════════════════════════════════════════════════════════════════
  // FACE CHECK — raw fetch to /api/detect-emotion, no auth needed
  // Face found = present. No face = absent. Simple and guaranteed.
  // ════════════════════════════════════════════════════════════════
  const checkFace = async () => {
    if (busyRef.current || !vidRef.current || !canRef.current) return
    if (vidRef.current.readyState !== 4) return
    busyRef.current = true; setProcessing(true)

    try {
      const c = canRef.current, v = vidRef.current
      c.width = v.videoWidth; c.height = v.videoHeight
      c.getContext('2d').drawImage(v, 0, 0)
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.8))

      const fd = new FormData()
      fd.append('file', blob, 'frame.jpg')

      const ctrl = new AbortController()
      const tid = setTimeout(() => ctrl.abort(), 10000)

      // Direct fetch — no API module, no auth token
      const resp = await fetch(`${BACKEND}/api/detect-emotion`, {
        method: 'POST', body: fd, signal: ctrl.signal,
      })
      clearTimeout(tid)

      const data = await resp.json()
      const ts = Math.floor((Date.now() - t0Ref.current) / 1000)
      setChecks(c => c + 1)

      if (data && data.dominant) {
        // FACE DETECTED
        setFaceOk(true)
        setEmotion(data.dominant)
        streakRef.current = 0; setStreak(0)
        setFocus(s => Math.min(100, s + 0.5))
        setLog(p => [...p, { ts, ok: true, em: data.dominant }])
      } else {
        // NO FACE
        setFaceOk(false); setEmotion(null)
        streakRef.current += 1; setStreak(streakRef.current)
        const s = streakRef.current
        const pen = s >= 5 ? 6 : s >= 3 ? 4 : 2
        setFocus(f => Math.max(0, f - pen))
        setLog(p => [...p, { ts, ok: false, em: null }])
        if (s >= 2) setWarns(w => [...w.slice(-29), { t: ts, m: `Face absent ${s * 3}s` }])
      }
    } catch (e) {
      if (e.name !== 'AbortError') console.log('Check failed:', e.message)
    } finally { busyRef.current = false; setProcessing(false) }
  }

  const fmt = s => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`
  const total = exam?.qs.length || 0
  const nAnswered = Object.keys(answers).length

  // ════════════ SELECT ════════════
  if (phase === 'select') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full space-y-6">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🔒</div>
          <h1 className="text-3xl font-black text-white mb-2">Proctored Exams</h1>
          <p className="text-gray-400">Select an exam. Camera monitors your focus.</p>
        </div>
        {EXAMS.map(ex => (
          <button key={ex.id} onClick={() => { setExam(ex); setPhase('info') }}
            className="w-full text-left bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 hover:border-blue-500/30 transition-all group">
            <div className="text-xs text-blue-400 font-bold uppercase mb-1">{ex.course}</div>
            <h2 className="text-white font-bold text-lg group-hover:text-blue-400">{ex.title}</h2>
            <p className="text-gray-500 text-sm mt-1">{ex.desc}</p>
            <div className="flex gap-4 mt-3 text-xs text-gray-600">
              <span>📝 {ex.qs.length} questions</span><span>⏱ {Math.floor(ex.time/60)} min</span><span>📹 Proctored</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )

  // ════════════ INFO ════════════
  if (phase === 'info') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-2xl p-8">
        <div className="text-center mb-6">
          <div className="text-xs text-blue-400 font-bold uppercase">{exam.course}</div>
          <h2 className="text-2xl font-black text-white mt-1">{exam.title}</h2>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5"><div className="text-white font-bold">{exam.qs.length}</div><div className="text-xs text-gray-500">Questions</div></div>
          <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5"><div className="text-white font-bold">{Math.floor(exam.time/60)} min</div><div className="text-xs text-gray-500">Time</div></div>
          <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5"><div className="text-white font-bold">Required</div><div className="text-xs text-gray-500">Camera</div></div>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-5 text-sm text-red-300">
          ⚠️ <strong>Anti-Cheat Active:</strong>
          <div className="text-xs text-red-400 mt-2 space-y-1">
            <div>• Camera tracks face presence every 3 seconds</div>
            <div>• Looking away 6+ seconds = warning + score drop</div>
            <div>• 45+ second gap between answers = flagged</div>
          </div>
        </div>
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name..."
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:border-blue-500/50 focus:outline-none mb-4" />
        <div className="flex gap-3">
          <button onClick={() => setPhase('select')} className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10">← Back</button>
          <button onClick={begin} disabled={!name.trim()} className="flex-1 py-3 rounded-xl font-bold bg-gradient-to-r from-red-500 to-rose-500 text-white disabled:opacity-40">🔒 Begin</button>
        </div>
      </div>
    </div>
  )

  // ════════════ EXAM ════════════
  if (phase === 'exam') {
    const q = exam.qs[curQ]
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-3 bg-white/5 rounded-xl px-4 py-2 border border-white/10 text-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /><span className="text-red-400 font-mono font-bold">{fmt(dur)}</span></div>
            <span className="text-gray-600">|</span><span className="text-gray-400">{name}</span>
            <span className="text-gray-600">|</span><span className="text-gray-400">{nAnswered}/{total}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className={`font-mono font-bold ${timeLeft < 60 ? 'text-red-400 animate-pulse' : 'text-gray-400'}`}>⏱ {fmt(timeLeft)}</span>
            <div className={`w-2.5 h-2.5 rounded-full ${faceOk ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
            <span className="font-bold" style={{ color: focusColor(focus) }}>{Math.round(focus)}%</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4" style={{ height: 'calc(100vh - 80px)' }}>
          {/* Questions */}
          <div className="col-span-3 overflow-auto">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-bold text-lg">Q{curQ + 1} <span className="text-gray-500 font-normal">/ {total}</span></h3>
                <div className="flex gap-1 flex-wrap">
                  {exam.qs.map((_, i) => (
                    <button key={i} onClick={() => setCurQ(i)}
                      className={`w-7 h-7 rounded text-xs font-bold ${i === curQ ? 'bg-blue-500 text-white' : answers[i] !== undefined ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/5 text-gray-600 border border-white/10'}`}>{i+1}</button>
                  ))}
                </div>
              </div>
              <p className="text-gray-100 text-lg mb-6">{q.q}</p>
              <div className="space-y-3">
                {q.o.map((opt, i) => (
                  <button key={i} onClick={() => pickAnswer(curQ, i)}
                    className={`w-full text-left px-5 py-4 rounded-xl border transition-all ${answers[curQ] === i ? 'bg-blue-500/20 border-blue-500/50 text-blue-200' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}>
                    <span className={`inline-flex w-7 h-7 rounded-full border-2 items-center justify-center text-sm font-bold mr-3 ${answers[curQ] === i ? 'border-blue-400 bg-blue-500/30 text-blue-300' : 'border-gray-600 text-gray-500'}`}>{String.fromCharCode(65+i)}</span>
                    {opt}
                  </button>
                ))}
              </div>
              <div className="flex justify-between mt-6">
                <button onClick={() => setCurQ(Math.max(0, curQ-1))} disabled={curQ===0} className="px-5 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 disabled:opacity-30">← Prev</button>
                {curQ < total-1 ? (
                  <button onClick={() => setCurQ(curQ+1)} className="px-5 py-2 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400">Next →</button>
                ) : (
                  <button onClick={submit} disabled={nAnswered < total} className="px-6 py-2 rounded-xl font-bold bg-gradient-to-r from-green-500 to-emerald-500 text-white disabled:opacity-40">✓ Submit ({nAnswered}/{total})</button>
                )}
              </div>
            </div>
          </div>

          {/* Camera */}
          <div className="space-y-3 overflow-auto">
            <div className={`rounded-2xl overflow-hidden border-2 ${faceOk ? 'border-green-500/30' : 'border-red-500/50'}`}>
              <div className="relative bg-black aspect-[3/4]">
                <video ref={vidRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <canvas ref={canRef} className="hidden" />
                <div className="absolute top-2 left-2">
                  <div className={`px-2 py-1 rounded text-[10px] font-bold ${faceOk ? 'bg-green-500/80' : 'bg-red-500/80'} text-white`}>{faceOk ? '✅ Present' : '🔴 Away'}</div>
                </div>
                {emotion && <div className="absolute top-2 right-2 px-2 py-1 rounded bg-black/60 text-white text-[10px] font-bold capitalize">{emotion}</div>}
                <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-red-500/80 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /><span className="text-white text-[10px] font-bold">REC</span></div>
                {processing && <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-blue-500/60 text-white text-[10px]">Checking...</div>}
                {!faceOk && streak >= 2 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-red-900/50">
                    <div className="text-center"><div className="text-3xl">⚠️</div><div className="text-red-200 text-xs font-bold mt-1">Look at screen!</div><div className="text-red-300 text-[10px]">{streak*3}s away</div></div>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <div className="text-2xl font-black" style={{ color: focusColor(focus) }}>{Math.round(focus)}%</div>
              <div className="text-[10px] text-gray-500">Focus</div>
              <div className="h-1.5 bg-white/10 rounded-full mt-2"><div className="h-full rounded-full transition-all" style={{ width: `${focus}%`, background: focusColor(focus) }} /></div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-2 text-[11px] space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">Checks</span><span className="text-white">{checks}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Away</span><span className={streak > 0 ? 'text-red-400' : 'text-green-400'}>{streak > 0 ? `${streak*3}s` : 'No'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Alerts</span><span className="text-yellow-400">{warns.length}</span></div>
            </div>
            {warns.length > 0 && (
              <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-2 max-h-24 overflow-y-auto">
                {warns.slice(-4).map((w,i) => <div key={i} className="text-[9px] text-red-300">{fmt(w.t)} — {w.m}</div>)}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ════════════ RESULTS ════════════
  const correct = exam.qs.filter((q,i) => answers[i] === q.a).length
  const pct = Math.round((correct/total)*100)
  const present = log.filter(l => l.ok).length
  const presentPct = log.length ? Math.round((present/log.length)*100) : 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center bg-white/5 border border-white/10 rounded-2xl p-8">
          <div className="text-xs text-blue-400 font-bold uppercase">{exam.course}</div>
          <h2 className="text-2xl font-black text-white mt-1 mb-1">{exam.title}</h2>
          <p className="text-gray-500 text-sm mb-6">{name} · {fmt(dur)}</p>
          <div className="grid grid-cols-4 gap-4">
            {[
              { v: `${pct}%`, l: 'Score', s: `${correct}/${total}`, c: pct >= 70 ? '#22c55e' : pct >= 50 ? '#eab308' : '#ef4444' },
              { v: `${Math.round(focus)}%`, l: 'Focus', s: focus >= 85 ? 'Excellent' : focus >= 70 ? 'Good' : focus >= 50 ? 'Moderate' : 'Poor', c: focusColor(focus) },
              { v: `${presentPct}%`, l: 'Present', s: `${present}/${log.length}`, c: presentPct >= 90 ? '#22c55e' : '#eab308' },
              { v: warns.length, l: 'Alerts', s: `${gapWarns.length} timing`, c: warns.length === 0 ? '#22c55e' : '#ef4444' },
            ].map(x => (
              <div key={x.l} className="bg-white/5 rounded-xl p-4 border border-white/5">
                <div className="text-3xl font-black" style={{ color: x.c }}>{x.v}</div>
                <div className="text-gray-400 text-sm mt-1">{x.l}</div>
                <div className="text-xs text-gray-500">{x.s}</div>
              </div>
            ))}
          </div>
        </div>

        {log.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="text-white font-bold mb-3">Focus Timeline</h3>
            <div className="flex gap-[1px] h-8 rounded-lg overflow-hidden">
              {log.map((e,i) => <div key={i} className="flex-1" style={{ background: e.ok ? '#22c55e' : '#ef4444' }} />)}
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-600">
              <span>Start</span>
              <span className="flex gap-3"><span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-sm" />Present</span><span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-sm" />Away</span></span>
              <span>End</span>
            </div>
          </div>
        )}

        {gapWarns.length > 0 && (
          <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-2xl p-6">
            <h3 className="text-yellow-400 font-bold mb-3">⏱ Answer Timing Flags</h3>
            {gapWarns.map((g,i) => <div key={i} className="text-sm text-yellow-300 bg-yellow-500/10 rounded-lg px-3 py-2 mb-1">Q{g.q}: {g.gap}s delay · at {fmt(g.ts)}</div>)}
          </div>
        )}

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-bold mb-4">Answer Review</h3>
          {exam.qs.map((q,i) => {
            const s = answers[i], ok = s === q.a
            return (
              <div key={i} className={`rounded-xl p-3 border mb-2 ${ok ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                <span className={`font-bold mr-2 ${ok ? 'text-green-400' : 'text-red-400'}`}>{ok ? '✓' : '✗'}</span>
                <span className="text-gray-200 text-sm">Q{i+1}: {q.q}</span>
                <div className="text-xs mt-1 ml-5">
                  <span className={ok ? 'text-green-400' : 'text-red-400'}>{s !== undefined ? q.o[s] : 'Not answered'}</span>
                  {!ok && s !== undefined && <span className="text-green-400 ml-2">· Correct: {q.o[q.a]}</span>}
                  {answerTs[i] && <span className="text-gray-600 ml-2">at {fmt(answerTs[i])}</span>}
                </div>
              </div>
            )
          })}
        </div>

        {warns.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="text-white font-bold mb-3">⚠️ All Alerts ({warns.length})</h3>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {warns.map((w,i) => <div key={i} className="text-sm text-red-300 bg-red-500/10 rounded-lg px-3 py-2">{fmt(w.t)} — {w.m}</div>)}
            </div>
          </div>
        )}

        <div className="text-center">
          <button onClick={() => { setPhase('select'); setExam(null); setAnswers({}); setWarns([]); setLog([]) }}
            className="px-8 py-3 rounded-2xl font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-500 shadow-lg">← Another Exam</button>
        </div>
      </div>
    </div>
  )
}
