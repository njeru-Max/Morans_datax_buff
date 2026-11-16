import 'server-only'

import { and, asc, count, desc, eq, inArray, ne } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { isPlatformAdmin, type SessionUser } from '@/lib/auth/session'
import {
  moransApplications,
  moransEvaluations,
  moransHackathons,
  moransHostMemberships,
  moransHostOrganizations,
  moransJudgeAssignments,
  moransSubmissions,
} from '@/lib/db/schema'

export type MoransDashboardStatus =
  | 'ready'
  | 'not-configured'
  | 'schema-not-ready'
  | 'unavailable'

export async function getMoransPublicDashboard() {
  const db = getDb()

  if (!db) {
    return {
      status: 'not-configured' as const,
      publishedCount: 0,
      events: [],
    }
  }

  try {
    const [countResult] = await db
      .select({ value: count() })
      .from(moransHackathons)
      .where(eq(moransHackathons.status, 'published'))

    const events = await db
      .select({
        id: moransHackathons.id,
        title: moransHackathons.title,
        slug: moransHackathons.slug,
        summary: moransHackathons.summary,
        hostType: moransHackathons.hostType,
        format: moransHackathons.format,
        location: moransHackathons.location,
        startsAt: moransHackathons.startsAt,
        registrationOpensAt: moransHackathons.registrationOpensAt,
        registrationClosesAt: moransHackathons.registrationClosesAt,
      })
      .from(moransHackathons)
      .where(eq(moransHackathons.status, 'published'))
      .orderBy(asc(moransHackathons.startsAt))
      .limit(6)

    return {
      status: 'ready' as const,
      publishedCount: countResult?.value ?? 0,
      events,
    }
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String(error.code)
        : undefined

    console.error(
      '[database] MORANS public catalogue query failed.',
      error instanceof Error ? error.name : 'UnknownError',
    )

    return {
      status: code === '42P01' ? ('schema-not-ready' as const) : ('unavailable' as const),
      publishedCount: 0,
      events: [],
    }
  }
}

