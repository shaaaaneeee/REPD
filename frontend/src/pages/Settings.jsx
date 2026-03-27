import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import { THEMES, applyTheme } from '../lib/theme'

const ease = [0.16, 1, 0.3, 1]

export default function Settings() {
  const { user, profile, fetchProfile, signOut } = useAuthStore()
  const navigate = useNavigate()

  const [saved, setSaved]   = useState({ fullName: '', unitPref: 'kg', theme: 'default' })
  const [draft, setDraft]   = useState({ fullName: '', unitPref: 'kg', theme: 'default' })
  const [saving, setSaving] = useState(false)
  const [saveOk, setSaveOk] = useState(false)
  const [error, setError]   = useState('')
  const isDirty = JSON.stringify(draft) !== JSON.stringify(saved)

  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSaving, setPwSaving]               = useState(false)
  const [pwSaved, setPwSaved]                 = useState(false)
  const [pwError, setPwError]                 = useState('')

  const [showDeleteAccount, setShowDeleteAccount] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletingAccount, setDeletingAccount]     = useState(false)

  useEffect(() => {
    if (profile) {
      const values = { fullName: profile.full_name || '', unitPref: profile.unit_pref || 'kg', theme: profile.theme || 'default' }
      setSaved(values)
      setDraft(values)
    }
  }, [profile])

  const handleThemeChange = (themeKey) => {
    setDraft(d => ({ ...d, theme: themeKey }))
    applyTheme(themeKey)
  }

  const handleDiscard = () => {
    setDraft(saved)
    applyTheme(saved.theme)
    setError('')
  }

  const handleSave = async () => {
    setSaving(true); setError(''); setSaveOk(false)
    try {
      const { error } = await supabase.from('profiles')
        .update({ full_name: draft.fullName, unit_pref: draft.unitPref, theme: draft.theme })
        .eq('id', user.id)
      if (error) throw error
      await fetchProfile(user.id)
      setSaveOk(true)
      setTimeout(() => setSaveOk(false), 2500)
    } catch (e) {
      setError(e.message)
      applyTheme(saved.theme)
    } finally {
      setSaving(false) }
  }

  const changePassword = async () => {
    setPwError(''); setPwSaved(false)
    if (newPassword !== confirmPassword) { setPwError('Passwords do not match'); return }
    if (newPassword.length < 6) { setPwError('Password must be at least 6 characters'); return }
    setPwSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setPwSaved(true); setNewPassword(''); setConfirmPassword('')
      setTimeout(() => setPwSaved(false), 2500)
    } catch (e) { setPwError(e.message) }
    finally { setPwSaving(false) }
  }

  const deleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return
    setDeletingAccount(true)
    try {
      // Delete all user data
      await supabase.from('ai_messages').delete().eq('user_id', user.id)
      await supabase.from('ai_conversations').delete().eq('user_id', user.id)
      await supabase.from('personal_records').delete().eq('user_id', user.id)
      // Sets cascade from sessions
      const { data: sessions } = await supabase.from('sessions').select('id').eq('user_id', user.id)
      if (sessions?.length) {
        await supabase.from('sets').delete().in('session_id', sessions.map(s => s.id))
      }
      await supabase.from('sessions').delete().eq('user_id', user.id)
      await supabase.from('profiles').delete().eq('id', user.id)
      await signOut()
      navigate('/login')
    } catch (e) {
      console.error('Delete account error:', e)
      setDeletingAccount(false)
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>

      {/* Delete account confirm modal */}
      <AnimatePresence>
        {showDeleteAccount && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => !deletingAccount && setShowDeleteAccount(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ background: 'var(--bg-surface)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '28px', maxWidth: 400, width: '90%' }}
            >
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--red)', marginBottom: 8 }}>
                Delete Account
              </div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
                This will permanently delete your account and all data including sessions, sets, PRs, and AI conversations. This cannot be undone.
              </div>
              <label style={{ ...labelStyle, marginBottom: 8 }}>
                Type <strong style={{ color: 'var(--red)' }}>DELETE</strong> to confirm
              </label>
              <input
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                style={{
                  width: '100%', padding: '11px 14px', marginBottom: 16,
                  background: 'var(--bg-elevated)',
                  border: `1px solid ${deleteConfirmText === 'DELETE' ? 'var(--red)' : 'var(--bg-border)'}`,
                  borderRadius: 8, color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setShowDeleteAccount(false); setDeleteConfirmText('') }} disabled={deletingAccount} style={{
                  flex: 1, padding: '11px', borderRadius: 8,
                  border: '1px solid var(--bg-border)', background: 'transparent',
                  color: 'var(--text-muted)', fontFamily: 'var(--font-display)',
                  fontWeight: 600, fontSize: 12, letterSpacing: '0.08em',
                  textTransform: 'uppercase', cursor: 'pointer',
                }}>
                  Cancel
                </button>
                <button
                  onClick={deleteAccount}
                  disabled={deleteConfirmText !== 'DELETE' || deletingAccount}
                  style={{
                    flex: 1, padding: '11px', borderRadius: 8, border: 'none',
                    background: deleteConfirmText === 'DELETE' ? 'var(--red)' : 'var(--bg-elevated)',
                    color: deleteConfirmText === 'DELETE' ? '#fff' : 'var(--text-muted)',
                    fontFamily: 'var(--font-display)', fontWeight: 700,
                    fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase',
                    cursor: deleteConfirmText === 'DELETE' ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s',
                  }}
                >
                  {deletingAccount ? 'Deleting…' : 'Delete Forever'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} style={{ marginBottom: 32 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6 }}>Account</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-primary)', lineHeight: 1 }}>
          Settings<span style={{ color: 'var(--accent)' }}>.</span>
        </h1>
      </motion.div>

      {/* Profile */}
      <Section delay={0.08}>
        <SectionTitle title="Profile" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>
          <Field label="Full Name" value={draft.fullName} onChange={e => setDraft(d => ({ ...d, fullName: e.target.value }))} placeholder="Your name" />
          <div>
            <label style={labelStyle}>Unit Preference</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              {['kg', 'lbs'].map(unit => (
                <button key={unit} onClick={() => setDraft(d => ({ ...d, unitPref: unit }))} style={{
                  flex: 1, padding: '10px', borderRadius: 8,
                  border: `1px solid ${draft.unitPref === unit ? 'var(--accent)' : 'var(--bg-border)'}`,
                  background: draft.unitPref === unit ? 'var(--accent-glow)' : 'var(--bg-elevated)',
                  color: draft.unitPref === unit ? 'var(--accent)' : 'var(--text-secondary)',
                  fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13,
                  letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.15s',
                }}>{unit}</button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Theme */}
      <Section delay={0.12}>
        <SectionTitle title="Theme" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          {Object.entries(THEMES).map(([key, t]) => (
            <button key={key} onClick={() => handleThemeChange(key)} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 10,
              border: `1px solid ${draft.theme === key ? 'var(--accent)' : 'var(--bg-border)'}`,
              background: draft.theme === key ? 'var(--accent-glow)' : 'var(--bg-elevated)',
              cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left', width: '100%',
            }}>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {[t.preview.bg, t.preview.surface, t.preview.accent, t.preview.text].map((color, i) => (
                  <div key={i} style={{ width: i === 2 ? 16 : 10, height: 16, borderRadius: 4, background: color, border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}/>
                ))}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 500, color: draft.theme === key ? 'var(--accent)' : 'var(--text-primary)', marginBottom: 2 }}>{t.label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>{t.description}</div>
              </div>
              {draft.theme === key && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }}/>}
            </button>
          ))}
        </div>
      </Section>

      {/* Password */}
      <Section delay={0.16}>
        <SectionTitle title="Change Password" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>
          <Field label="New Password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min. 6 characters" />
          <Field label="Confirm New Password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat new password" />
          {pwError && <ErrorMsg message={pwError} />}
          {pwSaved && <SuccessMsg message="Password updated successfully" />}
          <motion.button onClick={changePassword} disabled={pwSaving}
            whileHover={!pwSaving ? { scale: 1.01 } : {}} whileTap={!pwSaving ? { scale: 0.99 } : {}}
            style={{
              padding: '12px',
              background: pwSaved ? 'rgba(34,197,94,0.15)' : pwSaving ? 'var(--bg-elevated)' : 'var(--accent)',
              color: pwSaved ? 'var(--green)' : pwSaving ? 'var(--text-muted)' : '#fff',
              border: pwSaved ? '1px solid rgba(34,197,94,0.3)' : 'none',
              borderRadius: 8, fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase',
              cursor: pwSaving ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
            }}>
            {pwSaved ? '✓ Updated' : pwSaving ? 'Saving…' : 'Update Password'}
          </motion.button>
        </div>
      </Section>

      {/* Account info */}
      <Section delay={0.2}>
        <SectionTitle title="Account Info" />
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <InfoRow label="Email" value={user?.email || '—'} />
          <InfoRow label="User ID" value={user?.id?.slice(0, 16) + '...' || '—'} mono />
          <InfoRow label="Member since" value={user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'} />
        </div>
      </Section>

      {/* Danger zone */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease, delay: 0.24 }}
        style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '24px', marginBottom: 100 }}>
        <SectionTitle title="Danger Zone" />
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-secondary)', marginTop: 10, marginBottom: 16, lineHeight: 1.6 }}>
          Permanently delete your account and all associated data. This action cannot be undone.
        </div>
        <button onClick={() => setShowDeleteAccount(true)} style={{
          padding: '10px 20px', borderRadius: 8,
          border: '1px solid rgba(239,68,68,0.4)', background: 'transparent',
          color: 'var(--red)', fontFamily: 'var(--font-display)',
          fontWeight: 600, fontSize: 12, letterSpacing: '0.1em',
          textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          Delete Account
        </button>
      </motion.div>

      {/* Sticky action bar */}
      <motion.div
        initial={false}
        animate={{ opacity: isDirty ? 1 : 0, y: isDirty ? 0 : 12, pointerEvents: isDirty ? 'all' : 'none' }}
        transition={{ duration: 0.2 }}
        style={{
          display: 'flex', gap: 10,
          position: 'sticky', bottom: 16,
          background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
          borderRadius: 12, padding: '12px',
        }}
      >
        <button onClick={handleDiscard} style={{
          flex: '0 0 auto', padding: '12px 20px', background: 'transparent',
          border: '1px solid var(--bg-border)', borderRadius: 8, color: 'var(--text-muted)',
          fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13,
          letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--red)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--bg-border)'}
        >
          Discard
        </button>
        <motion.button onClick={handleSave} disabled={saving}
          whileHover={!saving ? { scale: 1.01 } : {}} whileTap={!saving ? { scale: 0.99 } : {}}
          style={{
            flex: 1, padding: '12px',
            background: saveOk ? 'rgba(34,197,94,0.15)' : saving ? 'var(--bg-surface)' : 'var(--accent)',
            color: saveOk ? 'var(--green)' : saving ? 'var(--text-muted)' : '#fff',
            border: saveOk ? '1px solid rgba(34,197,94,0.3)' : 'none',
            borderRadius: 8, fontFamily: 'var(--font-display)', fontWeight: 700,
            fontSize: 14, letterSpacing: '0.1em', textTransform: 'uppercase',
            cursor: saving ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
          }}>
          {saveOk ? '✓ Saved' : saving ? 'Saving…' : 'Apply Changes'}
        </motion.button>
      </motion.div>
      {error && <div style={{ marginTop: 8 }}><ErrorMsg message={error} /></div>}
    </div>
  )
}

function Section({ children, delay = 0 }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16,1,0.3,1], delay }}
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 12, padding: '24px', marginBottom: 16 }}>
      {children}
    </motion.div>
  )
}

const labelStyle = {
  display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500,
  letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6,
}

function SectionTitle({ title }) {
  return <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>{title}</div>
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ width: '100%', padding: '11px 14px', background: 'var(--bg-elevated)', border: `1px solid ${focused ? 'var(--accent)' : 'var(--bg-border)'}`, borderRadius: 8, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', fontSize: 14, outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
      />
    </div>
  )
}

function InfoRow({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '10px 0', borderBottom: '1px solid var(--bg-border)' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontFamily: mono ? 'var(--font-mono)' : 'var(--font-ui)', fontSize: 13, color: 'var(--text-secondary)' }}>{value}</span>
    </div>
  )
}

function ErrorMsg({ message }) {
  return <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '10px 12px', fontSize: 13, color: 'var(--red)', fontFamily: 'var(--font-ui)' }}>{message}</div>
}

function SuccessMsg({ message }) {
  return <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6, padding: '10px 12px', fontSize: 13, color: 'var(--green)', fontFamily: 'var(--font-ui)' }}>{message}</div>
}
