'use server'

import { randomUUID } from 'node:crypto'
import { and, eq, inArray, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireSessionUser } from '@/lib/auth/session'
import { getDb } from '@/lib/db'
import {
  moransApplications,
  moransEvaluations,
  moransHackathons,
  moransHostMemberships,
  moransHostOrganizations,
  moransJudgeAssignments,
  moransSubmissions,
  platformAuditLog,
} from '@/lib/db/schema'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ORGANIZATION_TYPES = new Set([
  'individual',
  'student_club',
  'university',
  'company',
  'ngo',
  'community',
  'other',
])
const EVENT_FORMATS = new Set(['in_person', 'online', 'hybrid'])
const HOST_EDIT_ROLES = ['owner', 'organiser']

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

  return `${base || 'hackathon'}-${randomUUID().slice(0, 8)}`
}

export async function createHostOrganization(formData: FormData) {
  const user = await requireSessionUser('/morans/workspace')
  const name = formText(formData, 'name')
  const organizationType = formText(formData, 'organizationType')
  const db = getDb()

  if (
    name.length < 2 ||
    name.length > 120 ||
    !ORGANIZATION_TYPES.has(organizationType)
  ) {
    redirect('/morans/workspace?status=invalid-host')
  }

  if (!db) {
    redirect('/morans/workspace?status=database-unavailable')
  }

  const memberships = await db
    .select({ id: moransHostMemberships.id })
    .from(moransHostMemberships)
    .where(
      and(
        eq(moransHostMemberships.userId, user.id),
        eq(moransHostMemberships.status, 'active'),
      ),
    )
    .limit(5)

  if (memberships.length >= 5) {
    redirect('/morans/workspace?status=host-limit')
  }

  await db.transaction(async (tx) => {
    const [organization] = await tx
      .insert(moransHostOrganizations)
      .values({
        ownerUserId: user.id,
        name,
        organizationType,
        verificationStatus: 'submitted',
      })
      .returning({ id: moransHostOrganizations.id })

    if (!organization) {
      throw new Error('Host application could not be created.')
    }

    await tx.insert(moransHostMemberships).values({
      organizationId: organization.id,
      userId: user.id,
      role: 'owner',
      status: 'active',
    })

    await tx.insert(platformAuditLog).values({
      actorUserId: user.id,
      moduleKey: 'morans',
      action: 'host.application.created',
      entityType: 'morans_host_organization',
      entityId: organization.id,
      metadata: { organizationType },
    })
  })

  revalidatePath('/morans')
  revalidatePath('/morans/workspace')
  redirect('/morans/workspace?status=host-submitted')
}

export async function createHackathonDraft(formData: FormData) {
  const user = await requireSessionUser('/morans/workspace')
  const organizationId = formText(formData, 'organizationId')
  const title = formText(formData, 'title')
  const summary = formText(formData, 'summary')
  const format = formText(formData, 'format')
  const location = formText(formData, 'location')
  const db = getDb()

  if (
    !UUID_PATTERN.test(organizationId) ||
    title.length < 3 ||
    title.length > 120 ||
    summary.length > 1200 ||
    !EVENT_FORMATS.has(format) ||
    location.length > 180
  ) {
    redirect('/morans/workspace?status=invalid-event')
  }

  if (!db) {
    redirect('/morans/workspace?status=database-unavailable')
  }

  const outcome = await db.transaction(async (tx) => {
    const [membership] = await tx
      .select({ role: moransHostMemberships.role })
      .from(moransHostMemberships)
      .where(
        and(
          eq(moransHostMemberships.organizationId, organizationId),
          eq(moransHostMemberships.userId, user.id),
          eq(moransHostMemberships.status, 'active'),
          inArray(moransHostMemberships.role, HOST_EDIT_ROLES),
        ),
      )
      .limit(1)

    if (!membership) return 'access-denied' as const

    const [organization] = await tx
      .select({ verificationStatus: moransHostOrganizations.verificationStatus })
      .from(moransHostOrganizations)
      .where(eq(moransHostOrganizations.id, organizationId))
      .limit(1)

    if (!organization || organization.verificationStatus !== 'approved') {
      return 'host-not-approved' as const
    }

    const [event] = await tx
      .insert(moransHackathons)
      .values({
        hostType: 'external',
        hostOrganizationId: organizationId,
        title,
        slug: slugify(title),
        summary,
        format,
        location: location || null,
        status: 'draft',
        createdByUserId: user.id,
      })
      .returning({ id: moransHackathons.id })

    if (!event) throw new Error('Hackathon draft could not be created.')

    await tx.insert(platformAuditLog).values({
      actorUserId: user.id,
      moduleKey: 'morans',
      action: 'hackathon.draft.created',
      entityType: 'morans_hackathon',
      entityId: event.id,
      metadata: { organizationId, format },
    })

    return 'created' as const
  })

  if (outcome === 'access-denied') {
    redirect('/morans/workspace?status=access-denied')
  }

  if (outcome === 'host-not-approved') {
    redirect('/morans/workspace?status=host-not-approved')
  }

  revalidatePath('/morans/workspace')
  redirect('/morans/workspace?status=event-draft-created')
}

