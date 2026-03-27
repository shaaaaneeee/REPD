import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'

const ease = [0.16, 1, 0.3, 1]

const MUSCLE_COLORS = {
  chest:     '#F97316',
  back:      '#3B82F6',
  legs:      '#22C55E',
  shoulders: '#A855F7',
  arms:      '#EAB308',
  core:      '#EC4899',
  cardio:    '#14B8A6',
}

export default function Dashboard() {
  const { profile, user } = useAuthStore()
  const location = useLocation()
  const [stats, setStats]         = useState(null)
  const [sessions, setSessions]   = useState([])
  const [frequency, setFrequency] = useState([])
  const [loading, setLoading]     = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)

  useEffect(() => {
    if (user) fetchDashboard()
    else setLoading(false)
  }, [user, location.key])

  const fetchDashboard = async () => {
    if (!hasLoaded) setLoading(true)
    try {
      await Promise.all([fetchStats(), fetchRecentSessions(), fetchMuscleFrequency()])
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
      setHasLoaded(true)
    }
  }

  const fetchStats = async () => {
    const { count: totalSessions } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    const { data: setsData } = await supabase
      .from('sets')
      .select('weight, reps, session_id, sessions!inner(user_id)')
      .eq('sessions.user_id', user.id)

    const totalVolume = (setsData || []).reduce((acc, s) => {
      return acc + ((s.weight || 0) * (s.reps || 0))
    }, 0)

    const { data: sessionDates } = await supabase
      .from('sessions')
      .select('started_at')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })

    const streak = calcStreak(sessionDates || [])

    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const { count: weekSessions } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('started_at', weekAgo.toISOString())

    setStats({ totalSessions, totalVolume, streak, weekSessions })
  }

  const fetchRecentSessions = async () => {
    const { data } = await supabase
      .from('sessions')
      .select(`
        id, name, started_at, ended_at,
        sets(id, weight, reps, exercise_id,
          exercises(name, muscle_group))
      `)
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(5)

    setSessions(data || [])
  }

  const fetchMuscleFrequency = async () => {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    const { data } = await supabase
      .from('sets')
      .select(`
        exercises(muscle_group),
        sessions!inner(user_id, started_at)
      `)
      .eq('sessions.user_id', user.id)
      .gte('sessions.started_at', weekAgo.toISOString())

    const counts = {}
    ;(data || []).forEach(s => {
      const mg = s.exercises?.muscle_group
      if (mg) counts[mg] = (counts[mg] || 0) + 1
    })

    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1
    const sorted = Object.entries(counts)
      .map(([muscle, count]) => ({ muscle, count, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count)

    setFrequency(sorted)
  }

  const calcStreak = (sessions) => {
    if (!sessions.length) return 0
    const days = [...new Set(sessions.map(s =>
      new Date(s.started_at).toDateString()
    ))]
    let streak = 0
    const today = new Date()
    for (let i = 0; i < 365; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      if (days.includes(d.toDateString())) streak++
      else if (i > 0) break
    }
    return streak
  }

  const formatVolume = (v) => {
    if (!v) return '0'
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
    return Math.round(v).toString()
  }

  const getDuration = (started, ended) => {
    if (!ended) return null
    const mins = Math.round((new Date(ended) - new Date(started)) / 60000)
    if (mins < 60) return `${mins}m`
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
  }

  const getSessionMuscles = (session) => {
    const muscles = new Set()
    session.sets?.forEach(s => {
      if (s.exercises?.muscle_group) muscles.add(s.exercises.muscle_group)
    })
    return [...muscles]
  }

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

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
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text-muted)',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          marginBottom: 6,
        }}>
          {getGreeting()}
        </div>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 36,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--text-primary)',
          lineHeight: 1,
        }}>
          {profile?.full_name?.split(' ')[0] || 'Athlete'}
          <span style={{ color: 'var(--accent)' }}>.</span>
        </h1>
      </motion.div>

      {/* Stats row */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease, delay: 0.08 }}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 32,
        }}
      >
        <StatCard label="Total Sessions" value={stats?.totalSessions ?? 0} unit="sessions" />
        <StatCard label="This Week"      value={stats?.weekSessions ?? 0}  unit="sessions" accent />
        <StatCard label="Total Volume"   value={formatVolume(stats?.totalVolume)} unit={profile?.unit_pref || 'kg'} />
        <StatCard label="Current Streak" value={stats?.streak ?? 0} unit="days" highlight={stats?.streak > 0} />
      </motion.div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>

        {/* Recent sessions */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease, delay: 0.16 }}
        >
          <SectionHeader title="Recent Sessions" action={sessions.length > 0 ? 'View All' : null} actionHref="/history" />

          {sessions.length === 0 ? (
            <EmptyState
              message="No sessions logged yet"
              sub="Head to Log Session to record your first workout"
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sessions.map((session, i) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, ease, delay: 0.2 + i * 0.06 }}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--bg-border)',
                    borderRadius: 10,
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    cursor: 'pointer',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(249,115,22,0.3)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--bg-border)'}
                >
                  {/* Date block */}
                  <div style={{
                    minWidth: 44,
                    textAlign: 'center',
                    background: 'var(--bg-elevated)',
                    borderRadius: 8,
                    padding: '8px 6px',
                  }}>
                    <div style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 20,
                      fontWeight: 700,
                      color: 'var(--accent)',
                      lineHeight: 1,
                    }}>
                      {new Date(session.started_at).getDate()}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      color: 'var(--text-muted)',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      marginTop: 2,
                    }}>
                      {new Date(session.started_at).toLocaleDateString('en-US', { month: 'short' })}
                    </div>
                  </div>

                  {/* Session info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'var(--font-ui)',
                      fontSize: 14,
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      marginBottom: 4,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {session.name || 'Workout'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {getSessionMuscles(session).slice(0, 4).map(m => (
                        <MuscleTag key={m} muscle={m} />
                      ))}
                    </div>
                  </div>

                  {/* Right side */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                    }}>
                      {session.sets?.length || 0} sets
                    </div>
                    {getDuration(session.started_at, session.ended_at) && (
                      <div style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        color: 'var(--text-muted)',
                        marginTop: 2,
                      }}>
                        {getDuration(session.started_at, session.ended_at)}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Right column */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease, delay: 0.24 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
        >
          {/* Muscle frequency */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--bg-border)',
            borderRadius: 10,
            padding: '20px',
          }}>
            <SectionHeader title="This Week" sub="Muscle groups" />

            {frequency.length === 0 ? (
              <div style={{
                fontFamily: 'var(--font-ui)',
                fontSize: 13,
                color: 'var(--text-muted)',
                textAlign: 'center',
                padding: '20px 0',
              }}>
                No data yet
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                {frequency.map(({ muscle, pct }) => (
                  <div key={muscle}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 4,
                    }}>
                      <span style={{
                        fontFamily: 'var(--font-ui)',
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                        textTransform: 'capitalize',
                      }}>
                        {muscle}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        color: 'var(--text-muted)',
                      }}>
                        {pct}%
                      </span>
                    </div>
                    <div style={{
                      height: 4,
                      background: 'var(--bg-elevated)',
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease, delay: 0.3 }}
                        style={{
                          height: '100%',
                          background: MUSCLE_COLORS[muscle] || 'var(--accent)',
                          borderRadius: 2,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--bg-border)',
            borderRadius: 10,
            padding: '20px',
          }}>
            <SectionHeader title="Quick Actions" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
              <QuickAction to="/log"      label="Log a Session" icon="+" accent />
              <QuickAction to="/progress" label="View Progress" icon="↗" />
              <QuickAction to="/ai"       label="Ask AI Coach"  icon="✦" />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function StatCard({ label, value, unit, accent, highlight }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: `1px solid ${highlight ? 'rgba(249,115,22,0.3)' : 'var(--bg-border)'}`,
      borderRadius: 10,
      padding: '18px 20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {highlight && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: 'var(--accent)',
        }}/>
      )}
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: 'var(--text-muted)',
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 32,
        fontWeight: 700,
        letterSpacing: '0.04em',
        color: accent || highlight ? 'var(--accent)' : 'var(--text-primary)',
        lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: 'var(--text-muted)',
        letterSpacing: '0.1em',
        marginTop: 4,
      }}>
        {unit}
      </div>
    </div>
  )
}

