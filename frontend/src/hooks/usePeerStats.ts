import { useState, useEffect, useRef, useCallback } from 'react'
import type { PeerStats, WgDevice } from '../types'

/**
 * Polls /api/status every `intervalMs` ms and returns a map of
 * public_key → PeerStats with computed traffic rates.
 */
export function usePeerStats(intervalMs = 5000): Record<string, PeerStats> {
  const [peerStats, setPeerStats] = useState<Record<string, PeerStats>>({})
  const prevTraffic = useRef<Record<string, { rx: number; tx: number; time: number }>>({})

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/status')
      const body = await res.json()
      if (!body.success) return

      const now = Date.now()
      const stats: Record<string, PeerStats> = {}

      for (const dev of body.data as WgDevice[]) {
        for (const peer of dev.peers) {
          const rx = parseInt(peer.transfer_rx) || 0
          const tx = parseInt(peer.transfer_tx) || 0
          const prev = prevTraffic.current[peer.public_key]
          let rxRate = 0, txRate = 0
          if (prev && now - prev.time > 0) {
            const dt = (now - prev.time) / 1000
            rxRate = Math.max(0, (rx - prev.rx) / dt)
            txRate = Math.max(0, (tx - prev.tx) / dt)
          }
          prevTraffic.current[peer.public_key] = { rx, tx, time: now }
          stats[peer.public_key] = {
            rx, tx, rxRate, txRate,
            latestHandshake: peer.latest_handshake,
            endpoint: peer.endpoint,
          }
        }
      }

      setPeerStats(stats)
    } catch { /* WireGuard may not be running */ }
  }, [])

  useEffect(() => {
    poll()
    const id = setInterval(poll, intervalMs)
    return () => clearInterval(id)
  }, [poll, intervalMs])

  return peerStats
}
