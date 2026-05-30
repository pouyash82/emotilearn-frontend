export default function GlassCard({
  children,
  className = '',
  hover = true,
  glow = false,
  accent = null,       // 'indigo' | 'green' | 'amber' | 'red' | 'teal'
  variant = 'default', // 'default' | 'stat' | 'subtle' | 'heavy'
  onClick,
}) {
  const accentColors = {
    indigo: 'rgba(99, 102, 241, 0.5)',
    green:  'rgba(34, 197, 94, 0.5)',
    amber:  'rgba(245, 158, 11, 0.5)',
    red:    'rgba(239, 68, 68, 0.5)',
    teal:   'rgba(20, 184, 166, 0.5)',
    blue:   'rgba(59, 130, 246, 0.5)',
  }

  const variantClasses = {
    default: 'glass',
    stat:    'card-stat',
    subtle:  'glass-subtle',
    heavy:   'glass-heavy',
  }

  return (
    <div
      onClick={onClick}
      className={`
        relative overflow-hidden rounded-2xl
        ${variantClasses[variant] || 'glass'}
        ${hover ? 'glass-interactive' : ''}
        ${glow ? 'glow-indigo' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      style={accent ? { '--card-accent': accentColors[accent] || accentColors.indigo } : undefined}
    >
      {/* Subtle gradient shimmer at top */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent pointer-events-none" />

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}