export async function submitHackathonForReview(formData: FormData) {
  const user = await requireSessionUser('/morans/workspace')
  const hackathonId = formText(formData, 'hackathonId')
  const db = getDb()

  if (!UUID_PATTERN.test(hackathonId)) {
    redirect('/morans/workspace?status=invalid-event')
  }

  if (!db) {
    redirect('/morans/workspace?status=database-unavailable')
  }

  const outcome = await db.transaction(async (tx) => {
    const [event] = await tx
      .select({
        id: moransHackathons.id,
        status: moransHackathons.status,
        hostOrganizationId: moransHackathons.hostOrganizationId,
      })
      .from(moransHackathons)
      .innerJoin(
        moransHostMemberships,
        and(
          eq(moransHackathons.hostOrganizationId, moransHostMemberships.organizationId),
          eq(moransHostMemberships.userId, user.id),
          eq(moransHostMemberships.status, 'active'),
          inArray(moransHostMemberships.role, HOST_EDIT_ROLES),
        ),
      )
      .where(eq(moransHackathons.id, hackathonId))
      .limit(1)

    if (!event?.hostOrganizationId) return 'access-denied' as const
    if (!['draft', 'needs_information'].includes(event.status)) return 'invalid-status' as const

    const [organization] = await tx
      .select({ verificationStatus: moransHostOrganizations.verificationStatus })
      .from(moransHostOrganizations)
      .where(eq(moransHostOrganizations.id, event.hostOrganizationId))
      .limit(1)

    if (organization?.verificationStatus !== 'approved') return 'host-not-approved' as const

    const [updatedEvent] = await tx
      .update(moransHackathons)
      .set({ status: 'submitted', updatedAt: new Date() })
      .where(
        and(
          eq(moransHackathons.id, event.id),
          inArray(moransHackathons.status, ['draft', 'needs_information']),
        ),
      )
      .returning({ id: moransHackathons.id })

    if (!updatedEvent) return 'invalid-status' as const

    await tx.insert(platformAuditLog).values({
      actorUserId: user.id,
      moduleKey: 'morans',
      action: 'hackathon.submitted',
      entityType: 'morans_hackathon',
      entityId: updatedEvent.id,
      metadata: { organizationId: event.hostOrganizationId },
    })

    return 'submitted' as const
  })

  if (outcome === 'access-denied') redirect('/morans/workspace?status=access-denied')
  if (outcome === 'host-not-approved') redirect('/morans/workspace?status=host-not-approved')
  if (outcome === 'invalid-status') redirect('/morans/workspace?status=event-already-submitted')

  revalidatePath('/morans/workspace')
  redirect('/morans/workspace?status=event-submitted')
}

