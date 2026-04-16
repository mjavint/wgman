import { useEffect, useState } from 'react'
import { getClients, createClient, updateClient, deleteClient, setClientStatus } from '../api/clients'
import { connectionStatus, formatBytes, formatRate, formatHandshake } from '../utils/clientStats'
import { usePeerStats } from '../hooks/usePeerStats'
import type { Client } from '../types'

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([])
  const peerStats = usePeerStats()
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [viewingClient, setViewingClient] = useState<Client | null>(null)
  const [error, setError] = useState('')

  useEffect(() => { loadClients() }, [])

  const loadClients = async () => {
    try {
      const data = await getClients()
      setClients(data as Client[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clients')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete client "${name}"? This cannot be undone.`)) return
    try {
      await deleteClient(id)
      loadClients()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete client')
    }
  }

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await setClientStatus(id, enabled)
      setClients((prev) => prev.map((c) => c.id === id ? { ...c, enabled } : c))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status')
    }
  }

  const activeCount = clients.filter((c) => c.enabled).length
  const connectedCount = clients.filter((c) => {
    const s = peerStats[c.public_key]
    return s && connectionStatus(s.latestHandshake) === 'connected'
  }).length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">
            {clients.length} total &middot; {activeCount} active &middot;{' '}
            <span style={{ color: connectedCount > 0 ? 'var(--green)' : 'var(--text-muted)' }}>
              {connectedCount} online
            </span>
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditingClient(null); setShowModal(true) }}>
          + New Client
        </button>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          {error}
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading clients...</div>
      ) : clients.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">⬡</div>
          <div className="empty-state-title">No clients yet</div>
          <div className="empty-state-desc">Add a client to generate a WireGuard configuration.</div>
          <button className="btn btn-primary" onClick={() => { setEditingClient(null); setShowModal(true) }}>+ New Client</button>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Client</th>
                <th>IP</th>
                <th>Connection</th>
                <th>↓ Download</th>
                <th>↑ Upload</th>
                <th>Last seen</th>
                <th>Enabled</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => {
                const stats = peerStats[client.public_key]
                const status = stats ? connectionStatus(stats.latestHandshake) : 'offline'
                const lastSeen = stats ? formatHandshake(stats.latestHandshake) : null

                return (
                  <tr key={client.id}>
                    {/* Client name */}
                    <td>
                      <div style={{ fontWeight: 500 }}>{client.name}</div>
                      {client.email && <div className="text-muted" style={{ fontSize: '0.75rem' }}>{client.email}</div>}
                    </td>

                    {/* Allocated IP */}
                    <td><span className="text-mono">{client.allocated_ips || '—'}</span></td>

                    {/* Connection badge */}
                    <td>
                      {!stats ? (
                        <span className="badge" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                          <span className="badge-dot" style={{ background: 'var(--text-muted)' }} />
                          Offline
                        </span>
                      ) : status === 'connected' ? (
                        <span className="badge badge-green">
                          <span className="badge-dot" />
                          Connected
                        </span>
                      ) : status === 'idle' ? (
                        <span className="badge badge-yellow">
                          <span className="badge-dot" />
                          Idle
                        </span>
                      ) : (
                        <span className="badge" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                          <span className="badge-dot" style={{ background: 'var(--text-muted)' }} />
                          Never
                        </span>
                      )}
                    </td>

                    {/* Download */}
                    <td>
                      <TrafficCell bytes={stats?.rx ?? 0} rate={stats?.rxRate ?? 0} color="var(--green)" />
                    </td>

                    {/* Upload */}
                    <td>
                      <TrafficCell bytes={stats?.tx ?? 0} rate={stats?.txRate ?? 0} color="var(--accent)" />
                    </td>

                    {/* Last seen */}
                    <td>
                      <span className="text-muted" style={{ fontSize: '0.8125rem' }}>
                        {lastSeen ?? '—'}
                      </span>
                    </td>

                    {/* Toggle */}
                    <td>
                      <label className="toggle" title={client.enabled ? 'Active' : 'Inactive'}>
                        <input type="checkbox" checked={client.enabled} onChange={(e) => handleToggle(client.id, e.target.checked)} />
                        <span className="toggle-slider" />
                      </label>
                    </td>

                    {/* Actions */}
                    <td>
                      <div className="table-actions">
                        <button className="btn-icon" title="View config / QR code" onClick={() => setViewingClient(client)}>⊞</button>
                        <button className="btn-icon" title="Edit" onClick={() => { setEditingClient(client); setShowModal(true) }}>✎</button>
                        <button className="btn-icon" title="Delete" style={{ color: 'var(--red)' }} onClick={() => handleDelete(client.id, client.name)}>✕</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <ClientModal
          client={editingClient}
          onClose={() => { setShowModal(false); setEditingClient(null) }}
          onSaved={() => { setShowModal(false); setEditingClient(null); loadClients() }}
        />
      )}

      {viewingClient && (
        <ClientConfigModal client={viewingClient} onClose={() => setViewingClient(null)} />
      )}
    </div>
  )
}

