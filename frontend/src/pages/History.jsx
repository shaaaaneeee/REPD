import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'

const ease = [0.16, 1, 0.3, 1]

const MUSCLE_COLORS = {
  chest: '#F97316', back: '#3B82F6', legs: '#22C55E',
  shoulders: '#A855F7', arms: '#EAB308', core: '#EC4899', cardio: '#14B8A6',
}

export default function History() {
  const { user, profile } = useAuthStore()
  const location = useLocation()
  const [sessions, setSessions]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [hasLoaded, setHasLoaded]   = useState(false)
  const [expanded, setExpanded]     = useState(null)
  const [filter, setFilter]         = useState('all')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting]     = useState(false)

  useEffect(() => {
    if (user) fetchSessions()
    else setLoading(false)
  }, [user, location.key])

  const fetchSessions = async () => {
    if (!hasLoaded) setLoading(true)
    try {
      const { data } = await supabase
        .from('sessions')
        .select(`id, name, started_at, ended_at, notes,
          sets(id, set_number, weight, reps, rpe,
            exercises(id, name, muscle_group))`)
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
      setSessions(data || [])
    } catch (err) {
      console.error('History fetch error:', err)
    } finally {
      setLoading(false)
      setHasLoaded(true)
    }
  }

  const deleteSession = async (id) => {
    setDeleting(true)
    try {
      await supabase.from('sets').delete().eq('session_id', id)
      await supabase.from('sessions').delete().eq('id', id)
      setSessions(prev => prev.filter(s => s.id !== id))
      if (expanded === id) setExpanded(null)
    } catch (e) {
      console.error('Delete failed:', e)
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const getSessionMuscles = (session) => {
    const muscles = new Set()
    session.sets?.forEach(s => { if (s.exercises?.muscle_group) muscles.add(s.exercises.muscle_group) })
    return [...muscles]
  }

  const getExercisesFromSession = (session) => {
    const map = {}
    session.sets?.forEach(s => {
      const id = s.exercises?.id
      if (!id) return
      if (!map[id]) map[id] = { name: s.exercises.name, muscle_group: s.exercises.muscle_group, sets: [] }
      map[id].sets.push(s)
    })
    return Object.values(map)
  }

  const getDuration = (started, ended) => {
    if (!ended) return null
    const mins = Math.round((new Date(ended) - new Date(started)) / 60000)
    if (mins < 60) return `${mins}m`
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
  }

  const getVolume = (session) =>
    session.sets?.reduce((acc, s) => acc + ((parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0)), 0) || 0

  const formatVolume = (v) => {
    if (!v) return '0'
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
    return Math.round(v).toString()
  }

  const MUSCLE_OPTIONS = ['all', 'chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio']
  const filtered = filter === 'all' ? sessions : sessions.filter(s => getSessionMuscles(s).includes(filter))
  const deleteTargetSession = sessions.find(s => s.id === deleteTarget)

  if (loading && !hasLoaded) return <LoadingState />

  return (
    <div>
      {/* Confirm delete modal */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 100,
              background: 'rgba(0,0,0,0.6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={() => !deleting && setDeleteTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
                borderRadius: 12, padding: '28px', maxWidth: 380, width: '90%',
              }}
            >
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: 8 }}>
                Delete Session?
              </div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--text-primary)' }}>{deleteTargetSession?.name || 'This workout'}</strong> will be permanently deleted along with all its sets and data.
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 24 }}>
                This cannot be undone.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setDeleteTarget(null)} disabled={deleting} style={{
                  flex: 1, padding: '11px', borderRadius: 8,
                  border: '1px solid var(--bg-border)', background: 'transparent',
                  color: 'var(--text-muted)', fontFamily: 'var(--font-display)',
                  fontWeight: 600, fontSize: 12, letterSpacing: '0.08em',
                  textTransform: 'uppercase', cursor: 'pointer',
                }}>
                  Cancel
                </button>
                <button onClick={() => deleteSession(deleteTarget)} disabled={deleting} style={{
                  flex: 1, padding: '11px', borderRadius: 8,
                  border: 'none', background: 'var(--red)', color: '#fff',
                  fontFamily: 'var(--font-display)', fontWeight: 700,
                  fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                }}>
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6 }}>
          {sessions.length} sessions total
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-primary)', lineHeight: 1 }}>
          History<span style={{ color: 'var(--accent)' }}>.</span>
        </h1>
      </motion.div>

      {/* Filter pills */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease, delay: 0.08 }}
        style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
        {MUSCLE_OPTIONS.map(m => (
          <button key={m} onClick={() => setFilter(m)} style={{
            padding: '5px 12px', borderRadius: 20,
            border: `1px solid ${filter === m ? (MUSCLE_COLORS[m] || 'var(--accent)') : 'var(--bg-border)'}`,
            background: filter === m ? `${MUSCLE_COLORS[m] || 'var(--accent)'}18` : 'transparent',
            color: filter === m ? (MUSCLE_COLORS[m] || 'var(--accent)') : 'var(--text-muted)',
            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em',
            textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.15s',
          }}>
            {m}
          </button>
        ))}
      </motion.div>

      {/* Sessions list */}
      {filtered.length === 0 ? <EmptyState /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((session, i) => {
            const isOpen = expanded === session.id
            const muscles = getSessionMuscles(session)
            const exercises = getExercisesFromSession(session)
            const volume = getVolume(session)
            const duration = getDuration(session.started_at, session.ended_at)

            return (
              <motion.div key={session.id}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease, delay: Math.min(i * 0.04, 0.3) }}
                style={{
                  background: 'var(--bg-surface)',
                  border: `1px solid ${isOpen ? 'rgba(249,115,22,0.25)' : 'var(--bg-border)'}`,
                  borderRadius: 12, overflow: 'hidden', transition: 'border-color 0.15s',
                }}
              >
                {/* Session row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', cursor: 'pointer' }}
                  onClick={() => setExpanded(isOpen ? null : session.id)}
                >
                  {/* Date block */}
                  <div style={{ minWidth: 44, textAlign: 'center', background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 6px', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>
                      {new Date(session.started_at).getDate()}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 }}>
                      {new Date(session.started_at).toLocaleDateString('en-US', { month: 'short' })}
                    </div>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {session.name || 'Workout'}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {muscles.map(m => (
                        <span key={m} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: MUSCLE_COLORS[m] || '#888', background: `${MUSCLE_COLORS[m] || '#888'}18`, border: `1px solid ${MUSCLE_COLORS[m] || '#888'}40`, borderRadius: 4, padding: '2px 6px' }}>
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'flex', gap: 20, flexShrink: 0, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{exercises.length}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>exer.</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{session.sets?.length || 0}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>sets</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{formatVolume(volume)}{profile?.unit_pref || 'kg'}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>vol.</div>
                    </div>
                    {duration && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{duration}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>time</div>
                      </div>
                    )}

                    {/* Delete button */}
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteTarget(session.id) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, padding: '4px 6px', borderRadius: 4, transition: 'color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                      title="Delete session"
                    >
                      ×
                    </button>

                    {/* Expand chevron */}
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', marginLeft: 4 }}
                      onClick={e => { e.stopPropagation(); setExpanded(isOpen ? null : session.id) }}
                    >▼</div>
                  </div>
                </div>

                {/* Expanded detail */}
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div key="detail"
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease }} style={{ overflow: 'hidden' }}
                    >
                      <div style={{ borderTop: '1px solid var(--bg-border)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {exercises.map(ex => (
                          <div key={ex.name}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: MUSCLE_COLORS[ex.muscle_group] || 'var(--accent)', background: `${MUSCLE_COLORS[ex.muscle_group] || 'var(--accent)'}18`, border: `1px solid ${MUSCLE_COLORS[ex.muscle_group] || 'var(--accent)'}40`, borderRadius: 4, padding: '2px 6px' }}>
                                {ex.muscle_group}
                              </span>
                              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{ex.name}</span>
                            </div>
                            <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, overflow: 'hidden' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr', gap: 8, padding: '8px 14px', borderBottom: '1px solid var(--bg-border)' }}>
                                {['Set', 'Weight', 'Reps', 'RPE'].map(h => (
                                  <div key={h} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{h}</div>
                                ))}
                              </div>
                              {ex.sets.sort((a, b) => a.set_number - b.set_number).map((s, si) => (
                                <div key={si} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr', gap: 8, padding: '8px 14px', borderBottom: si < ex.sets.length - 1 ? '1px solid var(--bg-border)' : 'none' }}>
                                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)', fontWeight: 500 }}>{s.set_number}</div>
                                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>{s.weight ? `${s.weight}${profile?.unit_pref || 'kg'}` : '—'}</div>
                                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>{s.reps || '—'}</div>
                                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{s.rpe || '—'}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px dashed var(--bg-border)', borderRadius: 10, padding: '60px 20px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>No sessions found</div>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-muted)' }}>Try a different filter or log your first session</div>
    </div>
  )
}

function LoadingState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[...Array(5)].map((_, i) => (
        <div key={i} style={{ height: 72, background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 12, animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.08}s` }}/>
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )
}
