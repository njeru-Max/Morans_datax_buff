
import { PlatformAdminDashboard } from '@/components/platform/platform-admin-dashboard'
import { getPlatformAdminWorkspace } from '@/lib/data/platform-admin'
import { requirePlatformAdmin } from '@/lib/auth/session'
import { getDatabaseStatus } from '@/lib/db'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function PlatformAdminPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  // Enforce authorization before loading platform administration data.
  await requirePlatformAdmin('/platform/admin')

  const [databaseStatus, workspace, params] = await Promise.all([
    getDatabaseStatus(),
    getPlatformAdminWorkspace(),
    searchParams,
  ])

  const statusMessage = Array.isArray(params.status)
    ? params.status[0]
    : params.status

  return (
    <PlatformAdminDashboard
      databaseStatus={databaseStatus}
      statusMessage={statusMessage}
      workspace={workspace}
    />
  )
}
