
import Link from 'next/link'
import { ArrowRight, BarChart3, ShieldCheck, Trophy } from 'lucide-react'
import { AuthForm } from '@/components/auth/auth-form'

type AuthPageProps = {
  authAvailable: boolean
  mode: 'sign-in' | 'sign-up'
  returnTo: string
  status?: string
}

export function AuthPage({
  authAvailable,
  mode,
  returnTo,
  status,
}: AuthPageProps) {
  const isSignUp = mode === 'sign-up'

  return (
    <main className="auth-page">
      <section aria-labelledby="auth-story-title" className="auth-story">
        <Link
          className="brand-lockup"
          href="/"
          aria-label="Nelsen Savannah platform home"
        >
          <span aria-hidden="true" className="brand-mark">NS</span>
          <span className="brand-copy">
            <strong>Nelsen Savannah</strong>
            <small>Integrated platform</small>
          </span>
        </Link>

        <div className="auth-story-copy">
          <p className="page-eyebrow">ONE PLATFORM Â· DISTINCT WORKSPACES</p>
          <h1 id="auth-story-title">
            A thoughtful home for learning and competition.
          </h1>
          <p>
            Sign in to reach the records and actions assigned to your account.
            Each workspace checks your role on the server.
          </p>
        </div>

        <ul aria-label="Workspace access principles" className="auth-principles">
          <li>
            <span aria-hidden="true"><BarChart3 /></span>
            <span>
              <strong>Data X</strong>
              <small>Institution membership scopes education metrics.</small>
            </span>
          </li>
          <li>
            <span aria-hidden="true"><Trophy /></span>
            <span>
              <strong>MORANS</strong>
              <small>Participant, host, and judge records stay role-scoped.</small>
            </span>
          </li>
          <li>
            <span aria-hidden="true"><ShieldCheck /></span>
            <span>
              <strong>Reviewed access</strong>
              <small>Public sign-up never grants administrator privileges.</small>
            </span>
          </li>
        </ul>
      </section>

      <section aria-labelledby="auth-form-title" className="auth-panel">
        <div className="auth-card">
          <p className="section-eyebrow">SECURE ACCOUNT</p>

          <h2 id="auth-form-title">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h2>

          <p className="auth-card-description">
            {isSignUp
              ? 'Use your account for participant access. Workspace roles are granted separately.'
              : 'Sign in to continue to your workspaces.'}
          </p>

          {!isSignUp && status === 'verification-sent' ? (
            <p className="auth-card-description" role="status">
              Your verification email has been sent. Check your inbox and spam
              folder for the link before signing in.
            </p>
          ) : null}

          {!isSignUp && status === 'verified' ? (
            <p className="auth-card-description" role="status">
              Your email has been verified successfully. You can now sign in.
            </p>
          ) : null}

          {!isSignUp && status === 'signed-out' ? (
            <p className="auth-card-description" role="status">
              You have been signed out.
            </p>
          ) : null}

          {!authAvailable ? (
            <p className="auth-error" role="status">
              Account access is temporarily unavailable. Please contact the
              platform administrator.
            </p>
          ) : null}

          <AuthForm
            authAvailable={authAvailable}
            mode={mode}
            returnTo={returnTo}
          />
          
          {!isSignUp ? (
            <>
              <p className="auth-switch">
                Forgot your password?{' '}
                <Link href="/forgot-password">Reset it here</Link>
              </p>
              <p className="auth-switch">
                Didn't receive your verification email?{' '}
                <Link href="/resend-verification">
                  Send another verification link
                </Link>
              </p>
            </>
          ) : null}

          <p className="auth-switch">
            {isSignUp ? 'Already have an account?' : 'New to the platform?'}{' '}
            <Link href={isSignUp ? '/sign-in' : '/sign-up'}>
              {isSignUp ? 'Sign in' : 'Create an account'}
              <ArrowRight aria-hidden="true" />
            </Link>
          </p>

          <Link className="auth-back-link" href="/">
            Back to platform overview
          </Link>
        </div>
      </section>
    </main>
  )
}
