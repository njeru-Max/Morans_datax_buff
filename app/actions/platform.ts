'use server'

import { randomUUID } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requirePlatformAdmin } from '@/lib/auth/session'
import { getDb } from '@/lib/db'
import {
  dataxInstitutionMemberships,
  dataxInstitutions,
  moransHackathons,
  moransHostMemberships,
  moransHostOrganizations,
  moransJudgeAssignments,
  appUsers,
  platformAuditLog,
} from '@/lib/db/schema'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATA_X_ROLES = new Set([
  'institution_admin',
  'programme_lead',
  'analyst',
  'instructor',
  'viewer',
])
const HOST_ROLES = new Set(['owner', 'organiser', 'finance_officer', 'judge_coordinator'])

function formText(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function slugify(value: string) {
  const base = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')

  return `${base || 'institution'}-${randomUUID().slice(0, 8)}`
}


async function ensureAuthUser(
  tx: Parameters<
    Parameters<NonNullable<ReturnType<typeof getDb>>['transaction']>[0]
  >[0],
  userId: string,
) {
  const [user] = await tx
    .select({ id: appUsers.id })
    .from(appUsers)
    .where(
      and(
        eq(appUsers.id, userId),
        eq(appUsers.status, 'active'),
      ),
    )
    .limit(1)

  return user ?? null
}


export async function createDataXInstitution(formData: FormData) {
  const admin = await requirePlatformAdmin('/platform/admin')
  const name = formText(formData, 'name')
  const countryCode = formText(formData, 'countryCode').toUpperCase()
  const initialUserId = formText(formData, 'initialUserId')
  const db = getDb()

  if (
    name.length < 2 ||
    name.length > 140 ||
    (countryCode && !/^[A-Z]{2}$/.test(countryCode)) ||
    !UUID_PATTERN.test(initialUserId)
  ) {
    redirect('/platform/admin?status=invalid-institution')
  }

  if (!db) redirect('/platform/admin?status=database-unavailable')

  const outcome = await db.transaction(async (tx) => {
    const targetUser = await ensureAuthUser(tx, initialUserId)
    if (!targetUser) return 'user-not-found' as const

    const [institution] = await tx
      .insert(dataxInstitutions)
      .values({
        ownerUserId: initialUserId,
        name,
        slug: slugify(name),
        countryCode: countryCode || null,
        status: 'pilot',
      })
      .returning({ id: dataxInstitutions.id })

    if (!institution) throw new Error('Institution could not be created.')

    await tx.insert(dataxInstitutionMemberships).values({
      institutionId: institution.id,
      userId: initialUserId,
      role: 'institution_admin',
      status: 'active',
    })

    await tx.insert(platformAuditLog).values({
      actorUserId: admin.id,
      moduleKey: 'data_x',
      action: 'institution.created',
      entityType: 'datax_institution',
      entityId: institution.id,
      metadata: { initialAdminUserId: initialUserId },
    })

    return 'created' as const
  })

  if (outcome === 'user-not-found') redirect('/platform/admin?status=user-not-found')

  revalidatePath('/platform/admin')
  revalidatePath('/data-x')
  redirect('/platform/admin?status=institution-created')
}

export async function grantDataXMembership(formData: FormData) {
  const admin = await requirePlatformAdmin('/platform/admin')
  const institutionId = formText(formData, 'institutionId')
  const userId = formText(formData, 'userId')
  const role = formText(formData, 'role')
  const db = getDb()

  if (
    !UUID_PATTERN.test(institutionId) ||
    !UUID_PATTERN.test(userId) ||
    !DATA_X_ROLES.has(role)
  ) {
    redirect('/platform/admin?status=invalid-membership')
  }

  if (!db) redirect('/platform/admin?status=database-unavailable')

  const outcome = await db.transaction(async (tx) => {
    const targetUser = await ensureAuthUser(tx, userId)
    if (!targetUser) return 'user-not-found' as const

    const [institution] = await tx
      .select({ id: dataxInstitutions.id })
      .from(dataxInstitutions)
      .where(eq(dataxInstitutions.id, institutionId))
      .limit(1)

    if (!institution) return 'institution-not-found' as const

    await tx
      .insert(dataxInstitutionMemberships)
      .values({ institutionId, userId, role, status: 'active' })
      .onConflictDoUpdate({
        target: [dataxInstitutionMemberships.institutionId, dataxInstitutionMemberships.userId],
        set: { role, status: 'active' },
      })

    await tx.insert(platformAuditLog).values({
      actorUserId: admin.id,
      moduleKey: 'data_x',
      action: 'institution.membership.granted',
      entityType: 'datax_institution_membership',
      entityId: `${institutionId}:${userId}`,
      metadata: { institutionId, userId, role },
    })

    return 'granted' as const
  })

  if (outcome === 'user-not-found') redirect('/platform/admin?status=user-not-found')
  if (outcome === 'institution-not-found') redirect('/platform/admin?status=institution-not-found')

  revalidatePath('/platform/admin')
  revalidatePath('/data-x')
  redirect('/platform/admin?status=datax-membership-granted')
}

export async function grantMoransHostMembership(formData: FormData) {
  const admin = await requirePlatformAdmin('/platform/admin')
  const organizationId = formText(formData, 'organizationId')
  const userId = formText(formData, 'userId')
  const role = formText(formData, 'role')
  const db = getDb()

  if (
    !UUID_PATTERN.test(organizationId) ||
    !UUID_PATTERN.test(userId) ||
    !HOST_ROLES.has(role)
  ) {
    redirect('/platform/admin?status=invalid-host-membership')
  }

  if (!db) redirect('/platform/admin?status=database-unavailable')

  const outcome = await db.transaction(async (tx) => {
    const targetUser = await ensureAuthUser(tx, userId)
    if (!targetUser) return 'user-not-found' as const

    const [organization] = await tx
      .select({ id: moransHostOrganizations.id })
      .from(moransHostOrganizations)
      .where(eq(moransHostOrganizations.id, organizationId))
      .limit(1)

    if (!organization) return 'organization-not-found' as const

    await tx
      .insert(moransHostMemberships)
      .values({ organizationId, userId, role, status: 'active' })
      .onConflictDoUpdate({
        target: [moransHostMemberships.organizationId, moransHostMemberships.userId],
        set: { role, status: 'active' },
      })

    await tx.insert(platformAuditLog).values({
      actorUserId: admin.id,
      moduleKey: 'morans',
      action: 'host.membership.granted',
      entityType: 'morans_host_membership',
      entityId: `${organizationId}:${userId}`,
      metadata: { organizationId, userId, role },
    })

    return 'granted' as const
  })

  if (outcome === 'user-not-found') redirect('/platform/admin?status=user-not-found')
  if (outcome === 'organization-not-found') redirect('/platform/admin?status=host-not-found')

  revalidatePath('/platform/admin')
  revalidatePath('/morans/workspace')
  redirect('/platform/admin?status=host-membership-granted')
}


export async function reviewHostOrganization(formData: FormData) {
  const admin = await requirePlatformAdmin('/platform/admin')
  const organizationId = formText(formData, 'organizationId')
  const decision = formText(formData, 'decision')
  const db = getDb()

  if (
    !UUID_PATTERN.test(organizationId) ||
    !['approved', 'needs_information', 'rejected'].includes(decision)
  ) {
    redirect('/platform/admin?status=invalid-host-review')
  }

  if (!db) redirect('/platform/admin?status=database-unavailable')

  const outcome = await db.transaction(async (tx) => {
    const [organization] = await tx
      .update(moransHostOrganizations)
      .set({
        verificationStatus: decision,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(moransHostOrganizations.id, organizationId),
          inArray(moransHostOrganizations.verificationStatus, [
            'submitted',
            'needs_information',
          ]),
        ),
      )
      .returning({ id: moransHostOrganizations.id })

    if (!organization) {
      return 'conflict' as const
    }

    await tx.insert(platformAuditLog).values({
      actorUserId: admin.id,
      moduleKey: 'morans',
      action: `host.application.${decision}`,
      entityType: 'morans_host_organization',
      entityId: organization.id,
      metadata: { decision },
    })

    return 'success' as const
  })

  if (outcome === 'conflict') {
    redirect('/platform/admin?status=host-review-conflict')
  }

  revalidatePath('/platform/admin')
  revalidatePath('/morans/workspace')
  redirect('/platform/admin?status=host-reviewed')
}


export async function reviewHackathon(formData: FormData) {
  const admin = await requirePlatformAdmin('/platform/admin')
  const hackathonId = formText(formData, 'hackathonId')
  const decision = formText(formData, 'decision')
  const db = getDb()

  if (
    !UUID_PATTERN.test(hackathonId) ||
    !['approve', 'needs_information', 'reject'].includes(decision)
  ) {
    redirect('/platform/admin?status=invalid-event-review')
  }

  if (!db) redirect('/platform/admin?status=database-unavailable')

  const outcome = await db.transaction(async (tx) => {
    const [event] = await tx
      .select({
        id: moransHackathons.id,
        status: moransHackathons.status,
        hostType: moransHackathons.hostType,
        hostOrganizationId: moransHackathons.hostOrganizationId,
      })
      .from(moransHackathons)
      .where(eq(moransHackathons.id, hackathonId))
      .limit(1)

    if (!event || !['submitted', 'under_review', 'needs_information'].includes(event.status)) {
      return 'invalid-status' as const
    }

    if (decision === 'approve' && event.hostType === 'external') {
      if (!event.hostOrganizationId) return 'host-not-approved' as const

      const [organization] = await tx
        .select({ verificationStatus: moransHostOrganizations.verificationStatus })
        .from(moransHostOrganizations)
        .where(eq(moransHostOrganizations.id, event.hostOrganizationId))
        .limit(1)

      if (organization?.verificationStatus !== 'approved') return 'host-not-approved' as const
    }

    const status =
      decision === 'approve'
        ? 'published'
        : decision === 'reject'
          ? 'rejected'
          : 'needs_information'

    const [updatedEvent] = await tx
      .update(moransHackathons)
      .set({
        status,
        publishedAt: decision === 'approve' ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(moransHackathons.id, event.id),
          inArray(moransHackathons.status, [
            'submitted',
            'under_review',
            'needs_information',
          ]),
        ),
      )
      .returning({ id: moransHackathons.id })

    if (!updatedEvent) return 'invalid-status' as const

    await tx.insert(platformAuditLog).values({
      actorUserId: admin.id,
      moduleKey: 'morans',
      action: `hackathon.review.${decision}`,
      entityType: 'morans_hackathon',
      entityId: updatedEvent.id,
      metadata: { decision },
    })

    return 'reviewed' as const
  })

  if (outcome === 'invalid-status') redirect('/platform/admin?status=event-review-conflict')
  if (outcome === 'host-not-approved') redirect('/platform/admin?status=host-not-approved')

  revalidatePath('/platform/admin')
  revalidatePath('/morans')
  revalidatePath('/morans/workspace')
  redirect('/platform/admin?status=event-reviewed')
}

export async function assignMoransJudge(formData: FormData) {
  const admin = await requirePlatformAdmin('/platform/admin')
  const hackathonId = formText(formData, 'hackathonId')
  const judgeUserId = formText(formData, 'judgeUserId')
  const db = getDb()

  if (!UUID_PATTERN.test(hackathonId) || !UUID_PATTERN.test(judgeUserId)) {
    redirect('/platform/admin?status=invalid-judge-assignment')
  }

  if (!db) redirect('/platform/admin?status=database-unavailable')

  const outcome = await db.transaction(async (tx) => {
    const targetUser = await ensureAuthUser(tx, judgeUserId)
    if (!targetUser) return 'user-not-found' as const

    
  const [event] = await tx
    .select({
      id: moransHackathons.id,
      status: moransHackathons.status,
    })
    .from(moransHackathons)
    .where(eq(moransHackathons.id, hackathonId))
    .limit(1)

  if (!event) return 'event-not-found' as const
  if (event.status !== 'published') return 'event-not-published' as const


    const [assignment] = await tx
      .insert(moransJudgeAssignments)
      .values({
        hackathonId,
        judgeUserId,
        assignedByUserId: admin.id,
        status: 'pending',
      })
      .onConflictDoNothing({
        target: [moransJudgeAssignments.hackathonId, moransJudgeAssignments.judgeUserId],
      })
      .returning({ id: moransJudgeAssignments.id })

    if (!assignment) return 'already-assigned' as const

    await tx.insert(platformAuditLog).values({
      actorUserId: admin.id,
      moduleKey: 'morans',
      action: 'judge.assignment.created',
      entityType: 'morans_judge_assignment',
      entityId: assignment.id,
      metadata: { hackathonId, judgeUserId },
    })

    return 'assigned' as const
  })

  if (outcome === 'user-not-found') redirect('/platform/admin?status=user-not-found')
  if (outcome === 'event-not-found') redirect('/platform/admin?status=event-not-found')
  if (outcome === 'event-not-published') {
    redirect('/platform/admin?status=event-not-published')
  }
  if (outcome === 'already-assigned') redirect('/platform/admin?status=judge-already-assigned')

  revalidatePath('/platform/admin')
  revalidatePath('/morans/workspace')
  redirect('/platform/admin?status=judge-assigned')
}
