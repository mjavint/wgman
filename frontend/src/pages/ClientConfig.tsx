import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

interface ClientConfig {
  name: string
  private_key: string
  public_key: string
  address: string
  dns: string
  allowed_ips: string
  endpoint: string
  mtu: number
  persistent_keepalive: number
  qr_code: string
}

export default function ClientConfig() {
  const [searchParams] = useSearchParams()
  const clientId = searchParams.get('id')
  
  const [config, setConfig] = useState<ClientConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  useEffect(() => {
    loadClientConfig()
  }, [clientId])

  const loadClientConfig = async () => {
    if (!clientId) {
      setError('No client ID provided')
      setLoading(false)
      return
    }

    try {
      const res = await fetch(`/api/public/client/${clientId}`)
      const data = await res.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Client not found')
      }
      
      setConfig(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(''), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const generateConfigFile = () => {
    if (!config) return ''
    
    return `[Interface]
PrivateKey = ${config.private_key}
Address = ${config.address}
DNS = ${config.dns}
${config.mtu ? `MTU = ${config.mtu}` : ''}

[Peer]
PublicKey = ${config.public_key}
AllowedIPs = ${config.allowed_ips}
${config.endpoint ? `Endpoint = ${config.endpoint}` : ''}
${config.persistent_keepalive ? `PersistentKeepalive = ${config.persistent_keepalive}` : ''}
`.trim()
  }

  const downloadConfig = () => {
    const configContent = generateConfigFile()
    const blob = new Blob([configContent], { type: 'application/x-wireguard' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${config?.name || 'wireguard'}.conf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="public-page">
        <div className="loading">Loading configuration...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="public-page">
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
            </svg>
          </div>
          <div className="empty-state-title">Configuration Not Found</div>
          <div className="empty-state-desc">{error}</div>
        </div>
      </div>
    )
  }

  if (!config) return null

  return (
    <div className="public-page">
      <div className="public-card animate-scale-in">
        <div className="public-header">
          <div className="public-logo">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div>
            <h1 className="public-title">{config.name}</h1>
            <p className="public-subtitle">WireGuard VPN Configuration</p>
          </div>
        </div>

        {config.qr_code && (
          <div className="qr-section">
            <div className="qr-label">Scan with WireGuard App</div>
            <div className="qr-container">
              <img src={`data:image/png;base64,${config.qr_code}`} alt="WireGuard QR Code" />
            </div>
          </div>
        )}

        <div className="config-section">
          <h3 className="section-title">Connection Details</h3>
          
          <ConfigRow
            label="Address"
            value={config.address}
            onCopy={() => copyToClipboard(config.address, 'address')}
            copied={copied === 'address'}
          />
          <ConfigRow
            label="DNS"
            value={config.dns}
            onCopy={() => copyToClipboard(config.dns, 'dns')}
            copied={copied === 'dns'}
          />
          <ConfigRow
            label="Endpoint"
            value={config.endpoint}
            onCopy={() => copyToClipboard(config.endpoint, 'endpoint')}
            copied={copied === 'endpoint'}
          />
          <ConfigRow
            label="Allowed IPs"
            value={config.allowed_ips}
            onCopy={() => copyToClipboard(config.allowed_ips, 'allowed_ips')}
            copied={copied === 'allowed_ips'}
          />
        </div>

        <div className="config-section">
          <h3 className="section-title">Keys</h3>
          
          <ConfigRow
            label="Private Key"
            value={config.private_key}
            onCopy={() => copyToClipboard(config.private_key, 'private_key')}
            copied={copied === 'private_key'}
            isPrivate
          />
          <ConfigRow
            label="Public Key"
            value={config.public_key}
            onCopy={() => copyToClipboard(config.public_key, 'public_key')}
            copied={copied === 'public_key'}
          />
        </div>

        <div className="config-section">
          <h3 className="section-title">Advanced</h3>
          
          <ConfigRow
            label="MTU"
            value={config.mtu?.toString() || '1420'}
          />
          <ConfigRow
            label="Persistent Keepalive"
            value={config.persistent_keepalive ? `${config.persistent_keepalive} seconds` : '25 seconds'}
          />
        </div>

        <div className="public-actions">
          <button className="btn btn-primary" onClick={downloadConfig}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download .conf
          </button>
          <button className="btn btn-secondary" onClick={() => copyToClipboard(generateConfigFile(), 'config')}>
            {copied === 'config' ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copy Config
              </>
            )}
          </button>
        </div>

        <div className="public-footer">
          <p>Set up your WireGuard client using the configuration above. Download the config file or scan the QR code with the WireGuard app on your device.</p>
        </div>
      </div>
    </div>
  )
}

function ConfigRow({
  label,
  value,
  onCopy,
  copied,
  isPrivate,
}: {
  label: string
  value: string
  onCopy?: () => void
  copied?: boolean
  isPrivate?: boolean
}) {
  return (
    <div className="config-row">
      <span className="config-label">{label}</span>
      <div className="config-value-wrapper">
        <code className={`config-value ${isPrivate ? 'config-value-private' : ''}`}>
          {value || '—'}
        </code>
        {onCopy && (
          <button className="copy-btn" onClick={onCopy} title={`Copy ${label}`}>
            {copied ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  )
}