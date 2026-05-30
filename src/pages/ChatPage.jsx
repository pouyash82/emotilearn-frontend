import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import GlassCard from '../components/GlassCard'
import API from '../api'

const ROLE_COLORS = {
  student: { bg: 'from-indigo-500 to-blue-500', badge: 'badge-primary' },
  teacher: { bg: 'from-amber-500 to-orange-500', badge: 'badge-warning' },
  admin:   { bg: 'from-purple-500 to-pink-500', badge: 'badge-danger' },
}

const fmtTime = (iso) => {
  if (!iso) return ''
  try {
    const d = new Date(iso), now = new Date(), diff = now - d
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

export default function ChatPage() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [contacts, setContacts] = useState([])
  const [selectedConvo, setSelectedConvo] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMsg, setNewMsg] = useState('')
  const [showNewChat, setShowNewChat] = useState(false)
  const [searchContact, setSearchContact] = useState('')
  const [unreadTotal, setUnreadTotal] = useState(0)
  const messagesEndRef = useRef(null)
  const pollRef = useRef(null)

  useEffect(() => {
    loadConversations(); loadContacts(); loadUnread()
    pollRef.current = setInterval(() => { loadConversations(); loadUnread(); if (selectedConvo) loadMessages(selectedConvo.id) }, 5000)
    return () => clearInterval(pollRef.current)
  }, [])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const loadConversations = () => API.get('/chat/conversations').then(r => setConversations(r.data.conversations || [])).catch(() => {})
  const loadContacts = () => API.get('/chat/contacts').then(r => setContacts(r.data.contacts || [])).catch(() => {})
  const loadUnread = () => API.get('/chat/unread-count').then(r => setUnreadTotal(r.data.unread || 0)).catch(() => {})
  const loadMessages = (id) => API.get(`/chat/conversations/${id}/messages`).then(r => setMessages(r.data.messages || [])).catch(() => {})

  const selectConversation = (c) => { setSelectedConvo(c); setShowNewChat(false); loadMessages(c.id) }
  const sendMessage = async () => {
    if (!newMsg.trim() || !selectedConvo) return
    try { await API.post(`/chat/conversations/${selectedConvo.id}/messages`, { content: newMsg }); setNewMsg(''); loadMessages(selectedConvo.id); loadConversations() } catch { alert('Failed to send') }
  }
  const startNewConversation = async (contact) => {
    try {
      const r = await API.post('/chat/conversations', { other_user_id: contact.id, message: `Hi ${contact.name}!` }); setShowNewChat(false); loadConversations()
      setTimeout(() => { API.get('/chat/conversations').then(res => { const found = (res.data.conversations || []).find(c => c.id === r.data.conversation_id); if (found) selectConversation(found) }) }, 300)
    } catch (e) { alert(e.response?.data?.detail || 'Cannot start conversation') }
  }
  const handleKeyPress = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }
  const filteredContacts = contacts.filter(c => c.name.toLowerCase().includes(searchContact.toLowerCase()) || c.email.toLowerCase().includes(searchContact.toLowerCase()))

  const backPath = user?.role === 'teacher' ? '/teacher' : user?.role === 'admin' ? '/admin' : '/student'

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      {/* Background */}
      <div className="fixed top-20 left-60 w-72 h-72 bg-indigo-200/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="fixed bottom-20 right-20 w-80 h-80 bg-blue-200/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Top bar */}
      <header className="glass-sidebar px-6 py-3 border-b border-gray-200 flex items-center gap-4 sticky top-0 z-30">
        <Link to={backPath} className="p-2 rounded-lg text-gray-500 hover:text-slate-800 hover:bg-gray-50 transition-all">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </Link>
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          <h1 className="text-sm font-semibold text-slate-800">Messages</h1>
          {unreadTotal > 0 && <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-slate-800 text-[10px] font-bold">{unreadTotal}</span>}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-5 relative z-10">
        <div className="flex gap-4 h-[calc(100vh-90px)]">

          {/* Left — Conversations */}
          <div className="w-72 shrink-0 flex flex-col">
            <div className="glass rounded-2xl flex-1 flex flex-col overflow-hidden">
              <div className="p-3 border-b border-gray-200 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Chats</span>
                <button onClick={() => setShowNewChat(true)} className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-200 text-slate-800 flex items-center justify-center hover:bg-gray-100 transition-all text-sm">+</button>
              </div>

              {showNewChat && (
                <div className="p-3 border-b border-gray-200 bg-gray-50">
                  <input type="text" placeholder="Search contacts..." value={searchContact} onChange={e => setSearchContact(e.target.value)} className="input-glass text-xs py-2" autoFocus />
                  <div className="mt-2 max-h-40 overflow-y-auto space-y-0.5">
                    {filteredContacts.length === 0 ? <p className="text-gray-400 text-xs text-center py-2">No contacts</p> : filteredContacts.map(c => {
                      const rc = ROLE_COLORS[c.role] || ROLE_COLORS.student
                      return (
                        <button key={c.id} onClick={() => startNewConversation(c)} className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-all text-left">
                          <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${rc.bg} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}>{c.name?.charAt(0)}</div>
                          <div className="min-w-0 flex-1"><div className="text-slate-800 text-xs truncate">{c.name}</div><div className="text-gray-400 text-[9px] capitalize">{c.role}</div></div>
                        </button>
                      )
                    })}
                  </div>
                  <button onClick={() => setShowNewChat(false)} className="text-gray-400 text-[10px] mt-1.5 hover:text-gray-400">Cancel</button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto">
                {conversations.length === 0 ? (
                  <div className="p-6 text-center">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="1.5" className="mx-auto mb-2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                    <p className="text-gray-400 text-xs mb-2">No conversations</p>
                    <button onClick={() => setShowNewChat(true)} className="btn-secondary text-xs px-3 py-1.5">Start a chat</button>
                  </div>
                ) : conversations.map(c => {
                  const isSelected = selectedConvo?.id === c.id
                  const rc = ROLE_COLORS[c.other_user?.role] || ROLE_COLORS.student
                  return (
                    <button key={c.id} onClick={() => selectConversation(c)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 transition-all text-left border-l-2 ${isSelected ? 'bg-gray-50 border-l-indigo-500' : 'hover:bg-gray-50 border-l-transparent'}`}>
                      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${rc.bg} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>{c.other_user?.name?.charAt(0) || '?'}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center"><span className="text-slate-800 text-xs font-medium truncate">{c.other_user?.name}</span><span className="text-gray-300 text-[9px] flex-shrink-0">{fmtTime(c.last_at)}</span></div>
                        <div className="flex justify-between items-center mt-0.5">
                          <span className="text-gray-400 text-[10px] truncate">{c.last_message || 'No messages'}</span>
                          {c.unread > 0 && <span className="px-1.5 py-0.5 rounded-full bg-indigo-500 text-white text-[9px] font-bold flex-shrink-0 ml-1">{c.unread}</span>}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right — Messages */}
          <div className="flex-1 flex flex-col">
            <div className="glass rounded-2xl flex-1 flex flex-col overflow-hidden">
              {!selectedConvo ? (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="1.5" className="mb-3"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                  <h2 className="text-lg font-bold text-slate-800 mb-1">Your Messages</h2>
                  <p className="text-gray-400 text-sm mb-4">Select a conversation or start a new one</p>
                  <button onClick={() => setShowNewChat(true)} className="btn-primary text-sm px-5 py-2.5">New Message</button>
                </div>
              ) : (
                <>
                  <div className="p-3 border-b border-gray-200 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${ROLE_COLORS[selectedConvo.other_user?.role]?.bg || 'from-gray-500 to-gray-600'} flex items-center justify-center text-white text-xs font-bold`}>{selectedConvo.other_user?.name?.charAt(0) || '?'}</div>
                    <div>
                      <h3 className="text-sm text-slate-800 font-semibold">{selectedConvo.other_user?.name}</h3>
                      <div className="flex items-center gap-2"><span className={`text-[9px] px-1.5 py-0.5 rounded ${ROLE_COLORS[selectedConvo.other_user?.role]?.badge || 'badge-info'} capitalize`}>{selectedConvo.other_user?.role}</span><span className="text-gray-300 text-[10px]">{selectedConvo.other_user?.email}</span></div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {messages.length === 0 ? <div className="text-center py-12 text-gray-400 text-xs">Start the conversation!</div> : messages.map(m => (
                      <div key={m.id} className={`flex ${m.is_mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] px-3.5 py-2.5 rounded-2xl text-sm ${m.is_mine ? 'bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-br-md' : 'bg-gray-100 text-gray-200 rounded-bl-md'}`}>
                          <div className="whitespace-pre-wrap break-words">{m.content}</div>
                          <div className={`text-[9px] mt-1 flex items-center gap-1 ${m.is_mine ? 'text-indigo-400 justify-end' : 'text-gray-400'}`}>
                            {fmtTime(m.created_at)}{m.is_mine && <span className="ml-0.5">{m.is_read ? '✓✓' : '✓'}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className="p-3 border-t border-gray-200">
                    <div className="flex gap-2 items-end">
                      <textarea value={newMsg} onChange={e => setNewMsg(e.target.value)} onKeyDown={handleKeyPress} placeholder="Type a message..." rows={1}
                        className="flex-1 input-glass py-2.5 text-sm resize-none max-h-28" style={{ minHeight: '40px' }} />
                      <button onClick={sendMessage} disabled={!newMsg.trim()} className="btn-primary px-4 py-2.5 text-sm disabled:opacity-40 flex-shrink-0">Send</button>
                    </div>
                    <div className="text-[9px] text-gray-300 mt-1 text-right">Enter to send · Shift+Enter for new line</div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
