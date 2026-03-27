import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'

const ease = [0.16, 1, 0.3, 1]

const MUSCLE_COLORS = {
  chest: '#F97316', back: '#3B82F6', legs: '#22C55E',
  shoulders: '#A855F7', arms: '#EAB308', core: '#EC4899', cardio: '#14B8A6',
}

const QUICK_NAMES = [
  'Push Day', 'Pull Day', 'Leg Day',
  'Upper Body', 'Lower Body', 'Full Body', 'Cardio',
]

export default function LogSession() {
  const { user, profile } = useAuthStore()
  const navigate  = useNavigate()
  const location  = useLocation()

  const [started, setStarted]           = useState(false)
  const [sessionName, setSessionName]   = useState('')
  const [exercises, setExercises]       = useState([])
  const [allExercises, setAllExercises] = useState([])
  const [search, setSearch]             = useState('')
  const [showSearch, setShowSearch]     = useState(false)
  const [saving, setSaving]             = useState(false)
  const [startTime, setStartTime]       = useState(null)
  const [elapsed, setElapsed]           = useState(0)
  const searchRef                       = useRef(null)

  // Timer — only runs after started
  useEffect(() => {
    if (!started || !startTime) return
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000)
    return () => clearInterval(t)
  }, [started, startTime])

  // Load exercise library
  useEffect(() => {
    const fetchExercises = async () => {
      const { data, error } = await supabase
        .from('exercises').select('*').order('muscle_group')
      if (error) console.error('Exercise fetch error:', error.message)
      setAllExercises(data || [])
    }
    fetchExercises()
  }, [location.key])

  // Close search on outside click
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowSearch(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleStart = () => {
    setStartTime(new Date())
    setStarted(true)
  }

  const formatElapsed = (s) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  const filteredExercises = allExercises.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.muscle_group.toLowerCase().includes(search.toLowerCase())
  )

  const addExercise = (exercise) => {
    if (exercises.find(e => e.exercise_id === exercise.id)) { setShowSearch(false); setSearch(''); return }
    setExercises(prev => [...prev, {
      exercise_id: exercise.id, name: exercise.name,
      muscle_group: exercise.muscle_group,
      sets: [{ set_number: 1, reps: '', weight: '', rpe: '' }],
    }])
    setShowSearch(false); setSearch('')
  }

  const addSet = (exIdx) => {
    setExercises(prev => prev.map((ex, i) => i !== exIdx ? ex : {
      ...ex, sets: [...ex.sets, { set_number: ex.sets.length + 1, reps: '', weight: '', rpe: '' }],
    }))
  }

  const removeSet = (exIdx, setIdx) => {
    setExercises(prev => prev.map((ex, i) => i !== exIdx ? ex : {
      ...ex, sets: ex.sets.filter((_, si) => si !== setIdx).map((s, si) => ({ ...s, set_number: si + 1 })),
    }))
  }

  const updateSet = (exIdx, setIdx, field, value) => {
    setExercises(prev => prev.map((ex, i) => i !== exIdx ? ex : {
      ...ex, sets: ex.sets.map((s, si) => si === setIdx ? { ...s, [field]: value } : s),
    }))
  }

  const removeExercise = (exIdx) => setExercises(prev => prev.filter((_, i) => i !== exIdx))

  const finishSession = async () => {
    if (exercises.length === 0) return
    setSaving(true)
    try {
      const { data: session, error: sessionErr } = await supabase
        .from('sessions')
        .insert({
          user_id:    user.id,
          name:       sessionName || `Workout — ${new Date().toLocaleDateString('en-US', { weekday: 'long' })}`,
          started_at: startTime.toISOString(),
          ended_at:   new Date().toISOString(),
        })
        .select().single()
      if (sessionErr) throw sessionErr

      const setsToInsert = exercises.flatMap(ex =>
        ex.sets.filter(s => s.reps || s.weight).map(s => ({
          session_id: session.id, exercise_id: ex.exercise_id,
          set_number: s.set_number,
          reps:   s.reps   ? parseInt(s.reps)    : null,
          weight: s.weight ? parseFloat(s.weight) : null,
          rpe:    s.rpe    ? parseFloat(s.rpe)    : null,
        }))
      )

      if (setsToInsert.length > 0) {
        const { error: setsErr } = await supabase.from('sets').insert(setsToInsert)
        if (setsErr) throw setsErr
      }

      await updatePRs(session.id)
      navigate('/')
    } catch (err) {
      console.error('Error saving session:', err)
      alert('Error saving session: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const updatePRs = async (sid) => {
    try {
      const { data: sets } = await supabase.from('sets').select('*').eq('session_id', sid)
      for (const s of (sets || [])) {
        if (!s.weight || !s.reps) continue
        const estimated1RM = s.weight * (1 + s.reps / 30)
        await supabase.from('personal_records').upsert({
          user_id: user.id, exercise_id: s.exercise_id, record_type: '1rm',
          value: estimated1RM, achieved_at: new Date().toISOString(), set_id: s.id,
        }, { onConflict: 'user_id,exercise_id,record_type' })
      }
    } catch (e) {
      console.warn('PR update failed:', e.message)
    }
  }

  const totalSets   = exercises.reduce((acc, ex) => acc + ex.sets.length, 0)
  const totalVolume = exercises.reduce((acc, ex) =>
    acc + ex.sets.reduce((a, s) => a + ((parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0)), 0), 0)
  const unit = profile?.unit_pref || 'kg'

  // ── Pre-start screen ────────────────────────────────
  if (!started) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
        >
          {/* Header */}
          <div style={{ marginBottom: 36 }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: 'var(--text-muted)', letterSpacing: '0.15em',
              textTransform: 'uppercase', marginBottom: 6,
            }}>
              Ready to train?
            </div>
            <h1 style={{
              fontFamily: 'var(--font-display)', fontSize: 36,
              fontWeight: 700, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: 'var(--text-primary)', lineHeight: 1,
            }}>
              New Session<span style={{ color: 'var(--accent)' }}>.</span>
            </h1>
          </div>

          {/* Session name */}
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
            borderRadius: 12, padding: '24px', marginBottom: 16,
          }}>
            <label style={{
              display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'var(--text-muted)', marginBottom: 10,
            }}>
              Session Name
            </label>
            <input
              value={sessionName}
              onChange={e => setSessionName(e.target.value)}
              placeholder="e.g. Push Day, Monday Chest..."
              style={{
                width: '100%', padding: '12px 14px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--bg-border)',
                borderRadius: 8, color: 'var(--text-primary)',
                fontFamily: 'var(--font-display)', fontSize: 16,
                fontWeight: 600, letterSpacing: '0.04em',
                outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--bg-border)'}
            />

            {/* Quick name pills */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
              {QUICK_NAMES.map(name => (
                <button
                  key={name}
                  onClick={() => setSessionName(name)}
                  style={{
                    padding: '4px 10px', borderRadius: 20,
                    border: `1px solid ${sessionName === name ? 'var(--accent)' : 'var(--bg-border)'}`,
                    background: sessionName === name ? 'var(--accent-glow)' : 'transparent',
                    color: sessionName === name ? 'var(--accent)' : 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)', fontSize: 10,
                    letterSpacing: '0.08em', cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Start button */}
          <motion.button
            onClick={handleStart}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{
              width: '100%', padding: '18px',
              background: 'var(--accent)', color: '#fff',
              border: 'none', borderRadius: 12,
              fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: 18, letterSpacing: '0.12em',
              textTransform: 'uppercase', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}
          >
            <span style={{ fontSize: 20 }}>▶</span>
            Start Session
          </motion.button>

          <button
            onClick={() => navigate('/')}
            style={{
              width: '100%', marginTop: 10, padding: '12px',
              background: 'transparent', border: 'none',
              color: 'var(--text-muted)', fontFamily: 'var(--font-ui)',
              fontSize: 13, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </motion.div>
      </div>
    )
  }

  // ── Active session screen ────────────────────────────
  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease }}
        style={{
          display: 'flex', alignItems: 'flex-start',
          justifyContent: 'space-between', marginBottom: 28, gap: 16, flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)',
            letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{
              display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
              background: '#22C55E', boxShadow: '0 0 6px #22C55E',
            }}/>
            Session in progress — {formatElapsed(elapsed)}
          </div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700,
            letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-primary)',
          }}>
            {sessionName || 'Workout'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <MiniStat label="Exercises" value={exercises.length} />
          <MiniStat label="Sets" value={totalSets} />
          <MiniStat label="Volume" value={totalVolume > 0 ? `${Math.round(totalVolume)}${unit}` : '—'} />
        </div>
      </motion.div>

      {/* Exercise blocks */}
      <AnimatePresence>
        {exercises.map((ex, exIdx) => (
          <motion.div
            key={ex.exercise_id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.3, ease }}
            style={{
              background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
              borderRadius: 12, marginBottom: 12, overflow: 'hidden',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px', borderBottom: '1px solid var(--bg-border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: MUSCLE_COLORS[ex.muscle_group] || 'var(--accent)',
                  background: `${MUSCLE_COLORS[ex.muscle_group] || 'var(--accent)'}18`,
                  border: `1px solid ${MUSCLE_COLORS[ex.muscle_group] || 'var(--accent)'}40`,
                  borderRadius: 4, padding: '2px 6px',
                }}>
                  {ex.muscle_group}
                </span>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
                  {ex.name}
                </span>
              </div>
              <button onClick={() => removeExercise(exIdx)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: 18, lineHeight: 1,
                padding: '2px 6px', borderRadius: 4, transition: 'color 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              >×</button>
            </div>

            <div style={{ padding: '12px 18px' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '32px 1fr 1fr 1fr 28px',
                gap: 8, marginBottom: 6, padding: '0 4px',
              }}>
                {['SET', 'WEIGHT', 'REPS', 'RPE', ''].map((h, i) => (
                  <div key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em', color: 'var(--text-muted)' }}>
                    {h}
                  </div>
                ))}
              </div>

              <AnimatePresence>
                {ex.sets.map((set, setIdx) => (
                  <motion.div key={setIdx}
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}
                    style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 1fr 28px', gap: 8, marginBottom: 6, alignItems: 'center' }}
                  >
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500, color: 'var(--accent)', textAlign: 'center' }}>
                      {set.set_number}
                    </div>
                    <SetInput value={set.weight} onChange={v => updateSet(exIdx, setIdx, 'weight', v)} placeholder={unit} type="number" />
                    <SetInput value={set.reps}   onChange={v => updateSet(exIdx, setIdx, 'reps', v)}   placeholder="reps" type="number" />
                    <SetInput value={set.rpe}    onChange={v => updateSet(exIdx, setIdx, 'rpe', v)}    placeholder="1-10" type="number" step="0.5" max="10" />
                    <button onClick={() => removeSet(exIdx, setIdx)} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', fontSize: 14, lineHeight: 1,
                      padding: '4px', borderRadius: 4, transition: 'color 0.15s',
                      visibility: ex.sets.length > 1 ? 'visible' : 'hidden',
                    }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >×</button>
                  </motion.div>
                ))}
              </AnimatePresence>

              <button onClick={() => addSet(exIdx)} style={{
                marginTop: 6, width: '100%', padding: '8px',
                background: 'transparent', border: '1px dashed var(--bg-border)',
                borderRadius: 8, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
                fontSize: 11, letterSpacing: '0.1em', cursor: 'pointer',
                transition: 'border-color 0.15s, color 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bg-border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
              >
                + ADD SET
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Add exercise */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease, delay: 0.2 }}
        style={{ position: 'relative', marginBottom: 24 }}
        ref={searchRef}
      >
        <button
          onClick={() => { setShowSearch(true); setTimeout(() => document.getElementById('ex-search')?.focus(), 50) }}
          style={{
            width: '100%', padding: '14px',
            background: showSearch ? 'var(--bg-surface)' : 'var(--bg-elevated)',
            border: `1px solid ${showSearch ? 'var(--accent)' : 'var(--bg-border)'}`,
            borderRadius: showSearch ? '10px 10px 0 0' : 10,
            color: 'var(--text-secondary)', fontFamily: 'var(--font-display)',
            fontSize: 13, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
            cursor: 'pointer', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <span style={{ fontSize: 18, color: 'var(--accent)', lineHeight: 1 }}>+</span>
          Add Exercise
        </button>

        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
              style={{
                position: 'absolute', top: '100%', left: 0, right: 0,
                background: 'var(--bg-surface)', border: '1px solid var(--accent)',
                borderTop: 'none', borderRadius: '0 0 10px 10px',
                zIndex: 50, maxHeight: 320, overflow: 'hidden', display: 'flex', flexDirection: 'column',
              }}
            >
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--bg-border)' }}>
                <input
                  id="ex-search" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search exercises or muscle group..."
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--text-primary)' }}
                />
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {filteredExercises.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-muted)' }}>
                    No exercises found
                  </div>
                ) : filteredExercises.map(ex => (
                  <div key={ex.id} onClick={() => addExercise(ex)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 16px', cursor: 'pointer', transition: 'background 0.1s',
                    borderBottom: '1px solid var(--bg-border)',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: exercises.find(e => e.exercise_id === ex.id) ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                      {ex.name}
                      {exercises.find(e => e.exercise_id === ex.id) && (
                        <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--accent)' }}>✓ added</span>
                      )}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: MUSCLE_COLORS[ex.muscle_group] || 'var(--text-muted)' }}>
                      {ex.muscle_group}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Finish / Discard */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease, delay: 0.3 }}
        style={{ display: 'flex', gap: 10 }}
      >
        <button onClick={() => navigate('/')} style={{
          flex: '0 0 auto', padding: '13px 20px',
          background: 'transparent', border: '1px solid var(--bg-border)',
          borderRadius: 8, color: 'var(--text-muted)',
          fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13,
          letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--red)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--bg-border)'}
        >
          Discard
        </button>

        <motion.button
          onClick={finishSession} disabled={saving || exercises.length === 0}
          whileHover={!saving && exercises.length > 0 ? { scale: 1.01 } : {}}
          whileTap={!saving && exercises.length > 0 ? { scale: 0.99 } : {}}
          style={{
            flex: 1, padding: '13px',
            background: exercises.length === 0 ? 'var(--bg-elevated)' : 'var(--accent)',
            color: exercises.length === 0 ? 'var(--text-muted)' : '#fff',
            border: 'none', borderRadius: 8,
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            cursor: exercises.length === 0 ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
          }}
        >
          {saving ? 'Saving…' : `Finish Session · ${formatElapsed(elapsed)}`}
        </motion.button>
      </motion.div>
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 3 }}>
        {label}
      </div>
    </div>
  )
}

function SetInput({ value, onChange, placeholder, type = 'text', step, max }) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      placeholder={placeholder} step={step} max={max} min="0"
      style={{
        width: '100%', padding: '8px 10px',
        background: focused ? 'var(--bg-elevated)' : 'var(--bg-base)',
        border: `1px solid ${focused ? 'var(--accent)' : 'var(--bg-border)'}`,
        borderRadius: 6, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)',
        fontSize: 13, outline: 'none', transition: 'all 0.15s', textAlign: 'center',
      }}
    />
  )
}
