import { useEffect, useState } from 'react'

export default function Settings() {
  const [username, setUsername] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem('wgman_username')
    if (stored) setUsername(stored)
  }, [])

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    if (newPassword !== confirmPassword) {
      setMessage('Passwords do not match')
      return
    }

    const res = await fetch('/api/update-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        currentPassword,
        newPassword,
      }),
    })

    const data = await res.json()
    if (data.success) {
      setMessage('Password updated successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } else {
      setMessage(data.message || 'Failed to update password')
    }
  }

  return (
    <div className="page settings-page">
      <h1>Settings</h1>

      <section className="settings-section">
        <h2>Change Password</h2>
        <form onSubmit={handlePasswordChange}>
          <div className="form-group">
            <label>Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          {message && <div className="message">{message}</div>}
          <button type="submit">Update Password</button>
        </form>
      </section>
    </div>
  )
}