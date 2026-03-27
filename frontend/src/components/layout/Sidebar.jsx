import { NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore } from '../../store/authStore'

const NAV = [
  { to: '/',          label: 'Dashboard',   icon: IconGrid    },
  { to: '/log',       label: 'Log Session', icon: IconPlus    },
  { to: '/history',   label: 'History',     icon: IconClock   },
  { to: '/progress',  label: 'Progress',    icon: IconChart   },
  { to: '/ai',        label: 'AI Coach',    icon: IconSparkle },
  { to: '/settings',  label: 'Settings',    icon: IconGear    },
]

export default function Sidebar() {
  const { profile, signOut } = useAuthStore()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <aside style={{
      width: 220,
      minWidth: 220,
      height: '100vh',
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--bg-border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 12px',
      position: 'sticky',
      top: 0,
    }}>

      {/* Wordmark */}
      <div style={{ padding: '0 10px', marginBottom: 32 }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 28, fontWeight: 700,
          letterSpacing: '0.15em',
          textTransform: 'uppercase', lineHeight: 1,
        }}>
          REP<span style={{ color: 'var(--accent)' }}>D</span>
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 9,
          color: 'var(--text-muted)', letterSpacing: '0.2em',
          marginTop: 4, textTransform: 'uppercase',
        }}>
          every rep, recorded.
        </div>
      </div>

      {/* Nav links */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={{ textDecoration: 'none' }}
          >
            {({ isActive }) => (
              <motion.div
                whileHover={{ x: 2 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 8,
                  background: isActive ? 'var(--accent-glow)' : 'transparent',
                  border: `1px solid ${isActive ? 'rgba(249,115,22,0.2)' : 'transparent'}`,
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  fontFamily: 'var(--font-ui)', fontSize: 14,
                  fontWeight: isActive ? 500 : 400,
                  cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                }}
              >
                <Icon size={16} active={isActive} />
                {label}
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    style={{
                      marginLeft: 'auto',
                      width: 4, height: 4,
                      borderRadius: '50%',
                      background: 'var(--accent)',
                    }}
                  />
                )}
              </motion.div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User + sign out */}
      <div style={{
        borderTop: '1px solid var(--bg-border)',
        paddingTop: 16,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 12px', borderRadius: 8,
          background: 'var(--bg-elevated)',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--accent-glow)',
            border: '1px solid rgba(249,115,22,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontWeight: 700,
            fontSize: 12, color: 'var(--accent)', flexShrink: 0,
          }}>
            {(profile?.full_name || 'U')[0].toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{
              fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 500,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {profile?.full_name || 'Athlete'}
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              color: 'var(--text-muted)', letterSpacing: '0.05em',
            }}>
              {profile?.unit_pref?.toUpperCase() || 'KG'}
            </div>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 12px', borderRadius: 8,
            border: 'none', background: 'transparent',
            color: 'var(--text-muted)', fontFamily: 'var(--font-ui)',
            fontSize: 13, cursor: 'pointer', width: '100%',
            transition: 'color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--red)'
            e.currentTarget.style.background = 'rgba(239,68,68,0.08)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--text-muted)'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <IconSignOut size={16} />
          Sign Out
        </button>
      </div>
    </aside>
  )
}

// ── Icons ──────────────────────────────────────────────
function IconGrid({ size = 16, active }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1.5" fill={active ? 'var(--accent)' : 'currentColor'} opacity={active ? 1 : 0.7}/>
      <rect x="9" y="1" width="6" height="6" rx="1.5" fill={active ? 'var(--accent)' : 'currentColor'} opacity={active ? 0.6 : 0.4}/>
      <rect x="1" y="9" width="6" height="6" rx="1.5" fill={active ? 'var(--accent)' : 'currentColor'} opacity={active ? 0.6 : 0.4}/>
      <rect x="9" y="9" width="6" height="6" rx="1.5" fill={active ? 'var(--accent)' : 'currentColor'} opacity={active ? 0.4 : 0.25}/>
    </svg>
  )
}

function IconPlus({ size = 16, active }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" opacity={active ? 1 : 0.7}/>
      <path d="M8 5v6M5 8h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}

function IconClock({ size = 16, active }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" opacity={active ? 1 : 0.7}/>
      <path d="M8 4.5V8l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconChart({ size = 16, active }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M2 12l3.5-4 3 2.5L12 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity={active ? 1 : 0.7}/>
      <circle cx="12" cy="5" r="1.5" fill="currentColor"/>
    </svg>
  )
}

function IconSparkle({ size = 16, active }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5L9.2 6.8 14.5 8l-5.3 1.2L8 14.5 6.8 9.2 1.5 8l5.3-1.2L8 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" opacity={active ? 1 : 0.7}/>
    </svg>
  )
}

function IconGear({ size = 16, active }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.2" opacity={active ? 1 : 0.7}/>
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity={active ? 1 : 0.7}/>
    </svg>
  )
}

function IconSignOut({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M10.5 11L14 8l-3.5-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 8H6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}
