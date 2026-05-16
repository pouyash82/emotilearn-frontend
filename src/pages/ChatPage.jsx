import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import GlassCard from '../components/GlassCard'
import API from '../api'

const ROLE_COLORS = {
  student: { bg: 'from-blue-500 to-indigo-500', text: 'text-blue-400', badge: 'bg-blue-500/20 text-blue-400 border-blue-500/20' },
  teacher: { bg: 'from-amber-500 to-orange-500', text: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-400 border-amber-500/20' },
  admin:   { bg: 'from-purple-500 to-pink-500',  text: 'text-purple-400', badge: 'bg-purple-500/20 text-purple-400 border-purple-500/20' },
}

const fmtTime = (iso) => {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const now = new Date()
    const diff = now - d
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
  const [loading, setLoading] = useState(false)
  const [showNewChat, setShowNewChat] = useState(false)
  const [searchContact, setSearchContact] = useState('')
  const [unreadTotal, setUnreadTotal] = useState(0)
  const messagesEndRef = useRef(null)
  const pollRef = useRef(null)

  useEffect(() => {
    loadConversations()
    loadContacts()
    loadUnread()
    // Poll for new messages every 5 seconds
    pollRef.current = setInterval(() => {
      loadConversations()
      loadUnread()
      if (selectedConvo) loadMessages(selectedConvo.id)
    }, 5000)
    return () => clearInterval(pollRef.current)
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadConversations = () => {
    API.get('/chat/conversations')
      .then(r => setConversations(r.data.conversations || []))
      .catch(() => {})
  }

  const loadContacts = () => {
    API.get('/chat/contacts')
      .then(r => setContacts(r.data.contacts || []))
      .catch(() => {})
  }

  const loadUnread = () => {
    API.get('/chat/unread-count')
      .then(r => setUnreadTotal(r.data.unread || 0))
      .catch(() => {})
  }

  const loadMessages = (convoId) => {
    API.get(`/chat/conversations/${convoId}/messages`)
      .then(r => setMessages(r.data.messages || []))
      .catch(() => {})
  }

  const selectConversation = (convo) => {
    setSelectedConvo(convo)
    setShowNewChat(false)
    loadMessages(convo.id)
  }

  const sendMessage = async () => {
    if (!newMsg.trim() || !selectedConvo) return
    try {
      await API.post(`/chat/conversations/${selectedConvo.id}/messages`, { content: newMsg })
      setNewMsg('')
      loadMessages(selectedConvo.id)
      loadConversations()
    } catch (e) {
      alert('Failed to send message')
    }
  }

  const startNewConversation = async (contact) => {
    try {
      const r = await API.post('/chat/conversations', {
        other_user_id: contact.id,
        message: `Hi ${contact.name}! 👋`,
      })
      setShowNewChat(false)
      loadConversations()
      // Select the new/existing conversation
      setTimeout(() => {
        API.get('/chat/conversations').then(res => {
          const convos = res.data.conversations || []
          const found = convos.find(c => c.id === r.data.conversation_id)
          if (found) selectConversation(found)
        })
      }, 300)
    } catch (e) {
      alert(e.response?.data?.detail || 'Cannot start conversation')
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(searchContact.toLowerCase()) ||
    c.email.toLowerCase().includes(searchContact.toLowerCase()))

  const roleStyle = ROLE_COLORS[user?.role] || ROLE_COLORS.student

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 py-6 relative z-10">
        <div className="flex gap-4 h-[calc(100vh-120px)]">

          {/* ═══════ LEFT SIDEBAR — Conversations ═══════ */}
          <div className="w-80 shrink-0 flex flex-col">
            <GlassCard className="flex-1 flex flex-col overflow-hidden">
              {/* Header */}
              <div className="p-4 border-b border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    💬 Messages
                    {unreadTotal > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">{unreadTotal}</span>
                    )}
                  </h2>
                  <button
                    onClick={() => setShowNewChat(true)}
                    className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-white flex items-center justify-center hover:bg-white/10 transition-all"
                  >+</button>
                </div>
              </div>

              {/* New chat contact picker */}
              {showNewChat && (
                <div className="p-3 border-b border-white/5 bg-white/5">
                  <input
                    type="text"
                    placeholder="Search contacts..."
                    value={searchContact}
                    onChange={e => setSearchContact(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
                    autoFocus
                  />
                  <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                    {filteredContacts.length === 0 ? (
                      <p className="text-gray-500 text-xs text-center py-2">No contacts available</p>
                    ) : filteredContacts.map(c => {
                      const rc = ROLE_COLORS[c.role] || ROLE_COLORS.student
                      return (
                        <button
                          key={c.id}
                          onClick={() => startNewConversation(c)}
                          className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white/10 transition-all text-left"
                        >
                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${rc.bg} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                            {c.name?.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-white text-sm truncate">{c.name}</div>
                            <div className="text-gray-500 text-[10px] truncate">{c.role}</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  <button onClick={() => setShowNewChat(false)} className="text-gray-500 text-xs mt-2 hover:text-gray-300">Cancel</button>
                </div>
              )}

              {/* Conversation list */}
              <div className="flex-1 overflow-y-auto">
                {conversations.length === 0 ? (
                  <div className="p-6 text-center">
                    <div className="text-3xl mb-2">💬</div>
                    <p className="text-gray-500 text-sm">No conversations yet</p>
                    <button onClick={() => setShowNewChat(true)}
                      className="mt-3 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-xs hover:bg-white/10">
                      Start a chat
                    </button>
                  </div>
                ) : conversations.map(c => {
                  const isSelected = selectedConvo?.id === c.id
                  const rc = ROLE_COLORS[c.other_user?.role] || ROLE_COLORS.student
                  return (
                    <button
                      key={c.id}
                      onClick={() => selectConversation(c)}
                      className={`w-full flex items-center gap-3 p-3 transition-all text-left ${
                        isSelected
                          ? 'bg-white/10 border-l-2 border-l-blue-500'
                          : 'hover:bg-white/5 border-l-2 border-l-transparent'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${rc.bg} flex items-center justify-center text-white font-bold shrink-0`}>
                        {c.other_user?.name?.charAt(0) || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <span className="text-white text-sm font-medium truncate">{c.other_user?.name}</span>
                          <span className="text-gray-600 text-[10px] shrink-0">{fmtTime(c.last_at)}</span>
                        </div>
                        <div className="flex justify-between items-center mt-0.5">
                          <span className="text-gray-500 text-xs truncate">{c.last_message || 'No messages'}</span>
                          {c.unread > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-bold shrink-0 ml-1">
                              {c.unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </GlassCard>
          </div>

          {/* ═══════ RIGHT — Messages ═══════ */}
          <div className="flex-1 flex flex-col">
            <GlassCard className="flex-1 flex flex-col overflow-hidden">
              {!selectedConvo ? (
                /* No conversation selected */
                <div className="flex-1 flex flex-col items-center justify-center">
                  <div className="text-6xl mb-4">💬</div>
                  <h2 className="text-xl font-bold text-white mb-2">Your Messages</h2>
                  <p className="text-gray-500 text-sm mb-4">Select a conversation or start a new one</p>
                  <button
                    onClick={() => setShowNewChat(true)}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold hover:scale-105 transition-all"
                  >
                    ✉️ New Message
                  </button>
                </div>
              ) : (
                <>
                  {/* Chat Header */}
                  <div className="p-4 border-b border-white/5 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${ROLE_COLORS[selectedConvo.other_user?.role]?.bg || 'from-gray-500 to-gray-600'} flex items-center justify-center text-white font-bold`}>
                      {selectedConvo.other_user?.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <h3 className="text-white font-bold">{selectedConvo.other_user?.name}</h3>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${ROLE_COLORS[selectedConvo.other_user?.role]?.badge || ''}`}>
                          {selectedConvo.other_user?.role}
                        </span>
                        <span className="text-gray-600 text-xs">{selectedConvo.other_user?.email}</span>
                      </div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.length === 0 ? (
                      <div className="text-center py-12 text-gray-500 text-sm">Start the conversation!</div>
                    ) : messages.map(m => (
                      <div key={m.id} className={`flex ${m.is_mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${
                          m.is_mine
                            ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-br-md'
                            : 'bg-white/10 text-gray-200 rounded-bl-md'
                        }`}>
                          <div className="whitespace-pre-wrap break-words">{m.content}</div>
                          <div className={`text-[10px] mt-1 flex items-center gap-1 ${m.is_mine ? 'text-blue-200 justify-end' : 'text-gray-500'}`}>
                            {fmtTime(m.created_at)}
                            {m.is_mine && (
                              <span>{m.is_read ? '✓✓' : '✓'}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <div className="p-4 border-t border-white/5">
                    <div className="flex gap-3 items-end">
                      <textarea
                        value={newMsg}
                        onChange={e => setNewMsg(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="Type a message..."
                        rows={1}
                        className="flex-1 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500/50 resize-none max-h-32"
                        style={{ minHeight: '44px' }}
                      />
                      <button
                        onClick={sendMessage}
                        disabled={!newMsg.trim()}
                        className="px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold hover:scale-105 disabled:opacity-40 disabled:hover:scale-100 transition-all shrink-0"
                      >
                        Send →
                      </button>
                    </div>
                    <div className="text-[10px] text-gray-600 mt-1 text-right">Press Enter to send, Shift+Enter for new line</div>
                  </div>
                </>
              )}
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  )
}