// ── Traffic cell with total + rate indicator ──────────────────────────────────
function TrafficCell({ bytes, rate, color }: { bytes: number; rate: number; color: string }) {
  const rateLabel = formatRate(rate)
  return (
    <div style={{ minWidth: '90px' }}>
      <div style={{ fontSize: '0.875rem', fontWeight: 500, color: bytes > 0 ? color : 'var(--text-muted)' }}>
        {formatBytes(bytes)}
      </div>
      {rateLabel && (
        <div style={{ fontSize: '0.6875rem', color, opacity: 0.75, marginTop: '1px' }}>
          ▲ {rateLabel}
        </div>
      )}
    </div>
  )
}

// ── Client modal (create / edit) ──────────────────────────────────────────────
function ClientModal({ client, onClose, onSaved }: {
  client: Client | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: client?.name ?? '',
    email: client?.email ?? '',
    allocated_ips: client?.allocated_ips ?? '',
    allowed_ips: client?.allowed_ips ?? '0.0.0.0/0, ::/0',
    endpoint: client?.endpoint ?? '',
    enabled: client?.enabled ?? true,
    public_key: client?.public_key ?? '',
    preshared_key: client?.preshared_key ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (client) {
        await updateClient({ ...form, id: client.id })
      } else {
        await createClient(form)
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save client')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{client ? 'Edit Client' : 'New Client'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Allocated IP</label>
              <input className="form-input text-mono" value={form.allocated_ips} onChange={(e) => setForm({ ...form, allocated_ips: e.target.value })} placeholder="10.252.1.x/32" />
            </div>
            <div className="form-group">
              <label className="form-label">Allowed IPs</label>
              <input className="form-input text-mono" value={form.allowed_ips} onChange={(e) => setForm({ ...form, allowed_ips: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Endpoint</label>
              <input className="form-input text-mono" value={form.endpoint} onChange={(e) => setForm({ ...form, endpoint: e.target.value })} placeholder="host:port" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : client ? 'Save Changes' : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Client config / QR modal ──────────────────────────────────────────────────
function ClientConfigModal({ client, onClose }: { client: Client; onClose: () => void }) {
  const downloadUrl = `/api/download?clientid=${client.id}`
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{client.name}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ textAlign: 'center' }}>
          {client.qr_code ? (
            <img src={`data:image/png;base64,${client.qr_code}`} alt="QR Code" style={{ maxWidth: '220px', borderRadius: '8px', marginBottom: '1rem' }} />
          ) : (
            <div className="text-muted" style={{ marginBottom: '1rem' }}>No QR code available</div>
          )}
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Scan with the WireGuard app or download the config file.
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
          <a href={downloadUrl} className="btn btn-primary" download={`${client.name}.conf`}>↓ Download Config</a>
        </div>
      </div>
    </div>
  )
}
