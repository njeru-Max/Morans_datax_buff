import Link from 'next/link'
import {
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  Gavel,
  Globe2,
  ShieldCheck,
  Trophy,
  UsersRound,
} from 'lucide-react'
import { applyToHackathon } from '@/app/actions/morans'
import { Button } from '@/components/ui/button'
import { MetricCard, PageHeading, SafetyNotice, SectionHeading, EmptyState } from '@/components/platform/dashboard-primitives'
import { PlatformShell } from '@/components/platform/platform-shell'
import type { SessionUser } from '@/lib/auth/session'
import type { DatabaseStatus } from '@/lib/db'
import type { getMoransPublicDashboard, getMoransWorkspace } from '@/lib/data/morans'

type MoransDashboardData = Awaited<ReturnType<typeof getMoransPublicDashboard>>
type MoransWorkspaceData = Awaited<ReturnType<typeof getMoransWorkspace>>

const statusMessages: Record<string, string> = {
  applied: 'Your application was submitted.',
  'already-applied': 'You already have an application for this event.',
  'registration-closed': 'Registration for that event is not open.',
  'invalid-application': 'The application could not be processed.',
  'database-unavailable': 'The database is temporarily unavailable. No application was created.',
}

function formatDate(date: Date | null) {
  if (!date) return 'Dates to be announced'

  return new Intl.DateTimeFormat('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatEventFormat(format: string) {
  if (format === 'in_person') return 'In person'
  if (format === 'hybrid') return 'Hybrid'
  return 'Online'
}

export function MoransDashboard({
  databaseStatus,
  dashboard,
  user,
  workspace,
  statusMessage,
}: {
  databaseStatus: DatabaseStatus
  dashboard: MoransDashboardData
  user: SessionUser | null
  workspace: MoransWorkspaceData | null
  statusMessage?: string
}) {
  const workspaceReady = workspace?.status === 'ready'
  const publicCount = dashboard.status === 'ready' ? dashboard.publishedCount : '—'
  const applicationsCount = user ? (workspaceReady ? workspace.applications.length : '—') : 'Sign in'
  const submissionsCount = user ? (workspaceReady ? workspace.participantSubmissions.length : '—') : 'Sign in'
  const judgeCount = user
    ? workspaceReady
      ? workspace.judgeAssignments.filter((assignment) => assignment.status === 'accepted').length
      : '—'
    : 'Sign in'
  const notice = statusMessage ? statusMessages[statusMessage] : undefined

  return (
    <PlatformShell active="morans" databaseStatus={databaseStatus} user={user}>
      <PageHeading
        eyebrow="MORANS · COMPETITION PLATFORM"
        title="Competition operations"
        description="Explore public events, then sign in for participant, host, and assigned judge workflows."
        status={<span className="page-status">Public catalogue</span>}
      />

      <SafetyNotice title="Private workspaces are session-scoped">
        Published event details are public. Applications, host records, submissions, and judge assignments are queried only for your verified account and authorized role.
      </SafetyNotice>

      {notice ? <p className="operation-status" role="status">{notice}</p> : null}

      <section aria-label="MORANS platform overview" className="metric-grid">
        <MetricCard
          icon={Trophy}
          label="Published hackathons"
          value={publicCount}
          detail="Public event records only."
        />
        <MetricCard
          icon={UsersRound}
          label="Your applications"
          value={applicationsCount}
          detail={user ? 'Visible only to your account.' : 'Sign in to see private records.'}
        />
        <MetricCard
          icon={ClipboardCheck}
          label="Your submissions"
          value={submissionsCount}
          detail={user ? 'Your project records only.' : 'Sign in to see private records.'}
        />
        <MetricCard
          icon={Gavel}
          label="Judge assignments"
          value={judgeCount}
          detail={user ? 'Assigned events only.' : 'Sign in to see private records.'}
        />
      </section>

      <section aria-labelledby="events-heading" className="surface-card events-card" id="events">
        <div className="section-heading-row">
          <SectionHeading
            id="events-heading"
            eyebrow="EXPLORE HACKATHONS"
            title="Published events"
            description="Only approved events with published status appear in this public catalogue."
          />
          <span className="public-only-label"><Globe2 aria-hidden="true" /> Public only</span>
        </div>

        {dashboard.status === 'ready' && dashboard.events.length > 0 ? (
          <div className="event-list">
            {dashboard.events.map((event) => {
              const application = workspace?.applications.find(
                (item) => item.hackathonId === event.id,
              )
              const now = new Date()
              const registrationClosed = Boolean(
                (event.registrationOpensAt && event.registrationOpensAt > now) ||
                  (event.registrationClosesAt && event.registrationClosesAt < now),
              )

              return (
                <article className="event-card" key={event.id}>
                  <div className="event-card-header">
                    <span className={`event-pill ${event.hostType === 'official' ? 'is-official' : 'is-hosted'}`}>
                      {event.hostType === 'official' ? 'Official MORANS' : 'External organiser'}
                    </span>
                    <span className="event-format">{formatEventFormat(event.format)}</span>
                  </div>
                  <h3 className="event-title">{event.title}</h3>
                  <p className="event-summary">
                    {event.summary || 'Event information will be shared by the organiser.'}
                  </p>
                  <div className="event-meta">
                    <span><CalendarDays aria-hidden="true" /> {formatDate(event.startsAt)}</span>
                    {event.location ? <span><Globe2 aria-hidden="true" /> {event.location}</span> : null}
                    {event.registrationClosesAt ? (
                      <span><ClipboardCheck aria-hidden="true" /> Registration closes {formatDate(event.registrationClosesAt)}</span>
                    ) : null}
                  </div>
                  <div className="event-card-action">
                    {application ? (
                      <span className="record-status">Application {application.status.replaceAll('_', ' ')}</span>
                    ) : user && !registrationClosed ? (
                      <form action={applyToHackathon}>
                        <input name="hackathonId" type="hidden" value={event.id} />
                        <Button size="sm" type="submit">Apply to event</Button>
                      </form>
                    ) : user ? (
                      <span className="form-note">Registration is closed.</span>
                    ) : (
                      <Link
                        className="action-button action-button-outline"
                        href={`/sign-in?returnTo=${encodeURIComponent('/morans')}`}
                      >
                        Sign in to apply <ArrowRight aria-hidden="true" />
                      </Link>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <EmptyState
            icon={CalendarDays}
            title={
              dashboard.status === 'ready'
                ? 'No published hackathons yet'
                : dashboard.status === 'not-configured'
                  ? 'Connect PostgreSQL to load the public catalogue'
                  : dashboard.status === 'schema-not-ready'
                    ? 'Apply the PostgreSQL schema first'
                    : 'The event catalogue is temporarily unavailable'
            }
            description={
              dashboard.status === 'ready'
                ? 'When an official or approved host event is published, it will appear here. No placeholder events are shown.'
                : dashboard.status === 'not-configured'
                  ? 'Set DATABASE_URL in the project environment, then run the database setup step in the project guide.'
                  : dashboard.status === 'schema-not-ready'
                    ? 'Apply the database schema before loading the public catalogue.'
                    : 'Check the PostgreSQL connection and schema setup. Private application and judging data remain unavailable.'
            }
          />
        )}
      </section>

      <div className="content-grid morans-content-grid">
        <section aria-labelledby="host-workflow-heading" className="surface-card" id="host-workflow">
          <SectionHeading
            id="host-workflow-heading"
            eyebrow="MULTI-ORGANISER WORKFLOW"
            title="Host a hackathon"
            description="A host application begins in review. Only approved hosts can create event drafts, and publication requires platform review."
          />
          <ol className="workflow-list">
            <li className="workflow-item">
              <span className="workflow-marker">01</span>
              <div className="workflow-copy">
                <strong>Request a host workspace</strong>
                <span>New host records start in the platform review queue.</span>
              </div>
            </li>
            <li className="workflow-item">
              <span className="workflow-marker">02</span>
              <div className="workflow-copy">
                <strong>Build an event draft</strong>
                <span>Approved owners and organisers can create a draft event.</span>
              </div>
            </li>
            <li className="workflow-item">
              <span className="workflow-marker">03</span>
              <div className="workflow-copy">
                <strong>Submit for review</strong>
                <span>Only an administrator can publish an event.</span>
              </div>
            </li>
          </ol>
          <div className="surface-card-footer">
            <span className="footnote-icon" aria-hidden="true"><ShieldCheck /></span>
            <p>Open your MORANS workspace to apply, request host access, manage drafts, or review assigned judging work.</p>
          </div>
          <Link className="action-button" href={user ? '/morans/workspace' : '/sign-up?returnTo=%2Fmorans%2Fworkspace'}>
            {user ? 'Open my MORANS workspace' : 'Create an account'}
            <ArrowRight aria-hidden="true" />
          </Link>
        </section>

        <section aria-labelledby="role-portals-heading" className="surface-card role-portals-card" id="role-portals">
          <SectionHeading
            id="role-portals-heading"
            eyebrow="ROLE-BASED PORTALS"
            title="Separate views, scoped actions"
            description="Each workflow uses a server-side role or assignment check before returning private records."
          />
          <div className="role-grid">
            <div className="role-card">
              <span className="role-icon" aria-hidden="true"><UsersRound /></span>
              <div><h3>Participant</h3><p>Own applications and submissions, with event eligibility checks.</p></div>
            </div>
            <div className="role-card">
              <span className="role-icon" aria-hidden="true"><CalendarDays /></span>
              <div><h3>Host / organiser</h3><p>Own organisation events and applications only.</p></div>
            </div>
            <div className="role-card">
              <span className="role-icon" aria-hidden="true"><Gavel /></span>
              <div><h3>Judge</h3><p>Accepted event assignments and permitted submissions only.</p></div>
            </div>
            <div className="role-card">
              <span className="role-icon" aria-hidden="true"><ShieldCheck /></span>
              <div><h3>Platform admin</h3><p>Host verification, event publication, and role provisioning.</p></div>
            </div>
          </div>
        </section>
      </div>

      <section className="governance-card finance-separation">
        <div className="governance-icon" aria-hidden="true"><ShieldCheck /></div>
        <div className="governance-copy">
          <p className="section-eyebrow">PLATFORM BOUNDARY</p>
          <h2>Official and external events stay distinct</h2>
          <p>
            Event host type remains explicit. Payments, refunds, settlements, sponsorship, and prize ledgers are deferred until the operating model and approvals are confirmed.
          </p>
        </div>
        <Link className="action-button action-button-outline" href="/#next-phases">
          View build gates <ArrowRight aria-hidden="true" />
        </Link>
      </section>
    </PlatformShell>
  )
}
