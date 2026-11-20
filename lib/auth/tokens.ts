import 'server-only'

import { createHash, randomBytes } from 'node:crypto'
import { getPool } from '@/lib/db'

export type AuthTokenPurpose =
  | 'email_verification'
  | 'password_reset'

const TOKEN_EXPIRY = {
  email_verification: 24 * 60 * 60 * 1000,
  password_reset: 30 * 60 * 1000,
}

export function hashAuthToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createAuthToken(
  userId: string,
  purpose: AuthTokenPurpose,
): Promise<string> {
  const pool = getPool()

  if (!pool) {
    throw new Error('Database unavailable.')
  }

  const rawToken = randomBytes(32).toString('base64url')
  const tokenHash = hashAuthToken(rawToken)
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY[purpose])

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    await client.query(
      `DELETE FROM public.auth_action_tokens
       WHERE user_id = $1 AND purpose = $2`,
      [userId, purpose],
    )

    await client.query(
      `INSERT INTO public.auth_action_tokens
         (user_id, purpose, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [userId, purpose, tokenHash, expiresAt],
    )

    await client.query('COMMIT')
    return rawToken
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function consumeAuthToken(
  token: string,
  purpose: AuthTokenPurpose,
): Promise<string | null> {
  if (
    token.length < 20 ||
    token.length > 200 ||
    !/^[A-Za-z0-9_-]+$/.test(token)
  ) {
    return null
  }

  const pool = getPool()

  if (!pool) {
    throw new Error('Database unavailable.')
  }

  const result = await pool.query(
    `UPDATE public.auth_action_tokens
        SET used_at = now()
      WHERE token_hash = $1
        AND purpose = $2
        AND used_at IS NULL
        AND expires_at > now()
      RETURNING user_id::text`,
    [hashAuthToken(token), purpose],
  )

  return result.rows[0]?.user_id ?? null
}
