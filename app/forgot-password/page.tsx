import type { Metadata } from 'next'
import Link from 'next/link'
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Forgot password | Nelsen Savannah',
  description: 'Request a password reset link for your Nelsen Savannah account.',
}

export default function ForgotPasswordPage() {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-card">
          <p className="section-eyebrow">ACCOUNT RECOVERY</p>
          <h1>Forgot your password?</h1>
          <p className="auth-card-description">
            Enter the email address associated with your account. If it is
            eligible, we will send you a secure password reset link.
          </p>

          <ForgotPasswordForm />

          <Link className="auth-back-link" href="/">
            Back to platform overview
          </Link>
        </div>
      </section>
    </main>
  )
}
