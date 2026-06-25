/**
 * RouterConfigModal — generates a ready-to-paste NAS setup script
 * for any supported hardware vendor.
 *
 * Props:
 *   tenantName  — display name
 *   domain      — portal domain (e.g. wifi.javacafe.com)
 *   vendorType  — mikrotik | unifi | omada | openwrt | radius | none
 *   onClose     — close handler
 */

import { useState } from 'react'

type VendorType = 'mikrotik' | 'unifi' | 'omada' | 'openwrt' | 'radius' | 'none'

interface Props {
  tenantName: string
  domain:     string
  vendorType: VendorType
  onClose:    () => void
}

// ── Script generators ─────────────────────────────────────────────────────

function scriptMikrotik(name: string, domain: string): string {
  const date = new Date().toLocaleDateString()
  return `# =================================================================
# WiFi Platform - MikroTik HotSpot Setup Script
# Tenant   : ${name}
# Portal   : https://${domain}
# Generated: ${date}
# =================================================================
# Paste in Winbox > New Terminal, or run via SSH.
# Requires RouterOS v6.x or v7.x with an active HotSpot server.

# --- Step 1: Walled-garden (allow portal domain before auth) ------
/ip hotspot walled-garden
add dst-host="${domain}" comment="WiFi Platform portal"
add dst-host="*.${domain}" comment="WiFi Platform wildcard"

# --- Step 2: Point every hotspot profile at the external portal ---
/ip hotspot profile
set [find] login-page="https://${domain}" html-directory=""

# --- Step 3: Restart hotspot servers to apply changes -------------
:foreach h in=[/ip hotspot find] do={ /ip hotspot disable $h }
:delay 2s
:foreach h in=[/ip hotspot find] do={ /ip hotspot enable $h }

:log info "WiFi Platform: HotSpot configured for ${domain}"
:put "Done - portal URL: https://${domain}"

# --- Notes --------------------------------------------------------
# The admin panel stores your RouterOS API credentials.
# The platform calls /ip/hotspot/active/add to grant access on login.
# Ensure API port 8728 is reachable from the platform server IP.
# To lock API access: /ip service set api address=<SERVER_IP>/32
`
}

function scriptUnifi(name: string, domain: string): string {
  return `# =================================================================
# WiFi Platform — Ubiquiti UniFi Setup Guide
# Tenant  : ${name}
# Portal  : https://${domain}
# =================================================================

# ── Web UI Setup (Network Controller) ────────────────────────────
#
# 1. Open UniFi Network → Settings → WiFi
#    Select your SSID → Advanced → Guest Policy: Enable Guest Network
#
# 2. Go to: Settings → Guest Hotspot
#    ┌─────────────────────────────────────────────┐
#    │ Splash Page Type : External Portal Server   │
#    │ Custom Portal URL: https://${domain.padEnd(30)} │
#    └─────────────────────────────────────────────┘
#
# 3. Under "Pre-Authorization Access" (Walled Garden), add:
#      ${domain}
#      *.${domain}
#
# 4. Click Apply Changes and push config to APs.
#
# ── Controller API (for automated access grants) ──────────────────
# The platform uses these REST endpoints:
#   POST /api/login                              (get session cookie)
#   POST /api/s/{site}/cmd/stamgr               (authorize-guest)
#
# Controller credentials are set in Admin → Tenant → Router Config.
# The controller must be reachable from the platform server on
# the configured port (default 8443).
#
# Self-signed certificates are automatically accepted for local
# controller installs. For UniFi Cloud, use the cloud hostname.
#
# ── Test ─────────────────────────────────────────────────────────
# After setup, use Admin → Tenant → ⚡ Test Connection to verify.
`
}

function scriptOmada(name: string, domain: string): string {
  return `# =================================================================
# WiFi Platform — TP-Link Omada Setup Guide
# Tenant  : ${name}
# Portal  : https://${domain}
# =================================================================

# ── Web UI Setup (Omada Controller v5+) ──────────────────────────
#
# 1. Open Omada Controller → Settings → Authentication → Portal
#
# 2. Select your SSID, then:
#    ┌─────────────────────────────────────────────────────────┐
#    │ Authentication Type : External Portal Server            │
#    │ Portal URL          : https://${domain.padEnd(27)} │
#    └─────────────────────────────────────────────────────────┘
#
# 3. Under "Walled Garden" add:
#      ${domain}
#      *.${domain}
#
# 4. Save and push configuration to all APs.
#
# ── Find your Omada Controller ID ────────────────────────────────
# In Omada web UI: Settings → Controller Settings → Controller Info
# Copy the value labelled "Omada ID" — looks like: abc123def456...
# Enter this in Admin → Tenant → Router Config → Controller ID.
#
# ── API Auth Flow ─────────────────────────────────────────────────
# The platform calls:
#   POST /{omadacId}/api/v2/hotspot/login             (get token)
#   POST /{omadacId}/openapi/v1/{omadacId}/sites/{siteId}/cmd/clients/{mac}/auth
#
# Controller must be reachable from the platform server.
# Default port: 8043.
#
# ── Test ─────────────────────────────────────────────────────────
# Admin → Tenant → ⚡ Test Connection
`
}

