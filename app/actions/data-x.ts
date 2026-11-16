'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getDb } from '@/lib/db'
import { requireSessionUser } from '@/lib/auth/session'
import {
  dataxImportBatches,
  dataxInstitutionMemberships,
  platformAuditLog,
} from '@/lib/db/schema'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const IMPORT_ROLES = new Set(['institution_admin', 'programme_lead', 'analyst'])

function formText(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function validDate(value: string) {
  if (!DATE_PATTERN.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export async function createDataXImportBatch(formData: FormData) {
  const user = await requireSessionUser('/data-x')
  const institutionId = formText(formData, 'institutionId')
  const filename = formText(formData, 'filename')
  const periodStart = formText(formData, 'periodStart')
  const periodEnd = formText(formData, 'periodEnd')
  const db = getDb()

  if (
    !UUID_PATTERN.test(institutionId) ||
    filename.length < 1 ||
    filename.length > 180 ||
    (periodStart && !validDate(periodStart)) ||
    (periodEnd && !validDate(periodEnd)) ||
    (periodStart && periodEnd && periodStart > periodEnd)
  ) {
    redirect('/data-x?status=invalid-import')
  }

  if (!db) {
    redirect('/data-x?status=database-unavailable')
  }

  const outcome = await db.transaction(async (tx) => {
    const [membership] = await tx
      .select({ role: dataxInstitutionMemberships.role })
      .from(dataxInstitutionMemberships)
      .where(
        and(
          eq(dataxInstitutionMemberships.institutionId, institutionId),
          eq(dataxInstitutionMemberships.userId, user.id),
          eq(dataxInstitutionMemberships.status, 'active'),
        ),
      )
      .limit(1)

    if (!membership || !IMPORT_ROLES.has(membership.role)) {
      return 'access-denied' as const
    }

    const [batch] = await tx
      .insert(dataxImportBatches)
      .values({
        institutionId,
        createdByUserId: user.id,
        originalFilename: filename,
        status: 'draft',
        periodStart: periodStart || null,
        periodEnd: periodEnd || null,
      })
      .returning({ id: dataxImportBatches.id })

    if (!batch) {
      throw new Error('Import draft could not be created.')
    }

    await tx.insert(platformAuditLog).values({
      actorUserId: user.id,
      moduleKey: 'data_x',
      action: 'import.draft.created',
      entityType: 'datax_import_batch',
      entityId: batch.id,
      metadata: { institutionId, filename },
    })

    return 'created' as const
  })

  if (outcome === 'access-denied') {
    redirect('/data-x?status=access-denied')
  }

  revalidatePath('/data-x')
  redirect('/data-x?status=batch-created')
}