export async function applyToHackathon(formData: FormData) {
  const user = await requireSessionUser('/morans')
  const hackathonId = formText(formData, 'hackathonId')
  const db = getDb()

  if (!UUID_PATTERN.test(hackathonId)) {
    redirect('/morans?status=invalid-application#events')
  }

  if (!db) {
    redirect('/morans?status=database-unavailable#events')
  }

  const outcome = await db.transaction(async (tx) => {
    const [event] = await tx
      .select({
        id: moransHackathons.id,
        status: moransHackathons.status,
        registrationOpensAt: moransHackathons.registrationOpensAt,
        registrationClosesAt: moransHackathons.registrationClosesAt,
      })
      .from(moransHackathons)
      .where(eq(moransHackathons.id, hackathonId))
      .limit(1)

    const now = new Date()

    if (
      !event ||
      event.status !== 'published' ||
      (event.registrationOpensAt && event.registrationOpensAt > now) ||
      (event.registrationClosesAt && event.registrationClosesAt < now)
    ) {
      return 'registration-closed' as const
    }

    const [application] = await tx
      .insert(moransApplications)
      .values({
        hackathonId: event.id,
        participantUserId: user.id,
        status: 'submitted',
        submittedAt: now,
      })
      .onConflictDoNothing({
        target: [moransApplications.hackathonId, moransApplications.participantUserId],
      })
      .returning({ id: moransApplications.id })

    if (!application) return 'already-applied' as const

    await tx.insert(platformAuditLog).values({
      actorUserId: user.id,
      moduleKey: 'morans',
      action: 'application.submitted',
      entityType: 'morans_application',
      entityId: application.id,
      metadata: { hackathonId: event.id },
    })

    return 'applied' as const
  })

  revalidatePath('/morans')
  revalidatePath('/morans/workspace')
  redirect(`/morans?status=${outcome}#events`)
}

export async function respondToJudgeAssignment(formData: FormData) {
  const user = await requireSessionUser('/morans/workspace')
  const assignmentId = formText(formData, 'assignmentId')
  const response = formText(formData, 'response')
  const db = getDb()

  if (!UUID_PATTERN.test(assignmentId) || !['accepted', 'declined'].includes(response)) {
    redirect('/morans/workspace?status=invalid-assignment')
  }

  if (!db) {
    redirect('/morans/workspace?status=database-unavailable')
  }

  const [assignment] = await db
    .update(moransJudgeAssignments)
    .set({ status: response })
    .where(
      and(
        eq(moransJudgeAssignments.id, assignmentId),
        eq(moransJudgeAssignments.judgeUserId, user.id),
        eq(moransJudgeAssignments.status, 'pending'),
      ),
    )
    .returning({ id: moransJudgeAssignments.id, hackathonId: moransJudgeAssignments.hackathonId })

  if (!assignment) {
    redirect('/morans/workspace?status=invalid-assignment')
  }

  await db.insert(platformAuditLog).values({
    actorUserId: user.id,
    moduleKey: 'morans',
    action: `judge.assignment.${response}`,
    entityType: 'morans_judge_assignment',
    entityId: assignment.id,
    metadata: { hackathonId: assignment.hackathonId },
  })

  revalidatePath('/morans/workspace')
  redirect(`/morans/workspace?status=assignment-${response}`)
}