function scriptOpenwrt(name: string, domain: string): string {
  return `#!/bin/sh
# =================================================================
# WiFi Platform — OpenWRT / nodogsplash Setup Script
# Tenant  : ${name}
# Portal  : https://${domain}
# =================================================================
# Run as root via SSH:  sh setup_nodogsplash.sh
# Tested on OpenWRT 21.x / 22.x / 23.x

set -e

echo "── WiFi Platform: nodogsplash setup ──"
echo "   Portal: https://${domain}"
echo ""

# ── 1. Install nodogsplash ────────────────────────────────────────
echo "[1/4] Installing nodogsplash..."
opkg update
opkg install nodogsplash

# ── 2. Detect LAN interface ───────────────────────────────────────
LAN_IF=$(uci get network.lan.ifname 2>/dev/null || echo "br-lan")
echo "[2/4] Using LAN interface: $LAN_IF"

# ── 3. Write nodogsplash config ───────────────────────────────────
echo "[3/4] Writing /etc/nodogsplash/nodogsplash.conf..."
cat > /etc/nodogsplash/nodogsplash.conf << 'EOF'
GatewayName       WiFi-Platform
GatewayInterface  ${LAN_IF}
GatewayPort       2050
MaxClients        250
AuthIdleTimeout   120

# Redirect unauthenticated clients to the portal
RedirectURL https://${domain}

# Walled garden — allow portal traffic before authentication
FirewallRuleSet preauthenticated-users {
    FirewallRule allow tcp port 53
    FirewallRule allow udp port 53
    FirewallRule allow tcp port 80
    FirewallRule allow tcp port 443
}

FirewallRuleSet authenticated-users {
    FirewallRule allow all
}

FirewallRuleSet users-to-router {
    FirewallRule allow udp port 53
    FirewallRule allow tcp port 53
    FirewallRule allow udp port 67
    FirewallRule deny all
}
EOF

# ── 4. Enable and start ───────────────────────────────────────────
echo "[4/4] Enabling and starting nodogsplash..."
/etc/init.d/nodogsplash enable
/etc/init.d/nodogsplash restart

echo ""
echo "✓ nodogsplash configured for WiFi Platform"
echo ""
echo "IMPORTANT:"
echo "  The portal receives a ?tok=TOKEN query parameter from nodogsplash."
echo "  This token is forwarded to the platform on login and used to call"
echo "  the nodogsplash auth endpoint (port 2050) to grant internet access."
echo ""
echo "  Make sure the platform server can reach this router on port 2050."
echo "  Router IP set in Admin → Tenant → Router Config → Router IP."
`
}

function scriptRadius(name: string, domain: string): string {
  return `# =================================================================
# WiFi Platform — RADIUS / Generic NAS Setup Guide
# Tenant  : ${name}
# Portal  : https://${domain}
# =================================================================

# ── pfSense / OPNsense ────────────────────────────────────────────
#
# 1. Services → Captive Portal → Add Zone
#    ✓ Enable Captive Portal
#    Authentication method: No Authentication
#      (The WiFi Platform portal handles user authentication)
#    Pre-authentication redirect URL: https://${domain}
#
# 2. Allowed IPs (before auth) → Add:
#    Direction: To, Network: <platform server IP>/32, Ports: 80,443
#
# ── Cisco Meraki ─────────────────────────────────────────────────
#
# Dashboard → Wireless → [SSID] → Access control
# Splash page: Click-through, then set:
#   Captive portal URL: https://${domain}
#
# OR for advanced RADIUS integration:
# Dashboard → Wireless → RADIUS servers → Add your RADIUS server
#
# ── Ruckus ZoneDirector / SmartZone ──────────────────────────────
#
# Configure → Hotspot Services → Create
# Login URL : https://${domain}
# Start Page: redirect to original URL
#
# ── FreeRADIUS radiusd.conf snippet ──────────────────────────────
#
# Add to /etc/freeradius3/clients.conf:
#
# client wifi-nas {
#     ipaddr  = <NAS IP>
#     secret  = <shared secret set in Admin → Tenant → Router Config>
#     shortname = wifi-nas
# }
#
# ── How session authorisation works ──────────────────────────────
#
# 1. User connects to WiFi → NAS redirects to https://${domain}
# 2. User authenticates on the portal
# 3. Platform records the session (MAC + timestamp) in the database
# 4. Your NAS or RADIUS server should query the platform API or
#    webhook to verify the MAC is authorised before granting access.
#
# API endpoint (planned):
#   GET https://${domain}/api/v1/session?mac=<MAC>
#   Returns: { authorised: true/false, expiresAt: "..." }
#
# Contact support to enable the MAC authorisation webhook.
`
}

