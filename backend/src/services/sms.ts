/**
 * SMS service — Twilio primary, Africa's Talking fallback
 */
import twilio from 'twilio'
import { env } from '../config/env.js'

const twilioClient = env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN
  ? twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)
  : null

export async function sendSms(to: string, message: string): Promise<boolean> {
  // Try Twilio first
  if (twilioClient && env.TWILIO_PHONE_NUMBER) {
    try {
      await twilioClient.messages.create({
        body: message,
        from: env.TWILIO_PHONE_NUMBER,
        to,
      })
      return true
    } catch (err: any) {
      console.warn(`Twilio SMS failed: ${err.message}. Trying Africa's Talking...`)
    }
  }

  // Fallback: Africa's Talking
  if (env.AT_API_KEY && env.AT_USERNAME) {
    try {
      const AT = (await import('africastalking')).default
      const at = AT({ apiKey: env.AT_API_KEY, username: env.AT_USERNAME })
      await at.SMS.send({ to: [to], message, from: undefined })
      return true
    } catch (err: any) {
      console.error(`Africa's Talking SMS failed: ${err.message}`)
    }
  }

  console.error(`No SMS provider available. Would have sent to ${to}: ${message}`)
  return false
}

export async function sendOtp(phone: string, otp: string): Promise<boolean> {
  const message = `Your WiFi verification code is: ${otp}. This code expires in 10 minutes.`
  return sendSms(phone, message)
}