function MuscleTag({ muscle }) {
  const color = MUSCLE_COLORS[muscle] || '#888'
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color,
      background: `${color}18`,
      border: `1px solid ${color}40`,
      borderRadius: 4,
      padding: '2px 6px',
    }}>
      {muscle}
    </span>
  )
}

function SectionHeader({ title, sub, action, actionHref }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: 4,
    }}>
      <div>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text-primary)',
        }}>
          {title}
        </span>
        {sub && (
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-muted)',
            letterSpacing: '0.1em',
            marginLeft: 8,
          }}>
            {sub}
          </span>
        )}
      </div>
      {action && (
        <Link to={actionHref} style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--accent)',
          letterSpacing: '0.1em',
          textDecoration: 'none',
          textTransform: 'uppercase',
        }}>
          {action} →
        </Link>
      )}
    </div>
  )
}

function QuickAction({ to, label, icon, accent }) {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          borderRadius: 8,
          border: `1px solid ${accent ? 'rgba(249,115,22,0.25)' : 'var(--bg-border)'}`,
          background: accent ? 'var(--accent-glow)' : 'var(--bg-elevated)',
          cursor: 'pointer',
          transition: 'border-color 0.15s, background 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'rgba(249,115,22,0.4)'
          e.currentTarget.style.background = 'var(--accent-glow)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = accent ? 'rgba(249,115,22,0.25)' : 'var(--bg-border)'
          e.currentTarget.style.background = accent ? 'var(--accent-glow)' : 'var(--bg-elevated)'
        }}
      >
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 14,
          color: 'var(--accent)',
          width: 20,
          textAlign: 'center',
        }}>
          {icon}
        </span>
        <span style={{
          fontFamily: 'var(--font-ui)',
          fontSize: 13,
          color: accent ? 'var(--accent)' : 'var(--text-secondary)',
        }}>
          {label}
        </span>
      </div>
    </Link>
  )
}

function EmptyState({ message, sub }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px dashed var(--bg-border)',
      borderRadius: 10,
      padding: '40px 20px',
      textAlign: 'center',
    }}>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
        marginBottom: 6,
      }}>
        {message}
      </div>
      <div style={{
        fontFamily: 'var(--font-ui)',
        fontSize: 12,
        color: 'var(--text-muted)',
      }}>
        {sub}
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {[...Array(3)].map((_, i) => (
        <div key={i} style={{
          height: 80,
          background: 'var(--bg-surface)',
          border: '1px solid var(--bg-border)',
          borderRadius: 10,
          animation: 'pulse 1.5s ease-in-out infinite',
          animationDelay: `${i * 0.1}s`,
        }}/>
      ))}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1 }
          50% { opacity: 0.4 }
        }
      `}</style>
    </div>
  )
}
