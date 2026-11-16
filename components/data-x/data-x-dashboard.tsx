import Link from 'next/link'
import { ArrowRight, BarChart3, Building2, CalendarClock, FileSpreadsheet, LockKeyhole, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState, MetricCard, PageHeading, SafetyNotice, SectionHeading } from '@/components/platform/dashboard-primitives'
import { PlatformShell } from '@/components/platform/platform-shell'
import type { DatabaseStatus } from '@/lib/db'
import type { SessionUser } from '@/lib/auth/session'
import type { getDataXWorkspace } from '@/lib/data/data-x'
import { createDataXImportBatch } from '@/app/actions/data-x'

type DataXWorkspace = Awaited<ReturnType<typeof getDataXWorkspace>>

const statusMessages: Record<string, string> = {
  'batch-created': 'A draft import batch was created for the selected institution.',
  'access-denied': 'Your active institution role does not allow draft imports.',
  'invalid-import': 'Check the file name and reporting-period dates, then try again.',
  'database-unavailable': 'The database is temporarily unavailable. No import was created.',
}

function roleLabel(role: string) {
  return role.replaceAll('_', ' ')
}

function batchStatusLabel(status: string) {
  return status.replaceAll('_', ' ')
}

export function DataXDashboard({
  databaseStatus,
  user,
  workspace,
  statusMessage,
}: {
  databaseStatus: DatabaseStatus
  user: SessionUser
  workspace: DataXWorkspace
  statusMessage?: string
}) {
  const message = statusMessage ? statusMessages[statusMessage] : undefined
  const batchCount = workspace.institutions.reduce((total, institution) => total + institution.batchCount, 0)
  const validatedCount = workspace.institutions.reduce((total, institution) => total + institution.validatedBatchCount, 0)
  const metricCount = workspace.institutions.reduce((total, institution) => total + institution.metricCount, 0)

  return (
    <PlatformShell active="data-x" databaseStatus={databaseStatus} user={user}>
      <PageHeading
        eyebrow="DATA X · EDUCATION ANALYTICS"
        title="Institution intelligence"
        description="See aggregate outcomes and import provenance only for institutions where your account has an active membership."
        status={<span className="page-status">{workspace.institutions.length} assigned institutions</span>}
      />

      <SafetyNotice title="Institution-level authorization is active">
        Every private read is limited to your active memberships. Draft import records require an approved Data X role; this workspace does not contain learner-level records.
      </SafetyNotice>

      {message ? <p className="operation-status" role="status">{message}</p> : null}

      {workspace.status !== 'ready' ? (
        <SafetyNotice title="Institution data is unavailable">
          {workspace.status === 'not-configured'
            ? 'PostgreSQL is not configured for this environment.'
            : workspace.status === 'schema-not-ready'
              ? 'The Data X tables are not available yet. Apply the database schema before using this workspace.'
              : 'The Data X workspace could not be loaded. Check the database connection and try again.'}
        </SafetyNotice>
      ) : null}

      <section aria-label="Your Data X access metrics" className="metric-grid">
        <MetricCard
          icon={Building2}
          label="Assigned institutions"
          value={workspace.institutions.length}
          detail="Active memberships only."
        />
        <MetricCard
          icon={FileSpreadsheet}
          label="Import batches"
          value={batchCount}
          detail="Visible within your institution scopes."
        />
        <MetricCard
          icon={ShieldCheck}
          label="Validated batches"
          value={validatedCount}
          detail="Validated or committed records."
        />
        <MetricCard
          icon={BarChart3}
          label="Aggregate measures"
          value={metricCount}
          detail="No learner-level data is stored here."
        />
      </section>

      {workspace.institutions.length === 0 ? (
        <section aria-labelledby="membership-heading" className="surface-card">
          <SectionHeading
            id="membership-heading"
            eyebrow="ACCESS REQUIRED"
            title="No institution membership is assigned"
            description="A platform administrator must add your account to an institution before its data is visible. Sign-up does not grant Data X access."
          />
          <EmptyState
            icon={LockKeyhole}
            title="Your workspace is private until assigned"
            description="When access is granted, this page will show only that institution’s aggregate measures and import history."
          />
        </section>
      ) : (
        <section aria-labelledby="institutions-heading" className="datax-workspace-section">
          <SectionHeading
            id="institutions-heading"
            eyebrow="AUTHORIZED WORKSPACES"
            title="Your institutions"
            description="Import creation checks your membership and permitted role again on the server."
          />

          <div className="datax-institution-grid">
            {workspace.institutions.map((institution) => {
              const batches = workspace.recentBatches.filter(
                (batch) => batch.institutionId === institution.institutionId,
              )

              return (
                <article className="surface-card datax-institution-card" key={institution.institutionId}>
                  <div className="datax-institution-heading">
                    <div>
                      <p className="section-eyebrow">{institution.institutionSlug}</p>
                      <h2>{institution.institutionName}</h2>
                    </div>
                    <span className="role-badge">{roleLabel(institution.role)}</span>
                  </div>

                  <div className="datax-mini-metrics">
                    <div><span>All batches</span><strong>{institution.batchCount}</strong></div>
                    <div><span>Validated</span><strong>{institution.validatedBatchCount}</strong></div>
                    <div><span>Measures</span><strong>{institution.metricCount}</strong></div>
                  </div>

                  {institution.canStartImport ? (
                    <form action={createDataXImportBatch} className="workflow-form">
                      <input name="institutionId" type="hidden" value={institution.institutionId} />
                      <fieldset className="workflow-fieldset">
                        <legend>Start a draft import</legend>
                        <label className="workflow-field" htmlFor={`filename-${institution.institutionId}`}>
                          <span>Source file name</span>
                          <input
                            id={`filename-${institution.institutionId}`}
                            maxLength={180}
                            name="filename"
                            placeholder="cohort-outcomes.csv"
                            required
                            type="text"
                          />
                        </label>
                        <div className="workflow-field-grid">
                          <label className="workflow-field" htmlFor={`period-start-${institution.institutionId}`}>
                            <span>Period start</span>
                            <input id={`period-start-${institution.institutionId}`} name="periodStart" type="date" />
                          </label>
                          <label className="workflow-field" htmlFor={`period-end-${institution.institutionId}`}>
                            <span>Period end</span>
                            <input id={`period-end-${institution.institutionId}`} name="periodEnd" type="date" />
                          </label>
                        </div>
                      </fieldset>
                      <p className="form-note">This records draft metadata only. File upload and row validation are not enabled yet.</p>
                      <Button type="submit">Create draft batch</Button>
                    </form>
                  ) : (
                    <p className="form-note">Your {roleLabel(institution.role)} role is read-only for imports.</p>
                  )}

                  <div className="recent-batches">
                    <h3>Recent batches</h3>
                    {batches.length > 0 ? (
                      <ul className="record-list">
                        {batches.slice(0, 5).map((batch) => (
                          <li className="record-list-item" key={batch.id}>
                            <div>
                              <strong>{batch.filename || 'Untitled import'}</strong>
                              <span>{batch.periodStart || 'Period not set'} – {batch.periodEnd || 'open'}</span>
                            </div>
                            <span className="record-status">{batchStatusLabel(batch.status)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="form-note">No import batches are available for this institution.</p>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      <section className="governance-card" id="governance">
        <div className="governance-icon" aria-hidden="true"><CalendarClock /></div>
        <div className="governance-copy">
          <p className="section-eyebrow">PILOT GOVERNANCE</p>
          <h2>Keep the measures transparent and source-linked</h2>
          <p>
            Every aggregate measure should retain its definition, reporting period, source batch, and limitations before it is used for decisions.
          </p>
        </div>
        <Link className="action-button action-button-outline" href="/#next-phases">
          View build gates
          <ArrowRight aria-hidden="true" />
        </Link>
      </section>
    </PlatformShell>
  )
}
