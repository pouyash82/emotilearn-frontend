export default function GlassCard({ 
  children, 
  className = '', 
  hover = true,
  glow = false 
}) {
  return (
    <div className={`
      relative overflow-hidden
      backdrop-blur-xl bg-white/5 
      border border-white/10
      rounded-3xl
      shadow-[0_8px_32px_rgba(0,0,0,0.3)]
      ${hover ? 'hover:bg-white/10 hover:border-white/20 hover:shadow-[0_8px_40px_rgba(168,85,247,0.2)] hover:scale-[1.02]' : ''}
      ${glow ? 'shadow-[0_0_40px_rgba(168,85,247,0.3)]' : ''}
      transition-all duration-500 ease-out
      ${className}
    `}>
      {/* Gradient border effect */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-purple-500/20 via-transparent to-pink-500/20 pointer-events-none" />
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}
