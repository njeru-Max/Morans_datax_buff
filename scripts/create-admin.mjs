import { randomBytes, scrypt as scryptCallback } from 'node:crypto'
import { promisify } from 'node:util'
import pg from 'pg'

const scrypt = promisify(scryptCallback)
const allowedRoles = new Set(['platform_admin', 'data_x_admin', 'morans_admin'])
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
const name = process.env.ADMIN_NAME?.trim()
const password = process.env.ADMIN_PASSWORD
const roles = (process.env.ADMIN_ROLES || 'platform_admin').split(',').map((role) => role.trim()).filter(Boolean)

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required (set it in .env.local).')
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Set ADMIN_EMAIL to a valid email address.')
if (!name || name.length < 2 || name.length > 100) throw new Error('Set ADMIN_NAME (2–100 characters).')
if (!password || password.length < 12 || password.length > 128) throw new Error('Set ADMIN_PASSWORD to 12–128 characters.')
if (!roles.length || roles.some((role) => !allowedRoles.has(role))) throw new Error(`ADMIN_ROLES must be a comma-separated list of: ${[...allowedRoles].join(', ')}`)

const salt = randomBytes(16).toString('hex')
const derived = await scrypt(password, salt, 64)
const passwordHash = `scrypt$${salt}$${derived.toString('hex')}`
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 })

try {
  await pool.query('BEGIN')
  const result = await pool.query(
    `INSERT INTO public.app_users (name, email, password_hash, role, email_verified)
     VALUES ($1, $2, $3, $4, true)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash,
       role = EXCLUDED.role, status = 'active', updated_at = now()
     RETURNING id::text`,
    [name, email, passwordHash, roles.includes('platform_admin') ? 'admin' : 'user'],
  )
  const userId = result.rows[0].id
  
  // Revoke existing sessions before changing the account's access.
  await pool.query(
    'UPDATE public.auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
    [userId],
  )

  // Make assigned roles match ADMIN_ROLES exactly.
  await pool.query(
    'DELETE FROM public.app_user_roles WHERE user_id = $1 AND NOT (role = ANY($2::text[]))',
    [userId, roles],
  )

  for (const role of roles) {
    await pool.query(
      `INSERT INTO public.app_user_roles (user_id, role)
       VALUES ($1, $2)
       ON CONFLICT (user_id, role) DO NOTHING`,
      [userId, role],
    )
  }

  await pool.query('COMMIT')
  console.log(`Administrator account ready: ${email}`)
  console.log(`Granted dashboard roles: ${roles.join(', ')}`)
  console.log('For security, clear ADMIN_PASSWORD from your shell environment now.')
} catch (error) {
  await pool.query('ROLLBACK')
  console.error('Admin setup failed. Confirm the database schema has been applied.')
  throw error
} finally {
  await pool.end()
}
