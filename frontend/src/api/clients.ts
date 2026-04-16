import { apiFetch } from './http'
import type { Client } from '../types'

export function getClients() {
  return apiFetch<Client[]>('/api/clients')
}

export function createClient(payload: Record<string, unknown>) {
  return apiFetch('/api/client/new', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function updateClient(payload: Record<string, unknown>) {
  return apiFetch('/api/client/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function deleteClient(id: string) {
  return apiFetch('/api/client/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
}

export function setClientStatus(id: string, enabled: boolean) {
  return apiFetch('/api/client/set-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, enabled }),
  })
}
