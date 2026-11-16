import 'server-only'

import { notFound, redirect } from 'next/navigation'
import { getSessionUser, type DashboardRole, type SessionUser } from '@/lib/auth/server'

export type { SessionUser } from '@/lib/auth/server'

export async function getCurrentUser(): Promise<SessionUser | null> {
  return getSessionUser()
}

export async function requireSessionUser(returnTo = '/') {
  const user = await getCurrentUser()
  if (!user) redirect(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`)
  return user
}

export function hasDashboardRole(
  user: Pick<SessionUser, 'roles' | 'role'> | null | undefined,
  role: DashboardRole
) {
  return Boolean(
    user &&
      (user.roles.includes(role) ||
        user.roles.includes('platform_admin'))
  )
}

export function isPlatformAdmin(user: Pick<SessionUser, 'roles' | 'role'> | null | undefined) {
  return hasDashboardRole(user, 'platform_admin')
}

export async function requireDashboardAdmin(role: DashboardRole, returnTo: string): Promise<SessionUser> {
  const user = await requireSessionUser(returnTo)
  if (!hasDashboardRole(user, role)) notFound()
  return user
}

export async function requirePlatformAdmin(returnTo = '/platform/admin') {
  return requireDashboardAdmin('platform_admin', returnTo)
}
