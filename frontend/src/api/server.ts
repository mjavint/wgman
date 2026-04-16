import { apiFetch } from './http'
import type { ServerConfig } from '../types'

export function getServerConfig() {
  return apiFetch<ServerConfig>('/api/server')
}

export function updateServerConfig(config: Record<string, unknown>) {
  return apiFetch('/api/server/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
}

export function generateServerKeyPair() {
  return apiFetch<{ private_key: string; public_key: string }>('/api/server/keypair', {
    method: 'POST',
  })
}
