import type { Metadata } from 'next'
import Link from 'next/link'
import { ResendVerificationForm } from '@/components/auth/resend-verification-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Resend verification email | Nelsen Savannah',
  description: 'Request a verification email for your Nelsen Savannah account.',
}

export default function ResendVerificationPage() {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-card">
          <p className="section-eyebrow">ACCOUNT RECOVERY</p>
          <h1>Verify your email</h1>
          <p className="auth-card-description">
            Enter the email address you used to register. If your account
            needs verification, we will send a fresh link.
          </p>

          <ResendVerificationForm />

          <p className="auth-switch">
            Remember your password? <Link href="/sign-in">Sign in</Link>
          </p>

          <Link className="auth-back-link" href="/">
            Back to platform overview
          </Link>
        </div>
      </section>
    </main>
  )
}