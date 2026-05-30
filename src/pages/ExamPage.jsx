import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

const BACKEND = 'https://web-production-3a26e.up.railway.app'
const FC = s => s >= 85 ? '#22c55e' : s >= 70 ? '#3b82f6' : s >= 50 ? '#eab308' : '#ef4444'
const fmt = s => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`

/* ─── Gaze analysis ─── */
function analyzeGaze(lm) {
  const nose=lm[1],lE=lm[33],rE=lm[263]
  const ecx=(lE.x+rE.x)/2,ew=Math.abs(rE.x-lE.x)||0.001
  const yaw=(nose.x-ecx)/ew
  let irisX=0,irisOk=false
  if(lm.length>=478){
    irisOk=true
    const lIx=(lm[468].x+lm[469].x+lm[470].x+lm[471].x+lm[472].x)/5
    const lMin=Math.min(lm[33].x,lm[133].x),lMax=Math.max(lm[33].x,lm[133].x)
    const lR=(lIx-lMin)/(lMax-lMin||0.001)
    const rIx=(lm[473].x+lm[474].x+lm[475].x+lm[476].x+lm[477].x)/5
    const rMin=Math.min(lm[263].x,lm[362].x),rMax=Math.max(lm[263].x,lm[362].x)
    const rR=(rIx-rMin)/(rMax-rMin||0.001)
    irisX=((lR+rR)/2-0.5)*2
  }
  return { yaw, irisX, irisOk }
}

function classifyFrame(g, cal) {
  if(!g) return { s:'absent', d:'Face not detected', c:'#ef4444', p:3 }
  let ix = g.irisX
  if(cal) ix -= cal
  const ay=Math.abs(g.yaw), aix=Math.abs(ix)
  if(ay>0.3) return { s:'head_turned', d:`Head ${g.yaw<0?'left':'right'}`, c:'#ef4444', p:2.5 }
  if(g.irisOk&&aix>0.35) return { s:'eyes_sideways', d:`Eyes ${ix<0?'left':'right'}`, c:'#f97316', p:2 }
  if(ay>0.15) return { s:'slight_turn', d:`Slight ${g.yaw<0?'left':'right'}`, c:'#eab308', p:1 }
  if(g.irisOk&&aix>0.25) return { s:'glance', d:`Glance ${ix<0?'left':'right'}`, c:'#eab308', p:0.5 }
  return { s:'focused', d:null, c:'#22c55e', p:0 }
}

/* ─── Sample exams ─── */
const EXAMS = [
  { id:'emotilearn', title:'EmotiLearn System Quiz', course:'Graduation Project',
    desc:'Test your understanding of the EmotiLearn system.', time:600, qs:[
    {q:"What architecture does EmotiLearn use?",o:["ResNet-50","EfficientNet-B2","VGG-16","MobileNet-V3"],a:1},
    {q:"How many emotions classified?",o:["5","6","7","8"],a:2},
    {q:"Training datasets?",o:["ImageNet+CIFAR","FER-2013+RAF-DB","CelebA+AffectNet","COCO+VGGFace"],a:1},
    {q:"Live transcription model?",o:["Google Speech","DeepSpeech","OpenAI Whisper","Amazon Transcribe"],a:2},
    {q:"Facial emotion fusion weight?",o:["30%","40%","50%","60%"],a:2},
    {q:"Voice tone model?",o:["BERT","wav2vec2","GPT-4","YOLO"],a:1},
    {q:"Backend framework?",o:["Django","Flask","FastAPI","Express.js"],a:2},
    {q:"Face detection method?",o:["MTCNN","Haar Cascade","RetinaFace","BlazeFace"],a:1},
    {q:"Session database?",o:["MongoDB","MySQL","PostgreSQL","SQLite"],a:2},
    {q:"Model accuracy?",o:["65%","72%","82%","95%"],a:2},
  ]},
  { id:'ml', title:'ML Fundamentals', course:'Computer Engineering',
    desc:'Core machine learning concepts.', time:480, qs:[
    {q:"What is overfitting?",o:["Too simple","Memorizes training data","Underfits","High bias"],a:1},
    {q:"Supervised algorithm?",o:["K-Means","PCA","Random Forest","DBSCAN"],a:2},
    {q:"CNN stands for?",o:["Central Neural Net","Convolutional Neural Network","Connected Nodes","Computed Net"],a:1},
    {q:"Loss function purpose?",o:["Speed up","Measure error","Increase accuracy","Reduce data"],a:1},
    {q:"Transfer learning?",o:["From scratch","Pre-trained on new data","Move data","Clustering"],a:1},
    {q:"Multi-class output activation?",o:["ReLU","Sigmoid","Softmax","Tanh"],a:2},
    {q:"What is an epoch?",o:["Single batch","Full dataset pass","LR step","A layer"],a:1},
    {q:"Dropout prevents?",o:["Underfitting","Overfitting","Gradient explosion","Data leakage"],a:1},
  ]},
]

export default function ExamPage() {
  const [searchParams] = useSearchParams()
  const [phase,setPhase]=useState('select')
  const [exam,setExam]=useState(null)
  const [name,setName]=useState('')
  const [backendMode,setBackendMode]=useState(false)
  const [backendExamId,setBackendExamId]=useState(null)
  const [answers,setAnswers]=useState({})
  const [curQ,setCurQ]=useState(0)
  const [dur,setDur]=useState(0)
  const [timeLeft,setTimeLeft]=useState(0)
  const [ansTs,setAnsTs]=useState({})
  const [camOn,setCamOn]=useState(false)
  const [snapCount,setSnapCount]=useState(0)
  const [procProgress,setProcProgress]=useState(0)
  const [procMsg,setProcMsg]=useState('')
  const [examScore,setExamScore]=useState(0)
  const [focusScore,setFocusScore]=useState(100)
  const [focusLog,setFocusLog]=useState([])
  const [alerts,setAlerts]=useState([])
  const [videoUrl,setVideoUrl]=useState(null)
  const [gapWarns,setGapWarns]=useState([])
  const [stats,setStats]=useState({})

  const vidRef=useRef(null), canRef=useRef(null), strRef=useRef(null)
  const recRef=useRef(null), chunksRef=useRef([]), snapsRef=useRef([])
  const snapTsRef=useRef([]), tmrRef=useRef(null), snapIntRef=useRef(null)
  const t0=useRef(null), lastAns=useRef(null)

  useEffect(()=>()=>cleanup(),[])

  useEffect(()=>{
    const id = searchParams.get('id')
    if(!id) return
    setBackendExamId(parseInt(id)); setBackendMode(true)
    const token = localStorage.getItem('token')
    fetch(`${BACKEND}/exams/${id}`,{headers:token?{Authorization:`Bearer ${token}`}:{}})
      .then(r=>r.json()).then(data=>{
        if(data.questions){
          setExam({ id:data.id, title:data.title, course:data.course_name||'Course', desc:data.description||'', time:data.time_limit||600, qs:data.questions.map(q=>({q:q.q,o:q.o,a:q.a})), is_proctored:data.is_proctored })
          try{const u=JSON.parse(localStorage.getItem('user')||'{}');if(u.name)setName(u.name)}catch{}
          setPhase('info')
        }
      }).catch(()=>{})
  },[])

  useEffect(()=>{
    if(phase!=='exam'||!exam) return
    tmrRef.current=setInterval(()=>{
      const el=Math.floor((Date.now()-t0.current)/1000)
      setDur(el); setTimeLeft(Math.max(0,exam.time-el))
      if(el>=exam.time) submitExam()
    },1000)
    return()=>clearInterval(tmrRef.current)
  },[phase])

  const cleanup=useCallback(()=>{
    clearInterval(tmrRef.current); clearInterval(snapIntRef.current)
    if(recRef.current&&recRef.current.state==='recording') try{recRef.current.stop()}catch{}
    if(strRef.current){strRef.current.getTracks().forEach(t=>t.stop());strRef.current=null}
    if(vidRef.current) vidRef.current.srcObject=null
  },[])

  const startExam=async()=>{
    if(!name.trim()) return alert('Enter your name')
    setAnswers({}); setCurQ(0); setDur(0); setSnapCount(0)
    setAnsTs({}); setAlerts([]); setFocusLog([]); setGapWarns([])
    snapsRef.current=[]; snapTsRef.current=[]; chunksRef.current=[]
    lastAns.current=null; t0.current=Date.now()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video:{width:640,height:480,facingMode:'user'}, audio:false })
      strRef.current=stream; setPhase('exam')
      await new Promise(r=>setTimeout(r,200))
      if(vidRef.current){vidRef.current.srcObject=stream; await vidRef.current.play()}
      setCamOn(true)
      try { const rec=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9'}); rec.ondataavailable=e=>{if(e.data.size>0)chunksRef.current.push(e.data)}; rec.start(1000); recRef.current=rec }
      catch { try { const rec=new MediaRecorder(stream,{mimeType:'video/webm'}); rec.ondataavailable=e=>{if(e.data.size>0)chunksRef.current.push(e.data)}; rec.start(1000); recRef.current=rec } catch {} }
      snapIntRef.current=setInterval(()=>{
        if(!vidRef.current||!canRef.current||vidRef.current.readyState!==4) return
        const c=canRef.current, v=vidRef.current; c.width=v.videoWidth; c.height=v.videoHeight
        c.getContext('2d').drawImage(v,0,0)
        snapsRef.current.push(c.getContext('2d').getImageData(0,0,c.width,c.height))
        snapTsRef.current.push(Math.floor((Date.now()-t0.current)/1000))
        setSnapCount(snapsRef.current.length)
      },3000)
    } catch(e) { alert('Camera required: '+e.message) }
  }

  useEffect(()=>{
    if(phase==='exam'&&strRef.current&&vidRef.current&&!vidRef.current.srcObject){
      vidRef.current.srcObject=strRef.current; vidRef.current.play().catch(()=>{})
    }
  },[phase])

  const pickAnswer=(qi,oi)=>{ const ts=Math.floor((Date.now()-t0.current)/1000); setAnsTs(p=>({...p,[qi]:ts})); lastAns.current=Date.now(); setAnswers(p=>({...p,[qi]:oi})) }

  const submitExam=async()=>{
    clearInterval(tmrRef.current); clearInterval(snapIntRef.current)
    if(recRef.current&&recRef.current.state==='recording'){ recRef.current.stop(); await new Promise(r=>setTimeout(r,500)) }
    if(strRef.current){strRef.current.getTracks().forEach(t=>t.stop());strRef.current=null}
    if(vidRef.current) vidRef.current.srcObject=null
    if(chunksRef.current.length>0) setVideoUrl(URL.createObjectURL(new Blob(chunksRef.current,{type:'video/webm'})))
    const correct=exam.qs.filter((q,i)=>answers[i]===q.a).length
    setExamScore(Math.round(correct/exam.qs.length*100))
    const gaps=[]; const sorted=Object.entries(ansTs).sort((a,b)=>a[1]-b[1])
    for(let i=1;i<sorted.length;i++){const gap=sorted[i][1]-sorted[i-1][1]; if(gap>45) gaps.push({q:parseInt(sorted[i][0])+1, gap, ts:sorted[i][1]})}
    setGapWarns(gaps); setPhase('processing'); await processSnapshots()
  }

  const processSnapshots=async()=>{
    const snaps=snapsRef.current, timestamps=snapTsRef.current
    if(snaps.length===0){ setFocusScore(100); setFocusLog([]); setAlerts([]); setStats({present:0,total:0}); setPhase('results'); return }
    setProcMsg('Loading MediaPipe Face Mesh...'); setProcProgress(0)
    let fl
    try {
      const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm')
      fl=await FaceLandmarker.createFromOptions(vision,{ baseOptions:{ modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task', delegate:'GPU'}, runningMode:'IMAGE', numFaces:1 })
    } catch(e) { setProcMsg('MediaPipe failed: '+e.message); await new Promise(r=>setTimeout(r,2000)); setFocusScore(100); setPhase('results'); return }
    setProcMsg('Analyzing session recording...')
    const log=[], warns=[]; let focus=100, cal=null, calSamples=[]
    const osc=document.createElement('canvas')
    for(let i=0;i<snaps.length;i++){
      setProcProgress(Math.round((i/snaps.length)*100)); setProcMsg(`Analyzing frame ${i+1} of ${snaps.length}...`)
      const snap=snaps[i], ts=timestamps[i]; osc.width=snap.width; osc.height=snap.height; osc.getContext('2d').putImageData(snap,0,0)
      try {
        const result=fl.detect(osc)
        if(result.faceLandmarks&&result.faceLandmarks.length>0){
          const gaze=analyzeGaze(result.faceLandmarks[0])
          if(calSamples.length<10&&gaze.irisOk){ calSamples.push(gaze.irisX); if(calSamples.length===10) cal=calSamples.reduce((a,b)=>a+b,0)/10 }
          const cls=classifyFrame(gaze, cal); log.push({ts,s:cls.s,d:cls.d,c:cls.c})
          if(cls.p>0) focus=Math.max(0,focus-cls.p*0.5); else focus=Math.min(100,focus+0.3)
          if(cls.p>=2) warns.push({t:ts,m:cls.d})
        } else { log.push({ts,s:'absent',d:'Face not detected',c:'#ef4444'}); focus=Math.max(0,focus-1.5); warns.push({t:ts,m:'Face not detected'}) }
      } catch { log.push({ts,s:'error',d:'Analysis error',c:'#6b7280'}) }
      if(i%5===0) await new Promise(r=>setTimeout(r,10))
    }
    fl.close()
    const present=log.filter(l=>l.s!=='absent'&&l.s!=='error').length
    setFocusScore(Math.round(focus)); setFocusLog(log); setAlerts(warns)
    setStats({present,total:log.length,pct:log.length?Math.round(present/log.length*100):100})
    setProcProgress(100); setProcMsg('Analysis complete!')
    if(backendMode && backendExamId){
      try {
        const token=localStorage.getItem('token')
        const resp=await fetch(`${BACKEND}/exams/submit`,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({exam_id:backendExamId,answers,focus_score:Math.round(focus),focus_log:log,alerts:warns,answer_timing:ansTs,gap_warnings:gapWarns,duration_sec:Math.floor((Date.now()-t0.current)/1000)})})
        const subData=await resp.json().catch(()=>({}))
        if(subData.submission_id&&chunksRef.current.length>0){ const vfd=new FormData(); vfd.append('file',new Blob(chunksRef.current,{type:'video/webm'}),`exam_${subData.submission_id}.webm`); fetch(`${BACKEND}/api/exam/video/${subData.submission_id}`,{method:'POST',body:vfd}).catch(()=>{}) }
      } catch(e){ console.log('Submit save failed:', e) }
    }
    await new Promise(r=>setTimeout(r,500)); setPhase('results')
  }

  const total=exam?.qs.length||0, nAns=Object.keys(answers).length

  // ════════════ SELECT ════════════
  if(phase==='select') return(
    <div className="min-h-screen flex items-center justify-center p-6" style={{background:'var(--bg-base)'}}>
      <div className="fixed inset-0 bg-gradient-to-br from-base via-surface/60 to-base z-0" />
      <div className="max-w-2xl w-full space-y-4 relative z-10 animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-rose-500 shadow-lg shadow-red-500/20 mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Proctored Exams</h1>
          <p className="text-gray-500 text-sm">Your session is recorded and analyzed after submission.</p>
        </div>
        {EXAMS.map(ex=>(
          <button key={ex.id} onClick={()=>{setExam(ex);setPhase('info')}}
            className="w-full text-left glass rounded-2xl p-5 hover:bg-white/5 transition-all group">
            <div className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider mb-1">{ex.course}</div>
            <div className="text-white font-semibold text-lg group-hover:text-indigo-400 transition-colors">{ex.title}</div>
            <div className="text-gray-500 text-sm mt-1">{ex.desc}</div>
            <div className="flex gap-4 mt-3 text-xs text-gray-600">
              <span>{ex.qs.length} questions</span><span>{Math.floor(ex.time/60)} min</span><span>Recorded + analyzed</span>
            </div>
          </button>))}
      </div></div>)

  // ════════════ INFO ════════════
  if(phase==='info') return(
    <div className="min-h-screen flex items-center justify-center p-6" style={{background:'var(--bg-base)'}}>
      <div className="fixed inset-0 bg-gradient-to-br from-base via-surface/60 to-base z-0" />
      <div className="max-w-md w-full glass-heavy rounded-2xl p-7 relative z-10 animate-fade-in-up">
        <div className="text-center mb-5">
          <div className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider">{exam.course}</div>
          <h2 className="text-xl font-bold text-white mt-1">{exam.title}</h2></div>
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[{v:exam.qs.length,l:'Questions'},{v:`${Math.floor(exam.time/60)}m`,l:'Time'},{v:'Video',l:'Recorded'}].map(s=>(
            <div key={s.l} className="glass-subtle rounded-xl p-3 text-center"><div className="text-white font-bold">{s.v}</div><div className="text-[10px] text-gray-600">{s.l}</div></div>
          ))}
        </div>
        <div className="bg-red-500/8 border border-red-500/15 rounded-xl p-4 mb-5 text-sm text-red-300">
          <div className="font-semibold mb-2 text-xs uppercase tracking-wide">How proctoring works</div>
          <div className="text-xs text-red-400/80 space-y-1">
            <div>Your webcam records the entire session</div>
            <div>After submission, AI analyzes your recording</div>
            <div>Head turns, eye movements, and face absence are detected</div>
            <div>Long gaps between answers are flagged</div>
            <div>Teacher receives score + focus report + recording</div>
          </div></div>
        <input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Your full name..." className="input-glass mb-4"/>
        <div className="flex gap-3">
          <button onClick={()=>setPhase('select')} className="btn-secondary flex-1 py-3">&larr; Back</button>
          <button onClick={startExam} disabled={!name.trim()} className="flex-1 py-3 rounded-xl font-semibold bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg shadow-red-500/20 disabled:opacity-40 transition-all">Begin Exam</button>
        </div></div></div>)

  // ════════════ EXAM ════════════
  if(phase==='exam'){const q=exam.qs[curQ]; return(
    <div className="min-h-screen p-3" style={{background:'var(--bg-base)'}}>
      <div className="flex items-center justify-between mb-3 glass rounded-xl px-4 py-2 text-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500 animate-recording"/><span className="text-red-400 font-mono font-bold">{fmt(dur)}</span></div>
          <span className="text-gray-700">|</span><span className="text-gray-400 text-xs">{name}</span>
          <span className="text-gray-700">|</span><span className="text-gray-400 text-xs">{nAns}/{total}</span></div>
        <div className="flex items-center gap-3">
          <span className={`font-mono font-bold text-xs ${timeLeft<60?'text-red-400 animate-pulse-soft':'text-gray-400'}`}>{fmt(timeLeft)}</span>
          <span className="text-gray-600 text-[10px]">{snapCount} frames</span></div></div>
      <div className="grid grid-cols-4 gap-3" style={{height:'calc(100vh - 72px)'}}>
        <div className="col-span-3 overflow-auto">
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-bold">Q{curQ+1} <span className="text-gray-600 font-normal text-sm">/ {total}</span></h3>
              <div className="flex gap-1 flex-wrap">{exam.qs.map((_,i)=>(
                <button key={i} onClick={()=>setCurQ(i)} className={`w-6 h-6 rounded-lg text-[10px] font-bold transition-all ${i===curQ?'bg-indigo-500 text-white':answers[i]!==undefined?'bg-green-500/15 text-green-400 border border-green-500/20':'bg-white/5 text-gray-700 border border-white/5'}`}>{i+1}</button>
              ))}</div></div>
            <p className="text-gray-200 text-lg mb-5 leading-relaxed">{q.q}</p>
            <div className="space-y-2">{q.o.map((opt,i)=>(
              <button key={i} onClick={()=>pickAnswer(curQ,i)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm ${answers[curQ]===i?'bg-indigo-500/15 border-indigo-500/30 text-indigo-200':'glass-subtle text-gray-300 hover:bg-white/5'}`}>
                <span className={`inline-flex w-6 h-6 rounded-full border-2 items-center justify-center text-xs font-bold mr-3 ${answers[curQ]===i?'border-indigo-400 bg-indigo-500/30 text-indigo-300':'border-gray-700 text-gray-600'}`}>{String.fromCharCode(65+i)}</span>{opt}
              </button>))}</div>
            <div className="flex justify-between mt-5">
              <button onClick={()=>setCurQ(Math.max(0,curQ-1))} disabled={curQ===0} className="btn-secondary text-xs px-4 py-2 disabled:opacity-30">&larr; Prev</button>
              {curQ<total-1?<button onClick={()=>setCurQ(curQ+1)} className="px-4 py-2 rounded-xl bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 text-xs font-medium">Next &rarr;</button>
              :<button onClick={submitExam} disabled={nAns<total} className="btn-success text-xs px-5 py-2 disabled:opacity-40">Submit ({nAns}/{total})</button>}
            </div></div></div>
        <div className="space-y-3">
          <div className="rounded-2xl overflow-hidden border-2 border-red-500/20">
            <div className="relative bg-black aspect-[3/4]">
              <video ref={vidRef} autoPlay playsInline muted className="w-full h-full object-cover"/>
              <canvas ref={canRef} className="hidden"/>
              <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-red-500/80 flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse-soft"/><span className="text-white text-[9px] font-bold">REC</span></div>
              <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/60 text-white text-[9px]">{snapCount} snapshots</div>
            </div></div>
          <div className="glass-subtle rounded-xl p-3 text-center">
            <div className="text-[10px] text-gray-500">Session recorded</div>
            <div className="text-[9px] text-gray-700 mt-0.5">AI analysis runs after submission</div>
          </div></div>
      </div></div>)}

  // ════════════ PROCESSING ════════════
  if(phase==='processing') return(
    <div className="min-h-screen flex items-center justify-center p-6" style={{background:'var(--bg-base)'}}>
      <div className="max-w-md w-full text-center animate-fade-in">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-500 shadow-lg shadow-indigo-500/20 mb-5">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Analyzing Your Session</h2>
        <p className="text-gray-500 text-sm mb-5">{procMsg}</p>
        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-3">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all duration-300" style={{width:`${procProgress}%`}}/></div>
        <div className="text-white font-mono font-bold">{procProgress}%</div>
        <div className="text-gray-600 text-xs mt-2">{snapsRef.current.length} frames to analyze</div>
      </div></div>)

  // ════════════ RESULTS ════════════
  const correct=exam?.qs.filter((q,i)=>answers[i]===q.a).length||0
  const pct=total?Math.round(correct/total*100):0
  const hw=alerts.filter(a=>a.m?.includes('Head')||a.m?.includes('head')).length
  const ew=alerts.filter(a=>a.m?.includes('Eyes')||a.m?.includes('eyes')||a.m?.includes('Glance')||a.m?.includes('glance')).length
  const aw=alerts.filter(a=>a.m?.includes('absent')||a.m?.includes('Face')).length

  return(
    <div className="min-h-screen p-6" style={{background:'var(--bg-base)'}}>
      <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
        {/* Scores */}
        <div className="text-center glass-heavy rounded-2xl p-7">
          <div className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider">{exam?.course}</div>
          <h2 className="text-xl font-bold text-white mt-1 mb-1">{exam?.title} — Results</h2>
          <p className="text-gray-600 text-sm mb-5">{name} · {fmt(dur)}</p>
          <div className="grid grid-cols-5 gap-3">
            {[
              {v:`${pct}%`,l:'Exam Score',s:`${correct}/${total}`,c:pct>=70?'#22c55e':pct>=50?'#eab308':'#ef4444'},
              {v:`${focusScore}%`,l:'Focus Score',s:focusScore>=85?'Excellent':focusScore>=70?'Good':focusScore>=50?'Moderate':'Poor',c:FC(focusScore)},
              {v:`${stats.pct||100}%`,l:'Present',s:`${stats.present||0}/${stats.total||0}`,c:(stats.pct||100)>=90?'#22c55e':'#eab308'},
              {v:alerts.length,l:'Alerts',s:`${hw}h ${ew}e ${aw}a`,c:alerts.length===0?'#22c55e':alerts.length<=5?'#eab308':'#ef4444'},
              {v:gapWarns.length,l:'Timing',s:'flags',c:gapWarns.length===0?'#22c55e':'#ef4444'},
            ].map(x=>(
              <div key={x.l} className="glass-subtle rounded-xl p-3">
                <div className="text-xl font-bold" style={{color:x.c}}>{x.v}</div>
                <div className="text-gray-500 text-[10px] mt-0.5">{x.l}</div>
                <div className="text-[9px] text-gray-700">{x.s}</div></div>))}</div></div>

        <div className="grid grid-cols-2 gap-5">
          {videoUrl && (
            <div className="glass rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Session Recording</h3>
              <video src={videoUrl} controls className="w-full rounded-xl" />
              <a href={videoUrl} download={`exam_recording_${Date.now()}.webm`} className="block mt-2 text-center text-xs text-indigo-400 hover:text-indigo-300">Download Recording</a>
            </div>)}
          {focusLog.length>0 && (
            <div className="glass rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Focus Timeline</h3>
              <div className="flex gap-[1px] h-8 rounded-lg overflow-hidden mb-2">
                {focusLog.map((e,i)=><div key={i} className="flex-1" title={`${fmt(e.ts)} — ${e.d||e.s}`} style={{background:e.c||'#6b7280'}}/>)}</div>
              <div className="flex justify-between text-[10px] text-gray-600"><span>Start</span>
                <span className="flex gap-2">{[{c:'#22c55e',l:'Focused'},{c:'#eab308',l:'Glance'},{c:'#f97316',l:'Turned'},{c:'#ef4444',l:'Away'}].map(x=><span key={x.l} className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm" style={{background:x.c}}/>{x.l}</span>)}</span>
                <span>End</span></div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                {[{v:hw,l:'head turns'},{v:ew,l:'eye glances'},{v:aw,l:'face absent'},{v:gapWarns.length,l:'timing flags'}].map(x=>(
                  <div key={x.l} className="glass-subtle rounded-lg p-2 text-center"><span className="text-white font-bold">{x.v}</span><span className="text-gray-600 ml-1">{x.l}</span></div>
                ))}
              </div></div>)}
        </div>

        {gapWarns.length>0&&(
          <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-2">Answer Timing Flags</h3>
            {gapWarns.map((g,i)=><div key={i} className="text-xs text-amber-300 bg-amber-500/8 rounded-xl px-4 py-2 mb-1 flex justify-between"><span>Q{g.q}: {g.gap}s delay</span><span className="text-amber-500">{fmt(g.ts)}</span></div>)}</div>)}

        <div className="glass rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Answer Review</h3>
          {exam?.qs.map((q,i)=>{const s=answers[i],ok=s===q.a;return(
            <div key={i} className={`rounded-xl p-3 border mb-1.5 text-sm ${ok?'bg-green-500/8 border-green-500/15':'bg-red-500/8 border-red-500/15'}`}>
              <span className={`font-bold mr-1.5 ${ok?'text-green-400':'text-red-400'}`}>{ok?'✓':'✗'}</span>
              <span className="text-gray-300">Q{i+1}: {q.q}</span>
              <div className="text-xs mt-0.5 ml-6"><span className={ok?'text-green-400':'text-red-400'}>{s!==undefined?q.o[s]:'Not answered'}</span>
                {!ok&&s!==undefined&&<span className="text-green-400 ml-2">Correct: {q.o[q.a]}</span>}
                {ansTs[i]!==undefined&&<span className="text-gray-700 ml-2">at {fmt(ansTs[i])}</span>}</div></div>)})}</div>

        {alerts.length>0&&(
          <div className="glass rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">All Proctoring Alerts ({alerts.length})</h3>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {alerts.map((w,i)=><div key={i} className="text-xs text-red-300 bg-red-500/8 rounded-lg px-3 py-2">{fmt(w.t)} — {w.m}</div>)}</div></div>)}

        <div className="text-center pb-8">
          <button onClick={()=>{setPhase('select');setExam(null);setAnswers({});setAlerts([]);setFocusLog([]);if(videoUrl)URL.revokeObjectURL(videoUrl);setVideoUrl(null)}}
            className="btn-primary px-8 py-3">&larr; Another Exam</button></div>
      </div></div>)
}