export async function submitJudgeEvaluation(formData: FormData) {
  const user = await requireSessionUser('/morans/workspace')
  const submissionId = formText(formData, 'submissionId')
  const scoreValue = formText(formData, 'score')
  const feedback = formText(formData, 'feedback')
  const score = Number(scoreValue)
  const db = getDb()

  if (
    !UUID_PATTERN.test(submissionId) ||
    !Number.isFinite(score) ||
    score < 0 ||
    score > 100 ||
    feedback.length > 5000
  ) {
    redirect('/morans/workspace?status=invalid-evaluation')
  }

  if (!db) {
    redirect('/morans/workspace?status=database-unavailable')
  }

  const outcome = await db.transaction(async (tx) => {
    const [submission] = await tx
      .select({
        id: moransSubmissions.id,
        hackathonId: moransSubmissions.hackathonId,
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
          eq(moransSubmissions.id, submissionId),
          ne(moransSubmissions.participantUserId, user.id),
          inArray(moransSubmissions.status, ['submitted', 'locked']),
        ),
      )
      .limit(1)

    if (!submission) return 'access-denied' as const

    const roundedScore = Math.round(score * 1000) / 1000
    const [evaluation] = await tx
      .insert(moransEvaluations)
      .values({
        hackathonId: submission.hackathonId,
        submissionId: submission.id,
        judgeUserId: user.id,
        score: String(roundedScore),
        feedback,
        conflictDeclared: false,
        status: 'submitted',
      })
      .onConflictDoUpdate({
        target: [moransEvaluations.submissionId, moransEvaluations.judgeUserId],
        set: {
          score: String(roundedScore),
          feedback,
          conflictDeclared: false,
          status: 'submitted',
          updatedAt: new Date(),
        },
      })
      .returning({ id: moransEvaluations.id })

    if (!evaluation) throw new Error('Judge evaluation could not be saved.')

    await tx.insert(platformAuditLog).values({
      actorUserId: user.id,
      moduleKey: 'morans',
      action: 'judge.evaluation.submitted',
      entityType: 'morans_evaluation',
      entityId: evaluation.id,
      metadata: { submissionId: submission.id, score: roundedScore },
    })

    return 'submitted' as const
  })

  if (outcome === 'access-denied') {
    redirect('/morans/workspace?status=access-denied')
  }

  revalidatePath('/morans/workspace')
  redirect('/morans/workspace?status=evaluation-submitted')
}

export async function reviewMoransApplication(formData: FormData) {
  const user = await requireSessionUser('/morans/workspace')
  const applicationId = formText(formData, 'applicationId')
  const decision = formText(formData, 'decision')
  const allowedDecisions = new Set([
    'eligible',
    'accepted',
    'waitlisted',
    'rejected',
    'needs_information',
  ])
  const db = getDb()

  if (!UUID_PATTERN.test(applicationId) || !allowedDecisions.has(decision)) {
    redirect('/morans/workspace?status=invalid-application-review')
  }

  if (!db) {
    redirect('/morans/workspace?status=database-unavailable')
  }

  const outcome = await db.transaction(async (tx) => {
    const [application] = await tx
      .select({
        id: moransApplications.id,
        hackathonId: moransApplications.hackathonId,
        status: moransApplications.status,
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
          inArray(moransHostMemberships.role, HOST_EDIT_ROLES),
        ),
      )
      .where(
        and(
          eq(moransApplications.id, applicationId),
          eq(moransApplications.status, 'submitted'),
        ),
      )
      .limit(1)

    if (!application) return 'access-denied' as const

    const [updatedApplication] = await tx
      .update(moransApplications)
      .set({ status: decision, updatedAt: new Date() })
      .where(
        and(
          eq(moransApplications.id, application.id),
          eq(moransApplications.status, 'submitted'),
        ),
      )
      .returning({ id: moransApplications.id })

    if (!updatedApplication) return 'invalid-status' as const

    await tx.insert(platformAuditLog).values({
      actorUserId: user.id,
      moduleKey: 'morans',
      action: `application.${decision}`,
      entityType: 'morans_application',
      entityId: updatedApplication.id,
      metadata: { hackathonId: application.hackathonId },
    })

    return 'reviewed' as const
  })

  if (outcome === 'access-denied') redirect('/morans/workspace?status=access-denied')
  if (outcome === 'invalid-status') redirect('/morans/workspace?status=application-already-reviewed')

  revalidatePath('/morans/workspace')
  redirect('/morans/workspace?status=application-reviewed')
}

