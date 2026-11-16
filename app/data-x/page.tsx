import { DataXDashboard } from '@/components/data-x/data-x-dashboard'
import { requireSessionUser } from '@/lib/auth/session'
import { getDataXWorkspace } from '@/lib/data/data-x'
import { getDatabaseStatus } from '@/lib/db'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function DataXPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const user = await requireSessionUser('/data-x')
  const [databaseStatus, workspace, params] = await Promise.all([
    getDatabaseStatus(),
    getDataXWorkspace(user.id),
    searchParams,
  ])

  const statusMessage = Array.isArray(params.status) ? params.status[0] : params.status

  return (
    <DataXDashboard
      databaseStatus={databaseStatus}
      statusMessage={statusMessage}
      user={user}
      workspace={workspace}
    />
  )
}