export async function getMoransWorkspace(user: SessionUser) {
  const db = getDb()
  const platformAdmin = isPlatformAdmin(user)

  const emptyWorkspace = {
    applications: [],
    participantSubmissions: [],
    hostApplications: [],
    hostOrganizations: [],
    hostEvents: [],
    judgeAssignments: [],
    judgeSubmissions: [],
    judgeEvaluations: [],
    pendingHosts: [],
    pendingEvents: [],
  }

  if (!db) {
    return {
      status: 'not-configured' as const,
      platformAdmin,
      ...emptyWorkspace,
    }
  }

  try {
    const [applications, participantSubmissions, hostOrganizations, judgeAssignments] =
      await Promise.all([
        db
          .select({
            id: moransApplications.id,
            hackathonId: moransApplications.hackathonId,
            title: moransHackathons.title,
            slug: moransHackathons.slug,
            status: moransApplications.status,
            submittedAt: moransApplications.submittedAt,
          })
          .from(moransApplications)
          .innerJoin(
            moransHackathons,
            eq(moransApplications.hackathonId, moransHackathons.id),
          )
          .where(eq(moransApplications.participantUserId, user.id))
          .orderBy(desc(moransApplications.createdAt))
          .limit(50),
        db
          .select({
            id: moransSubmissions.id,
            hackathonId: moransSubmissions.hackathonId,
            title: moransSubmissions.title,
            status: moransSubmissions.status,
            submittedAt: moransSubmissions.submittedAt,
          })
          .from(moransSubmissions)
          .where(eq(moransSubmissions.participantUserId, user.id))
          .orderBy(desc(moransSubmissions.createdAt))
          .limit(50),
        db
        .select({
          organizationId: moransHostOrganizations.id,
          organizationName: moransHostOrganizations.name,
          verificationStatus: moransHostOrganizations.verificationStatus,
          role: moransHostMemberships.role,
        })
        .from(moransHostMemberships)
        .innerJoin(
          moransHostOrganizations,
          eq(moransHostMemberships.organizationId, moransHostOrganizations.id),
        )
        .where(
          and(
            eq(moransHostMemberships.userId, user.id),
            eq(moransHostMemberships.status, 'active'),
          ),
        )
        .orderBy(asc(moransHostOrganizations.name)),
      db
        .select({
          id: moransJudgeAssignments.id,
          hackathonId: moransJudgeAssignments.hackathonId,
          title: moransHackathons.title,
          status: moransJudgeAssignments.status,
          createdAt: moransJudgeAssignments.createdAt,
        })
        .from(moransJudgeAssignments)
        .innerJoin(
          moransHackathons,
          eq(moransJudgeAssignments.hackathonId, moransHackathons.id),
        )
        .where(
          and(
            eq(moransJudgeAssignments.judgeUserId, user.id),
            inArray(moransJudgeAssignments.status, ['pending', 'accepted']),
          ),
        )
        .orderBy(desc(moransJudgeAssignments.createdAt))
        .limit(50),
    ])

    const organizationIds = hostOrganizations.map((organization) => organization.organizationId)
    const assignedHackathonIds = judgeAssignments
      .filter((assignment) => assignment.status === 'accepted')
      .map((assignment) => assignment.hackathonId)
    const uniqueAssignedHackathonIds = [...new Set(assignedHackathonIds)]

    const [hostEvents, judgeSubmissions, pendingHosts, pendingEvents] = await Promise.all([
      organizationIds.length > 0
        ? db
            .select({
              id: moransHackathons.id,
              hostOrganizationId: moransHackathons.hostOrganizationId,
              title: moransHackathons.title,
              status: moransHackathons.status,
              createdAt: moransHackathons.createdAt,
            })
            .from(moransHackathons)
            .innerJoin(
              moransHostMemberships,
              and(
                eq(moransHackathons.hostOrganizationId, moransHostMemberships.organizationId),
                eq(moransHostMemberships.userId, user.id),
                eq(moransHostMemberships.status, 'active'),
              ),
            )
            .where(inArray(moransHackathons.hostOrganizationId, organizationIds))
            .orderBy(desc(moransHackathons.createdAt))
            .limit(50)
        : Promise.resolve([]),
      uniqueAssignedHackathonIds.length > 0
        ? db
            .select({
              id: moransSubmissions.id,
              hackathonId: moransSubmissions.hackathonId,
              title: moransSubmissions.title,
              summary: moransSubmissions.summary,
              projectUrl: moransSubmissions.projectUrl,
              status: moransSubmissions.status,
            })
            .from(moransSubmissions)
            .innerJoin(
              moransJudgeAssignments,
              and(
                eq(moransSubmissions.hackathonId, moransJudgeAssignments.hackathonId),
                eq(moransJudgeAssignments.judgeUserId, user.id),
                eq(moransJudgeAssignments.status, 'accepted'),
              ),
            )
            .where(
              and(
                inArray(moransSubmissions.hackathonId, uniqueAssignedHackathonIds),
                inArray(moransSubmissions.status, ['submitted', 'locked']),
                ne(moransSubmissions.participantUserId, user.id),
              ),
            )
            .orderBy(asc(moransSubmissions.createdAt))
            .limit(100)
        : Promise.resolve([]),
      platformAdmin
        ? db
            .select({
              id: moransHostOrganizations.id,
              name: moransHostOrganizations.name,
              organizationType: moransHostOrganizations.organizationType,
              verificationStatus: moransHostOrganizations.verificationStatus,
              ownerUserId: moransHostOrganizations.ownerUserId,
              createdAt: moransHostOrganizations.createdAt,
            })
            .from(moransHostOrganizations)
            .where(
              inArray(moransHostOrganizations.verificationStatus, [
                'submitted',
                'needs_information',
              ]),
            )
            .orderBy(asc(moransHostOrganizations.createdAt))
            .limit(100)
        : Promise.resolve([]),
      platformAdmin
        ? db
            .select({
              id: moransHackathons.id,
              title: moransHackathons.title,
              status: moransHackathons.status,
              hostType: moransHackathons.hostType,
              hostOrganizationId: moransHackathons.hostOrganizationId,
              createdByUserId: moransHackathons.createdByUserId,
              createdAt: moransHackathons.createdAt,
            })
            .from(moransHackathons)
            .where(
              inArray(moransHackathons.status, [
                'submitted',
                'under_review',
                'needs_information',
              ]),
            )
            .orderBy(asc(moransHackathons.createdAt))
            .limit(100)
        : Promise.resolve([]),
    ])

    const manageableOrganizationIds = hostOrganizations
      .filter((organization) => ['owner', 'organiser'].includes(organization.role))
      .map((organization) => organization.organizationId)
    const manageableHostEventIds = hostEvents
      .filter((event) =>
        event.hostOrganizationId
          ? manageableOrganizationIds.includes(event.hostOrganizationId)
          : false,
      )
      .map((event) => event.id)
    const hostApplications =
      manageableHostEventIds.length > 0
        ? await db
            .select({
              id: moransApplications.id,
              hackathonId: moransApplications.hackathonId,
              hackathonTitle: moransHackathons.title,
              participantUserId: moransApplications.participantUserId,
              status: moransApplications.status,
              submittedAt: moransApplications.submittedAt,
            })
            .from(moransApplications)
            .innerJoin(
              moransHackathons,
              eq(moransApplications.hackathonId, moransHackathons.id),
            )
            .innerJoin(
              moransHostMemberships,
              and(
                eq(moransHackathons.hostOrganizationId, moransHostMemberships.organizationId),
                eq(moransHostMemberships.userId, user.id),
                eq(moransHostMemberships.status, 'active'),
                inArray(moransHostMemberships.role, ['owner', 'organiser']),
              ),
            )
            .where(inArray(moransApplications.hackathonId, manageableHostEventIds))
            .orderBy(desc(moransApplications.createdAt))
            .limit(100)
        : []

    const submissionIds = judgeSubmissions.map((submission) => submission.id)
    const judgeEvaluations =
      submissionIds.length > 0
        ? await db
            .select({
              submissionId: moransEvaluations.submissionId,
              score: moransEvaluations.score,
              status: moransEvaluations.status,
              conflictDeclared: moransEvaluations.conflictDeclared,
            })
            .from(moransEvaluations)
            .where(
              and(
                eq(moransEvaluations.judgeUserId, user.id),
                inArray(moransEvaluations.submissionId, submissionIds),
              ),
            )
        : []

    return {
      status: 'ready' as const,
      platformAdmin,
      applications,
      participantSubmissions,
      hostApplications,
      hostOrganizations,
      hostEvents,
      judgeAssignments,
      judgeSubmissions,
      judgeEvaluations,
      pendingHosts,
      pendingEvents,
    }
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String(error.code)
        : undefined

    console.error(
      '[database] MORANS role-scoped query failed.',
      error instanceof Error ? error.name : 'UnknownError',
    )

    return {
      status: code === '42P01' ? ('schema-not-ready' as const) : ('unavailable' as const),
      platformAdmin,
      ...emptyWorkspace,
    }
  }
}
