import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('no external auth provider references remain in application source or lockfile', async () => {
  const targets = ['package.json', 'pnpm-lock.yaml', 'proxy.ts', 'lib/auth/server.ts', 'lib/auth/session.ts', 'lib/auth/actions.ts', 'lib/db/schema.ts', 'db/schema.sql']
  for (const path of targets) {
    const content = await read(path)
    assert.doesNotMatch(content, /neon_auth|NEON_AUTH|@neondatabase|createNeonAuth/i, `${path} still contains an external auth dependency`)
  }
  await assert.rejects(read('app/api/auth/[...path]/route.ts'))
})

test('PostgreSQL schema defines users, scoped dashboard roles, and revocable expiring sessions', async () => {
  const sql = await read('db/schema.sql')
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.app_users/)
  assert.match(sql, /password_hash text NOT NULL/)
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.app_user_roles/)
  for (const role of ['platform_admin', 'data_x_admin', 'morans_admin']) assert.ok(sql.includes(role))
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.auth_sessions/)
  assert.match(sql, /token_hash text NOT NULL UNIQUE/)
  assert.match(sql, /expires_at timestamptz NOT NULL/)
  assert.match(sql, /revoked_at timestamptz/)
})

test('passwords and session tokens are hashed; browser session cookie is HttpOnly', async () => {
  const auth = await read('lib/auth/server.ts')
  assert.match(auth, /scrypt/)
  assert.match(auth, /timingSafeEqual/)
  assert.match(auth, /createHash\('sha256'\)/)
  assert.match(auth, /httpOnly:\s*true/)
  assert.match(auth, /sameSite:\s*'lax'/)
  assert.match(auth, /secure:\s*process\.env\.NODE_ENV === 'production'/)
})

test('public sign-up cannot assign administrator roles', async () => {
  const actions = await read('lib/auth/actions.ts')
  const start = actions.indexOf('export async function signUpWithEmail')
  const end = actions.indexOf('export async function signOut')
  const signup = actions.slice(start, end)
  assert.match(signup, /INSERT INTO public\.app_users \(name, email, password_hash\)/)
  assert.doesNotMatch(signup, /app_user_roles|platform_admin|data_x_admin|morans_admin/)
})

test('each dashboard admin route checks its own role server-side', async () => {
  const dataX = await read('app/data-x/admin/page.tsx')
  const morans = await read('app/morans/admin/page.tsx')
  assert.match(dataX, /requireDashboardAdmin\('data_x_admin'/)
  assert.match(morans, /requireDashboardAdmin\('morans_admin'/)
  const session = await read('lib/auth/session.ts')
  assert.match(session, /hasDashboardRole/)
  assert.match(session, /user\.roles\.includes\('platform_admin'\)/)
  assert.match(session, /notFound\(\)/)
})

test('admin bootstrap validates roles and never accepts password as a CLI argument', async () => {
  const script = await read('scripts/create-admin.mjs')
  assert.match(script, /process\.env\.ADMIN_PASSWORD/)
  assert.match(script, /allowedRoles/)
  assert.match(script, /ON CONFLICT \(user_id, role\) DO NOTHING/)
  assert.doesNotMatch(script, /process\.argv/)
})

test('environment example contains only local PostgreSQL configuration', async () => {
  const env = await read('.env.example')
  assert.match(env, /^DATABASE_URL=postgresql:/m)
  assert.doesNotMatch(env, /AUTH|NEON|SECRET/i)
})


test('admin bootstrap removes roles not explicitly requested', async () => {
  const script = await read('scripts/create-admin.mjs')
  assert.match(script, /DELETE FROM public\.app_user_roles WHERE user_id = \$1 AND NOT \(role = ANY\(\$2::text\[\]\)\)/)
  assert.match(script, /UPDATE public\.auth_sessions SET revoked_at = now\(\) WHERE user_id = \$1 AND revoked_at IS NULL/)
  assert.match(script, /BEGIN/)
  assert.match(script, /COMMIT/)
  assert.match(script, /ROLLBACK/)
})
