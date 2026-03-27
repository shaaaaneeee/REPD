import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, BarChart, Bar
} from 'recharts'

const ease = [0.16, 1, 0.3, 1]

const MUSCLE_COLORS = {
  chest: '#F97316', back: '#3B82F6', legs: '#22C55E',
  shoulders: '#A855F7', arms: '#EAB308', core: '#EC4899', cardio: '#14B8A6',
}

export default function Progress() {
  const { user, profile } = useAuthStore()
  const location = useLocation()

  const [prs, setPrs]               = useState([])
  const [volumeData, setVolumeData] = useState([])
  const [exercises, setExercises]   = useState([])
  const [selectedEx, setSelectedEx] = useState(null)
  const [strengthData, setStrengthData] = useState([])
  const [loading, setLoading]       = useState(true)
  const [hasLoaded, setHasLoaded]   = useState(false)

  useEffect(() => {
    if (user) fetchAll()
    else setLoading(false)
  }, [user, location.key])

  const fetchAll = async () => {
    if (!hasLoaded) setLoading(true)
    try {
      await Promise.all([fetchPRs(), fetchVolumeHistory(), fetchExerciseList()])
    } catch (err) {
      console.error('Progress fetch error:', err)
    } finally {
      setLoading(false)
      setHasLoaded(true)
    }
  }

  const fetchPRs = async () => {
    const { data } = await supabase
      .from('personal_records')
      .select('*, exercises(name, muscle_group)')
      .eq('user_id', user.id)
      .order('value', { ascending: false })
    setPrs(data || [])
  }

  const fetchVolumeHistory = async () => {
    const { data } = await supabase
      .from('sessions')
      .select(`id, started_at, sets(weight, reps)`)
      .eq('user_id', user.id)
      .order('started_at', { ascending: true })
      .limit(30)

    const formatted = (data || []).map(s => ({
      date: new Date(s.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      volume: Math.round(
        s.sets?.reduce((acc, set) =>
          acc + ((parseFloat(set.weight) || 0) * (parseInt(set.reps) || 0)), 0) || 0
      ),
    }))
    setVolumeData(formatted)
  }

  const fetchExerciseList = async () => {
    const { data } = await supabase
      .from('sets')
      .select('exercise_id, exercises(id, name, muscle_group), sessions!inner(user_id)')
      .eq('sessions.user_id', user.id)

    const seen = {}
    ;(data || []).forEach(s => {
      const ex = s.exercises
      if (ex && !seen[ex.id]) seen[ex.id] = ex
    })
    const list = Object.values(seen)
    setExercises(list)
    if (list.length > 0 && !selectedEx) {
      setSelectedEx(list[0].id)
      fetchStrengthCurve(list[0].id)
    }
  }

  const fetchStrengthCurve = async (exerciseId) => {
    const { data } = await supabase
      .from('sets')
      .select('weight, reps, created_at, sessions!inner(user_id, started_at)')
      .eq('exercise_id', exerciseId)
      .eq('sessions.user_id', user.id)
      .order('sessions.started_at', { ascending: true })

    const byDate = {}
    ;(data || []).forEach(s => {
      const date = new Date(s.sessions?.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const estimated1rm = (parseFloat(s.weight) || 0) * (1 + (parseInt(s.reps) || 0) / 30)
      if (!byDate[date] || estimated1rm > byDate[date]) {
        byDate[date] = estimated1rm
      }
    })

    setStrengthData(Object.entries(byDate).map(([date, orm]) => ({
      date,
      '1RM': Math.round(orm * 10) / 10,
    })))
  }

  const handleSelectExercise = (id) => {
    setSelectedEx(id)
    fetchStrengthCurve(id)
  }

  const selectedExercise = exercises.find(e => e.id === selectedEx)

  if (loading && !hasLoaded) return <LoadingState />

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        style={{ marginBottom: 32 }}
      >
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--text-muted)', letterSpacing: '0.15em',
          textTransform: 'uppercase', marginBottom: 6,
        }}>
          Lifetime stats
        </div>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 36,
          fontWeight: 700, letterSpacing: '0.06em',
          textTransform: 'uppercase', color: 'var(--text-primary)', lineHeight: 1,
        }}>
          Progress<span style={{ color: 'var(--accent)' }}>.</span>
        </h1>
      </motion.div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Volume history chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease, delay: 0.08 }}
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--bg-border)',
            borderRadius: 12, padding: '24px',
          }}
        >
          <ChartHeader title="Volume Per Session" sub="kg lifted" />
          {volumeData.length < 2 ? (
            <NotEnoughData />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={volumeData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2E" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontFamily: 'JetBrains Mono', fontSize: 10, fill: '#5A5856' }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fontFamily: 'JetBrains Mono', fontSize: 10, fill: '#5A5856' }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip content={<CustomTooltip unit="kg" />} />
                <Bar dataKey="volume" fill="#F97316" radius={[4, 4, 0, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Strength curve */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease, delay: 0.14 }}
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--bg-border)',
            borderRadius: 12, padding: '24px',
          }}
        >
          <div style={{
            display: 'flex', alignItems: 'flex-start',
            justifyContent: 'space-between', gap: 16,
            flexWrap: 'wrap', marginBottom: 20,
          }}>
            <ChartHeader
              title="Strength Curve"
              sub={selectedExercise ? `estimated 1RM — ${selectedExercise.name}` : 'estimated 1RM'}
            />
            {/* Exercise selector */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {exercises.slice(0, 8).map(ex => (
                <button
                  key={ex.id}
                  onClick={() => handleSelectExercise(ex.id)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 20,
                    border: `1px solid ${selectedEx === ex.id
                      ? (MUSCLE_COLORS[ex.muscle_group] || 'var(--accent)')
                      : 'var(--bg-border)'}`,
                    background: selectedEx === ex.id
                      ? `${MUSCLE_COLORS[ex.muscle_group] || 'var(--accent)'}18`
                      : 'transparent',
                    color: selectedEx === ex.id
                      ? (MUSCLE_COLORS[ex.muscle_group] || 'var(--accent)')
                      : 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    letterSpacing: '0.08em',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {ex.name}
                </button>
              ))}
            </div>
          </div>

          {strengthData.length < 2 ? (
            <NotEnoughData message="Log this exercise at least twice to see a trend" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={strengthData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2E" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontFamily: 'JetBrains Mono', fontSize: 10, fill: '#5A5856' }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fontFamily: 'JetBrains Mono', fontSize: 10, fill: '#5A5856' }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip content={<CustomTooltip unit="kg 1RM" />} />
                <Line
                  type="monotone" dataKey="1RM"
                  stroke={MUSCLE_COLORS[selectedExercise?.muscle_group] || '#F97316'}
                  strokeWidth={2} dot={{ r: 3, fill: MUSCLE_COLORS[selectedExercise?.muscle_group] || '#F97316' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Personal Records */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease, delay: 0.2 }}
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--bg-border)',
            borderRadius: 12, padding: '24px',
          }}
        >
          <ChartHeader title="Personal Records" sub="estimated 1RM" />

          {prs.length === 0 ? (
            <NotEnoughData message="Log sessions to start tracking PRs" />
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 10, marginTop: 16,
            }}>
              {prs.map(pr => {
                const color = MUSCLE_COLORS[pr.exercises?.muscle_group] || 'var(--accent)'
                return (
                  <div key={pr.id} style={{
                    background: 'var(--bg-elevated)',
                    border: `1px solid ${color}25`,
                    borderRadius: 10, padding: '14px 16px',
                    position: 'relative', overflow: 'hidden',
                  }}>
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                      background: color, opacity: 0.6,
                    }}/>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9,
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                      color, marginBottom: 6,
                    }}>
                      {pr.exercises?.muscle_group}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-ui)', fontSize: 13,
                      fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8,
                    }}>
                      {pr.exercises?.name}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-display)', fontSize: 26,
                      fontWeight: 700, color, lineHeight: 1,
                    }}>
                      {Math.round(pr.value * 10) / 10}
                      <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginLeft: 4 }}>
                        {profile?.unit_pref || 'kg'}
                      </span>
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9,
                      color: 'var(--text-muted)', marginTop: 6, letterSpacing: '0.06em',
                    }}>
                      {new Date(pr.achieved_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric'
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}

function ChartHeader({ title, sub }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <span style={{
        fontFamily: 'var(--font-display)', fontSize: 14,
        fontWeight: 600, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'var(--text-primary)',
      }}>
        {title}
      </span>
      {sub && (
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10,
          color: 'var(--text-muted)', letterSpacing: '0.1em', marginLeft: 8,
        }}>
          {sub}
        </span>
      )}
    </div>
  )
}

function CustomTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--bg-border)',
      borderRadius: 8, padding: '8px 12px',
    }}>
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5A5856', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 13, color: '#F97316', fontWeight: 500 }}>
        {payload[0].value} {unit}
      </div>
    </div>
  )
}

function NotEnoughData({ message = 'Log more sessions to see this chart' }) {
  return (
    <div style={{
      height: 100, display: 'flex', alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        fontFamily: 'var(--font-ui)', fontSize: 13,
        color: 'var(--text-muted)', textAlign: 'center',
      }}>
        {message}
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {[...Array(3)].map((_, i) => (
        <div key={i} style={{
          height: 200, background: 'var(--bg-surface)',
          border: '1px solid var(--bg-border)', borderRadius: 12,
          animation: 'pulse 1.5s ease-in-out infinite',
          animationDelay: `${i * 0.1}s`,
        }}/>
      ))}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  )
}
