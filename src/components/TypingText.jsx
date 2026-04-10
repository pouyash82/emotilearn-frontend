import { useState, useEffect } from 'react'

export default function TypingText({ 
  texts = ['Hello World'], 
  speed = 100, 
  deleteSpeed = 50,
  pauseTime = 2000,
  className = '' 
}) {
  const [displayText, setDisplayText] = useState('')
  const [textIndex, setTextIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    const currentText = texts[textIndex]
    
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        // Typing
        if (charIndex < currentText.length) {
          setDisplayText(currentText.substring(0, charIndex + 1))
          setCharIndex(charIndex + 1)
        } else {
          // Pause before deleting
          setTimeout(() => setIsDeleting(true), pauseTime)
        }
      } else {
        // Deleting
        if (charIndex > 0) {
          setDisplayText(currentText.substring(0, charIndex - 1))
          setCharIndex(charIndex - 1)
        } else {
          setIsDeleting(false)
          setTextIndex((textIndex + 1) % texts.length)
        }
      }
    }, isDeleting ? deleteSpeed : speed)

    return () => clearTimeout(timeout)
  }, [charIndex, isDeleting, textIndex, texts, speed, deleteSpeed, pauseTime])

  return (
    <span className={className}>
      {displayText}
      <span className="animate-pulse text-purple-400">|</span>
    </span>
  )
}
