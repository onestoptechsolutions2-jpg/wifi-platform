/**
 * vendor.ts — Unified hardware vendor abstraction
 *
 * Supported vendors:
 *   mikrotik  — RouterOS API (port 8728/8729), TCP socket
 *   unifi     — Ubiquiti UniFi Controller REST API (port 8443)
 *   omada     — TP-Link Omada Controller REST API
 *   openwrt   — OpenWRT nodogsplash external auth redirect
 *   radius    — Generic RADIUS CoA (or manual / unsupported)
 *   none      — No-op (for setups that handle auth externally)
 *
 * Each vendor receives the full Tenant row plus the MAC address.
 * vendorConfig (JSON) holds vendor-specific encrypted credentials.
 */

import https from 'https'
import http  from 'http'
import { mikrotikGrantAccess } from './mikrotik.js'
import { decrypt, encrypt }    from '../utils/crypto.js'
import type { Tenant }          from '@prisma/client'

// ── Types ─────────────────────────────────────────────────────────────────

export type VendorType = 'mikrotik' | 'unifi' | 'omada' | 'openwrt' | 'radius' | 'none'

export interface VendorInfo {
  id:          VendorType
  name:        string
  description: string
  fields:      VendorField[]
}

export interface VendorField {
  key:         string
  label:       string
  type:        'text' | 'number' | 'password'
  placeholder?: string
  default?:    string | number
  hint?:       string
}

// ── Vendor registry — used by admin UI to show the right form ─────────────

