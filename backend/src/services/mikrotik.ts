/**
 * MikroTik HotSpot integration
 *
 * Uses the RouterOS API (port 8728) to:
 * - Grant internet access to a MAC address (add hotspot host entry)
 * - Revoke access (remove hotspot host entry)
 * - Test connectivity
 *
 * Supports both MikroTik RouterOS v6 (legacy API) and v7 (REST API).
 * This implementation uses the legacy API via a TCP socket connection,
 * which works on both v6 and v7.
 */

import net from 'net'
import { decrypt } from '../utils/crypto.js'
import type { Tenant } from '@prisma/client'

export interface MikroTikConfig {
  host:      string
  port:      number
  username:  string
  password:  string
  interface?: string
}

function getTenantMikrotikConfig(tenant: Tenant): MikroTikConfig {
  if (!tenant.mkHost || !tenant.mkUser || !tenant.mkPasswordEnc) {
    throw new Error(`MikroTik not configured for tenant ${tenant.id}`)
  }

  return {
    host:      tenant.mkHost,
    port:      tenant.mkPort,
    username:  tenant.mkUser,
    password:  decrypt(tenant.mkPasswordEnc),
    interface: tenant.mkInterface,
  }
}

// ── Low-level MikroTik API client ─────────────────────────────────────────

class MikroTikApi {
  private socket: net.Socket | null = null
  private config: MikroTikConfig

  constructor(config: MikroTikConfig) {
    this.config = config
  }

  /** Open TCP connection and authenticate */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(this.config.port, this.config.host)
      this.socket.setTimeout(10000)

      this.socket.once('connect', async () => {
        try {
          await this.login(this.config.username, this.config.password)
          resolve()
        } catch (err) {
          reject(err)
        }
      })

      this.socket.once('error', reject)
      this.socket.once('timeout', () => reject(new Error('MikroTik connection timed out')))
    })
  }

  /** Send a MikroTik API sentence and read the response */
  async sendCommand(words: string[]): Promise<Record<string, string>[]> {
    return new Promise((resolve, reject) => {
      if (!this.socket) return reject(new Error('Not connected'))

      const sentence = encodeSentence(words)
      this.socket.write(sentence)

      const results: Record<string, string>[] = []
      let current: Record<string, string> = {}
      let buffer = Buffer.alloc(0)

      const onData = (data: Buffer) => {
        buffer = Buffer.concat([buffer, data])
        while (buffer.length > 0) {
          const { word, consumed } = decodeWord(buffer)
          buffer = buffer.slice(consumed)
          if (word === '') {
            // End of sentence
            if (Object.keys(current).length > 0) {
              results.push(current)
              current = {}
            }
            continue
          }
          if (word === '!done') {
            this.socket?.removeListener('data', onData)
            resolve(results)
            return
          }
          if (word.startsWith('!trap') || word.startsWith('!fatal')) {
            this.socket?.removeListener('data', onData)
            reject(new Error(`MikroTik error: ${word}`))
            return
          }
          if (word.startsWith('=')) {
            const [key, ...valueParts] = word.slice(1).split('=')
            current[key] = valueParts.join('=')
          }
        }
      }

      this.socket.on('data', onData)
    })
  }

  private async login(username: string, password: string): Promise<void> {
    // RouterOS v6: two-step login with challenge
    // RouterOS v7: single step /login with name + password
    try {
      // Try v7 style first
      await this.sendCommand(['/login', `=name=${username}`, `=password=${password}`])
    } catch {
      // Fallback to v6 style (challenge-response MD5)
      const challenge = await this.sendCommand(['/login'])
      const ret = challenge[0]?.ret ?? ''
      const md5pass = computeMd5Login(password, ret)
      await this.sendCommand(['/login', `=name=${username}`, `=response=${md5pass}`])
    }
  }

  disconnect() {
    this.socket?.destroy()
    this.socket = null
  }
}

// ── Encoding helpers ──────────────────────────────────────────────────────

function encodeLength(length: number): Buffer {
  if (length < 0x80) return Buffer.from([length])
  if (length < 0x4000) {
    length |= 0x8000
    return Buffer.from([(length >> 8) & 0xff, length & 0xff])
  }
  length |= 0xc00000
  return Buffer.from([(length >> 16) & 0xff, (length >> 8) & 0xff, length & 0xff])
}

