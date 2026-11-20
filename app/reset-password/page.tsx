import type { Metadata } from 'next'
import Link from 'next/link'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Reset password | Nelsen Savannah',
  description: 'Choose a new password for your Nelsen Savannah account.',
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const value = params.token
  const token = typeof value === 'string' ? value : ''

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-card">
          <p className="section-eyebrow">ACCOUNT RECOVERY</p>
          <h1>Choose a new password</h1>
          <p className="auth-card-description">
            Use a password between 12 and 128 characters. Reset links expire
            after 30 minutes and can only be used once.
          </p>

          <ResetPasswordForm token={token} />

          <Link className="auth-back-link" href="/">
            Back to platform overview
          </Link>
        </div>
      </section>
    </main>
  )
}