export const VENDOR_REGISTRY: VendorInfo[] = [
  {
    id:          'mikrotik',
    name:        'MikroTik RouterOS',
    description: 'RouterOS API (port 8728). Works on all MikroTik routers running v6 or v7.',
    fields: [
      { key: 'host',      label: 'Router IP / Hostname', type: 'text',     placeholder: '192.168.88.1' },
      { key: 'port',      label: 'API Port',             type: 'number',   default: 8728 },
      { key: 'user',      label: 'API Username',         type: 'text',     placeholder: 'admin' },
      { key: 'password',  label: 'API Password',         type: 'password', placeholder: '••••••••' },
      { key: 'interface', label: 'Hotspot Interface',    type: 'text',     placeholder: 'bridge',
        hint: 'The bridge or ether interface your hotspot runs on' },
    ],
  },
  {
    id:          'unifi',
    name:        'Ubiquiti UniFi',
    description: 'UniFi Network Controller REST API. Works with USG, Dream Machine, and UniFi switches.',
    fields: [
      { key: 'host',     label: 'Controller IP / Hostname', type: 'text',     placeholder: '192.168.1.1' },
      { key: 'port',     label: 'Controller Port',          type: 'number',   default: 8443 },
      { key: 'site',     label: 'Site Name',                type: 'text',     placeholder: 'default',
        hint: 'Lowercase site ID shown in the URL: /manage/site/default' },
      { key: 'user',     label: 'Admin Username',           type: 'text',     placeholder: 'admin' },
      { key: 'password', label: 'Admin Password',           type: 'password', placeholder: '••••••••' },
    ],
  },
  {
    id:          'omada',
    name:        'TP-Link Omada',
    description: 'Omada Software Controller or OC200/OC300 hardware controller REST API.',
    fields: [
      { key: 'host',          label: 'Controller IP / Hostname', type: 'text',     placeholder: '192.168.1.1' },
      { key: 'port',          label: 'Controller Port',          type: 'number',   default: 8043 },
      { key: 'omadacId',      label: 'Omada Controller ID',      type: 'text',     placeholder: 'abc123def456',
        hint: 'Found in Omada → Settings → Controller Info' },
      { key: 'siteId',        label: 'Site ID',                  type: 'text',     placeholder: 'Default',
        hint: 'Omada site name (case-sensitive)' },
      { key: 'user',          label: 'Admin Username',           type: 'text',     placeholder: 'admin' },
      { key: 'password',      label: 'Admin Password',           type: 'password', placeholder: '••••••••' },
    ],
  },
  {
    id:          'openwrt',
    name:        'OpenWRT / nodogsplash',
    description: 'OpenWRT router running nodogsplash. The portal redirects to nodogsplash auth endpoint to grant access.',
    fields: [
      { key: 'host', label: 'Router IP',       type: 'text',   placeholder: '192.168.1.1' },
      { key: 'port', label: 'Nodogsplash Port', type: 'number', default: 2050,
        hint: 'Usually 2050 — check /etc/nodogsplash/nodogsplash.conf GatewayPort' },
    ],
  },
  {
    id:          'radius',
    name:        'RADIUS / Generic',
    description: 'pfSense, OPNsense, Cisco Meraki, Ruckus, or any RADIUS-based system. The system logs access grants — configure your RADIUS server to accept MACs after portal login.',
    fields: [
      { key: 'radiusHost',   label: 'RADIUS Server IP', type: 'text',     placeholder: '192.168.1.10' },
      { key: 'radiusPort',   label: 'RADIUS Port',       type: 'number',   default: 1812 },
      { key: 'radiusSecret', label: 'Shared Secret',     type: 'password', placeholder: '••••••••' },
      { key: 'nasId',        label: 'NAS Identifier',    type: 'text',     placeholder: 'wifi-nas-01' },
    ],
  },
  {
    id:          'none',
    name:        'None / Manual',
    description: 'No automatic access grant. Use this if your hardware handles authentication externally (e.g., Cisco Meraki click-through, custom RADIUS).',
    fields: [],
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────

function getConfig(tenant: Tenant): Record<string, any> {
  return (tenant.vendorConfig as Record<string, any>) ?? {}
}

/** Make an HTTPS request (ignores self-signed certs for local controllers) */
function httpsRequest(options: https.RequestOptions & { body?: any }, rejectUnauthorized = false): Promise<any> {
  return new Promise((resolve, reject) => {
    const body = options.body ? JSON.stringify(options.body) : undefined
    const reqOpts: https.RequestOptions = {
      ...options,
      rejectUnauthorized,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': body ? Buffer.byteLength(body) : 0,
        ...(options.headers ?? {}),
      },
    }
    const req = https.request(reqOpts, (res) => {
      let data = ''
      res.on('data', chunk => (data += chunk))
      res.on('end', () => {
        try { resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) }) }
        catch { resolve({ status: res.statusCode, headers: res.headers, body: data }) }
      })
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

/** Same but plain HTTP */
function httpRequest(options: http.RequestOptions & { body?: any }): Promise<any> {
  return new Promise((resolve, reject) => {
    const body = options.body ? JSON.stringify(options.body) : undefined
    const reqOpts: http.RequestOptions = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': body ? Buffer.byteLength(body) : 0,
        ...(options.headers ?? {}),
      },
    }
    const req = http.request(reqOpts, (res) => {
      let data = ''
      res.on('data', chunk => (data += chunk))
      res.on('end', () => {
        try { resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) }) }
        catch { resolve({ status: res.statusCode, headers: res.headers, body: data }) }
      })
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

// ── UniFi ─────────────────────────────────────────────────────────────────

async function unifiGrantAccess(tenant: Tenant, macAddress: string, sessionMinutes = 240): Promise<void> {
  const cfg = getConfig(tenant)
  if (!cfg.host || !cfg.user || !cfg.passwordEnc) {
    throw new Error('UniFi not configured for this tenant')
  }

  const host     = cfg.host as string
  const port     = (cfg.port as number) ?? 8443
  const site     = (cfg.site as string) ?? 'default'
  const user     = cfg.user as string
  const password = decrypt(cfg.passwordEnc as string)

  // Step 1: Login → get session cookie
  const loginRes = await httpsRequest({
    hostname: host, port, method: 'POST',
    path: '/api/login',
    body: { username: user, password },
  })

  const setCookie = loginRes.headers['set-cookie'] as string[] | undefined
  const cookie    = setCookie?.map((c: string) => c.split(';')[0]).join('; ') ?? ''

  if (loginRes.status !== 200 || !cookie) {
    throw new Error(`UniFi login failed: ${JSON.stringify(loginRes.body)}`)
  }

  // Step 2: Authorize guest MAC
  const mac = macAddress.toLowerCase()
  const authRes = await httpsRequest({
    hostname: host, port, method: 'POST',
    path: `/api/s/${site}/cmd/stamgr`,
    headers: { Cookie: cookie },
    body: { cmd: 'authorize-guest', mac, minutes: sessionMinutes },
  })

  if (authRes.status !== 200) {
    throw new Error(`UniFi authorize failed: ${JSON.stringify(authRes.body)}`)
  }

  // Step 3: Logout (best-effort)
  httpsRequest({ hostname: host, port, method: 'GET', path: '/api/logout', headers: { Cookie: cookie } }).catch(() => {})
}

export async function unifiTestConnection(cfg: Record<string, any>): Promise<{ ok: boolean; message: string }> {
  if (!cfg.host || !cfg.user || !cfg.passwordEnc) {
    return { ok: false, message: 'Missing host, user, or password' }
  }
  try {
    const host     = cfg.host as string
    const port     = (cfg.port as number) ?? 8443
    const user     = cfg.user as string
    const password = decrypt(cfg.passwordEnc as string)

    const loginRes = await httpsRequest({ hostname: host, port, method: 'POST', path: '/api/login', body: { username: user, password } })
    if (loginRes.status !== 200) return { ok: false, message: `Login failed (HTTP ${loginRes.status})` }

    const sysRes = await httpsRequest({ hostname: host, port, method: 'GET', path: '/api/s/default/stat/sysinfo',
      headers: { Cookie: loginRes.headers['set-cookie']?.map((c: string) => c.split(';')[0]).join('; ') ?? '' } })
    const ver = sysRes.body?.data?.[0]?.version ?? 'unknown'
    return { ok: true, message: `Connected to UniFi Controller v${ver}` }
  } catch (err: any) {
    return { ok: false, message: err.message ?? 'Connection failed' }
  }
}

// ── Omada ─────────────────────────────────────────────────────────────────

async function omadaGrantAccess(tenant: Tenant, macAddress: string, sessionMinutes = 240): Promise<void> {
  const cfg = getConfig(tenant)
  if (!cfg.host || !cfg.user || !cfg.passwordEnc || !cfg.omadacId) {
    throw new Error('Omada not configured for this tenant')
  }

  const host      = cfg.host as string
  const port      = (cfg.port as number) ?? 8043
  const omadacId  = cfg.omadacId as string
  const siteId    = (cfg.siteId as string) ?? 'Default'
  const user      = cfg.user as string
  const password  = decrypt(cfg.passwordEnc as string)
  const base      = `/${omadacId}`

  // Step 1: Login
  const loginRes = await httpsRequest({
    hostname: host, port, method: 'POST',
    path: `${base}/api/v2/hotspot/login`,
    body: { username: user, password },
  })

  const token  = loginRes.body?.result?.token as string | undefined
  const setCookie = loginRes.headers['set-cookie'] as string[] | undefined
  const cookie = setCookie?.map((c: string) => c.split(';')[0]).join('; ') ?? ''

  if (!token) throw new Error(`Omada login failed: ${JSON.stringify(loginRes.body)}`)

  // Step 2: Authorize client
  const mac       = macAddress.toUpperCase().replace(/:/g, '-')
  const authRes   = await httpsRequest({
    hostname: host, port, method: 'POST',
    path: `${base}/openapi/v1/${omadacId}/sites/${siteId}/cmd/clients/${mac}/auth`,
    headers: { Cookie: cookie, 'Csrf-Token': token },
    body: { minutes: sessionMinutes },
  })

  if (authRes.body?.errorCode !== 0) {
    throw new Error(`Omada authorize failed: ${JSON.stringify(authRes.body)}`)
  }
}

export async function omadaTestConnection(cfg: Record<string, any>): Promise<{ ok: boolean; message: string }> {
  if (!cfg.host || !cfg.user || !cfg.passwordEnc || !cfg.omadacId) {
    return { ok: false, message: 'Missing host, omadacId, user, or password' }
  }
  try {
    const host     = cfg.host as string
    const port     = (cfg.port as number) ?? 8043
    const omadacId = cfg.omadacId as string
    const user     = cfg.user as string
    const password = decrypt(cfg.passwordEnc as string)

    const loginRes = await httpsRequest({
      hostname: host, port, method: 'POST',
      path: `/${omadacId}/api/v2/hotspot/login`,
      body: { username: user, password },
    })

    const token = loginRes.body?.result?.token
    if (!token) return { ok: false, message: `Login failed: ${JSON.stringify(loginRes.body)}` }

    const infoRes = await httpsRequest({
      hostname: host, port, method: 'GET',
      path: `/${omadacId}/openapi/v1/${omadacId}/controller/info`,
      headers: { 'Csrf-Token': token },
    })
    const name = infoRes.body?.result?.name ?? 'Omada Controller'
    return { ok: true, message: `Connected to ${name}` }
  } catch (err: any) {
    return { ok: false, message: err.message ?? 'Connection failed' }
  }
}

// ── OpenWRT / nodogsplash ─────────────────────────────────────────────────
// nodogsplash token auth — requires the `tok` query param from the initial
// router redirect (passed through to portal as ?tok=TOKEN).

async function openwrtGrantAccess(tenant: Tenant, macAddress: string, tok?: string): Promise<void> {
  const cfg  = getConfig(tenant)
  const host = cfg.host as string
  const port = (cfg.port as number) ?? 2050

  if (!host) throw new Error('OpenWRT host not configured')
  if (!tok)  throw new Error('OpenWRT auth requires tok param from router redirect')

  // nodogsplash auth endpoint: GET /auth?tok=TOKEN&redir=URL
  const path = `/auth?tok=${encodeURIComponent(tok)}&redir=${encodeURIComponent('http://google.com')}&mac=${encodeURIComponent(macAddress)}`

  const res = await httpRequest({ hostname: host, port, method: 'GET', path })
  if (res.status !== 200 && res.status !== 302) {
    throw new Error(`nodogsplash auth failed (HTTP ${res.status})`)
  }
}

// ── RADIUS — placeholder (full CoA implementation requires UDP socket) ────
// For now we log the event. A full RADIUS CoA implementation can be added
// using the node-radius-client package.

async function radiusGrantAccess(tenant: Tenant, macAddress: string): Promise<void> {
  const cfg = getConfig(tenant)
  // Log the auth event — RADIUS CoA is sent by your NAS automatically when
  // it sees the MAC authorised in the database.
  console.info(`[RADIUS] Grant access for MAC ${macAddress} on tenant ${tenant.id} — NAS: ${cfg.radiusHost ?? 'not configured'}`)
  // No network call here: the RADIUS NAS polls your RADIUS server;
  // the portal just records the session so the NAS can look it up.
}

// ── Unified entry point ───────────────────────────────────────────────────

/**
 * Grant internet access for a device via whichever vendor is configured.
 * @param tenant     Full Tenant record from Prisma
 * @param macAddress Device MAC address in any format (normalised internally)
 * @param tok        Optional nodogsplash token (only needed for openwrt vendor)
 */
export async function grantAccess(tenant: Tenant, macAddress: string, tok?: string): Promise<void> {
  const vendorType = (tenant.vendorType as VendorType) ?? 'mikrotik'

  switch (vendorType) {
    case 'mikrotik':
      await mikrotikGrantAccess(tenant, macAddress)
      break

    case 'unifi':
      await unifiGrantAccess(tenant, macAddress)
      break

    case 'omada':
      await omadaGrantAccess(tenant, macAddress)
      break

    case 'openwrt':
      await openwrtGrantAccess(tenant, macAddress, tok)
      break

    case 'radius':
      await radiusGrantAccess(tenant, macAddress)
      break

    case 'none':
    default:
      // No-op: hardware handles auth externally
      break
  }
}

/**
 * Test connectivity for whichever vendor is configured.
 * Returns { ok, message }.
 */
export async function testVendorConnection(
  vendorType: VendorType,
  cfg: Record<string, any>,
): Promise<{ ok: boolean; message: string }> {
  switch (vendorType) {
    case 'mikrotik': {
      const { mikrotikTestConnection } = await import('./mikrotik.js')
      return mikrotikTestConnection({
        host:      cfg.host,
        port:      cfg.port ?? 8728,
        username:  cfg.user,
        password:  decrypt(cfg.passwordEnc ?? ''),
        interface: cfg.interface,
      })
    }
    case 'unifi':
      return unifiTestConnection(cfg)

    case 'omada':
      return omadaTestConnection(cfg)

    case 'openwrt':
      if (!cfg.host) return { ok: false, message: 'Host not configured' }
      return { ok: true, message: `OpenWRT host: ${cfg.host}:${cfg.port ?? 2050} — connect test not available (auth is token-based)` }

    case 'radius':
      return { ok: true, message: `RADIUS server: ${cfg.radiusHost ?? 'not set'}:${cfg.radiusPort ?? 1812}` }

    case 'none':
    default:
      return { ok: true, message: 'No vendor configured — access not granted automatically.' }
  }
}

/**
 * Encrypt a plain-text password and merge it into the vendorConfig JSON.
 * Call this when the admin saves a new password for a non-MikroTik vendor.
 */
export function mergeEncryptedPassword(existingConfig: any, newPassword: string | null | undefined): Record<string, any> {
  const config = { ...(existingConfig ?? {}) }
  if (newPassword) {
    config.passwordEnc = encrypt(newPassword)
  }
  return config
}
