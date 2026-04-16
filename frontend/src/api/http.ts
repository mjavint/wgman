/**
 * Base fetch wrapper — handles 401 redirects and normalises the
 * {success, data, error} envelope returned by the backend API.
 */
export async function apiFetch<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options)

  if (res.status === 401) {
    window.location.href = '/login'
    throw new Error('Session expired')
  }

  const body = await res.json()
  if (!body.success) throw new Error(body.error || body.message || 'Unknown error')
  return body.data as T
}
