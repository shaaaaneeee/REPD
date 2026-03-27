import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import AppLayout from './components/layout/AppLayout'

import Login     from './pages/Login'
import Dashboard from './pages/Dashboard'
import History   from './pages/History'
import Progress  from './pages/Progress'
import LogSession from './pages/LogSession'
import AI        from './pages/AI'
import Settings  from './pages/Settings'

function Protected({ children }) {
  const { user, loading } = useAuthStore()
  if (loading) return <Spinner />
  if (!user)   return <Navigate to="/login" replace />
  return children
}

function Spinner() {
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-base)',
    }}>
      <div style={{
        width: 32, height: 32,
        border: '2px solid var(--bg-border)',
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }}/>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export default function App() {
  const init = useAuthStore(s => s.init)
  useEffect(() => { init() }, [init])

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <Protected>
          <AppLayout />
        </Protected>
      }>
        <Route index          element={<Dashboard />} />
        <Route path="log"      element={<LogSession />} />
        <Route path="history"  element={<History />} />
        <Route path="progress" element={<Progress />} />
        <Route path="ai"       element={<AI />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
