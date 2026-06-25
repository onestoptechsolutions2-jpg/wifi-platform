import { randomInt } from 'crypto'
import CryptoJS from 'crypto-js'
import { env } from '../config/env.js'

/** AES-256 encrypt a plaintext string — used for hardware credentials */
export function encrypt(plaintext: string): string {
  return CryptoJS.AES.encrypt(plaintext, env.ENCRYPTION_KEY).toString()
}

/** AES-256 decrypt a ciphertext string */
export function decrypt(ciphertext: string): string {
  const bytes = CryptoJS.AES.decrypt(ciphertext, env.ENCRYPTION_KEY)
  return bytes.toString(CryptoJS.enc.Utf8)
}

/**
 * Generate a cryptographically secure N-digit numeric OTP.
 * Uses Node's built-in crypto.randomInt — NOT Math.random().
 */
export function generateOtp(length = 6): string {
  const max = Math.pow(10, length)  // 1_000_000 for 6 digits
  return randomInt(0, max).toString().padStart(length, '0')
}
