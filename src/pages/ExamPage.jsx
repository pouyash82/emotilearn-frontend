import { useState, useEffect, useRef, useCallback } from 'react'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

const BACKEND = 'https://web-production-3a26e.up.railway.app'
const FC = s => s >= 85 ? '#22c55e' : s >= 70 ? '#3b82f6' : s >= 50 ? '#eab308' : '#ef4444'

function analyzeGaze(lm) {
  const nose = lm[1], lEye = lm[33], rEye = lm[263]
  const ecx = (lEye.x + rEye.x) / 2
  const ew = Math.abs(rEye.x - lEye.x) || 0.001
  const ecy = (lEye.y + rEye.y) / 2
  const yaw = (nose.x - ecx) / ew
  const pitch = (nose.y - ecy) / ew
  let irisX = 0, irisY = 0, irisOk = false
  if (lm.length >= 478) {
    irisOk = true
    const lI=lm[468],lIn=lm[133],lOut=lm[33],lT=lm[159],lB=lm[145]
    const rI=lm[473],rIn=lm[362],rOut=lm[263],rT=lm[386],rB=lm[374]
    const lrx=(lI.x-lOut.x)/(Math.abs(lIn.x-lOut.x)||0.001)
    const rrx=(rI.x-rOut.x)/(Math.abs(rIn.x-rOut.x)||0.001)
    irisX=((lrx+rrx)/2-0.5)*2
    const lry=(lI.y-lT.y)/(Math.abs(lB.y-lT.y)||0.001)
    const rry=(rI.y-rT.y)/(Math.abs(rB.y-rT.y)||0.001)
    irisY=((lry+rry)/2-0.5)*2
  }
  return { yaw, pitch, irisX, irisY, irisOk }
}

