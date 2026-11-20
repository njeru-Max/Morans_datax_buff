'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import {
  requestVerificationEmail,
  type AuthActionState,
} from '@/lib/auth/actions'

export function ResendVerificationForm() {
  const [state, formAction, isPending] =
    useActionState<AuthActionState, FormData>(
      requestVerificationEmail,
      null,
    )

  return (
    <form action={formAction} className="auth-form">
      <label className="auth-field" htmlFor="resend-email">
        <span>Email address</span>
        <input
          autoComplete="email"
          id="resend-email"
          maxLength={254}
          name="email"
          placeholder="name@example.com"
          required
          type="email"
        />
      </label>

      {state?.error ? (
        <p className="auth-error" role="alert">
          {state.error}
        </p>
      ) : null}

      {state?.success ? (
        <p className="auth-card-description" role="status">
          {state.success}
        </p>
      ) : null}

      <Button
        className="auth-submit"
        disabled={isPending}
        type="submit"
      >
        {isPending ? 'Please wait...' : 'Send verification email'}
      </Button>
    </form>
  )
}