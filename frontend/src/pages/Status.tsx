import { useEffect, useState, useCallback } from 'react'
import { getWgInterfaceStatus, startWgInterface, stopWgInterface, restartWgInterface } from '../api'

interface Peer {
  public_key: string
  endpoint: string
  allowed_ips: string
  latest_handshake: string
  transfer_rx: string
  transfer_tx: string
}

interface DeviceStatus {
  device: string
  peers: Peer[]
}

interface InterfaceStatus {
  running: boolean
  interface: string
  manageable: boolean
}

function formatBytes(bytes: string) {
  const b = parseInt(bytes) || 0
  if (b === 0) return '0 B'
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatHandshake(ts: string) {
  if (!ts || ts === '0001-01-01 00:00:00') return 'Never'
  const d = new Date(ts.replace(' ', 'T') + 'Z')
  if (isNaN(d.getTime())) return ts
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diffSec < 60) return `${diffSec}s ago`
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  return `${Math.floor(diffSec / 86400)}d ago`
}

function isConnected(ts: string) {
  if (!ts || ts === '0001-01-01 00:00:00') return false
  const d = new Date(ts.replace(' ', 'T') + 'Z')
  if (isNaN(d.getTime())) return false
  return (Date.now() - d.getTime()) / 1000 < 180
}

export default function Status() {
  const [status, setStatus] = useState<DeviceStatus[]>([])
  const [ifStatus, setIfStatus] = useState<InterfaceStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<'start' | 'stop' | 'restart' | null>(null)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const loadStatus = useCallback(async () => {
    try {
      const [res, ifRes] = await Promise.all([
        fetch('/api/status'),
        getWgInterfaceStatus().catch(() => null),
      ])
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Failed to fetch status')
      setStatus(data.data as DeviceStatus[])
      if (ifRes) setIfStatus(ifRes as InterfaceStatus)
      setLastUpdate(new Date())
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStatus()
    const interval = setInterval(loadStatus, 5000)
    return () => clearInterval(interval)
  }, [loadStatus])

  const handleAction = async (action: 'start' | 'stop' | 'restart') => {
    setActionLoading(action)
    setActionError('')
    try {
      if (action === 'start') await startWgInterface()
      else if (action === 'stop') await stopWgInterface()
      else await restartWgInterface()
      await loadStatus()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `Failed to ${action} WireGuard`)
    } finally {
      setActionLoading(null)
    }
  }

  const totalPeers = status.reduce((sum, d) => sum + d.peers.length, 0)
  const connectedPeers = status.reduce(
    (sum, d) => sum + d.peers.filter((p) => isConnected(p.latest_handshake)).length,
    0
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Status</h1>
          {lastUpdate && (
            <p className="page-subtitle">
              Updated {lastUpdate.toLocaleTimeString()} · auto-refresh every 5s
            </p>
          )}
        </div>
        <button className="btn btn-secondary" onClick={loadStatus}>
          ↻ Refresh
        </button>
      </div>

      {/* Interface control panel */}
      {ifStatus && (
        <div className="card" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Interface</span>
            <span className="badge badge-green" style={{ fontFamily: 'monospace' }}>{ifStatus.interface}</span>
            <span className={`badge ${ifStatus.running ? 'badge-green' : 'badge-red'}`}>
              <span className="badge-dot" />
              {ifStatus.running ? 'Running' : 'Stopped'}
            </span>
          </div>

          {ifStatus.manageable && (
            <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
              <button
                className="btn btn-secondary"
                onClick={() => handleAction('start')}
                disabled={actionLoading !== null || ifStatus.running}
                title="Start WireGuard"
              >
                {actionLoading === 'start' ? '...' : '▶ Start'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleAction('stop')}
                disabled={actionLoading !== null || !ifStatus.running}
                title="Stop WireGuard"
              >
                {actionLoading === 'stop' ? '...' : '■ Stop'}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleAction('restart')}
                disabled={actionLoading !== null}
                title="Restart WireGuard"
              >
                {actionLoading === 'restart' ? 'Restarting...' : '↺ Restart'}
              </button>
            </div>
          )}
        </div>
      )}

      {actionError && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{actionError}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Interfaces</div>
          <div className="stat-value accent">{status.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Peers</div>
          <div className="stat-value">{totalPeers}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Connected</div>
          <div className="stat-value" style={{ color: connectedPeers > 0 ? 'var(--green)' : 'var(--text-muted)' }}>
            {connectedPeers}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading status...</div>
      ) : !ifStatus?.running && status.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">◉</div>
          <div className="empty-state-title">WireGuard interface is not running</div>
          <div className="empty-state-desc">
            {ifStatus?.manageable ? (
              <p>Click <strong>▶ Start</strong> above to start the WireGuard interface.</p>
            ) : (
              <>
                <p>WireGuard is not running or no interfaces are active.</p>
                <p style={{ marginTop: '0.5rem', fontSize: '0.8125rem' }}>
                  Enable <code>WGUI_MANAGE_START=true</code> in your environment to control the interface from the UI.
                </p>
              </>
            )}
          </div>
        </div>
      ) : (
        status.map((dev, idx) => (
          <div key={idx} style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.875rem' }}>
              <span className="badge badge-green">
                <span className="badge-dot" />
                {dev.device}
              </span>
              <span className="text-muted" style={{ fontSize: '0.8125rem' }}>
                {dev.peers.length} peer{dev.peers.length !== 1 ? 's' : ''}
              </span>
            </div>

            {dev.peers.length === 0 ? (
              <div className="card">
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  No peers connected to this interface.
                </p>
              </div>
            ) : (
              dev.peers.map((peer, peerIdx) => {
                const connected = isConnected(peer.latest_handshake)
                return (
                  <div key={peerIdx} className="peer-card">
                    <div className="peer-header">
                      <span className="peer-key">
                        {peer.public_key.slice(0, 28)}…
                      </span>
                      <span className={`badge ${connected ? 'badge-green' : 'badge-red'}`}>
                        <span className="badge-dot" />
                        {connected ? 'Connected' : 'Idle'}
                      </span>
                    </div>
                    <div className="peer-meta">
                      {peer.endpoint && peer.endpoint !== '<nil>' && (
                        <div className="peer-meta-item">
                          <span className="peer-meta-label">Endpoint</span>
                          <span className="text-mono">{peer.endpoint}</span>
                        </div>
                      )}
                      <div className="peer-meta-item">
                        <span className="peer-meta-label">Allowed IPs</span>
                        <span className="text-mono">{peer.allowed_ips || '—'}</span>
                      </div>
                      <div className="peer-meta-item">
                        <span className="peer-meta-label">Last handshake</span>
                        <span>{formatHandshake(peer.latest_handshake)}</span>
                      </div>
                      <div className="peer-meta-item">
                        <span className="peer-meta-label">↓</span>
                        <span>{formatBytes(peer.transfer_rx)}</span>
                      </div>
                      <div className="peer-meta-item">
                        <span className="peer-meta-label">↑</span>
                        <span>{formatBytes(peer.transfer_tx)}</span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        ))
      )}
    </div>
  )
}
