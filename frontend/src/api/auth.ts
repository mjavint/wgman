export async function login(username: string, password: string, rememberMe = false) {
  const res = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, rememberMe }),
  })
  const data = await res.json()
  if (!data.status) throw new Error(data.message || 'Login failed')
  return data
}

export async function logout() {
  const res = await fetch('/logout', { method: 'POST' })
  if (!res.ok && res.status !== 401) throw new Error('Logout failed')
}
