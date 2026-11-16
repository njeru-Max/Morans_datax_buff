import 'server-only'

import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { cookies } from 'next/headers'
import { getPool } from '@/lib/db'

const scrypt = promisify(scryptCallback)
const SESSION_COOKIE = 'nelsen_session'
const SESSION_DAYS = 7
const MIN_PASSWORD_LENGTH = 12

export const DASHBOARD_ROLES = ['platform_admin', 'data_x_admin', 'morans_admin'] as const
export type DashboardRole = (typeof DASHBOARD_ROLES)[number]
export type SessionUser = {
  id: string
  name: string
  email: string
  role: string
  emailVerified: boolean
  roles: DashboardRole[]
}

export function isAuthConfigured() {
  return Boolean(process.env.DATABASE_URL)
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < MIN_PASSWORD_LENGTH || password.length > 128) {
    throw new Error(`Password must be between ${MIN_PASSWORD_LENGTH} and 128 characters.`)
  }
  const salt = randomBytes(16).toString('hex')
  const derived = (await scrypt(password, salt, 64)) as Buffer
  return `scrypt$${salt}$${derived.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !hash || !/^[a-f0-9]{128}$/i.test(hash)) return false
  const derived = (await scrypt(password, salt, 64)) as Buffer
  const expected = Buffer.from(hash, 'hex')
  return expected.length === derived.length && timingSafeEqual(expected, derived)
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function createSession(userId: string) {
  const pool = getPool()
  if (!pool) throw new Error('DATABASE_URL is required for authentication.')
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  await pool.query(
    'INSERT INTO public.auth_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, hashSessionToken(token), expiresAt],
  )
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })
}

export async function revokeCurrentSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const pool = getPool()
  if (token && pool) {
    await pool.query(
      'UPDATE public.auth_sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL',
      [hashSessionToken(token)],
    )
  }
  cookieStore.delete(SESSION_COOKIE)
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const pool = getPool()
  if (!pool) return null
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  try {
    const result = await pool.query(
      `SELECT u.id::text, u.name, u.email, u.role, u.email_verified,
              COALESCE(array_agg(r.role) FILTER (WHERE r.role IS NOT NULL), ARRAY[]::text[]) AS roles
         FROM public.auth_sessions s
         JOIN public.app_users u ON u.id = s.user_id
         LEFT JOIN public.app_user_roles r ON r.user_id = u.id
        WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.status = 'active'
        GROUP BY u.id LIMIT 1`,
      [hashSessionToken(token)],
    )
    const row = result.rows[0]
    if (!row) return null
    await pool.query('UPDATE public.auth_sessions SET last_seen_at = now() WHERE token_hash = $1', [hashSessionToken(token)])
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      emailVerified: row.email_verified,
      roles: row.roles.filter((role: string): role is DashboardRole => DASHBOARD_ROLES.includes(role as DashboardRole)),
    }
  } catch (error) {
    console.error('[auth] Session lookup failed.', error instanceof Error ? error.name : 'UnknownError')
    return null
  }
}
