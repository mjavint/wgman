import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  connectionStatus,
  formatBytes,
  formatRate,
  formatHandshake,
  ZERO_HANDSHAKE,
} from './clientStats'

// ── connectionStatus ─────────────────────────────────────────────────────────

describe('connectionStatus', () => {
  const NOW = new Date('2024-06-01T12:00:00Z').getTime()

  beforeEach(() => { vi.setSystemTime(NOW) })
  afterEach(() => { vi.useRealTimers() })

  it('returns "never" for null/undefined', () => {
    expect(connectionStatus(null)).toBe('never')
    expect(connectionStatus(undefined)).toBe('never')
    expect(connectionStatus('')).toBe('never')
  })

  it('returns "never" for ZERO_HANDSHAKE sentinel', () => {
    expect(connectionStatus(ZERO_HANDSHAKE)).toBe('never')
  })

  it('returns "never" for invalid date string', () => {
    expect(connectionStatus('not-a-date')).toBe('never')
  })

  it('returns "connected" for handshake < 3 minutes ago', () => {
    const ts = new Date(NOW - 60_000).toISOString().replace('T', ' ').slice(0, 19)
    expect(connectionStatus(ts)).toBe('connected')
  })

  it('returns "connected" for handshake exactly 179 seconds ago', () => {
    const ts = new Date(NOW - 179_000).toISOString().replace('T', ' ').slice(0, 19)
    expect(connectionStatus(ts)).toBe('connected')
  })

  it('returns "idle" for handshake exactly 180 seconds ago', () => {
    const ts = new Date(NOW - 180_000).toISOString().replace('T', ' ').slice(0, 19)
    expect(connectionStatus(ts)).toBe('idle')
  })

  it('returns "idle" for handshake 10 minutes ago', () => {
    const ts = new Date(NOW - 600_000).toISOString().replace('T', ' ').slice(0, 19)
    expect(connectionStatus(ts)).toBe('idle')
  })

  it('handles space-separated format from wg show dump (no T)', () => {
    // wg returns "2024-06-01 11:59:00" — 60s ago
    expect(connectionStatus('2024-06-01 11:59:00')).toBe('connected')
  })
})

// ── formatBytes ──────────────────────────────────────────────────────────────

describe('formatBytes', () => {
  it('returns "0 B" for 0', () => {
    expect(formatBytes(0)).toBe('0 B')
  })

  it('formats bytes under 1 KB', () => {
    expect(formatBytes(512)).toBe('512 B')
  })

  it('formats KB range', () => {
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
  })

  it('formats MB range', () => {
    expect(formatBytes(1024 ** 2)).toBe('1.0 MB')
    expect(formatBytes(1024 ** 2 * 2.5)).toBe('2.5 MB')
  })

  it('formats GB range', () => {
    expect(formatBytes(1024 ** 3)).toBe('1.00 GB')
    expect(formatBytes(1024 ** 3 * 1.5)).toBe('1.50 GB')
  })
})

// ── formatRate ───────────────────────────────────────────────────────────────

describe('formatRate', () => {
  it('returns empty string for rate < 1 bps', () => {
    expect(formatRate(0)).toBe('')
    expect(formatRate(0.5)).toBe('')
  })

  it('formats low byte rates', () => {
    expect(formatRate(100)).toBe('100 B/s')
  })

  it('formats KB/s range', () => {
    expect(formatRate(1024)).toBe('1.0 KB/s')
    expect(formatRate(2048)).toBe('2.0 KB/s')
  })

  it('formats MB/s range', () => {
    expect(formatRate(1024 ** 2)).toBe('1.0 MB/s')
  })
})

// ── formatHandshake ──────────────────────────────────────────────────────────

describe('formatHandshake', () => {
  const NOW = new Date('2024-06-01T12:00:00Z').getTime()

  beforeEach(() => { vi.setSystemTime(NOW) })
  afterEach(() => { vi.useRealTimers() })

  it('returns null for ZERO_HANDSHAKE', () => {
    expect(formatHandshake(ZERO_HANDSHAKE)).toBeNull()
  })

  it('returns null for null/undefined', () => {
    expect(formatHandshake(null)).toBeNull()
    expect(formatHandshake(undefined)).toBeNull()
  })

  it('returns seconds ago for recent handshake', () => {
    const ts = new Date(NOW - 30_000).toISOString().replace('T', ' ').slice(0, 19)
    expect(formatHandshake(ts)).toBe('30s ago')
  })

  it('returns minutes ago for handshake 5 min ago', () => {
    const ts = new Date(NOW - 5 * 60_000).toISOString().replace('T', ' ').slice(0, 19)
    expect(formatHandshake(ts)).toBe('5m ago')
  })

  it('returns hours ago for handshake 2h ago', () => {
    const ts = new Date(NOW - 2 * 3600_000).toISOString().replace('T', ' ').slice(0, 19)
    expect(formatHandshake(ts)).toBe('2h ago')
  })

  it('returns days ago for handshake 3d ago', () => {
    const ts = new Date(NOW - 3 * 86400_000).toISOString().replace('T', ' ').slice(0, 19)
    expect(formatHandshake(ts)).toBe('3d ago')
  })
})
