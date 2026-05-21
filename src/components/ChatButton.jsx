import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import API from '../api'

export default function ChatButton() {
  const [unread, setUnread] = useState(0)
  const [pulse, setPulse] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    loadUnread()
    const interval = setInterval(loadUnread, 10000) // Check every 10s
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
      className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl 
        bg-gradient-to-r from-blue-500 to-indigo-500 
        text-white shadow-lg shadow-blue-500/30 
        flex items-center justify-center 
        hover:scale-110 active:scale-95 transition-all duration-300
        ${pulse ? 'animate-bounce' : ''}`}
      title="Messages"
    >
      {/* DM Icon */}
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>

      {/* Unread Badge */}
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-slate-900 animate-pulse">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  )
}
