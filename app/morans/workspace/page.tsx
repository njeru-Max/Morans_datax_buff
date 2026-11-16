import { MoransWorkspace } from '@/components/morans/morans-workspace'
import { requireSessionUser } from '@/lib/auth/session'
import { getMoransWorkspace } from '@/lib/data/morans'
import { getDatabaseStatus } from '@/lib/db'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function MoransWorkspacePage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const user = await requireSessionUser('/morans/workspace')
  const [databaseStatus, workspace, params] = await Promise.all([
    getDatabaseStatus(),
    getMoransWorkspace(user),
    searchParams,
  ])

  const statusMessage = Array.isArray(params.status) ? params.status[0] : params.status

  return (
    <MoransWorkspace
      databaseStatus={databaseStatus}
      statusMessage={statusMessage}
      user={user}
      workspace={workspace}
    />
  )
}