function getScript(vendor: VendorType, name: string, domain: string): string {
  switch (vendor) {
    case 'mikrotik': return scriptMikrotik(name, domain)
    case 'unifi':    return scriptUnifi(name, domain)
    case 'omada':    return scriptOmada(name, domain)
    case 'openwrt':  return scriptOpenwrt(name, domain)
    case 'radius':   return scriptRadius(name, domain)
    default:         return '# No configuration required for this vendor type.'
  }
}

function fileExtension(vendor: VendorType): string {
  return vendor === 'openwrt' ? 'sh' : 'txt'
}

// ── Modal component ───────────────────────────────────────────────────────

const VENDOR_LABELS: Record<VendorType, string> = {
  mikrotik: 'MikroTik RouterOS',
  unifi:    'Ubiquiti UniFi',
  omada:    'TP-Link Omada',
  openwrt:  'OpenWRT / nodogsplash',
  radius:   'RADIUS / Generic',
  none:     'None',
}

export default function RouterConfigModal({ tenantName, domain, vendorType, onClose }: Props) {
  const [copied, setCopied] = useState(false)

  const script = getScript(vendorType, tenantName, domain)
  const ext    = fileExtension(vendorType)

  const copy = async () => {
    await navigator.clipboard.writeText(script)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const download = () => {
    const blob = new Blob([script], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `wifi-platform-${vendorType}-setup.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (vendorType === 'none') {
    return (
      <div style={overlay}>
        <div style={modal}>
          <div style={modalHeader}>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Router Config — None / Manual</h2>
            <button onClick={onClose} style={closeBtn}>✕</button>
          </div>
          <div style={{ padding: '1.5rem' }}>
            <p style={{ color: 'var(--muted)' }}>
              No router configuration is needed — your hardware handles authentication externally.
            </p>
            <p style={{ color: 'var(--muted)' }}>
              Ensure your router redirects unauthenticated clients to:<br />
              <code style={codeTag}>https://{domain}</code>
            </p>
          </div>
          <div style={modalFooter}>
            <button className="btn btn-outline" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...modal, maxWidth: 760 }}>
        {/* Header */}
        <div style={modalHeader}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
              Router Setup Script
            </h2>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
              {VENDOR_LABELS[vendorType]} · {tenantName} · {domain}
            </div>
          </div>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        {/* Script preview */}
        <div style={{ padding: '0 1.25rem', flex: 1, overflow: 'auto' }}>
          <pre style={{
            background: '#0f172a', color: '#e2e8f0',
            borderRadius: 10, padding: '1rem', fontSize: '0.78rem',
            lineHeight: 1.65, overflowX: 'auto', maxHeight: 480,
            margin: 0, fontFamily: '"Cascadia Code", "Fira Code", monospace',
          }}>
            {script}
          </pre>
        </div>

        {/* Footer */}
        <div style={{ ...modalFooter, gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--muted)', flex: 1 }}>
            {vendorType === 'mikrotik' && 'Paste in Winbox Terminal or run via SSH'}
            {vendorType === 'openwrt' && 'Run as root via SSH: sh setup_nodogsplash.sh'}
            {(vendorType === 'unifi' || vendorType === 'omada') && 'Follow the steps in the script — no shell required'}
            {vendorType === 'radius' && 'Refer to your NAS vendor documentation'}
          </span>
          <button className="btn btn-outline btn-sm" onClick={copy}>
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>
          <button className="btn btn-outline btn-sm" onClick={download}>
            ⬇ Download .{ext}
          </button>
          <button className="btn btn-primary btn-sm" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: '1rem',
}

const modal: React.CSSProperties = {
  background: 'var(--surface, #fff)',
  borderRadius: 14,
  width: '100%',
  maxWidth: 720,
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
  overflow: 'hidden',
}

const modalHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
  padding: '1.1rem 1.25rem 0.9rem',
  borderBottom: '1px solid var(--border)',
}

const modalFooter: React.CSSProperties = {
  display: 'flex', alignItems: 'center',
  padding: '0.875rem 1.25rem',
  borderTop: '1px solid var(--border)',
}

const closeBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: '1.1rem', color: 'var(--muted)', padding: '0 0.25rem',
  lineHeight: 1,
}

const codeTag: React.CSSProperties = {
  background: 'var(--bg, #f5f5f5)', padding: '2px 6px',
  borderRadius: 4, fontFamily: 'monospace',
}
