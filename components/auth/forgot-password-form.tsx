'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  requestPasswordReset,
  type AuthActionState,
} from '@/lib/auth/actions'

export function ForgotPasswordForm() {
  const [state, formAction, isPending] =
    useActionState<AuthActionState, FormData>(requestPasswordReset, null)

  return (
    <form action={formAction} className="auth-form">
      <label className="auth-field" htmlFor="reset-request-email">
        <span>Email address</span>
        <input
          autoComplete="email"
          id="reset-request-email"
          name="email"
          placeholder="name@example.com"
          required
          maxLength={254}
          type="email"
        />
      </label>

      {state?.error ? (
        <p className="auth-error" role="alert">{state.error}</p>
      ) : null}

      {state?.success ? (
        <p className="auth-card-description" role="status">
          {state.success}
        </p>
      ) : null}

      {!state?.success ? (
        <Button className="auth-submit" disabled={isPending} type="submit">
          {isPending ? 'Please wait...' : 'Send reset link'}
        </Button>
      ) : null}

      <p className="auth-switch">
        Remember your password? <Link href="/sign-in">Sign in</Link>
      </p>
    </form>
  )
}
