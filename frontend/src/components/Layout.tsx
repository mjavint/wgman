import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { logout, getPendingChanges, applyWgConfig } from '../api'

export default function Layout() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('wgman_username')
    if (stored) setUsername(stored)
  }, [])

  useEffect(() => {
    checkPendingChanges()
    const interval = setInterval(checkPendingChanges, 5000)
    return () => clearInterval(interval)
  }, [])

  const checkPendingChanges = async () => {
    try {
      const data = await getPendingChanges()
      console.log('Pending changes response:', data)
      const hasChangesValue = data?.has_changes === true
      setHasChanges(hasChangesValue)
    } catch (err) {
      console.error('Failed to check pending changes:', err)
    }
  }

  const handleApply = async () => {
    if (!confirm('Apply pending changes and restart WireGuard?')) return
    setApplying(true)
    try {
      await applyWgConfig()
      setHasChanges(false)
    } catch (err) {
      alert('Failed to apply changes: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setApplying(false)
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
    } finally {
      localStorage.removeItem('wgman_username')
      navigate('/login')
    }
  }

  const initials = username ? username.slice(0, 2).toUpperCase() : '?'

  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <span className="brand-name">WireGuard</span>
        </div>

        <div className="nav-links">
          <NavLink to="/clients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </span>
            <span>Clients</span>
          </NavLink>
          <NavLink to="/server" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            </span>
            <span>Server</span>
          </NavLink>
          <NavLink to="/status" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </span>
            <span>Status</span>
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </span>
            <span>Settings</span>
          </NavLink>
        </div>

        <div className="user-info">
          <div className="user-avatar">{initials}</div>
          <span className="user-name">{username || 'User'}</span>
          <button className="btn-logout" onClick={handleLogout} title="Logout">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </nav>

      <main className="content">
        <div className="top-bar">
          {hasChanges && (
            <button className="btn btn-primary" onClick={handleApply} disabled={applying}>
              {applying ? 'Applying...' : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                  </svg>
                  Apply & Restart
                  <span className="pending-badge">!</span>
                </>
              )}
            </button>
          )}
        </div>
        <Outlet />
      </main>
    </div>
  )
}
