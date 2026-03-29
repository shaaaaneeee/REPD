import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const ease = [0.16, 1, 0.3, 1]

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState(false)
  const [validSession, setValidSession] = useState(false)
  const [checking, setChecking]     = useState(true)

  useEffect(() => {
    // Parse the token from the URL hash that Supabase appends
    const hash = window.location.hash
    const query = window.location.search
    
    const params = new URLSearchParams(
      hash ? hash.replace('#', '') : query
    )
    
    const accessToken  = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const type         = params.get('type')

    if (type === 'recovery' && accessToken) {
      // Set the session using the tokens from the URL
      supabase.auth.setSession({
        access_token:  accessToken,
        refresh_token: refreshToken,
      }).then(({ error }) => {
        if (error) {
          setError('This reset link is invalid or has expired. Please request a new one.')
        } else {
          setValidSession(true)
        }
        setChecking(false)
      })
    } else {
      setError('Invalid reset link. Please request a new password reset.')
      setChecking(false)
    }
  }, [])

  const handleReset = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 6)  { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-base)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `linear-gradient(var(--bg-border) 1px, transparent 1px), linear-gradient(90deg, var(--bg-border) 1px, transparent 1px)`,
        backgroundSize: '48px 48px', opacity: 0.35,
      }}/>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }}
      >
        {/* Wordmark */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 700, letterSpacing: '0.18em', color: 'var(--text-primary)', textTransform: 'uppercase', lineHeight: 1 }}>
            REP<span style={{ color: 'var(--accent)' }}>D</span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.2em', marginTop: 6, textTransform: 'uppercase' }}>
            Set new password
          </div>
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 12, padding: 32 }}>

          {/* Checking token */}
          {checking && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                Verifying reset link…
              </div>
            </div>
          )}

          {/* Success */}
          {!checking && success && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--green)', marginBottom: 8 }}>
                Password updated!
              </div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-muted)' }}>
                Redirecting to login…
              </div>
            </div>
          )}

          {/* Invalid link */}
          {!checking && !validSession && !success && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--red)', marginBottom: 20, lineHeight: 1.6 }}>
                {error}
              </div>
              <button onClick={() => navigate('/login')} style={{
                padding: '10px 20px', borderRadius: 8,
                border: '1px solid var(--bg-border)', background: 'transparent',
                color: 'var(--text-muted)', fontFamily: 'var(--font-display)',
                fontWeight: 600, fontSize: 12, letterSpacing: '0.08em',
                textTransform: 'uppercase', cursor: 'pointer',
              }}>
                Back to Login
              </button>
            </div>
          )}

          {/* Reset form */}
          {!checking && validSession && !success && (
            <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field
                label="New Password" type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 6 characters" required
              />
              <Field
                label="Confirm Password" type="password" value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat new password" required
              />
              {error && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '10px 12px', fontSize: 13, color: 'var(--red)' }}>
                  {error}
                </div>
              )}
              <motion.button
                type="submit" disabled={loading}
                whileHover={!loading ? { scale: 1.01 } : {}}
                whileTap={!loading ? { scale: 0.99 } : {}}
                style={{
                  padding: '13px', background: loading ? 'var(--bg-elevated)' : 'var(--accent)',
                  color: loading ? 'var(--text-muted)' : '#fff',
                  border: 'none', borderRadius: 8,
                  fontFamily: 'var(--font-display)', fontWeight: 700,
                  fontSize: 14, letterSpacing: '0.1em', textTransform: 'uppercase',
                  cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                }}
              >
                {loading ? 'Updating…' : 'Set New Password'}
              </motion.button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text', required }) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
        {label}
      </label>
      <input
        type={type} value={value} onChange={onChange}
        placeholder={placeholder} required={required}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          width: '100%', padding: '11px 14px', background: 'var(--bg-elevated)',
          border: `1px solid ${focused ? 'var(--accent)' : 'var(--bg-border)'}`,
          borderRadius: 8, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)',
          fontSize: 14, outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box',
        }}
      />
    </div>
  )
}