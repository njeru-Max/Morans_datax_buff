
import 'server-only'
import { Resend } from 'resend'

type AuthEmail = {
  to: string
  subject: string
  text: string
  html: string
}

export function isEmailDeliveryConfigured(): boolean {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.EMAIL_FROM?.trim()
  const appUrl = process.env.APP_URL?.trim()

  if (!apiKey || !from || !appUrl) return false

  try {
    const url = new URL(appUrl)
    return (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      Boolean(url.host)
    )
  } catch {
    return false
  }
}

export async function sendAuthEmail(email: AuthEmail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.EMAIL_FROM?.trim()

  if (!apiKey || !from) {
    throw new Error('Email delivery is not configured.')
  }

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from,
    to: email.to,
    subject: email.subject,
    text: email.text,
    html: email.html,
  })
     if (error) {
    console.error('[email] Delivery failed:', {
      name: error.name,
      message: error.message,
      statusCode: error.statusCode,
    })
    throw new Error('Email delivery failed.')
   }
  }
