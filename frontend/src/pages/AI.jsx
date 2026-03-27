import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'

const ease = [0.16, 1, 0.3, 1]
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const SUGGESTED_PROMPTS = [
  "How is my training looking this week?",
  "Which muscle groups am I neglecting?",
  "Am I making progress on my main lifts?",
  "What should I focus on next session?",
  "How's my overall volume trending?",
]

export default function AI() {
  const { user } = useAuthStore()

  const [conversations, setConversations]   = useState([])
  const [activeId, setActiveId]             = useState(null)
  const [messages, setMessages]             = useState([])
  const [input, setInput]                   = useState('')
  const [loading, setLoading]               = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [sidebarOpen, setSidebarOpen]       = useState(true)
  const [deleteTarget, setDeleteTarget]     = useState(null)
  const [renamingId, setRenamingId]         = useState(null)
  const [renameValue, setRenameValue]       = useState('')

  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    if (user) fetchConversations()
  }, [user])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }

  const fetchConversations = async () => {
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/ai/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setConversations(data.conversations || [])
      }
    } catch (e) {
      console.error('fetchConversations error:', e)
    }
  }

  const fetchMessages = async (conversationId) => {
    setLoadingHistory(true)
    setMessages([])
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/ai/history/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
      }
    } catch (e) {
      console.error('fetchMessages error:', e)
    }
    setLoadingHistory(false)
  }

  const createConversation = async () => {
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/ai/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: 'New Chat' }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('createConversation failed:', res.status, err)
        return null
      }
      const data = await res.json()
      setConversations(prev => [data, ...prev])
      setActiveId(data.id)
      setMessages([])
      return data.id
    } catch (e) {
      console.error('createConversation error:', e)
      return null
    }
  }

  const selectConversation = (id) => {
    setActiveId(id)
    fetchMessages(id)
  }

  const deleteConversation = async (id) => {
    try {
      const token = await getToken()
      await fetch(`${API_URL}/ai/conversations/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setConversations(prev => prev.filter(c => c.id !== id))
      if (activeId === id) { setActiveId(null); setMessages([]) }
    } catch (e) {
      console.error('deleteConversation error:', e)
    }
    setDeleteTarget(null)
  }

  const renameConversation = async (id) => {
    if (!renameValue.trim()) { setRenamingId(null); return }
    try {
      const token = await getToken()
      await fetch(`${API_URL}/ai/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: renameValue.trim() }),
      })
      setConversations(prev => prev.map(c => c.id === id ? { ...c, title: renameValue.trim() } : c))
    } catch (e) {
      console.error('renameConversation error:', e)
    }
    setRenamingId(null)
  }

  const sendMessage = async (text) => {
    const message = text || input.trim()
    if (!message || loading) return

    let convId = activeId
    if (!convId) {
      convId = await createConversation()
      if (!convId) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Failed to create conversation. Make sure the backend is running.',
          error: true,
        }])
        return
      }
    }

    // Include the new user message in history for context
    const updatedMessages = [...messages, { role: 'user', content: message }]
    setInput('')
    setMessages(updatedMessages)
    setLoading(true)

    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message,
          conversation_history: updatedMessages.slice(-10),
          conversation_id: convId,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Request failed')
      }

      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])

      // Auto-title from first message
      if (messages.length === 0) {
        const title = message.slice(0, 40) + (message.length > 40 ? '…' : '')
        setConversations(prev => prev.map(c =>
          c.id === convId ? { ...c, title, updated_at: new Date().toISOString() } : c
        ))
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, something went wrong: ${e.message}`,
        error: true,
      }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const activeConversation = conversations.find(c => c.id === activeId)

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', gap: 0, margin: '0 -36px', overflow: 'hidden' }}>

      {/* Confirm delete modal */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 12, padding: '28px', maxWidth: 360, width: '90%' }}
            >
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: 8 }}>
                Delete Chat?
              </div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
                This will permanently delete this conversation and all its messages.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setDeleteTarget(null)} style={{
                  flex: 1, padding: '10px', borderRadius: 8,
                  border: '1px solid var(--bg-border)', background: 'transparent',
                  color: 'var(--text-muted)', fontFamily: 'var(--font-display)',
                  fontWeight: 600, fontSize: 12, letterSpacing: '0.08em',
                  textTransform: 'uppercase', cursor: 'pointer',
                }}>Cancel</button>
                <button onClick={() => deleteConversation(deleteTarget)} style={{
                  flex: 1, padding: '10px', borderRadius: 8, border: 'none',
                  background: 'var(--red)', color: '#fff', fontFamily: 'var(--font-display)',
                  fontWeight: 700, fontSize: 12, letterSpacing: '0.08em',
                  textTransform: 'uppercase', cursor: 'pointer',
                }}>Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 240, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              background: 'var(--bg-surface)', borderRight: '1px solid var(--bg-border)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
            }}
          >
            <div style={{ padding: '20px 14px 12px', borderBottom: '1px solid var(--bg-border)' }}>
              <button onClick={createConversation} style={{
                width: '100%', padding: '10px 12px',
                background: 'var(--accent-glow)', border: '1px solid rgba(249,115,22,0.25)',
                borderRadius: 8, color: 'var(--accent)', fontFamily: 'var(--font-display)',
                fontWeight: 600, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 6, transition: 'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent-glow)'; e.currentTarget.style.color = 'var(--accent)' }}
              >
                <span style={{ fontSize: 16 }}>+</span> New Chat
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
              {conversations.length === 0 ? (
                <div style={{ padding: '20px 8px', fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                  No chats yet
                </div>
              ) : conversations.map(conv => (
                <div key={conv.id} style={{ position: 'relative', marginBottom: 2 }}>
                  {renamingId === conv.id ? (
                    <input
                      autoFocus value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onBlur={() => renameConversation(conv.id)}
                      onKeyDown={e => { if (e.key === 'Enter') renameConversation(conv.id); if (e.key === 'Escape') setRenamingId(null) }}
                      style={{
                        width: '100%', padding: '8px 10px', background: 'var(--bg-elevated)',
                        border: '1px solid var(--accent)', borderRadius: 6, color: 'var(--text-primary)',
                        fontFamily: 'var(--font-ui)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  ) : (
                    <div
                      onClick={() => selectConversation(conv.id)}
                      style={{
                        padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                        background: activeId === conv.id ? 'var(--accent-glow)' : 'transparent',
                        border: `1px solid ${activeId === conv.id ? 'rgba(249,115,22,0.2)' : 'transparent'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        gap: 6, transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { if (activeId !== conv.id) e.currentTarget.style.background = 'var(--bg-elevated)' }}
                      onMouseLeave={e => { if (activeId !== conv.id) e.currentTarget.style.background = 'transparent' }}
                    >
                      <span style={{
                        fontFamily: 'var(--font-ui)', fontSize: 13,
                        color: activeId === conv.id ? 'var(--accent)' : 'var(--text-secondary)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
                      }}>
                        {conv.title}
                      </span>
                      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                        <button
                          onClick={e => { e.stopPropagation(); setRenamingId(conv.id); setRenameValue(conv.title) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11, padding: '2px 4px', borderRadius: 3, transition: 'color 0.1s' }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                        >✎</button>
                        <button
                          onClick={e => { e.stopPropagation(); setDeleteTarget(conv.id) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: '2px 4px', borderRadius: 3, transition: 'color 0.1s' }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                        >×</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '20px 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexShrink: 0 }}>
          <button
            onClick={() => setSidebarOpen(o => !o)}
            style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
              borderRadius: 6, padding: '6px 10px', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: 14, transition: 'all 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >☰</button>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              Powered by Groq
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-primary)', lineHeight: 1 }}>
              {activeConversation?.title || 'AI Coach'}<span style={{ color: 'var(--accent)' }}>.</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 4, marginBottom: 16 }}>

          {loadingHistory && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1s ease-in-out infinite' }}/>
              Loading...
              <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
            </div>
          )}

          {/* Empty state */}
          {!activeId && !loadingHistory && messages.length === 0 && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }}>
              <div style={{ background: 'var(--bg-surface)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: 12, padding: '24px', marginBottom: 20 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>
                  Your personal training coach
                </div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  I have access to all your logged sessions, sets, volume, and PRs. Ask me anything — I'll give you specific, data-driven feedback.
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
                Try asking
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {SUGGESTED_PROMPTS.map((prompt, i) => (
                  <motion.button key={i}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, ease, delay: 0.1 + i * 0.05 }}
                    onClick={() => sendMessage(prompt)}
                    style={{
                      background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
                      borderRadius: 8, padding: '11px 16px', color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-ui)', fontSize: 13, textAlign: 'left',
                      cursor: 'pointer', transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.3)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bg-border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                  >
                    <span style={{ color: 'var(--accent)', fontSize: 12 }}>✦</span>
                    {prompt}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Message bubbles */}
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease }}
                style={{ display: 'flex', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', gap: 10, alignItems: 'flex-start' }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: msg.role === 'user' ? 'var(--accent-glow)' : 'var(--bg-elevated)',
                  border: `1px solid ${msg.role === 'user' ? 'rgba(249,115,22,0.3)' : 'var(--bg-border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  color: msg.role === 'user' ? 'var(--accent)' : 'var(--text-muted)',
                }}>
                  {msg.role === 'user' ? 'U' : '✦'}
                </div>
                <div style={{
                  maxWidth: '75%',
                  background: msg.role === 'user' ? 'var(--accent-glow)' : msg.error ? 'rgba(239,68,68,0.08)' : 'var(--bg-surface)',
                  border: `1px solid ${msg.role === 'user' ? 'rgba(249,115,22,0.2)' : msg.error ? 'rgba(239,68,68,0.25)' : 'var(--bg-border)'}`,
                  borderRadius: msg.role === 'user' ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                  padding: '12px 16px',
                }}>
                  <MessageContent content={msg.content} role={msg.role} />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          {loading && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}
            >
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>✦</div>
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: '4px 12px 12px 12px', padding: '14px 16px', display: 'flex', gap: 4, alignItems: 'center' }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'bounce 1.2s ease-in-out infinite', animationDelay: `${i*0.2}s` }}/>
                ))}
                <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}`}</style>
              </div>
            </motion.div>
          )}
          <div ref={bottomRef}/>
        </div>

        {/* Input */}
        <div style={{ flexShrink: 0, background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 12, padding: '4px 4px 4px 16px', display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <textarea
            ref={inputRef} value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your coach anything..."
            rows={1}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', fontSize: 14,
              lineHeight: 1.5, resize: 'none', padding: '10px 0', maxHeight: 120, overflowY: 'auto',
            }}
            onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
          />
          <motion.button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            whileHover={input.trim() && !loading ? { scale: 1.05 } : {}}
            whileTap={input.trim() && !loading ? { scale: 0.95 } : {}}
            style={{
              width: 36, height: 36, borderRadius: 8, border: 'none',
              background: input.trim() && !loading ? 'var(--accent)' : 'var(--bg-elevated)',
              color: input.trim() && !loading ? '#fff' : 'var(--text-muted)',
              cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, flexShrink: 0, marginBottom: 4, transition: 'all 0.15s',
            }}
          >↑</motion.button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
          Enter to send · Shift+Enter for new line
        </div>
      </div>
    </div>
  )
}

function MessageContent({ content, role }) {
  const lines = content.split('\n')
  return (
    <div style={{ fontFamily: 'var(--font-ui)', fontSize: 14, lineHeight: 1.65, color: role === 'user' ? 'var(--accent)' : 'var(--text-primary)' }}>
      {lines.map((line, i) => {
        const parts = line.split(/(\*\*[^*]+\*\*)/)
        return (
          <div key={i} style={{ marginBottom: line === '' ? 8 : 0 }}>
            {parts.map((part, j) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={j} style={{ fontWeight: 600 }}>{part.slice(2, -2)}</strong>
              }
              if (part.startsWith('- ') || part.startsWith('• ')) {
                return (
                  <div key={j} style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <span style={{ color: 'var(--accent)', flexShrink: 0 }}>·</span>
                    <span>{part.slice(2)}</span>
                  </div>
                )
              }
              return <span key={j}>{part}</span>
            })}
          </div>
        )
      })}
    </div>
  )
}
