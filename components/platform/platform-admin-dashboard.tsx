import {
  Building2,
  CalendarDays,
  ClipboardCheck,
  Gavel,
  ShieldCheck,
  UsersRound,
} from 'lucide-react'
import {
  assignMoransJudge,
  createDataXInstitution,
  grantDataXMembership,
  grantMoransHostMembership,
  reviewHackathon,
  reviewHostOrganization,
} from '@/app/actions/platform'
import { Button } from '@/components/ui/button'
import { EmptyState, PageHeading, SafetyNotice, SectionHeading } from '@/components/platform/dashboard-primitives'
import { PlatformShell } from '@/components/platform/platform-shell'
import type { DatabaseStatus } from '@/lib/db'
import type { getPlatformAdminWorkspace } from '@/lib/data/platform-admin'
import { AccountPicker } from '@/components/platform/account-picker'
import { AccountDirectory } from '@/components/platform/account-directory'

type AdminWorkspaceData = Awaited<ReturnType<typeof getPlatformAdminWorkspace>>

const statusMessages: Record<string, string> = {
  'institution-created': 'The institution and its first membership were created.',
  'datax-membership-granted': 'The Data X membership was saved.',
  'host-membership-granted': 'The host membership was saved.',
  'host-reviewed': 'The host application review was saved.',
  'event-reviewed': 'The event review was saved.',
  'judge-assigned': 'The judge assignment was created and is awaiting acceptance.',
  'judge-already-assigned': 'That judge already has an assignment for this event.',
  'user-not-found': 'Choose an existing active account from the user list.',
  'institution-not-found': 'Choose an existing Data X institution.',
  'host-not-found': 'Choose an existing host organization.',
  'event-not-published': 'Judges can only be assigned to published events.',
  'event-not-found': 'Choose an existing MORANS event.',
  'host-not-approved': 'Approve the external host organization before publishing its event.',
  'host-review-conflict': 'That host record is no longer awaiting review.',
  'event-review-conflict': 'That event is no longer awaiting review.',
  'invalid-institution': 'Check the institution name, two-letter country code, and initial account.',
  'invalid-membership': 'Check the selected institution, account, and Data X role.',
  'invalid-host-membership': 'Check the selected host, account, and host role.',
  'invalid-host-review': 'Choose a valid host review decision.',
  'invalid-event-review': 'Choose a valid event review decision.',
  'invalid-judge-assignment': 'Choose a valid event and user account.',
  'database-unavailable': 'The database is temporarily unavailable. No changes were saved.',
}



function readableStatus(value: string) {
  return value.replaceAll('_', ' ')
}