function encodeSentence(words: string[]): Buffer {
  const parts: Buffer[] = []
  for (const word of words) {
    const wordBuf = Buffer.from(word, 'utf8')
    parts.push(encodeLength(wordBuf.length))
    parts.push(wordBuf)
  }
  parts.push(Buffer.from([0])) // end of sentence
  return Buffer.concat(parts)
}

function decodeWord(buf: Buffer): { word: string; consumed: number } {
  if (buf.length === 0) return { word: '', consumed: 0 }
  let length: number
  let offset: number
  const b0 = buf[0]
  if ((b0 & 0x80) === 0) { length = b0; offset = 1 }
  else if ((b0 & 0xc0) === 0x80) { length = ((b0 & 0x3f) << 8) | buf[1]; offset = 2 }
  else { length = ((b0 & 0x3f) << 16) | (buf[1] << 8) | buf[2]; offset = 3 }
  if (length === 0) return { word: '', consumed: offset }
  const word = buf.slice(offset, offset + length).toString('utf8')
  return { word, consumed: offset + length }
}

function computeMd5Login(password: string, challenge: string): string {
  const { createHash } = require('crypto')
  const challengeBuf = Buffer.from(challenge, 'hex')
  const passBuf = Buffer.from(password, 'utf8')
  const hash = createHash('md5')
  hash.update(Buffer.from([0]))
  hash.update(passBuf)
  hash.update(challengeBuf)
  return '00' + hash.digest('hex')
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Grant internet access to a device MAC address via MikroTik HotSpot.
 * Adds the MAC to the active hotspot hosts with unlimited uptime.
 */
export async function mikrotikGrantAccess(tenant: Tenant, macAddress: string): Promise<void> {
  const config = getTenantMikrotikConfig(tenant)
  const api = new MikroTikApi(config)

  try {
    await api.connect()

    // Add to hotspot host — bypass authentication for this MAC
    await api.sendCommand([
      '/ip/hotspot/host/add',
      `=mac-address=${macAddress}`,
      '=to-address=0.0.0.0/0',
    ])
  } finally {
    api.disconnect()
  }
}

/**
 * Revoke internet access for a device MAC address.
 * Removes all matching entries from hotspot hosts and active sessions.
 */
export async function mikrotikRevokeAccess(tenant: Tenant, macAddress: string): Promise<void> {
  const config = getTenantMikrotikConfig(tenant)
  const api = new MikroTikApi(config)

  try {
    await api.connect()

    // Find and remove hotspot host entries for this MAC
    const hosts = await api.sendCommand([
      '/ip/hotspot/host/print',
      `?mac-address=${macAddress}`,
    ])

    for (const host of hosts) {
      if (host['.id']) {
        await api.sendCommand(['/ip/hotspot/host/remove', `=.id=${host['.id']}`])
      }
    }

    // Also remove from active sessions if present
    const sessions = await api.sendCommand([
      '/ip/hotspot/active/print',
      `?mac-address=${macAddress}`,
    ])

    for (const session of sessions) {
      if (session['.id']) {
        await api.sendCommand(['/ip/hotspot/active/remove', `=.id=${session['.id']}`])
      }
    }
  } finally {
    api.disconnect()
  }
}

/**
 * Test connectivity to a MikroTik router.
 * Returns true if connection and authentication succeed.
 */
export async function mikrotikTestConnection(config: MikroTikConfig): Promise<{ ok: boolean; message: string }> {
  const api = new MikroTikApi(config)
  try {
    await api.connect()
    const result = await api.sendCommand(['/system/identity/print'])
    const identity = result[0]?.name ?? 'unknown'
    return { ok: true, message: `Connected to MikroTik: ${identity}` }
  } catch (err: any) {
    return { ok: false, message: err.message ?? 'Connection failed' }
  } finally {
    api.disconnect()
  }
}

/**
 * Get all currently active hotspot sessions.
 */
export async function mikrotikGetActiveSessions(tenant: Tenant): Promise<Record<string, string>[]> {
  const config = getTenantMikrotikConfig(tenant)
  const api = new MikroTikApi(config)
  try {
    await api.connect()
    return await api.sendCommand(['/ip/hotspot/active/print'])
  } finally {
    api.disconnect()
  }
}
