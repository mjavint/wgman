import { useEffect, useState } from 'react'
import { getServerConfig, updateServerConfig, generateServerKeyPair } from '../api'

interface ServerConfig {
  private_key: string
  public_key: string
  address: string
  listen_port: number
  dns: string
  firewall_mark: string
  post_up: string
  post_down: string
  endpoint_address: string
  mtu: number
  persistent_keepalive: number
  config_file_path: string
  table: string
}

export default function Server() {
  const [config, setConfig] = useState<ServerConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPrivateKey, setShowPrivateKey] = useState(false)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const data = await getServerConfig()
      setConfig(data as ServerConfig)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load config')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await updateServerConfig(config as unknown as Record<string, unknown>)
      setSuccess('Configuration saved successfully')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save config')
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateKeyPair = async () => {
    if (!config) return
    if (!confirm('Generate new key pair? This will disconnect all current clients. Continue?'))
    
    setGenerating(true)
    setError('')
    try {
      const data = await generateServerKeyPair()
      setConfig({
        ...config,
        private_key: data.private_key,
        public_key: data.public_key,
      })
      setSuccess('New key pair generated successfully')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate key pair')
    } finally {
      setGenerating(false)
    }
  }

  const handleDetectEndpoint = async () => {
    try {
      const res = await fetch('https://api.ipify.org?format=json')
      const data = await res.json()
      if (config) {
        setConfig({ ...config, endpoint_address: data.ip })
      }
    } catch {
      setError('Failed to detect public IP')
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setSuccess('Copied to clipboard')
      setTimeout(() => setSuccess(''), 2000)
    } catch {
      setError('Failed to copy')
    }
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="animate-pulse">Loading...</div>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">No configuration</div>
        <div className="empty-state-desc">Unable to load server configuration.</div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Server Configuration</h1>
          <p className="page-subtitle">Configure WireGuard server settings</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          {error}
          <button
            onClick={() => setError('')}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}

      {success && (
        <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
          {success}
        </div>
      )}

      <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-md)' }}>
          <h2 className="card-title" style={{ margin: 0 }}>Server Keys</h2>
          <button
            className="btn btn-secondary"
            onClick={handleGenerateKeyPair}
            disabled={generating}
          >
            {generating ? (
              <span className="animate-pulse">Generating...</span>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
                </svg>
                Generate New Keys
              </>
            )}
          </button>
        </div>

        <div className="form-group">
          <label>Private Key</label>
          <div className="key-input-wrapper">
            <input
              type={showPrivateKey ? 'text' : 'password'}
              value={config.private_key || ''}
              onChange={(e) => setConfig({ ...config, private_key: e.target.value })}
              className="text-mono"
              placeholder="Base64 encoded private key"
            />
            <button
              type="button"
              className="key-toggle-btn"
              onClick={() => setShowPrivateKey(!showPrivateKey)}
              title={showPrivateKey ? 'Hide' : 'Show'}
            >
              {showPrivateKey ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.9 9.9 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.06 3.95M1 1l22 22"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>
          <div className="form-hint">Keep this secret! Used to decrypt traffic.</div>
        </div>

        <div className="form-group">
          <label>Public Key</label>
          <div className="key-display">
            <code>{config.public_key || '—'}</code>
            {config.public_key && (
              <button
                className="btn-icon"
                onClick={() => copyToClipboard(config.public_key)}
                title="Copy public key"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              </button>
            )}
          </div>
          <div className="form-hint">Share this with clients to connect.</div>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleSave() }}>
        <div className="card">
          <h2 className="card-title">Interface Settings</h2>

          <div className="form-row">
            <div className="form-group">
              <label>Listen Port</label>
              <input
                type="number"
                value={config.listen_port}
                onChange={(e) => setConfig({ ...config, listen_port: parseInt(e.target.value) || 51820 })}
                placeholder="51820"
              />
              <div className="form-hint">UDP port for incoming connections</div>
            </div>
            <div className="form-group">
              <label>Address</label>
              <input
                type="text"
                value={config.address}
                onChange={(e) => setConfig({ ...config, address: e.target.value })}
                placeholder="10.0.0.1/24"
              />
              <div className="form-hint">VPN subnet (CIDR notation)</div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>DNS Servers</label>
              <input
                type="text"
                value={config.dns}
                onChange={(e) => setConfig({ ...config, dns: e.target.value })}
                placeholder="1.1.1.1, 8.8.8.8"
              />
              <div className="form-hint">Comma-separated DNS servers</div>
            </div>
            <div className="form-group">
              <label>Endpoint Address</label>
              <div className="input-with-button">
                <input
                  type="text"
                  value={config.endpoint_address}
                  onChange={(e) => setConfig({ ...config, endpoint_address: e.target.value })}
                  placeholder="your-public-ip.com"
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleDetectEndpoint}
                >
                  Detect
                </button>
              </div>
              <div className="form-hint">Public IP for clients to connect</div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>MTU</label>
              <input
                type="number"
                value={config.mtu || ''}
                onChange={(e) => setConfig({ ...config, mtu: parseInt(e.target.value) || 0 })}
                placeholder="1420"
              />
              <div className="form-hint">Leave empty to omit in config</div>
            </div>
            <div className="form-group">
              <label>Persistent Keepalive</label>
              <input
                type="number"
                value={config.persistent_keepalive || ''}
                onChange={(e) => setConfig({ ...config, persistent_keepalive: parseInt(e.target.value) || 0 })}
                placeholder="25"
              />
              <div className="form-hint">Seconds. Leave empty to omit</div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Firewall Mark</label>
              <input
                type="text"
                value={config.firewall_mark}
                onChange={(e) => setConfig({ ...config, firewall_mark: e.target.value })}
                placeholder="0xca6c"
              />
            </div>
            <div className="form-group">
              <label>Table</label>
              <input
                type="text"
                value={config.table}
                onChange={(e) => setConfig({ ...config, table: e.target.value })}
                placeholder="auto"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Wireguard Config File Path</label>
            <input
              type="text"
              value={config.config_file_path}
              onChange={(e) => setConfig({ ...config, config_file_path: e.target.value })}
              placeholder="/etc/wireguard/wg0.conf"
            />
            <div className="form-hint">Full path to the WireGuard config file</div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 'var(--space-md)' }}>
          <h2 className="card-title">Firewall Scripts</h2>

          <div className="form-group">
            <label>Post Up</label>
            <textarea
              value={config.post_up}
              onChange={(e) => setConfig({ ...config, post_up: e.target.value })}
              placeholder="iptables -A FORWARD -i %i -j ACCEPT..."
            />
            <div className="form-hint">Commands run after interface is brought up</div>
          </div>

          <div className="form-group">
            <label>Post Down</label>
            <textarea
              value={config.post_down}
              onChange={(e) => setConfig({ ...config, post_down: e.target.value })}
              placeholder="iptables -D FORWARD -i %i -j ACCEPT..."
            />
            <div className="form-hint">Commands run after interface is brought down</div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 'var(--space-md)' }}>
          <h2 className="card-title">Help</h2>
          
          <div className="help-section">
            <div className="help-item">
              <h3>Endpoint Address</h3>
              <p>The public IP address of your WireGuard server that the client will connect to. Click on "Detect" button to auto detect the public IP address of your server.</p>
            </div>
            
            <div className="help-item">
              <h3>DNS Servers</h3>
              <p>The DNS servers will be set to client config.</p>
            </div>
            
            <div className="help-item">
              <h3>MTU</h3>
              <p>The MTU will be set to server and client config. By default it is 1450. You might want to adjust the MTU size if your connection (e.g PPPoE, 3G, satellite network, etc) has a low MTU. Leave blank to omit this setting in the configs.</p>
            </div>
            
            <div className="help-item">
              <h3>Persistent Keepalive</h3>
              <p>By default, WireGuard peers remain silent while they do not need to communicate, so peers located behind a NAT and/or firewall may be unreachable from other peers until they reach out to other peers themselves. Adding PersistentKeepalive can ensure that the connection remains open. Leave blank to omit this setting in the Client config.</p>
            </div>
            
            <div className="help-item">
              <h3>Firewall Mark</h3>
              <p>Add a matching fwmark on all packets going out of a WireGuard non-default-route tunnel. Default value: 0xca6c</p>
            </div>
            
            <div className="help-item">
              <h3>Table</h3>
              <p>Value for the Table setting in the wg conf file. Default value: auto</p>
            </div>
            
            <div className="help-item">
              <h3>Wireguard Config File Path</h3>
              <p>The path of your WireGuard server config file. Please make sure the parent directory exists and is writable.</p>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </form>
    </div>
  )
}