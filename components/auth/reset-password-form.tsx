'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  resetPasswordWithToken,
  type AuthActionState,
} from '@/lib/auth/actions'

type ResetPasswordFormProps = {
  token: string
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [state, formAction, isPending] =
    useActionState<AuthActionState, FormData>(
      resetPasswordWithToken,
      null,
    )

  if (!token) {
    return (
      <div className="auth-form">
        <p className="auth-error" role="alert">
          This reset link is missing its token or is invalid. Request a new link.
        </p>
        <Link className="auth-back-link" href="/forgot-password">
          Request another reset link
        </Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="auth-form">
      <input name="token" type="hidden" value={token} />

      <label className="auth-field" htmlFor="reset-new-password">
        <span>New password</span>
        <input
          autoComplete="new-password"
          id="reset-new-password"
          maxLength={128}
          minLength={12}
          name="password"
          placeholder="At least 12 characters"
          required
          type="password"
        />
      </label>

      <label className="auth-field" htmlFor="reset-confirm-password">
        <span>Confirm new password</span>
        <input
          autoComplete="new-password"
          id="reset-confirm-password"
          maxLength={128}
          minLength={12}
          name="confirmPassword"
          placeholder="Enter the password again"
          required
          type="password"
        />
      </label>

      {state?.error ? (
        <p className="auth-error" role="alert">{state.error}</p>
      ) : null}

      {state?.success ? (
        <>
          <p className="auth-card-description" role="status">
            {state.success}
          </p>
          <Link className="auth-back-link" href="/sign-in">
            Continue to sign in
          </Link>
        </>
      ) : (
        <Button className="auth-submit" disabled={isPending} type="submit">
          {isPending ? 'Updating password...' : 'Reset password'}
        </Button>
      )}

      <p className="auth-switch">
        <Link href="/sign-in">Return to sign in</Link>
      </p>
    </form>
  )
}
