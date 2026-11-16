import 'server-only'

import { and, asc, count, desc, eq, inArray } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import {
  dataxImportBatches,
  dataxInstitutionMemberships,
  dataxInstitutions,
  dataxMetricRecords,
} from '@/lib/db/schema'

export type DataXWorkspaceStatus =
  | 'ready'
  | 'not-configured'
  | 'schema-not-ready'
  | 'unavailable'

export async function getDataXWorkspace(userId: string) {
  const db = getDb()

  if (!db) {
    return {
      status: 'not-configured' as const,
      institutions: [],
      recentBatches: [],
    }
  }

  try {
    const memberships = await db
      .select({
        institutionId: dataxInstitutions.id,
        institutionName: dataxInstitutions.name,
        institutionSlug: dataxInstitutions.slug,
        institutionStatus: dataxInstitutions.status,
        role: dataxInstitutionMemberships.role,
      })
      .from(dataxInstitutionMemberships)
      .innerJoin(
        dataxInstitutions,
        eq(dataxInstitutionMemberships.institutionId, dataxInstitutions.id),
      )
      .where(
        and(
          eq(dataxInstitutionMemberships.userId, userId),
          eq(dataxInstitutionMemberships.status, 'active'),
        ),
      )
      .orderBy(asc(dataxInstitutions.name))

    const institutionIds = memberships.map((membership) => membership.institutionId)

    if (institutionIds.length === 0) {
      return {
        status: 'ready' as const,
        institutions: [],
        recentBatches: [],
      }
    }

    const [batchCounts, validatedBatchCounts, metricCounts, recentBatches] =
      await Promise.all([
        db
          .select({ institutionId: dataxImportBatches.institutionId, value: count() })
          .from(dataxImportBatches)
          .innerJoin(
            dataxInstitutionMemberships,
            and(
              eq(dataxImportBatches.institutionId, dataxInstitutionMemberships.institutionId),
              eq(dataxInstitutionMemberships.userId, userId),
              eq(dataxInstitutionMemberships.status, 'active'),
            ),
          )
          .where(inArray(dataxImportBatches.institutionId, institutionIds))
          .groupBy(dataxImportBatches.institutionId),
        db
          .select({ institutionId: dataxImportBatches.institutionId, value: count() })
          .from(dataxImportBatches)
          .innerJoin(
            dataxInstitutionMemberships,
            and(
              eq(dataxImportBatches.institutionId, dataxInstitutionMemberships.institutionId),
              eq(dataxInstitutionMemberships.userId, userId),
              eq(dataxInstitutionMemberships.status, 'active'),
            ),
          )
          .where(
            and(
              inArray(dataxImportBatches.institutionId, institutionIds),
              inArray(dataxImportBatches.status, ['validated', 'committed']),
            ),
          )
          .groupBy(dataxImportBatches.institutionId),
        db
          .select({ institutionId: dataxMetricRecords.institutionId, value: count() })
          .from(dataxMetricRecords)
          .innerJoin(
            dataxInstitutionMemberships,
            and(
              eq(dataxMetricRecords.institutionId, dataxInstitutionMemberships.institutionId),
              eq(dataxInstitutionMemberships.userId, userId),
              eq(dataxInstitutionMemberships.status, 'active'),
            ),
          )
          .where(inArray(dataxMetricRecords.institutionId, institutionIds))
          .groupBy(dataxMetricRecords.institutionId),
        db
          .select({
            id: dataxImportBatches.id,
            institutionId: dataxImportBatches.institutionId,
            filename: dataxImportBatches.originalFilename,
            status: dataxImportBatches.status,
            periodStart: dataxImportBatches.periodStart,
            periodEnd: dataxImportBatches.periodEnd,
            rowsTotal: dataxImportBatches.rowsTotal,
            rowsValid: dataxImportBatches.rowsValid,
            rowsRejected: dataxImportBatches.rowsRejected,
            createdAt: dataxImportBatches.createdAt,
          })
          .from(dataxImportBatches)
          .innerJoin(
            dataxInstitutionMemberships,
            and(
              eq(dataxImportBatches.institutionId, dataxInstitutionMemberships.institutionId),
              eq(dataxInstitutionMemberships.userId, userId),
              eq(dataxInstitutionMemberships.status, 'active'),
            ),
          )
          .where(inArray(dataxImportBatches.institutionId, institutionIds))
          .orderBy(desc(dataxImportBatches.createdAt))
          .limit(50),
      ])

    const batchCountByInstitution = new Map(
      batchCounts.map((item) => [item.institutionId, item.value]),
    )
    const validatedCountByInstitution = new Map(
      validatedBatchCounts.map((item) => [item.institutionId, item.value]),
    )
    const metricCountByInstitution = new Map(
      metricCounts.map((item) => [item.institutionId, item.value]),
    )

    return {
      status: 'ready' as const,
      institutions: memberships.map((membership) => ({
        ...membership,
        batchCount: batchCountByInstitution.get(membership.institutionId) ?? 0,
        validatedBatchCount:
          validatedCountByInstitution.get(membership.institutionId) ?? 0,
        metricCount: metricCountByInstitution.get(membership.institutionId) ?? 0,
        canStartImport: ['institution_admin', 'programme_lead', 'analyst'].includes(
          membership.role,
        ),
      })),
      recentBatches,
    }
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String(error.code)
        : undefined

    console.error(
      '[database] Data X membership-scoped query failed.',
      error instanceof Error ? error.name : 'UnknownError',
    )

    return {
      status: code === '42P01' ? ('schema-not-ready' as const) : ('unavailable' as const),
      institutions: [],
      recentBatches: [],
    }
  }
}
