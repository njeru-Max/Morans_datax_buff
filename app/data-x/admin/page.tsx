import type { Metadata } from 'next'
import { PlatformShell } from '@/components/platform/platform-shell'
import { requireDashboardAdmin } from '@/lib/auth/session'
import { getDatabaseStatus } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Data X administration | Nelsen Savannah' }

export default async function DataXAdminPage() {
  const [user, databaseStatus] = await Promise.all([
    requireDashboardAdmin('data_x_admin', '/data-x/admin'),
    getDatabaseStatus(),
  ])
  return (
    <PlatformShell active="data-x-admin" databaseStatus={databaseStatus} user={user}>
      <section className="dashboard-content">
        <p className="page-eyebrow">DATA X · ADMINISTRATION</p>
        <h1>Data X administration</h1>
        <p>You are signed in as {user.name}. This area is restricted to Data X administrators and platform administrators.</p>
        <p>Before enabling live imports, complete CSV schema validation, duplicate detection, transactional commit, and import audit checks.</p>
      </section>
    </PlatformShell>
  )
}
