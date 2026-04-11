import { useEffect, useRef } from 'react'

export default function AnimatedBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animationId
    let particles = []
    let mouse = { x: null, y: null }

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Track mouse
    window.addEventListener('mousemove', (e) => {
      mouse.x = e.x
      mouse.y = e.y
    })

    class Particle {
      constructor() {
        this.x = Math.random() * canvas.width
        this.y = Math.random() * canvas.height
        this.size = Math.random() * 5 + 2
        this.baseSize = this.size
        this.speedX = Math.random() * 2 - 1
        this.speedY = Math.random() * 2 - 1
        this.color = this.getRandomColor()
        this.opacity = Math.random() * 0.5 + 0.2
      }

      getRandomColor() {
        const colors = [
          'rgba(59, 130, 246, ',   // Purple
          'rgba(99, 102, 241, ',   // Pink
          'rgba(59, 130, 246, ',   // Blue
          'rgba(34, 211, 238, ',   // Cyan
          'rgba(251, 146, 60, ',   // Orange
        ]
        return colors[Math.floor(Math.random() * colors.length)]
      }

      update() {
        this.x += this.speedX
        this.y += this.speedY

        // Bounce off edges
        if (this.x < 0 || this.x > canvas.width) this.speedX *= -1
        if (this.y < 0 || this.y > canvas.height) this.speedY *= -1

        // Mouse interaction
        if (mouse.x && mouse.y) {
          const dx = mouse.x - this.x
          const dy = mouse.y - this.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          if (distance < 150) {
            this.size = this.baseSize * 2
            this.opacity = 0.8
          } else {
            this.size = this.baseSize
            this.opacity = Math.random() * 0.5 + 0.2
          }
        }
      }

      draw() {
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
        ctx.fillStyle = this.color + this.opacity + ')'
        ctx.shadowBlur = 20
        ctx.shadowColor = this.color + '0.5)'
        ctx.fill()
      }
    }

    // Create particles
    const createParticles = () => {
      const count = Math.floor((canvas.width * canvas.height) / 15000)
      for (let i = 0; i < count; i++) {
        particles.push(new Particle())
      }
    }
    createParticles()

    // Connect nearby particles with lines
    const connectParticles = () => {
      for (let a = 0; a < particles.length; a++) {
        for (let b = a + 1; b < particles.length; b++) {
          const dx = particles[a].x - particles[b].x
          const dy = particles[a].y - particles[b].y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < 120) {
            ctx.beginPath()
            ctx.strokeStyle = `rgba(59, 130, 246, ${0.15 - distance / 800})`
            ctx.lineWidth = 1
            ctx.moveTo(particles[a].x, particles[a].y)
            ctx.lineTo(particles[b].x, particles[b].y)
            ctx.stroke()
          }
        }
      }
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      particles.forEach(particle => {
        particle.update()
        particle.draw()
      })
      
      connectParticles()
      animationId = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animationId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ background: 'transparent' }}
    />
  )
}
