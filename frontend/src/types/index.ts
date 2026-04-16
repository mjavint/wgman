// ── Client ────────────────────────────────────────────────────────────────────

export interface Client {
  id: string
  name: string
  email: string
  private_key: string
  public_key: string
  preshared_key: string
  allocated_ips: string
  allowed_ips: string
  endpoint: string
  enabled: boolean
  created_at: string
  qr_code: string
}

// ── WireGuard peer stats (from /api/status polling) ──────────────────────────

export interface PeerStats {
  rx: number
  tx: number
  rxRate: number   // bytes/sec
  txRate: number   // bytes/sec
  latestHandshake: string
  endpoint: string
}

// ── WireGuard status API types ────────────────────────────────────────────────

export interface WgPeer {
  public_key: string
  endpoint: string
  allowed_ips: string
  latest_handshake: string
  transfer_rx: string
  transfer_tx: string
}

export interface WgDevice {
  device: string
  peers: WgPeer[]
}

export interface WgInterfaceStatus {
  running: boolean
  manageable: boolean
  interface?: string
}

// ── Server config ─────────────────────────────────────────────────────────────

export interface ServerConfig {
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
