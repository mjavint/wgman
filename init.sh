#!/bin/bash
set -euo pipefail

# ── /dev/net/tun ──────────────────────────────────────────────────────────────
if [ -c /dev/net/tun ]; then
    chmod 666 /dev/net/tun 2>/dev/null || true
fi

# ── WireGuard group ───────────────────────────────────────────────────────────
addgroup wgman wireguard 2>/dev/null || true

# ── IP forwarding ─────────────────────────────────────────────────────────────
# Belt-and-suspenders: sysctl in docker-compose sets this at namespace level,
# but we also set it here so it is guaranteed active before wg-quick starts.
sysctl -w net.ipv4.ip_forward=1             2>/dev/null || true
sysctl -w net.ipv4.conf.all.forwarding=1    2>/dev/null || true
sysctl -w net.ipv6.conf.all.forwarding=1    2>/dev/null || true

# ── WireGuard kernel module ───────────────────────────────────────────────────
modprobe wireguard 2>/dev/null || true

# ── Graceful shutdown ─────────────────────────────────────────────────────────
# On SIGTERM bring the WireGuard interface down cleanly before the container stops.
_shutdown() {
    conf=$(jq -r .config_file_path /app/db/server/global_settings.json 2>/dev/null \
           || echo /app/db/wg0.conf)
    sudo wg-quick down "$conf" 2>/dev/null || true
}
trap _shutdown SIGTERM SIGINT

# ── Start application ─────────────────────────────────────────────────────────
# wgman handles WireGuard auto-start after initialising the config.
exec ./wgman
