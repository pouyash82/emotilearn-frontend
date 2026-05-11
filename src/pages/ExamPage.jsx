import { useState, useEffect, useRef, useCallback } from 'react'

const BACKEND = 'https://web-production-3a26e.up.railway.app'
const focusColor = s => s >= 85 ? '#22c55e' : s >= 70 ? '#3b82f6' : s >= 50 ? '#eab308' : '#ef4444'

const EXAMS = [
  {
    id: 'emotilearn', title: 'EmotiLearn System Quiz', course: 'Graduation Project',
    desc: 'Test your understanding of the EmotiLearn system.', time: 600,
    qs: [
      { q: "What architecture does EmotiLearn use for emotion recognition?", o: ["ResNet-50", "EfficientNet-B2", "VGG-16", "MobileNet-V3"], a: 1 },
      { q: "How many emotions does the system classify?", o: ["5", "6", "7", "8"], a: 2 },
      { q: "Which datasets were combined for training?", o: ["ImageNet+CIFAR", "FER-2013+RAF-DB", "CelebA+AffectNet", "COCO+VGGFace"], a: 1 },
      { q: "What model provides live speech transcription?", o: ["Google Speech", "DeepSpeech", "OpenAI Whisper", "Amazon Transcribe"], a: 2 },
      { q: "What fusion weight does facial emotion get?", o: ["30%", "40%", "50%", "60%"], a: 2 },
      { q: "Which model analyzes voice tone?", o: ["BERT", "wav2vec2", "GPT-4", "YOLO"], a: 1 },
      { q: "Backend framework?", o: ["Django", "Flask", "FastAPI", "Express.js"], a: 2 },
      { q: "Face detection method?", o: ["MTCNN", "Haar Cascade", "RetinaFace", "BlazeFace"], a: 1 },
      { q: "Database for sessions?", o: ["MongoDB", "MySQL", "PostgreSQL", "SQLite"], a: 2 },
      { q: "Model's approximate accuracy?", o: ["65%", "72%", "82%", "95%"], a: 2 },
    ],
  },
  {
    id: 'ml', title: 'Machine Learning Basics', course: 'Computer Engineering',
    desc: 'Core ML concepts.', time: 480,
    qs: [
      { q: "What is overfitting?", o: ["Too simple", "Memorizes training data", "Underfits", "High bias"], a: 1 },
      { q: "Supervised learning algorithm?", o: ["K-Means", "PCA", "Random Forest", "DBSCAN"], a: 2 },
      { q: "CNN stands for?", o: ["Central Neural Net", "Convolutional Neural Network", "Connected Node Net", "Computed Neural Net"], a: 1 },
      { q: "Purpose of loss function?", o: ["Speed up", "Measure error", "Increase accuracy", "Reduce data"], a: 1 },
      { q: "Transfer learning is?", o: ["Training from scratch", "Pre-trained model on new data", "Moving data", "Clustering"], a: 1 },
      { q: "Multi-class output activation?", o: ["ReLU", "Sigmoid", "Softmax", "Tanh"], a: 2 },
      { q: "What is an epoch?", o: ["Single batch", "Full pass through dataset", "Learning rate step", "A layer"], a: 1 },
      { q: "Dropout prevents?", o: ["Underfitting", "Overfitting", "Gradient explosion", "Data leakage"], a: 1 },
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
  const [ansTs, setAnsTs] = useState({})
  const [gapW, setGapW] = useState([])
  const [busy, setBusy] = useState(false)
  const [lastErr, setLastErr] = useState('')  // visible debug

  const vidRef = useRef(null)
  const canRef = useRef(null)
  const strRef = useRef(null)
  const intRef = useRef(null)
  const tmrRef = useRef(null)
  const t0 = useRef(null)
  const lockRef = useRef(false)
  const skRef = useRef(0)
  const lastAns = useRef(null)

  useEffect(() => () => kill(), [])
  useEffect(() => {
    if (phase !== 'exam' || !exam) return
    tmrRef.current = setInterval(() => {
      const el = Math.floor((Date.now() - t0.current) / 1000)
      setDur(el); setTimeLeft(Math.max(0, exam.time - el))
      if (el >= exam.time) done()
    }, 1000)
    return () => clearInterval(tmrRef.current)
  }, [phase])

  const cam = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } })
      if (vidRef.current) { vidRef.current.srcObject = s; await vidRef.current.play() }
      strRef.current = s; setCamOn(true); return true
    } catch (e) { alert('Camera required: ' + e.message); return false }
  }

  const kill = useCallback(() => {
    clearInterval(intRef.current); clearInterval(tmrRef.current)
    if (strRef.current) { strRef.current.getTracks().forEach(t => t.stop()); strRef.current = null }
    if (vidRef.current) vidRef.current.srcObject = null
    setCamOn(false); lockRef.current = false
  }, [])

  const go = () => {
    if (!name.trim()) return alert('Enter your name')
    setPhase('exam'); setAnswers({}); setCurQ(0); setDur(0)
    setFocus(100); setChecks(0); setStreak(0); skRef.current = 0
    setWarns([]); setLog([]); setAnsTs({}); setGapW([]); setLastErr('')
    lastAns.current = null; t0.current = Date.now()
  }

  useEffect(() => {
    if (phase !== 'exam') return
    let dead = false
    ;(async () => {
      await new Promise(r => setTimeout(r, 300))
      if (dead) return
      const ok = await cam()
      if (ok && !dead) {
        intRef.current = setInterval(chk, 3000)
        setTimeout(chk, 800)
      }
    })()
    return () => { dead = true }
  }, [phase])

  const pick = (qi, oi) => {
    const now = Date.now(), ts = Math.floor((now - t0.current) / 1000)
    setAnsTs(p => ({ ...p, [qi]: ts }))
    if (lastAns.current) {
      const gap = Math.round((now - lastAns.current) / 1000)
      if (gap > 45) {
        setGapW(p => [...p, { q: qi + 1, gap, ts }])
        setFocus(s => Math.max(0, s - 2))
        setWarns(w => [...w.slice(-29), { t: ts, m: `${gap}s gap before Q${qi + 1}` }])
      }
    }
    lastAns.current = now
    setAnswers(p => ({ ...p, [qi]: oi }))
  }

  const done = () => { clearInterval(intRef.current); clearInterval(tmrRef.current); kill(); setPhase('results') }

  // ════════════════════════════════════════════════════════════════
  // FACE CHECK via /api/face-check (HF trpakov/vit-face-expression)
  // Same pattern as Whisper — backend forwards to HF cloud GPU.
  // ════════════════════════════════════════════════════════════════
  const chk = async () => {
    if (lockRef.current || !vidRef.current || !canRef.current) return
    if (vidRef.current.readyState !== 4) return
    lockRef.current = true; setBusy(true); setLastErr('')

    try {
      const c = canRef.current, v = vidRef.current
      c.width = v.videoWidth; c.height = v.videoHeight
      c.getContext('2d').drawImage(v, 0, 0)
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.8))
      const fd = new FormData(); fd.append('file', blob, 'frame.jpg')

      const ctrl = new AbortController()
      const tid = setTimeout(() => ctrl.abort(), 15000)

      const resp = await fetch(`${BACKEND}/api/face-check`, {
        method: 'POST', body: fd, signal: ctrl.signal,
      })
      clearTimeout(tid)
      const data = await resp.json()
      const ts = Math.floor((Date.now() - t0.current) / 1000)
      setChecks(c => c + 1)

      if (data.face_detected) {
        setFaceOk(true); setEmotion(data.dominant || 'detected')
        skRef.current = 0; setStreak(0)
        setFocus(s => Math.min(100, s + 0.5))
        setLog(p => [...p, { ts, ok: true, em: data.dominant }])
        setLastErr('')
      } else {
        setFaceOk(false); setEmotion(null)
        skRef.current += 1; setStreak(skRef.current)
        const sk = skRef.current
        setFocus(f => Math.max(0, f - (sk >= 5 ? 6 : sk >= 3 ? 4 : 2)))
        setLog(p => [...p, { ts, ok: false }])
        if (sk >= 2) setWarns(w => [...w.slice(-29), { t: ts, m: `Face absent ${sk * 3}s` }])
        setLastErr(data.error || 'No face detected')
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        setLastErr('Network error: ' + e.message)
        console.error('Face check failed:', e)
      }
    } finally { lockRef.current = false; setBusy(false) }
  }

  const fmt = s => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`
  const total = exam?.qs.length || 0
  const nAns = Object.keys(answers).length

  // ════════════ SELECT ════════════
  if (phase === 'select') return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a, #1e293b)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 600, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 900, margin: 0 }}>Proctored Exams</h1>
          <p style={{ color: '#94a3b8', marginTop: 8 }}>Select an exam. Camera monitors your focus.</p>
        </div>
        {EXAMS.map(ex => (
          <div key={ex.id} onClick={() => { setExam(ex); setPhase('info') }}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24, marginBottom: 12, cursor: 'pointer' }}>
            <div style={{ color: '#60a5fa', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{ex.course}</div>
            <div style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginTop: 4 }}>{ex.title}</div>
            <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>{ex.desc}</div>
            <div style={{ color: '#475569', fontSize: 12, marginTop: 12 }}>📝 {ex.qs.length} questions · ⏱ {Math.floor(ex.time/60)} min · 📹 Proctored</div>
          </div>
        ))}
      </div>
    </div>
  )

  // ════════════ INFO ════════════
  if (phase === 'info') return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a, #1e293b)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 440, width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 32 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ color: '#60a5fa', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{exam.course}</div>
          <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 900, margin: '4px 0 0' }}>{exam.title}</h2>
        </div>
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: 16, marginBottom: 20, color: '#fca5a5', fontSize: 13 }}>
          ⚠️ <strong>Anti-Cheat:</strong> Camera tracks face every 3s. Looking away 6+ seconds = warning. 45s+ answer gap = flagged.
        </div>
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name..."
          style={{ width: '100%', padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box', marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => setPhase('select')} style={{ flex: 1, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}>← Back</button>
          <button onClick={go} disabled={!name.trim()} style={{ flex: 1, padding: 12, borderRadius: 12, background: name.trim() ? 'linear-gradient(to right, #ef4444, #f43f5e)' : '#333', border: 'none', color: '#fff', fontWeight: 700, cursor: name.trim() ? 'pointer' : 'default', fontSize: 14 }}>🔒 Begin</button>
        </div>
      </div>
    </div>
  )

  // ════════════ EXAM ════════════
  if (phase === 'exam') {
    const q = exam.qs[curQ]
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a, #1e293b)', padding: 16 }}>
        {/* Top */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '8px 16px', marginBottom: 12, fontSize: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: '#f87171', fontFamily: 'monospace', fontWeight: 700 }}>● {fmt(dur)}</span>
            <span style={{ color: '#64748b' }}>|</span>
            <span style={{ color: '#94a3b8' }}>{name}</span>
            <span style={{ color: '#64748b' }}>|</span>
            <span style={{ color: '#94a3b8' }}>{nAns}/{total}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: timeLeft < 60 ? '#f87171' : '#94a3b8', fontFamily: 'monospace', fontWeight: 700 }}>⏱ {fmt(timeLeft)}</span>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: faceOk ? '#22c55e' : '#ef4444' }} />
            <span style={{ fontWeight: 700, color: focusColor(focus) }}>{Math.round(focus)}%</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 16 }}>
          {/* Questions */}
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ color: '#fff', margin: 0, fontWeight: 700 }}>Q{curQ+1} / {total}</h3>
              <div style={{ display: 'flex', gap: 4 }}>
                {exam.qs.map((_,i) => (
                  <button key={i} onClick={() => setCurQ(i)}
                    style={{ width: 28, height: 28, borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      background: i===curQ ? '#3b82f6' : answers[i]!==undefined ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)',
                      color: i===curQ ? '#fff' : answers[i]!==undefined ? '#4ade80' : '#64748b' }}>{i+1}</button>
                ))}
              </div>
            </div>
            <p style={{ color: '#e2e8f0', fontSize: 17, lineHeight: 1.6, marginBottom: 24 }}>{q.q}</p>
            {q.o.map((opt, i) => (
              <button key={i} onClick={() => pick(curQ, i)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '14px 20px', borderRadius: 12, marginBottom: 10, cursor: 'pointer', fontSize: 14, transition: 'all 0.2s',
                  background: answers[curQ]===i ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)',
                  border: answers[curQ]===i ? '1px solid rgba(59,130,246,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  color: answers[curQ]===i ? '#93c5fd' : '#cbd5e1' }}>
                <strong style={{ marginRight: 10, color: answers[curQ]===i ? '#60a5fa' : '#64748b' }}>{String.fromCharCode(65+i)}</strong>{opt}
              </button>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
              <button onClick={() => setCurQ(Math.max(0,curQ-1))} disabled={curQ===0}
                style={{ padding: '10px 20px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', cursor: 'pointer', opacity: curQ===0?0.3:1 }}>← Prev</button>
              {curQ < total-1 ? (
                <button onClick={() => setCurQ(curQ+1)} style={{ padding: '10px 20px', borderRadius: 12, background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', cursor: 'pointer' }}>Next →</button>
              ) : (
                <button onClick={done} disabled={nAns<total} style={{ padding: '10px 24px', borderRadius: 12, background: nAns>=total?'linear-gradient(to right,#22c55e,#10b981)':'#333', border: 'none', color: '#fff', fontWeight: 700, cursor: nAns>=total?'pointer':'default' }}>✓ Submit ({nAns}/{total})</button>
              )}
            </div>
          </div>

          {/* Camera panel */}
          <div>
            <div style={{ borderRadius: 16, overflow: 'hidden', border: `2px solid ${faceOk ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.5)'}`, marginBottom: 12 }}>
              <div style={{ position: 'relative', background: '#000', aspectRatio: '3/4' }}>
                <video ref={vidRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <canvas ref={canRef} style={{ display: 'none' }} />
                <div style={{ position: 'absolute', top: 6, left: 6, padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, color: '#fff', background: faceOk ? 'rgba(34,197,94,0.8)' : 'rgba(239,68,68,0.8)' }}>
                  {faceOk ? '✅ Present' : '🔴 Away'}
                </div>
                {emotion && <div style={{ position: 'absolute', top: 6, right: 6, padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,0.6)', textTransform: 'capitalize' }}>{emotion}</div>}
                <div style={{ position: 'absolute', bottom: 6, left: 6, padding: '3px 8px', borderRadius: 4, background: 'rgba(239,68,68,0.8)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', animation: 'pulse 1.5s infinite' }} />
                  <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>REC</span>
                </div>
                {busy && <div style={{ position: 'absolute', bottom: 6, right: 6, padding: '3px 8px', borderRadius: 4, background: 'rgba(59,130,246,0.6)', color: '#fff', fontSize: 9 }}>Checking...</div>}
                {!faceOk && streak >= 2 && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(127,29,29,0.5)' }}>
                    <div style={{ textAlign: 'center' }}><div style={{ fontSize: 32 }}>⚠️</div><div style={{ color: '#fecaca', fontSize: 11, fontWeight: 700 }}>Look at screen!</div><div style={{ color: '#fca5a5', fontSize: 10 }}>{streak*3}s away</div></div>
                  </div>
                )}
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 12, textAlign: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: focusColor(focus) }}>{Math.round(focus)}%</div>
              <div style={{ fontSize: 10, color: '#64748b' }}>Focus Score</div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 4, marginTop: 8, overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: 4, transition: 'all 0.5s', width: `${focus}%`, background: focusColor(focus) }} /></div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 8, fontSize: 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}><span>Checks</span><span style={{ color: '#fff', fontWeight: 700 }}>{checks}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', marginTop: 4 }}><span>Away</span><span style={{ color: streak>0?'#f87171':'#4ade80', fontWeight: 700 }}>{streak>0?`${streak*3}s`:'No'}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', marginTop: 4 }}><span>Alerts</span><span style={{ color: '#fbbf24', fontWeight: 700 }}>{warns.length}</span></div>
            </div>
            {/* Debug info — visible so we can see what's happening */}
            {lastErr && <div style={{ marginTop: 8, padding: 6, borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 9, color: '#fca5a5', wordBreak: 'break-all' }}>Debug: {lastErr}</div>}
            {warns.length > 0 && (
              <div style={{ marginTop: 8, maxHeight: 80, overflow: 'auto' }}>
                {warns.slice(-4).map((w,i) => <div key={i} style={{ fontSize: 9, color: '#fca5a5', padding: '2px 0' }}>{fmt(w.t)} — {w.m}</div>)}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ════════════ RESULTS ════════════
  const correct = exam.qs.filter((q,i) => answers[i]===q.a).length
  const pct = Math.round(correct/total*100)
  const present = log.filter(l=>l.ok).length
  const ppct = log.length ? Math.round(present/log.length*100) : 100

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a, #1e293b)', padding: 24 }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 32, marginBottom: 24 }}>
          <h2 style={{ color: '#fff', fontSize: 24, fontWeight: 900, margin: '0 0 4px' }}>{exam.title} — Results</h2>
          <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 24px' }}>{name} · {fmt(dur)}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { v: `${pct}%`, l: 'Score', s: `${correct}/${total}`, c: pct>=70?'#22c55e':pct>=50?'#eab308':'#ef4444' },
              { v: `${Math.round(focus)}%`, l: 'Focus', s: focus>=85?'Excellent':focus>=70?'Good':focus>=50?'Moderate':'Poor', c: focusColor(focus) },
              { v: `${ppct}%`, l: 'Present', s: `${present}/${log.length}`, c: ppct>=90?'#22c55e':'#eab308' },
              { v: warns.length, l: 'Alerts', s: `${gapW.length} timing`, c: warns.length===0?'#22c55e':'#ef4444' },
            ].map(x => (
              <div key={x.l} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: x.c }}>{x.v}</div>
                <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>{x.l}</div>
                <div style={{ color: '#64748b', fontSize: 10 }}>{x.s}</div>
              </div>
            ))}
          </div>
        </div>

        {log.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24, marginBottom: 24 }}>
            <h3 style={{ color: '#fff', fontWeight: 700, margin: '0 0 12px' }}>Focus Timeline</h3>
            <div style={{ display: 'flex', gap: 1, height: 32, borderRadius: 8, overflow: 'hidden' }}>
              {log.map((e,i) => <div key={i} style={{ flex: 1, background: e.ok?'#22c55e':'#ef4444' }} />)}
            </div>
          </div>
        )}

        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24, marginBottom: 24 }}>
          <h3 style={{ color: '#fff', fontWeight: 700, margin: '0 0 12px' }}>Answers</h3>
          {exam.qs.map((q,i) => {
            const s=answers[i], ok=s===q.a
            return (
              <div key={i} style={{ padding: 12, borderRadius: 12, marginBottom: 8, background: ok?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)', border: `1px solid ${ok?'rgba(34,197,94,0.2)':'rgba(239,68,68,0.2)'}` }}>
                <span style={{ fontWeight: 700, color: ok?'#4ade80':'#f87171', marginRight: 8 }}>{ok?'✓':'✗'}</span>
                <span style={{ color: '#e2e8f0', fontSize: 13 }}>Q{i+1}: {q.q}</span>
                <div style={{ fontSize: 11, marginTop: 4, marginLeft: 24 }}>
                  <span style={{ color: ok?'#4ade80':'#f87171' }}>{s!==undefined?q.o[s]:'Not answered'}</span>
                  {!ok && s!==undefined && <span style={{ color: '#4ade80', marginLeft: 8 }}>· {q.o[q.a]}</span>}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ textAlign: 'center' }}>
          <button onClick={() => { setPhase('select'); setExam(null); setAnswers({}); setWarns([]); setLog([]) }}
            style={{ padding: '12px 32px', borderRadius: 16, background: 'linear-gradient(to right, #3b82f6, #6366f1)', border: 'none', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>← Another Exam</button>
        </div>
      </div>
    </div>
  )
}