export async function submitProjectSubmission(formData: FormData) {
  const user = await requireSessionUser('/morans/workspace')
  const hackathonId = formText(formData, 'hackathonId')
  const title = formText(formData, 'title')
  const summary = formText(formData, 'summary')
  const projectUrl = formText(formData, 'projectUrl')
  const db = getDb()

  if (
    !UUID_PATTERN.test(hackathonId) ||
    title.length < 3 ||
    title.length > 140 ||
    summary.length > 3000 ||
    projectUrl.length > 500
  ) {
    redirect('/morans/workspace?status=invalid-submission')
  }

  let normalizedProjectUrl: string | null = null

  if (projectUrl) {
    try {
      const parsedUrl = new URL(projectUrl)
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        redirect('/morans/workspace?status=invalid-submission')
      }
      normalizedProjectUrl = parsedUrl.toString()
    } catch {
      redirect('/morans/workspace?status=invalid-submission')
    }
  }

  if (!db) {
    redirect('/morans/workspace?status=database-unavailable')
  }

  const outcome = await db.transaction(async (tx) => {
    const [application] = await tx
      .select({ status: moransApplications.status })
      .from(moransApplications)
      .where(
        and(
          eq(moransApplications.hackathonId, hackathonId),
          eq(moransApplications.participantUserId, user.id),
          inArray(moransApplications.status, ['eligible', 'accepted']),
        ),
      )
      .limit(1)

    if (!application) return 'not-accepted' as const

    const [event] = await tx
      .select({
        id: moransHackathons.id,
        status: moransHackathons.status,
        endsAt: moransHackathons.endsAt,
      })
      .from(moransHackathons)
      .where(eq(moransHackathons.id, hackathonId))
      .limit(1)

    if (
      !event ||
      event.status !== 'published' ||
      (event.endsAt && event.endsAt < new Date())
    ) {
      return 'submission-closed' as const
    }

    const [existingSubmission] = await tx
      .select({ id: moransSubmissions.id, status: moransSubmissions.status })
      .from(moransSubmissions)
      .where(
        and(
          eq(moransSubmissions.hackathonId, hackathonId),
          eq(moransSubmissions.participantUserId, user.id),
        ),
      )
      .orderBy(moransSubmissions.createdAt)
      .limit(1)

    if (existingSubmission && existingSubmission.status !== 'draft') {
      return 'already-submitted' as const
    }

    const now = new Date()
    let submissionId = existingSubmission?.id

    if (existingSubmission) {
      const [updated] = await tx
        .update(moransSubmissions)
        .set({
          title,
          summary,
          projectUrl: normalizedProjectUrl,
          status: 'submitted',
          submittedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(moransSubmissions.id, existingSubmission.id),
            eq(moransSubmissions.participantUserId, user.id),
            eq(moransSubmissions.status, 'draft'),
          ),
        )
        .returning({ id: moransSubmissions.id })

      submissionId = updated?.id
    } else {
      const [created] = await tx
        .insert(moransSubmissions)
        .values({
          hackathonId,
          participantUserId: user.id,
          title,
          summary,
          projectUrl: normalizedProjectUrl,
          status: 'submitted',
          submittedAt: now,
        })
        .returning({ id: moransSubmissions.id })

      submissionId = created?.id
    }

    if (!submissionId) return 'already-submitted' as const

    await tx.insert(platformAuditLog).values({
      actorUserId: user.id,
      moduleKey: 'morans',
      action: 'submission.submitted',
      entityType: 'morans_submission',
      entityId: submissionId,
      metadata: { hackathonId },
    })

    return 'submitted' as const
  })

  if (outcome === 'not-accepted') redirect('/morans/workspace?status=application-not-accepted')
  if (outcome === 'submission-closed') redirect('/morans/workspace?status=submission-closed')
  if (outcome === 'already-submitted') redirect('/morans/workspace?status=already-submitted')

  revalidatePath('/morans/workspace')
  redirect('/morans/workspace?status=submission-submitted')
}
