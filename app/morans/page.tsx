import { MoransDashboard } from '@/components/morans/morans-dashboard'
import { getCurrentUser } from '@/lib/auth/session'
import { getDatabaseStatus } from '@/lib/db'
import { getMoransPublicDashboard, getMoransWorkspace } from '@/lib/data/morans'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function MoransPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const [databaseStatus, dashboard, user, params] = await Promise.all([
    getDatabaseStatus(),
    getMoransPublicDashboard(),
    getCurrentUser(),
    searchParams,
  ])
  const workspace = user ? await getMoransWorkspace(user) : null
  const statusMessage = Array.isArray(params.status) ? params.status[0] : params.status

  return (
    <MoransDashboard
      databaseStatus={databaseStatus}
      dashboard={dashboard}
      statusMessage={statusMessage}
      user={user}
      workspace={workspace}
    />
  )
}
