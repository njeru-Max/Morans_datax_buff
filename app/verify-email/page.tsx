
import type { Metadata } from 'next'
import Link from 'next/link'
import { VerifyEmailForm } from '@/components/auth/verify-email-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Verify email | Nelsen Savannah',
  description: 'Verify your email address for Nelsen Savannah.',
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function VerifyEmailPage({
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
          <p className="section-eyebrow">ACCOUNT VERIFICATION</p>
          <h1>Verify your email</h1>
          <p className="auth-card-description">
            Confirm your email address to activate your Nelsen Savannah account.
          </p>

          <VerifyEmailForm token={token} />

          <p className="auth-switch">
            Already verified or have an account?{' '}
            <Link href="/sign-in">Sign in</Link>
          </p>

          <Link className="auth-back-link" href="/">
            Back to platform overview
          </Link>
        </div>
      </section>
    </main>
  )
}
