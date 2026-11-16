import { PortalDashboard } from '@/components/portal-dashboard'
import { getCurrentUser } from '@/lib/auth/session'
import { isAuthConfigured } from '@/lib/auth/server'
import { getDatabaseStatus } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const [databaseStatus, user] = await Promise.all([getDatabaseStatus(), getCurrentUser()])
  return (
    <PortalDashboard
      authAvailable={isAuthConfigured()}
      databaseStatus={databaseStatus}
      user={user}
    />
  )
}
