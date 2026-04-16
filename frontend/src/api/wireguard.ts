import { apiFetch } from './http'
import type { WgDevice, WgInterfaceStatus } from '../types'

export function getPendingChanges() {
  return apiFetch<{ has_changes: boolean }>('/api/pending-changes')
}

export function applyWgConfig() {
  return apiFetch('/api/apply-wg-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
}

export function getWgStatus() {
  return apiFetch<WgDevice[]>('/api/status')
}

export function getWgInterfaceStatus() {
  return apiFetch<WgInterfaceStatus>('/api/wg/interface-status')
}

export function startWgInterface() {
  return apiFetch('/api/wg/start', { method: 'POST' })
}

export function stopWgInterface() {
  return apiFetch('/api/wg/stop', { method: 'POST' })
}

export function restartWgInterface() {
  return apiFetch('/api/wg/restart', { method: 'POST' })
}
