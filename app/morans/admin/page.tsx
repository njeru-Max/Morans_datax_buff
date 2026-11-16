import type { Metadata } from 'next'
import { PlatformShell } from '@/components/platform/platform-shell'
import { requireDashboardAdmin } from '@/lib/auth/session'
import { getDatabaseStatus } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'MORANS administration | Nelsen Savannah' }

export default async function MoransAdminPage() {
  const [user, databaseStatus] = await Promise.all([
    requireDashboardAdmin('morans_admin', '/morans/admin'),
    getDatabaseStatus(),
  ])
  return (
    <PlatformShell active="morans-admin" databaseStatus={databaseStatus} user={user}>
      <section className="dashboard-content">
        <p className="page-eyebrow">MORANS · ADMINISTRATION</p>
        <h1>MORANS administration</h1>
        <p>You are signed in as {user.name}. This area is restricted to MORANS administrators and platform administrators.</p>
        <p>Before production launch, test event publication, participant submissions, host verification, judge assignment, and evaluation state transitions end to end.</p>
      </section>
    </PlatformShell>
  )
}
