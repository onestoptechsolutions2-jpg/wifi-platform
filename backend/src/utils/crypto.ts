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

/** Generate a random N-digit numeric string (for OTP) */
export function generateOtp(length = 6): string {
  let otp = ''
  for (let i = 0; i < length; i++) {
    otp += Math.floor(Math.random() * 10).toString()
  }
  return otp
}
