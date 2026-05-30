import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import API from '../api'

export default function ChatButton() {
  const [unread, setUnread] = useState(0)
  const [pulse, setPulse] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    loadUnread()
    const interval = setInterval(loadUnread, 10000)
    return () => clearInterval(interval)
  }, [])

  const loadUnread = () => {
    API.get('/chat/unread-count')
      .then(r => {
        const count = r.data.unread || 0
        if (count > unread) setPulse(true)
        setUnread(count)
        setTimeout(() => setPulse(false), 1000)
      })
      .catch(() => {})
  }

  return (
    <button
      onClick={() => navigate('/chat')}
      className={`fixed bottom-6 right-6 z-50 w-12 h-12 rounded-xl 
        bg-gradient-to-br from-indigo-500 to-blue-500 
        text-white shadow-lg shadow-indigo-500/25 
        flex items-center justify-center 
        hover:scale-105 hover:shadow-indigo-500/40 active:scale-95 
        transition-all duration-300
        ${pulse ? 'animate-bounce' : ''}`}
      title="Messages"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>

      {unread > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 flex items-center justify-center rounded-full bg-rose-500 text-white text-[9px] font-bold px-1 border-2 border-[var(--bg-base)] animate-pulse-soft">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  )
}