function classifyFocus(g) {
  if (!g) return { status:'absent', pen:3, detail:'Face not detected', color:'#ef4444' }
  const ay=Math.abs(g.yaw), aix=Math.abs(g.irisX)
  if (ay>0.3) return { status:'head_turned', pen:2.5, detail:`Head ${g.yaw<0?'left':'right'} (${Math.round(ay*100)}%)`, color:'#ef4444' }
  if (g.irisOk && aix>0.25) return { status:'eyes_sideways', pen:2, detail:`Eyes ${g.irisX<0?'left':'right'}`, color:'#f97316' }
  if (ay>0.15) return { status:'slight_turn', pen:1, detail:`Slight ${g.yaw<0?'left':'right'}`, color:'#eab308' }
  if (g.irisOk && aix>0.15) return { status:'slight_glance', pen:0.5, detail:`Glance ${g.irisX<0?'left':'right'}`, color:'#eab308' }
  return { status:'focused', pen:-0.5, detail:null, color:'#22c55e' }
}

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
  const [phase,setPhase]=useState('select')
  const [exam,setExam]=useState(null)
  const [name,setName]=useState('')
  const [loadMsg,setLoadMsg]=useState('')
  const [answers,setAnswers]=useState({})
  const [curQ,setCurQ]=useState(0)
  const [dur,setDur]=useState(0)
  const [timeLeft,setTimeLeft]=useState(0)
  const [faceOk,setFaceOk]=useState(true)
  const [emotion,setEmotion]=useState(null)
  const [focusStatus,setFocusStatus]=useState({status:'focused',detail:null,color:'#22c55e'})
  const [focus,setFocus]=useState(100)
  const [checks,setChecks]=useState(0)
  const [warns,setWarns]=useState([])
  const [log,setLog]=useState([])
  const [ansTs,setAnsTs]=useState({})
  const [gapW,setGapW]=useState([])
  const [dbg,setDbg]=useState('')

  const vidRef=useRef(null),canRef=useRef(null),strRef=useRef(null)
  const tmrRef=useRef(null),flRef=useRef(null),rafRef=useRef(null),emoRef=useRef(null)
  const t0=useRef(null),lastAns=useRef(null),focusR=useRef(100),fc=useRef(0),lft=useRef(0)

  useEffect(()=>()=>cleanup(),[])

  useEffect(()=>{
    if(phase!=='exam'||!exam)return
    tmrRef.current=setInterval(()=>{
      const el=Math.floor((Date.now()-t0.current)/1000)
      setDur(el);setTimeLeft(Math.max(0,exam.time-el))
      if(el>=exam.time)submitExam()
    },1000)
    return()=>clearInterval(tmrRef.current)
  },[phase])

  const cleanup=useCallback(()=>{
    clearInterval(tmrRef.current);clearInterval(emoRef.current)
    if(rafRef.current)cancelAnimationFrame(rafRef.current)
    if(strRef.current){strRef.current.getTracks().forEach(t=>t.stop());strRef.current=null}
    if(vidRef.current)vidRef.current.srcObject=null
    if(flRef.current){try{flRef.current.close()}catch{};flRef.current=null}
  },[])

  const initProctoring=async()=>{
    setLoadMsg('Loading MediaPipe Face Mesh...')
    try{
      const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm')
      setLoadMsg('Loading face landmark model...')
      const fl=await FaceLandmarker.createFromOptions(vision,{
        baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',delegate:'GPU'},
        runningMode:'VIDEO',numFaces:1
      })
      flRef.current=fl
      setLoadMsg('Starting camera...')
      const stream=await navigator.mediaDevices.getUserMedia({video:{width:640,height:480,facingMode:'user'}})
      if(vidRef.current){vidRef.current.srcObject=stream;await vidRef.current.play()}
      strRef.current=stream;setLoadMsg('');return true
    }catch(e){setLoadMsg('');setDbg('Init failed: '+e.message);return false}
  }

  const startExam=async()=>{
    if(!name.trim())return alert('Enter your name')
    setPhase('loading');setAnswers({});setCurQ(0);setDur(0);setFocus(100);focusR.current=100
    setChecks(0);setWarns([]);setLog([]);setAnsTs({});setGapW([]);setDbg('')
    lastAns.current=null;t0.current=Date.now();fc.current=0
    await new Promise(r=>setTimeout(r,100))
    const ok=await initProctoring()
    if(!ok){alert('Could not start proctoring.');setPhase('info');return}
    setPhase('exam')
    const loop=()=>{
      if(!flRef.current||!vidRef.current||vidRef.current.readyState!==4){rafRef.current=requestAnimationFrame(loop);return}
      const now=performance.now()
      if(now-lft.current<200){rafRef.current=requestAnimationFrame(loop);return}
      lft.current=now
      try{
        const r=flRef.current.detectForVideo(vidRef.current,now)
        const ts=Math.floor((Date.now()-t0.current)/1000)
        fc.current+=1
        const upd=fc.current%3===0
        if(r.faceLandmarks&&r.faceLandmarks.length>0){
          const gaze=analyzeGaze(r.faceLandmarks[0])
          const cls=classifyFocus(gaze)
          if(cls.pen>0)focusR.current=Math.max(0,focusR.current-cls.pen*0.1)
          else focusR.current=Math.min(100,focusR.current+0.05)
          if(upd){
            setFaceOk(true);setFocusStatus(cls);setFocus(focusR.current);setChecks(c=>c+1)
            setLog(p=>[...p,{ts,ok:true,s:cls.status}])
            if(cls.pen>=2)setWarns(w=>{const n=[...w,{t:ts,m:cls.detail}];return n.length>30?n.slice(-30):n})
          }
        }else{
          focusR.current=Math.max(0,focusR.current-0.3)
          if(upd){
            setFaceOk(false);setFocusStatus({status:'absent',pen:3,detail:'Face not detected',color:'#ef4444'})
            setFocus(focusR.current);setChecks(c=>c+1)
            setLog(p=>[...p,{ts,ok:false,s:'absent'}])
            setWarns(w=>{const n=[...w,{t:ts,m:'Face absent'}];return n.length>30?n.slice(-30):n})
          }
        }
      }catch{}
      rafRef.current=requestAnimationFrame(loop)
    }
    rafRef.current=requestAnimationFrame(loop)
    emoRef.current=setInterval(async()=>{
      if(!vidRef.current||!canRef.current||vidRef.current.readyState!==4)return
      try{
        const c=canRef.current,v=vidRef.current;c.width=v.videoWidth;c.height=v.videoHeight
        c.getContext('2d').drawImage(v,0,0)
        const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',0.7))
        const fd=new FormData();fd.append('file',blob,'f.jpg')
        const resp=await fetch(`${BACKEND}/api/face-check`,{method:'POST',body:fd})
        const d=await resp.json()
        if(d.face_detected&&d.dominant)setEmotion(d.dominant);else setEmotion(null)
      }catch{}
    },3000)
  }

  const pickAnswer=(qi,oi)=>{
    const now=Date.now(),ts=Math.floor((now-t0.current)/1000)
    setAnsTs(p=>({...p,[qi]:ts}))
    if(lastAns.current){const gap=Math.round((now-lastAns.current)/1000)
      if(gap>45){setGapW(p=>[...p,{q:qi+1,gap,ts}]);focusR.current=Math.max(0,focusR.current-2);setFocus(focusR.current)
        setWarns(w=>[...w.slice(-29),{t:ts,m:`${gap}s gap before Q${qi+1}`}])}}
    lastAns.current=now;setAnswers(p=>({...p,[qi]:oi}))
  }

  const submitExam=()=>{clearInterval(tmrRef.current);clearInterval(emoRef.current)
    if(rafRef.current)cancelAnimationFrame(rafRef.current);cleanup();setPhase('results')}

  const fmt=s=>`${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`
  const total=exam?.qs.length||0,nAns=Object.keys(answers).length

  if(phase==='select')return(
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full space-y-4">
        <div className="text-center mb-8"><div className="text-5xl mb-3">🔒</div>
          <h1 className="text-3xl font-black text-white mb-2">Proctored Exams</h1>
          <p className="text-gray-400 text-sm">Eye gaze + head tracking via MediaPipe Face Mesh</p></div>
        {EXAMS.map(ex=>(
          <button key={ex.id} onClick={()=>{setExam(ex);setPhase('info')}}
            className="w-full text-left bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 hover:border-blue-500/30 transition-all group">
            <div className="text-xs text-blue-400 font-bold uppercase mb-1">{ex.course}</div>
            <div className="text-white font-bold text-lg group-hover:text-blue-400">{ex.title}</div>
            <div className="text-gray-500 text-sm mt-1">{ex.desc}</div>
            <div className="flex gap-4 mt-3 text-xs text-gray-600"><span>📝 {ex.qs.length}q</span><span>⏱ {Math.floor(ex.time/60)}min</span><span>📹 478-point tracking</span></div>
          </button>))}
      </div></div>)

  if(phase==='info')return(
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-2xl p-8">
        <div className="text-center mb-5"><div className="text-xs text-blue-400 font-bold uppercase">{exam.course}</div>
          <h2 className="text-2xl font-black text-white mt-1">{exam.title}</h2></div>
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5"><div className="text-white font-bold">{exam.qs.length}</div><div className="text-xs text-gray-500">Questions</div></div>
          <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5"><div className="text-white font-bold">{Math.floor(exam.time/60)}m</div><div className="text-xs text-gray-500">Time</div></div>
          <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5"><div className="text-white font-bold">Iris</div><div className="text-xs text-gray-500">Tracking</div></div></div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-5 text-sm text-red-300">
          <div className="font-bold mb-2">⚠️ Anti-Cheat:</div>
          <div className="text-xs text-red-400 space-y-1">
            <div>• MediaPipe Face Mesh — 478 landmarks at 5fps</div>
            <div>• Iris tracking — detects eye glances</div>
            <div>• Head rotation — detects turning away</div>
            <div>• Answer timing — flags 45s+ gaps</div></div></div>
        <input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Your full name..."
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:border-blue-500/50 focus:outline-none mb-4"/>
        <div className="flex gap-3">
          <button onClick={()=>setPhase('select')} className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10">← Back</button>
          <button onClick={startExam} disabled={!name.trim()} className="flex-1 py-3 rounded-xl font-bold bg-gradient-to-r from-red-500 to-rose-500 text-white disabled:opacity-40">🔒 Begin</button></div>
      </div></div>)

  if(phase==='loading')return(
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-6">
      <div className="text-center">
        <video ref={vidRef} autoPlay playsInline muted className="hidden"/><canvas ref={canRef} className="hidden"/>
        <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"/>
        <div className="text-white font-bold text-lg mb-2">Initializing Proctoring</div>
        <div className="text-gray-400 text-sm">{loadMsg||'Please wait...'}</div>
        {dbg&&<div className="text-red-400 text-xs mt-4 max-w-sm">{dbg}</div>}
      </div></div>)

  if(phase==='exam'){const q=exam.qs[curQ];return(
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-3">
      <div className="flex items-center justify-between mb-3 bg-white/5 rounded-xl px-4 py-2 border border-white/10 text-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"/><span className="text-red-400 font-mono font-bold">{fmt(dur)}</span></div>
          <span className="text-gray-600">|</span><span className="text-gray-400">{name}</span>
          <span className="text-gray-600">|</span><span className="text-gray-400">{nAns}/{total}</span></div>
        <div className="flex items-center gap-3">
          <span className={`font-mono font-bold ${timeLeft<60?'text-red-400 animate-pulse':'text-gray-400'}`}>⏱{fmt(timeLeft)}</span>
          <div className="w-2.5 h-2.5 rounded-full" style={{background:focusStatus.color}}/>
          <span className="font-bold" style={{color:FC(focus)}}>{Math.round(focus)}%</span></div></div>
      <div className="grid grid-cols-4 gap-3" style={{height:'calc(100vh - 72px)'}}>
        <div className="col-span-3 overflow-auto">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-bold text-lg">Q{curQ+1} <span className="text-gray-500 font-normal">/ {total}</span></h3>
              <div className="flex gap-1 flex-wrap">{exam.qs.map((_,i)=>(
                <button key={i} onClick={()=>setCurQ(i)} className={`w-7 h-7 rounded-lg text-xs font-bold ${i===curQ?'bg-blue-500 text-white':answers[i]!==undefined?'bg-green-500/20 text-green-400 border border-green-500/30':'bg-white/5 text-gray-600 border border-white/10'}`}>{i+1}</button>
              ))}</div></div>
            <p className="text-gray-100 text-lg mb-6 leading-relaxed">{q.q}</p>
            <div className="space-y-3">{q.o.map((opt,i)=>(
              <button key={i} onClick={()=>pickAnswer(curQ,i)}
                className={`w-full text-left px-5 py-4 rounded-xl border transition-all ${answers[curQ]===i?'bg-blue-500/20 border-blue-500/50 text-blue-200':'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}>
                <span className={`inline-flex w-7 h-7 rounded-full border-2 items-center justify-center text-sm font-bold mr-3 ${answers[curQ]===i?'border-blue-400 bg-blue-500/30 text-blue-300':'border-gray-600 text-gray-500'}`}>{String.fromCharCode(65+i)}</span>{opt}
              </button>))}</div>
            <div className="flex justify-between mt-6">
              <button onClick={()=>setCurQ(Math.max(0,curQ-1))} disabled={curQ===0} className="px-5 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 disabled:opacity-30">← Prev</button>
              {curQ<total-1?<button onClick={()=>setCurQ(curQ+1)} className="px-5 py-2 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400">Next →</button>
              :<button onClick={submitExam} disabled={nAns<total} className="px-6 py-2 rounded-xl font-bold bg-gradient-to-r from-green-500 to-emerald-500 text-white disabled:opacity-40">✓ Submit ({nAns}/{total})</button>}
            </div></div></div>
        <div className="space-y-3 overflow-auto">
          <div className="rounded-2xl overflow-hidden border-2 transition-colors" style={{borderColor:focusStatus.color+'66'}}>
            <div className="relative bg-black aspect-[3/4]">
              <video ref={vidRef} autoPlay playsInline muted className="w-full h-full object-cover"/>
              <canvas ref={canRef} className="hidden"/>
              <div className="absolute top-2 left-2"><div className="px-2 py-1 rounded text-[10px] font-bold text-white" style={{background:focusStatus.color+'cc'}}>
                {focusStatus.status==='focused'?'✅ Focused':focusStatus.status==='absent'?'🔴 Away':'⚠️ '+(focusStatus.detail||focusStatus.status)}</div></div>
              {emotion&&<div className="absolute top-2 right-2 px-2 py-1 rounded bg-black/60 text-white text-[10px] font-bold capitalize">{emotion}</div>}
              <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-red-500/80 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"/><span className="text-white text-[10px] font-bold">REC</span></div>
              {!faceOk&&<div className="absolute inset-0 flex items-center justify-center bg-red-900/40"><div className="text-center"><div className="text-3xl">⚠️</div><div className="text-red-200 text-xs font-bold">Look at screen!</div></div></div>}
            </div></div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <div className="text-2xl font-black" style={{color:FC(focus)}}>{Math.round(focus)}%</div>
            <div className="text-[10px] text-gray-500">Focus</div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mt-2"><div className="h-full rounded-full transition-all" style={{width:`${Math.max(0,focus)}%`,background:FC(focus)}}/></div></div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-2 text-[11px] space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">Checks</span><span className="text-white font-bold">{checks}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Status</span><span className="font-bold" style={{color:focusStatus.color}}>{focusStatus.status}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Alerts</span><span className="text-yellow-400 font-bold">{warns.length}</span></div></div>
          {warns.length>0&&<div className="bg-red-500/5 border border-red-500/10 rounded-xl p-2 max-h-24 overflow-y-auto">
            {warns.slice(-5).map((w,i)=><div key={i} className="text-[9px] text-red-300 py-0.5">{fmt(w.t)} — {w.m}</div>)}</div>}
          {dbg&&<div className="text-[9px] text-yellow-400 bg-yellow-500/10 rounded p-1 break-all">{dbg}</div>}
        </div></div></div>)}

  const correct=exam?.qs.filter((q,i)=>answers[i]===q.a).length||0
  const pct=total?Math.round(correct/total*100):0
  const fl=log.filter(l=>l.ok).length,ppct=log.length?Math.round(fl/log.length*100):100
  const hw=warns.filter(w=>w.m?.includes('Head')||w.m?.includes('head')).length
  const ew=warns.filter(w=>w.m?.includes('Eyes')||w.m?.includes('eyes')||w.m?.includes('Glance')||w.m?.includes('glance')).length

  return(
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center bg-white/5 border border-white/10 rounded-2xl p-8">
          <div className="text-xs text-blue-400 font-bold uppercase">{exam?.course}</div>
          <h2 className="text-2xl font-black text-white mt-1 mb-1">{exam?.title} — Results</h2>
          <p className="text-gray-500 text-sm mb-6">{name} · {fmt(dur)}</p>
          <div className="grid grid-cols-4 gap-4">
            {[{v:`${pct}%`,l:'Score',s:`${correct}/${total}`,c:pct>=70?'#22c55e':pct>=50?'#eab308':'#ef4444'},
              {v:`${Math.round(focus)}%`,l:'Focus',s:focus>=85?'Excellent':focus>=70?'Good':focus>=50?'Moderate':'Poor',c:FC(focus)},
              {v:`${ppct}%`,l:'Present',s:`${fl}/${log.length}`,c:ppct>=90?'#22c55e':'#eab308'},
              {v:warns.length,l:'Alerts',s:`${hw} head · ${ew} eyes`,c:warns.length===0?'#22c55e':warns.length<=5?'#eab308':'#ef4444'}
            ].map(x=>(
              <div key={x.l} className="bg-white/5 rounded-xl p-4 border border-white/5">
                <div className="text-3xl font-black" style={{color:x.c}}>{x.v}</div>
                <div className="text-gray-400 text-sm mt-1">{x.l}</div>
                <div className="text-xs text-gray-500">{x.s}</div></div>))}</div></div>
        {log.length>0&&<div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-bold mb-3">Focus Timeline</h3>
          <div className="flex gap-[1px] h-8 rounded-lg overflow-hidden">
            {log.map((e,i)=><div key={i} className="flex-1" style={{background:e.ok?(e.s==='focused'?'#22c55e':e.s==='slight_turn'||e.s==='slight_glance'?'#eab308':'#f97316'):'#ef4444'}}/>)}</div>
          <div className="flex justify-between mt-1 text-xs text-gray-600"><span>Start</span>
            <span className="flex gap-3"><span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-sm"/>Focused</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-yellow-500 rounded-sm"/>Glance</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-orange-500 rounded-sm"/>Turned</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-sm"/>Away</span></span><span>End</span></div></div>}
        {gapW.length>0&&<div className="bg-yellow-500/5 border border-yellow-500/10 rounded-2xl p-6">
          <h3 className="text-yellow-400 font-bold mb-3">⏱ Answer Timing Flags</h3>
          {gapW.map((g,i)=><div key={i} className="text-sm text-yellow-300 bg-yellow-500/10 rounded-xl px-4 py-2 mb-1 flex justify-between"><span>Q{g.q}: {g.gap}s delay</span><span className="text-yellow-500 text-xs">{fmt(g.ts)}</span></div>)}</div>}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-bold mb-4">Answer Review</h3>
          {exam?.qs.map((q,i)=>{const s=answers[i],ok=s===q.a;return(
            <div key={i} className={`rounded-xl p-3 border mb-2 ${ok?'bg-green-500/10 border-green-500/20':'bg-red-500/10 border-red-500/20'}`}>
              <span className={`font-bold mr-2 ${ok?'text-green-400':'text-red-400'}`}>{ok?'✓':'✗'}</span>
              <span className="text-gray-200 text-sm">Q{i+1}: {q.q}</span>
              <div className="text-xs mt-1 ml-6"><span className={ok?'text-green-400':'text-red-400'}>{s!==undefined?q.o[s]:'Not answered'}</span>
                {!ok&&s!==undefined&&<span className="text-green-400 ml-2">· {q.o[q.a]}</span>}
                {ansTs[i]!==undefined&&<span className="text-gray-600 ml-2">at {fmt(ansTs[i])}</span>}</div></div>)})}</div>
        {warns.length>0&&<div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-bold mb-3">⚠️ All Alerts ({warns.length})</h3>
          <div className="max-h-40 overflow-y-auto space-y-1">{warns.map((w,i)=><div key={i} className="text-sm text-red-300 bg-red-500/10 rounded-lg px-3 py-2">{fmt(w.t)} — {w.m}</div>)}</div></div>}
        <div className="text-center pb-8"><button onClick={()=>{setPhase('select');setExam(null);setAnswers({});setWarns([]);setLog([])}}
          className="px-8 py-3 rounded-2xl font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-500 shadow-lg">← Another Exam</button></div>
      </div></div>)
}
