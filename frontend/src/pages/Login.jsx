import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const ease = [0.16, 1, 0.3, 1]

export default function Login() {
  const [mode, setMode]         = useState('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [name, setName]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')
  const [mode2, setMode2]       = useState('login') // 'login' | 'signup' | 'reset'
  const navigate = useNavigate()

  const handleReset = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password',
      })
      if (error) throw error
      setSuccess('Password reset email sent — check your inbox.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        })
        if (error) throw error
        setSuccess('Account created — check your email to confirm.')
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        if (data.session) {
          navigate('/')
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Background grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(var(--bg-border) 1px, transparent 1px),
          linear-gradient(90deg, var(--bg-border) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
        opacity: 0.35,
      }}/>

      {/* Accent glow */}
      <div style={{
        position: 'absolute',
        top: '20%', left: '50%',
        transform: 'translateX(-50%)',
        width: 600, height: 300,
        background: 'radial-gradient(ellipse, rgba(249,115,22,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }}/>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease }}
        style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }}
      >
        {/* Wordmark */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 48,
            fontWeight: 700,
            letterSpacing: '0.18em',
            color: 'var(--text-primary)',
            textTransform: 'uppercase',
            lineHeight: 1,
          }}>
            REP<span style={{ color: 'var(--accent)' }}>D</span>
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-muted)',
            letterSpacing: '0.22em',
            marginTop: 8,
            textTransform: 'uppercase',
          }}>
            every rep, recorded.
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--bg-border)',
          borderRadius: 12,
          padding: '32px',
        }}>

          {/* Smooth sliding toggle */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-base)',
            border: '1px solid var(--bg-border)',
            borderRadius: 8,
            padding: 3,
            marginBottom: 28,
            position: 'relative',
          }}>
            <motion.div
              animate={{ x: mode === 'login' ? 0 : '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              style={{
                position: 'absolute',
                top: 3, left: 3,
                width: 'calc(50% - 3px)',
                bottom: 3,
                background: 'var(--accent)',
                borderRadius: 6,
                zIndex: 0,
              }}
            />
            {['login', 'signup'].map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); setSuccess('') }}
                style={{
                  flex: 1,
                  padding: '9px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 13,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  background: 'transparent',
                  color: mode === m ? '#fff' : 'var(--text-muted)',
                  position: 'relative',
                  zIndex: 1,
                  transition: 'color 0.2s',
                }}
              >
                {m === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>

            <AnimatePresence initial={false}>
              {mode === 'signup' && (
                <motion.div
                  key="name-field"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.28, ease }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{ marginBottom: 16 }}>
                    <Field label="Full Name" type="text" value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Your name" required={mode === 'signup'} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div style={{ marginBottom: 16 }}>
              <Field label="Email" type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required />
            </div>

            <div style={{ marginBottom: mode === 'login' ? 4 : 16 }}>
              <Field label="Password" type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'Min. 6 characters' : '••••••••'} required />
            </div>

            {mode === 'login' && (
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={() => { setError(''); setSuccess(''); setMode2('reset') }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: 'var(--font-mono)', fontSize: 10,
                    color: 'var(--text-muted)', letterSpacing: '0.08em',
                    textDecoration: 'underline', textUnderlineOffset: '3px',
                  }}
                >
                  Forgot password?
                </button>
              </div>
            )}

            <AnimatePresence>
              {error && (
                <motion.div key="err"
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 6, padding: '10px 12px',
                    fontSize: 13, color: 'var(--red)',
                    marginBottom: 16,
                  }}
                >{error}</motion.div>
              )}
              {success && (
                <motion.div key="ok"
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{
                    background: 'rgba(34,197,94,0.1)',
                    border: '1px solid rgba(34,197,94,0.3)',
                    borderRadius: 6, padding: '10px 12px',
                    fontSize: 13, color: 'var(--green)',
                    marginBottom: 16,
                  }}
                >{success}</motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={!loading ? { scale: 1.015 } : {}}
              whileTap={!loading  ? { scale: 0.985 } : {}}
              style={{
                padding: '13px',
                background: loading ? 'var(--bg-elevated)' : 'var(--accent)',
                color: loading ? 'var(--text-muted)' : '#fff',
                border: 'none',
                borderRadius: 8,
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s, color 0.2s',
              }}
            >
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </motion.button>
          </form>
        </div>

        <div style={{
          textAlign: 'center', marginTop: 20,
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--text-muted)', letterSpacing: '0.05em',
        }}>
          YOUR DATA. YOUR PROGRESS. YOUR REPS.
        </div>
      </motion.div>

      {/* Reset password overlay */}
      <AnimatePresence>
        {mode2 === 'reset' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 50,
              background: 'rgba(0,0,0,0.7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 24,
            }}
            onClick={() => setMode2('login')}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--bg-border)',
                borderRadius: 12, padding: 32,
                width: '100%', maxWidth: 380,
              }}
            >
              <div style={{
                fontFamily: 'var(--font-display)', fontSize: 20,
                fontWeight: 700, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: 'var(--text-primary)',
                marginBottom: 8,
              }}>
                Reset Password
              </div>
              <div style={{
                fontFamily: 'var(--font-ui)', fontSize: 13,
                color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6,
              }}>
                Enter your email and we'll send you a reset link.
              </div>
              <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Field
                  label="Email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
                {error && (
                  <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '10px 12px', fontSize: 13, color: 'var(--red)' }}>
                    {error}
                  </div>
                )}
                {success && (
                  <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6, padding: '10px 12px', fontSize: 13, color: 'var(--green)' }}>
                    {success}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => { setMode2('login'); setError(''); setSuccess('') }}
                    style={{
                      flex: 1, padding: '12px', borderRadius: 8,
                      border: '1px solid var(--bg-border)', background: 'transparent',
                      color: 'var(--text-muted)', fontFamily: 'var(--font-display)',
                      fontWeight: 600, fontSize: 13, letterSpacing: '0.08em',
                      textTransform: 'uppercase', cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={!loading ? { scale: 1.01 } : {}}
                    whileTap={!loading ? { scale: 0.99 } : {}}
                    style={{
                      flex: 1, padding: '12px', border: 'none', borderRadius: 8,
                      background: loading ? 'var(--bg-elevated)' : 'var(--accent)',
                      color: loading ? 'var(--text-muted)' : '#fff',
                      fontFamily: 'var(--font-display)', fontWeight: 700,
                      fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase',
                      cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                    }}
                  >
                    {loading ? 'Sending…' : 'Send Link'}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Field({ label, type, value, onChange, placeholder, required }) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label style={{
        display: 'block',
        fontFamily: 'var(--font-mono)',
        fontSize: 11, fontWeight: 500,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
        marginBottom: 6,
      }}>
        {label}
      </label>
      <input
        type={type} value={value} onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder} required={required}
        style={{
          width: '100%', padding: '11px 14px',
          background: 'var(--bg-elevated)',
          border: `1px solid ${focused ? 'var(--accent)' : 'var(--bg-border)'}`,
          borderRadius: 8,
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-ui)',
          fontSize: 14, outline: 'none',
          transition: 'border-color 0.2s',
        }}
      />
    </div>
  )
}