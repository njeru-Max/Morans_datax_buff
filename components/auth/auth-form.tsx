'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import {
  signInWithEmail,
  signUpWithEmail,
  type AuthActionState,
} from '@/lib/auth/actions'

type AuthFormProps = {
  authAvailable: boolean
  mode: 'sign-in' | 'sign-up'
  returnTo: string
}

export function AuthForm({ authAvailable, mode, returnTo }: AuthFormProps) {
  const action = mode === 'sign-in' ? signInWithEmail : signUpWithEmail
  const [state, formAction, isPending] = useActionState<AuthActionState, FormData>(action, null)
  const isSignUp = mode === 'sign-up'

  return (
    <form action={formAction} className="auth-form">
      <input name="returnTo" type="hidden" value={returnTo} />
      <fieldset className="auth-fieldset" disabled={!authAvailable}>
        <legend className="sr-only">{isSignUp ? 'Create an account' : 'Sign in'}</legend>
        {isSignUp ? (
          <label className="auth-field" htmlFor="auth-name">
            <span>Full name</span>
            <input
              autoComplete="name"
              id="auth-name"
              maxLength={100}
              minLength={2}
              name="name"
              placeholder="Your name"
              required
              type="text"
            />
          </label>
        ) : null}
        <label className="auth-field" htmlFor="auth-email">
          <span>Email address</span>
          <input
            autoComplete="email"
            id="auth-email"
            name="email"
            placeholder="name@example.com"
            required
            type="email"
          />
        </label>
        <label className="auth-field" htmlFor="auth-password">
          <span>Password</span>
          <input
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            id="auth-password"
            maxLength={128}
            minLength={isSignUp ? 12 : undefined}
            name="password"
            placeholder={isSignUp ? 'At least 12 characters' : 'Your password'}
            required
            type="password"
          />
        </label>
      </fieldset>

      {state?.error ? (
        <p className="auth-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button
        className="auth-submit"
        disabled={!authAvailable || isPending}
        type="submit"
      >
        {!authAvailable
          ? isSignUp
            ? 'Sign-up unavailable'
            : 'Sign-in unavailable'
          : isPending
            ? 'Please wait…'
            : isSignUp
              ? 'Create account'
              : 'Sign in'}
      </Button>
    </form>
  )
}
