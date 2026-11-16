
import 'server-only'

import { asc, desc, inArray } from 'drizzle-orm'
import { requirePlatformAdmin, type SessionUser } from '@/lib/auth/session'
import { getDb } from '@/lib/db'
import {
  dataxInstitutions,
  moransHackathons,
  moransHostOrganizations,
} from '@/lib/db/schema'

export async function getPlatformAdminWorkspace() {
  const user: SessionUser = await requirePlatformAdmin('/platform/admin')
  const db = getDb()

  const emptyWorkspace = {
    institutions: [],
    hostOrganizations: [],
    hackathons: [],
  }

  if (!db) {
    return {
      user,
      status: 'not-configured' as const,
      ...emptyWorkspace,
    }
  }

  try {
    const [institutions, hostOrganizations, hackathons] = await Promise.all([
      db
        .select({
          id: dataxInstitutions.id,
          name: dataxInstitutions.name,
          slug: dataxInstitutions.slug,
          status: dataxInstitutions.status,
        })
        .from(dataxInstitutions)
        .orderBy(asc(dataxInstitutions.name))
        .limit(200),

      db
        .select({
          id: moransHostOrganizations.id,
          name: moransHostOrganizations.name,
          organizationType: moransHostOrganizations.organizationType,
          verificationStatus: moransHostOrganizations.verificationStatus,
          ownerUserId: moransHostOrganizations.ownerUserId,
        })
        .from(moransHostOrganizations)
        .orderBy(desc(moransHostOrganizations.createdAt))
        .limit(200),

      db
        .select({
          id: moransHackathons.id,
          title: moransHackathons.title,
          status: moransHackathons.status,
          hostType: moransHackathons.hostType,
          hostOrganizationId: moransHackathons.hostOrganizationId,
        })
        .from(moransHackathons)
        .where(
          inArray(moransHackathons.status, [
            'submitted',
            'under_review',
            'needs_information',
            'published',
          ]),
        )
        .orderBy(desc(moransHackathons.createdAt))
        .limit(200),
    ])

    return {
      user,
      status: 'ready' as const,
      institutions,
      hostOrganizations,
      hackathons,
    }
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String(error.code)
        : undefined

    console.error(
      '[database] Platform admin workspace query failed.',
      error instanceof Error ? error.name : 'UnknownError',
    )

    return {
      user,
      status: code === '42P01' ? ('schema-not-ready' as const) : ('unavailable' as const),
      ...emptyWorkspace,
    }
  }
}
