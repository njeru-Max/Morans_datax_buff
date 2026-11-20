
'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  verifyEmailToken,
  type AuthActionState,
} from '@/lib/auth/actions'

type VerifyEmailFormProps = {
  token: string
}

export function VerifyEmailForm({ token }: VerifyEmailFormProps) {
  const [state, formAction, isPending] =
    useActionState<AuthActionState, FormData>(verifyEmailToken, null)

  if (!token) {
    return (
      <div className="auth-form">
        <p className="auth-error" role="alert">
          This verification link is missing its token. Please request a new verification email.
        </p>
        <Link className="auth-back-link" href="/sign-up">
          Return to sign-up
        </Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="auth-form">
      <input name="token" type="hidden" value={token} />

      {state?.error ? (
        <p className="auth-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button
        className="auth-submit"
        disabled={isPending}
        type="submit"
      >
        {isPending ? 'Verifying...' : 'Verify email address'}
      </Button>

      <p className="auth-card-description">
        This link can only be used once and expires after 24 hours.
      </p>
    </form>
  )
}
