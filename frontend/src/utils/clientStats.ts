/**
 * Pure utility functions for client traffic/connection display.
 * Extracted here so they can be unit-tested without DOM dependencies.
 */

export type ConnectionStatus = 'connected' | 'idle' | 'never' | 'offline'

/** Zero-time sentinel used by wg show dump for peers that never handshaked. */
export const ZERO_HANDSHAKE = '0001-01-01 00:00:00'

/** Connected if handshake happened less than 3 minutes ago. */
export function connectionStatus(latestHandshake: string | undefined | null): Exclude<ConnectionStatus, 'offline'> {
  if (!latestHandshake || latestHandshake === ZERO_HANDSHAKE) return 'never'
  const d = new Date(latestHandshake.replace(' ', 'T') + 'Z')
  if (isNaN(d.getTime())) return 'never'
  const diffSec = (Date.now() - d.getTime()) / 1000
  return diffSec < 180 ? 'connected' : 'idle'
}

/** Format a byte count as a human-readable string. */
export function formatBytes(n: number): string {
  if (n === 0) return '0 B'
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}

/** Format bytes-per-second as a human-readable rate. Empty string if rate < 1. */
export function formatRate(bps: number): string {
  if (bps < 1) return ''
  if (bps < 1024) return `${bps.toFixed(0)} B/s`
  if (bps < 1024 ** 2) return `${(bps / 1024).toFixed(1)} KB/s`
  return `${(bps / 1024 ** 2).toFixed(1)} MB/s`
}

/** Format a handshake timestamp as a relative time string, or null if never. */
export function formatHandshake(ts: string | undefined | null): string | null {
  if (!ts || ts === ZERO_HANDSHAKE) return null
  const d = new Date(ts.replace(' ', 'T') + 'Z')
  if (isNaN(d.getTime())) return null
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diffSec < 60) return `${diffSec}s ago`
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  return `${Math.floor(diffSec / 86400)}d ago`
}
