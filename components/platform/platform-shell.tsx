import Link from 'next/link'
import {
  ArrowUpRight,
  BarChart3,
  Database,
  House,
  ShieldCheck,
  Trophy,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { signOut } from '@/lib/auth/actions'
import { hasDashboardRole, isPlatformAdmin, type SessionUser } from '@/lib/auth/session'
import type { DatabaseStatus } from '@/lib/db'

type PlatformSection = 'overview' | 'data-x' | 'morans' | 'morans-workspace' | 'admin' | 'data-x-admin' | 'morans-admin'

type PlatformShellProps = {
  active: PlatformSection
  databaseStatus: DatabaseStatus
  user?: SessionUser | null
  children: ReactNode
}

const baseNavigation: Array<{
  href: string
  label: string
  section: PlatformSection
  icon: LucideIcon
}> = [
  { href: '/', label: 'Platform overview', section: 'overview', icon: House },
  { href: '/data-x', label: 'Data X', section: 'data-x', icon: BarChart3 },
  { href: '/morans', label: 'MORANS', section: 'morans', icon: Trophy },
]

const statusLabels: Record<DatabaseStatus, string> = {
  connected: 'PostgreSQL connected',
  'not-configured': 'PostgreSQL needs setup',
  unavailable: 'PostgreSQL unavailable',
}

const workspaceLabels: Record<PlatformSection, string> = {
  overview: 'Platform overview',
  'data-x': 'Data X workspace',
  morans: 'MORANS catalogue',
  'morans-workspace': 'MORANS workspace',
  admin: 'Platform administration',
  'data-x-admin': 'Data X administration',
  'morans-admin': 'MORANS administration',
}

export function PlatformShell({
  active,
  databaseStatus,
  user = null,
  children,
}: PlatformShellProps) {
  const navigation = [
    ...baseNavigation,
    ...(user
      ? [{ href: '/morans/workspace', label: 'My MORANS', section: 'morans-workspace' as const, icon: UsersRound }]
      : []),
    ...(hasDashboardRole(user, 'data_x_admin')
      ? [{ href: '/data-x/admin', label: 'Data X admin', section: 'data-x-admin' as const, icon: ShieldCheck }]
      : []),
    ...(hasDashboardRole(user, 'morans_admin')
      ? [{ href: '/morans/admin', label: 'MORANS admin', section: 'morans-admin' as const, icon: ShieldCheck }]
      : []),
    ...(isPlatformAdmin(user)
      ? [{ href: '/platform/admin', label: 'Platform admin', section: 'admin' as const, icon: ShieldCheck }]
      : []),
  ]

  return (
    <div className="platform-frame">
      <aside className="platform-sidebar">
        <Link className="brand-lockup" href="/" aria-label="Nelsen Savannah platform home">
          <span className="brand-mark" aria-hidden="true">NS</span>
          <span className="brand-copy">
            <strong>Nelsen Savannah</strong>
            <small>Integrated platform</small>
          </span>
        </Link>

        <p className="sidebar-section-label">Workspaces</p>
        <nav aria-label="Main navigation" className="platform-nav">
          {navigation.map(({ href, label, section, icon: Icon }) => (
            <Link
              aria-current={active === section ? 'page' : undefined}
              className={`platform-nav-link${active === section ? ' is-active' : ''}`}
              href={href}
              key={section}
            >
              <Icon aria-hidden="true" className="platform-nav-icon" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <div className="platform-sidebar-footer">
          <span className="sidebar-note-icon" aria-hidden="true"><ShieldCheck /></span>
          <p className="sidebar-footer-title">Role-scoped access</p>
          <p className="sidebar-footer-copy">
            Private records are checked against your session and workspace membership on the server.
          </p>
        </div>
      </aside>

      <main className="platform-main">
        <header className="platform-topbar">
          <p className="topbar-context">
            <span>NELSEN SAVANNAH</span>
            <span aria-hidden="true">/</span>
            <strong>{workspaceLabels[active]}</strong>
          </p>
          <div className="topbar-meta">
            <span
              aria-label={statusLabels[databaseStatus]}
              className={`database-pill is-${databaseStatus}`}
            >
              <span aria-hidden="true" className="database-dot" />
              <Database aria-hidden="true" className="database-icon" />
              {statusLabels[databaseStatus]}
            </span>
            <Link className="topbar-link" href="/#next-phases">
              Build plan
              <ArrowUpRight aria-hidden="true" className="topbar-link-icon" />
            </Link>
            <div className="account-controls">
              {user ? (
                <>
                  <span className="account-name" title={user.email}>
                    {user.name || user.email}
                  </span>
                  {isPlatformAdmin(user) ? <span className="admin-role-badge">Admin</span> : null}
                  <form action={signOut}>
                    <Button size="sm" type="submit" variant="ghost">Sign out</Button>
                  </form>
                </>
              ) : (
                <Link className="account-signin" href="/sign-in">Sign in</Link>
              )}
            </div>
          </div>
        </header>
        <div className="platform-content">{children}</div>
      </main>
    </div>
  )
}