export function PlatformAdminDashboard({
  databaseStatus,
  workspace,
  statusMessage,
}: {
  databaseStatus: DatabaseStatus
  workspace: AdminWorkspaceData
  statusMessage?: string
}) {
  const notice = statusMessage ? statusMessages[statusMessage] : undefined
  const activeHosts = workspace.hostOrganizations.filter((organization) =>
    ['submitted', 'needs_information'].includes(organization.verificationStatus),
  )
  const eventsAwaitingReview = workspace.hackathons.filter((event) =>
    ['submitted', 'under_review', 'needs_information'].includes(event.status),
  )
  const publishedEvents = workspace.hackathons.filter((event) => event.status === 'published')

  return (
    <PlatformShell active="admin" databaseStatus={databaseStatus} user={workspace.user}>
      <PageHeading
        eyebrow="PLATFORM · ADMINISTRATION"
        title="Access and review"
        description="Provision institution and host memberships, review submissions, and create assigned judge queues."
        status={<span className="page-status">Administrator</span>}
      />

      <SafetyNotice title="Administrator actions are audited">
        This screen is available only to accounts with the Managed Auth administrator role. New sign-ups cannot grant themselves platform-admin or workspace roles.
      </SafetyNotice>

      {notice ? <p className="operation-status" role="status">{notice}</p> : null}
      {workspace.status !== 'ready' ? (
        <SafetyNotice title="Administration data is unavailable">
          {workspace.status === 'not-configured'
            ? 'PostgreSQL is not configured for this environment.'
            : workspace.status === 'schema-not-ready'
              ? 'The application tables are not available yet.'
              : 'The admin workspace could not be loaded. Check the database connection and try again.'}
        </SafetyNotice>
      ) : null}

      <section aria-label="Platform administration metrics" className="metric-grid">
        <article className="metric-card">
          <div className="metric-card-heading">
            <span aria-hidden="true" className="metric-icon"><UsersRound /></span>
            <span className="metric-label">Accounts</span>
          </div>
          <p className="metric-value">Search</p>
          <p className="metric-detail">Browse active accounts without a 200-account limit.</p>
        </article>
        <article className="metric-card"><div className="metric-card-heading"><span aria-hidden="true" className="metric-icon"><Building2 /></span><span className="metric-label">Institutions</span></div><p className="metric-value">{workspace.institutions.length}</p><p className="metric-detail">Data X tenant workspaces.</p></article>
        <article className="metric-card"><div className="metric-card-heading"><span aria-hidden="true" className="metric-icon"><CalendarDays /></span><span className="metric-label">Host reviews</span></div><p className="metric-value">{activeHosts.length}</p><p className="metric-detail">Submitted or awaiting information.</p></article>
        <article className="metric-card"><div className="metric-card-heading"><span aria-hidden="true" className="metric-icon"><ClipboardCheck /></span><span className="metric-label">Event reviews</span></div><p className="metric-value">{eventsAwaitingReview.length}</p><p className="metric-detail">Events awaiting a publication decision.</p></article>
      </section>

      <section aria-labelledby="datax-admin-heading" className="surface-card">
        <SectionHeading
          id="datax-admin-heading"
          eyebrow="DATA X · TENANT PROVISIONING"
          title="Create an institution or grant a membership"
          description="Every new institution receives one initial institution administrator. Additional memberships use explicit user and institution IDs from the authenticated account directory."
        />

        <div className="admin-form-grid">
          <form action={createDataXInstitution} className="workflow-form">
            <fieldset className="workflow-fieldset">
              <legend>Create an institution</legend>
              <label className="workflow-field" htmlFor="institution-name"><span>Institution name</span><input id="institution-name" maxLength={140} minLength={2} name="name" required type="text" /></label>
              <label className="workflow-field" htmlFor="institution-country"><span>Country code (optional)</span><input id="institution-country" maxLength={2} name="countryCode" placeholder="KE" type="text" /></label>
             
              <AccountPicker
                 id="institution-initial-user"
                 name="initialUserId"
                 label="Initial institution administrator"
              />
            </fieldset>
            <Button type="submit">Create institution</Button>
          </form>

          <form action={grantDataXMembership} className="workflow-form">
            <fieldset className="workflow-fieldset">
              <legend>Grant a Data X role</legend>
              <label className="workflow-field" htmlFor="membership-institution"><span>Institution</span>
                <select id="membership-institution" name="institutionId" required defaultValue="">
                  <option disabled value="">Select an institution</option>
                  {workspace.institutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.name}</option>)}
                </select>
              </label>
              <AccountPicker
                  id="membership-user"
                  name="userId"
                  label="Account"
              />
              <label className="workflow-field" htmlFor="membership-role"><span>Role</span>
                <select id="membership-role" name="role" required defaultValue="viewer">
                  <option value="institution_admin">Institution administrator</option>
                  <option value="programme_lead">Programme lead</option>
                  <option value="analyst">Analyst</option>
                  <option value="instructor">Instructor</option>
                  <option value="viewer">Viewer</option>
                </select>
              </label>
            </fieldset>
            <Button disabled={workspace.institutions.length === 0} type="submit">Save membership</Button>
          </form>
        </div>
      </section>

      <section aria-labelledby="morans-admin-heading" className="surface-card">
        <SectionHeading
          id="morans-admin-heading"
          eyebrow="MORANS · ROLE MANAGEMENT"
          title="Host access and judge assignments"
          description="Host membership changes and judge assignments are scoped to an existing organisation or event and recorded in the audit log."
        />
        <div className="admin-form-grid">
          <form action={grantMoransHostMembership} className="workflow-form">
            <fieldset className="workflow-fieldset">
              <legend>Grant a host role</legend>
              <label className="workflow-field" htmlFor="host-member-organization"><span>Host organisation</span>
                <select id="host-member-organization" name="organizationId" required defaultValue="">
                  <option disabled value="">Select an organisation</option>
                  {workspace.hostOrganizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name} · {readableStatus(organization.verificationStatus)}</option>)}
                </select>
              </label>
              <AccountPicker
                id="host-member-user"
                name="userId"
                label="Account"
              />
              <label className="workflow-field" htmlFor="host-member-role"><span>Role</span>
                <select id="host-member-role" name="role" required defaultValue="organiser">
                  <option value="owner">Owner</option>
                  <option value="organiser">Organiser</option>
                  <option value="finance_officer">Finance officer</option>
                  <option value="judge_coordinator">Judge coordinator</option>
                </select>
              </label>
            </fieldset>
            <Button disabled={workspace.hostOrganizations.length === 0} type="submit">Save host role</Button>
          </form>

          <form action={assignMoransJudge} className="workflow-form">
            <fieldset className="workflow-fieldset">
              <legend>Assign a judge</legend>
              <label className="workflow-field" htmlFor="judge-event"><span>Published event</span>
                <select id="judge-event" name="hackathonId" required defaultValue="">
                  <option disabled value="">Select an event</option>
                  {publishedEvents.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
                </select>
              </label>
              <AccountPicker
                 id="judge-user"
                 name="judgeUserId"
                 label="Account"
              />
            </fieldset>
            <Button disabled={publishedEvents.length === 0} type="submit">Create assignment</Button>
          </form>
        </div>
      </section>

      <div className="content-grid admin-review-grid">
        <section aria-labelledby="host-review-heading" className="surface-card">
          <SectionHeading
            id="host-review-heading"
            eyebrow="HOST VERIFICATION"
            title="Review host applications"
            description="Only approved host organizations can create external event drafts."
          />
          {activeHosts.length > 0 ? (
            <ul className="record-list">
              {activeHosts.map((organization) => (
                <li className="record-list-item record-list-item-stacked" key={organization.id}>
                  <div className="record-main">
                    <div><strong>{organization.name}</strong><span>{readableStatus(organization.organizationType)} · {readableStatus(organization.verificationStatus)}</span></div>
                    <span className="record-status">{readableStatus(organization.verificationStatus)}</span>
                  </div>
                  <div className="inline-actions">
                    {(['approved', 'needs_information', 'rejected'] as const).map((decision) => (
                      <form action={reviewHostOrganization} key={decision}>
                        <input name="organizationId" type="hidden" value={organization.id} />
                        <input name="decision" type="hidden" value={decision} />
                        <Button size="xs" type="submit" variant={decision === 'approved' ? 'default' : 'outline'}>
                          {decision === 'needs_information' ? 'Request info' : readableStatus(decision)}
                        </Button>
                      </form>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={ShieldCheck} title="No host applications awaiting review" description="Submitted host records will appear here." />
          )}
        </section>

        <section aria-labelledby="event-review-heading" className="surface-card">
          <SectionHeading
            id="event-review-heading"
            eyebrow="EVENT PUBLICATION"
            title="Review event submissions"
            description="External events can be published only after their host organization is approved."
          />
          {eventsAwaitingReview.length > 0 ? (
            <ul className="record-list">
              {eventsAwaitingReview.map((event) => {
                const host = workspace.hostOrganizations.find((item) => item.id === event.hostOrganizationId)
                return (
                  <li className="record-list-item record-list-item-stacked" key={event.id}>
                    <div className="record-main">
                      <div><strong>{event.title}</strong><span>{event.hostType === 'official' ? 'Official MORANS' : host?.name || 'External host'} · {readableStatus(event.status)}</span></div>
                      <span className="record-status">{readableStatus(event.status)}</span>
                    </div>
                    <div className="inline-actions">
                      {(['approve', 'needs_information', 'reject'] as const).map((decision) => (
                        <form action={reviewHackathon} key={decision}>
                          <input name="hackathonId" type="hidden" value={event.id} />
                          <input name="decision" type="hidden" value={decision} />
                          <Button size="xs" type="submit" variant={decision === 'approve' ? 'default' : 'outline'}>
                            {decision === 'needs_information' ? 'Request info' : decision === 'approve' ? 'Publish' : 'Reject'}
                          </Button>
                        </form>
                      ))}
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyState icon={CalendarDays} title="No events awaiting review" description="Host-submitted events will appear here after they are submitted." />
          )}
        </section>
      </div>

      
        <section aria-labelledby="account-directory-heading" className="surface-card">
          <SectionHeading
            id="account-directory-heading"
            eyebrow="MANAGED AUTH"
            title="Account directory"
            description="Search active accounts by name or email and browse paginated results. This page does not grant global administrator roles."
          />
          <AccountDirectory />
        </section>

      <p className="dashboard-note">
        <Gavel aria-hidden="true" /> Global platform-admin elevation remains an Auth-provider operation. The public app never promotes accounts.
      </p>
    </PlatformShell>
  )
}
