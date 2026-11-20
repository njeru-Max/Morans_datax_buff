'use server'

import { redirect } from 'next/navigation'
import { getPool } from '@/lib/db'
import { createSession, hashPassword, revokeCurrentSession, verifyPassword } from '@/lib/auth/server'
import { safeInternalPath } from '@/lib/auth/redirect'
import { createAuthToken, hashAuthToken } from '@/lib/auth/tokens'
import { isEmailDeliveryConfigured, sendAuthEmail } from '@/lib/auth/email'
import { createHash } from 'node:crypto'

export type AuthActionState = {
  error?: string
  success?: string
} | null

function formText(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

function validEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function signInWithEmail(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = formText(formData, 'email').trim().toLowerCase()
  const password = formText(formData, 'password')
  if (!validEmail(email) || password.length === 0 || password.length > 128) return { error: 'Enter a valid email address and password.' }
  const pool = getPool()
  if (!pool) return { error: 'Authentication is unavailable until PostgreSQL is configured.' }
  try {
    const attempts = await pool.query(
      "SELECT count(*)::int AS count FROM public.auth_login_attempts WHERE email = $1 AND succeeded = false AND attempted_at > now() - interval '15 minutes'",
      [email],
    )
    if ((attempts.rows[0]?.count ?? 0) >= 5) {
      return { error: 'Too many sign-in attempts. Please wait 15 minutes and try again.' }
    }
    const { rows } = await pool.query(
      "SELECT id::text, password_hash, email_verified FROM public.app_users WHERE email = $1 AND status = 'active' LIMIT 1",
      [email],
    )
    const row = rows[0]
    if (!row || !(await verifyPassword(password, row.password_hash))) {
      await pool.query('INSERT INTO public.auth_login_attempts (email, succeeded) VALUES ($1, false)', [email])
      return { error: 'We could not sign you in. Check your details and try again.' }
    }
    await pool.query('INSERT INTO public.auth_login_attempts (email, succeeded) VALUES ($1, true)', [email])
    if (row.email_verified !== true) {
      return { error: 'Please verify your email address before signing in.' }
    }
    await createSession(row.id)
  } catch (error) {
    console.error('[auth] Sign-in failed.', error instanceof Error ? error.name : 'UnknownError')
    return { error: 'Sign-in is temporarily unavailable. Please try again shortly.' }
  }
  redirect(safeInternalPath(formData.get('returnTo')))
}


export async function signUpWithEmail(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const name = formText(formData, 'name').trim()
  const email = formText(formData, 'email').trim().toLowerCase()
  const password = formText(formData, 'password')

  if (
    name.length < 2 ||
    name.length > 100 ||
    !validEmail(email) ||
    password.length < 12 ||
    password.length > 128
  ) {
    return {
      error: 'Enter a name, valid email, and password of at least 12 characters.',
    }
  }

  const pool = getPool()
  if (!pool) {
    return {
      error: 'Account creation is unavailable until PostgreSQL is configured.',
    }
  }

  if (!isEmailDeliveryConfigured()) {
    return {
      error: 'Registration is temporarily unavailable because email delivery is not configured.',
    }
  }

  try {
    const passwordHash = await hashPassword(password)

    const result = await pool.query(
      `INSERT INTO public.app_users (name, email, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING
       RETURNING id::text`,
      [name, email, passwordHash],
    )

    const userId = result.rows[0]?.id

    if (!userId) {
      return {
        error: 'An account with that email already exists. Try signing in.',
      }
    }

    const token = await createAuthToken(userId, 'email_verification')
    const appUrl = process.env.APP_URL?.trim()

    if (!appUrl) {
      return {
        error: 'Registration is temporarily unavailable. Please try again later.',
      }
    }

    const verificationUrl = new URL('/verify-email', appUrl)
    verificationUrl.searchParams.set('token', token)

    await sendAuthEmail({
      to: email,
      subject: 'Verify your Nelsen Savannah account',
      text: [
        `Hello ${name},`,
        '',
        'Please verify your email address to activate your Nelsen Savannah account.',
        '',
        `Verify your email: ${verificationUrl.toString()}`,
        '',
        'This link expires in 24 hours. If you did not create this account, you can ignore this email.',
      ].join('\n'),
      html: `
        <p>Hello,</p>
        <p>Please verify your email address to activate your Nelsen Savannah account.</p>
        <p><a href="${verificationUrl.toString()}">Verify your email address</a></p>
        <p>This link expires in 24 hours. If you did not create this account, you can ignore this email.</p>
      `,
    })
  } catch (error) {
    console.error(
      '[auth] Sign-up or verification email failed.',
      error instanceof Error ? error.name : 'UnknownError',
    )
    return {
      error: 'We could not complete registration or send your verification email. If you already submitted the form, use the verification recovery option when available.',
    }
  }

  // A new account must verify its email before signing in.
  // Do not call createSession() here.
  redirect('/sign-in?status=verification-sent')
}


export async function signOut() {
  try {
    await revokeCurrentSession()
  } catch (error) {
    console.error('[auth] Sign-out failed.', error instanceof Error ? error.name : 'UnknownError')
  }
  redirect('/sign-in?status=signed-out')
}


export async function verifyEmailToken(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const token = formText(formData, 'token')

  if (
    token.length < 20 ||
    token.length > 200 ||
    !/^[A-Za-z0-9_-]+$/.test(token)
  ) {
    return { error: 'This verification link is invalid or has expired. Request a new one.' }
  }

  const pool = getPool()
  if (!pool) {
    return { error: 'Verification is temporarily unavailable. Please try again later.' }
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const consumed = await client.query(
      `UPDATE public.auth_action_tokens
          SET used_at = now()
        WHERE token_hash = $1
          AND purpose = 'email_verification'
          AND used_at IS NULL
          AND expires_at > now()
        RETURNING user_id::text`,
      [hashAuthToken(token)],
    )

    const userId = consumed.rows[0]?.user_id

    if (!userId) {
      await client.query('ROLLBACK')
      return { error: 'This verification link is invalid or has expired. Request a new one.' }
    }

    const updated = await client.query(
      `UPDATE public.app_users
          SET email_verified = true,
              updated_at = now()
        WHERE id = $1
          AND status = 'active'
        RETURNING id`,
      [userId],
    )

    if (updated.rowCount !== 1) {
      await client.query('ROLLBACK')
      return { error: 'This account could not be verified. Please contact support.' }
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    console.error(
      '[auth] Email verification failed.',
      error instanceof Error ? error.name : 'UnknownError',
    )
    return { error: 'Verification is temporarily unavailable. Please try again later.' }
  } finally {
    client.release()
  }

  redirect('/sign-in?status=verified')
}

export async function requestVerificationEmail(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = formText(formData, 'email').trim().toLowerCase()

  if (!validEmail(email)) {
    return { error: 'Enter a valid email address.' }
  }

  const genericSuccess =
    'If an eligible account exists for that address, a verification email will be sent. Check your inbox and spam folder.'

  const pool = getPool()

  if (!pool) {
    return { success: genericSuccess }
  }

  try {
    // Hash the normalized address so the rate-limit table does not
    // need to store email addresses in plain text.
    const emailHash = createHash('sha256')
      .update(email)
      .digest('hex')

    // Atomically allow one request per email address per minute.
    // PostgreSQL serializes concurrent conflicts on the same hash.
    const rateLimit = await pool.query(
      `INSERT INTO public.auth_email_request_limits
         (email_hash, last_requested_at)
       VALUES ($1, now())
       ON CONFLICT (email_hash) DO UPDATE
          SET last_requested_at = now()
        WHERE public.auth_email_request_limits.last_requested_at
              < now() - interval '1 minute'
       RETURNING email_hash`,
      [emailHash],
    )

    if (!rateLimit.rowCount) {
      return { success: genericSuccess }
    }

    // Use the same outward response whether delivery is configured
    // or not, to avoid revealing account or configuration details.
    if (!isEmailDeliveryConfigured()) {
      return { success: genericSuccess }
    }

    const result = await pool.query(
      `SELECT id::text, name, email_verified
         FROM public.app_users
        WHERE email = $1
          AND status = 'active'
        LIMIT 1`,
      [email],
    )

    const user = result.rows[0]

    // Do not reveal whether an account exists or is already verified.
    if (!user || user.email_verified === true) {
      return { success: genericSuccess }
    }

    const token = await createAuthToken(
      user.id,
      'email_verification',
    )

    const appUrl = process.env.APP_URL?.trim()

    if (!appUrl) {
      return { success: genericSuccess }
    }

    const verificationUrl = new URL('/verify-email', appUrl)
    verificationUrl.searchParams.set('token', token)

    await sendAuthEmail({
      to: email,
      subject: 'Verify your Nelsen Savannah account',
      text: [
        `Hello ${user.name},`,
        '',
        'Please verify your email address to activate your Nelsen Savannah account.',
        '',
        `Verify your email: ${verificationUrl.toString()}`,
        '',
        'This link expires in 24 hours. If you did not request this email, you can ignore it.',
      ].join('\n'),
      html: `
        <p>Hello,</p>
        <p>Please verify your email address to activate your Nelsen Savannah account.</p>
        <p><a href="${verificationUrl.toString()}">Verify your email address</a></p>
        <p>This link expires in 24 hours. If you did not request this email, you can ignore it.</p>
      `,
    })

    return { success: genericSuccess }
  } catch (error) {
    console.error(
      '[auth] Verification email request failed.',
      error instanceof Error ? error.name : 'UnknownError',
    )

    // Keep responses generic, including when a database operation
    // or email delivery fails.
    return { success: genericSuccess }
  }
}

export async function requestPasswordReset(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const genericMessage =
    'If an eligible account exists for that email, a password reset link will be sent shortly.'

  const email = formText(formData, 'email').trim().toLowerCase()

  if (!validEmail(email)) {
    return { error: 'Enter a valid email address.' }
  }

  const pool = getPool()
  if (!pool || !isEmailDeliveryConfigured()) {
    return { success: genericMessage }
  }

  try {
    // Apply the existing atomic per-email cooldown to auth email requests.
    const emailHash = createHash('sha256').update(email).digest('hex')
    const limitResult = await pool.query(
      `INSERT INTO public.auth_email_request_limits
         (email_hash, last_requested_at)
       VALUES ($1, now())
       ON CONFLICT (email_hash) DO UPDATE
          SET last_requested_at = now()
        WHERE public.auth_email_request_limits.last_requested_at
              < now() - interval '1 minute'
       RETURNING email_hash`,
      [emailHash],
    )

    if (limitResult.rowCount !== 1) {
      return { success: genericMessage }
    }

    const userResult = await pool.query(
      `SELECT id::text AS id
         FROM public.app_users
        WHERE email = $1
          AND status = 'active'
          AND email_verified = true
        LIMIT 1`,
      [email],
    )

    const user = userResult.rows[0]
    if (!user) {
      return { success: genericMessage }
    }

    const token = await createAuthToken(user.id, 'password_reset')
    const appUrl = process.env.APP_URL?.trim()

    if (!appUrl) {
      return { success: genericMessage }
    }

    const resetUrl = new URL('/reset-password', appUrl)
    resetUrl.searchParams.set('token', token)

    await sendAuthEmail({
      to: email,
      subject: 'Reset your Nelsen Savannah password',
      text:
        `A password reset was requested for your account.\n\n` +
        `Use this link within 30 minutes to choose a new password:\n${resetUrl.toString()}\n\n` +
        'If you did not request this, you can ignore this email.',
      html:
        '<p>A password reset was requested for your Nelsen Savannah account.</p>' +
        `<p><a href="${resetUrl.toString()}">Reset your password</a></p>` +
        '<p>This link expires in 30 minutes. If you did not request this, ignore this email.</p>',
    })

    return { success: genericMessage }
  } catch (error) {
    console.error(
      '[auth] Password reset request failed:',
      error instanceof Error ? error.name : 'UnknownError',
    )
    return { success: genericMessage }
  }
}

export async function resetPasswordWithToken(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const token = formText(formData, 'token').trim()
  const password = formText(formData, 'password')
  const confirmation = formText(formData, 'confirmPassword')

  if (
    token.length < 20 ||
    token.length > 200 ||
    !/^[A-Za-z0-9_-]+$/.test(token)
  ) {
    return { error: 'This reset link is invalid or expired. Request a new one.' }
  }

  if (password.length < 12 || password.length > 128) {
    return { error: 'Your password must be between 12 and 128 characters.' }
  }

  if (password !== confirmation) {
    return { error: 'The passwords do not match.' }
  }

  const pool = getPool()
  if (!pool) {
    return { error: 'Password reset is temporarily unavailable. Please try again.' }
  }

  let client: import("pg").PoolClient | undefined
  let transactionStarted = false

  try {
    const passwordHash = await hashPassword(password)
    const tokenHash = hashAuthToken(token)

    client = await pool.connect()
    await client.query('BEGIN')
    transactionStarted = true

    // Consume the token atomically. A used or expired token cannot be reused.
    const tokenResult = await client.query(
      `UPDATE public.auth_action_tokens
          SET used_at = now()
        WHERE token_hash = $1
          AND purpose = 'password_reset'
          AND used_at IS NULL
          AND expires_at > now()
        RETURNING user_id::text AS user_id`,
      [tokenHash],
    )

    const userId = tokenResult.rows[0]?.user_id

    if (!userId) {
      await client.query('ROLLBACK')
      transactionStarted = false
      return {
        error: 'This reset link is invalid or expired. Request a new one.',
      }
    }

    const userResult = await client.query(
      `UPDATE public.app_users
          SET password_hash = $1
        WHERE id = $2
          AND status = 'active'
          AND email_verified = true
        RETURNING id`,
      [passwordHash, userId],
    )

    if (userResult.rowCount !== 1) {
      await client.query('ROLLBACK')
      transactionStarted = false
      return {
        error: 'This reset link is invalid or expired. Request a new one.',
      }
    }

    // Invalidate any other outstanding password-reset links for this account.
    await client.query(
      `UPDATE public.auth_action_tokens
          SET used_at = now()
        WHERE user_id = $1
          AND purpose = 'password_reset'
          AND used_at IS NULL`,
      [userId],
    )

    // Revoke all active sessions, not just the browser making this request.
    await client.query(
      `UPDATE public.auth_sessions
          SET revoked_at = now()
        WHERE user_id = $1
          AND revoked_at IS NULL`,
      [userId],
    )

    await client.query('COMMIT')
    transactionStarted = false

    return {
      success: 'Your password has been reset. You can now sign in with your new password.',
    }
  } catch (error) {
    if (client && transactionStarted) {
      await client.query('ROLLBACK').catch(() => undefined)
    }

    console.error(
      '[auth] Password reset failed:',
      error instanceof Error ? error.name : 'UnknownError',
    )

    return {
      error: 'Password reset is temporarily unavailable. Please try again.',
    }
  } finally {
    client?.release()
  }
}
