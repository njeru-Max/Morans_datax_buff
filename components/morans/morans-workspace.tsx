import Link from 'next/link'
import { ArrowRight, CalendarDays, ClipboardCheck, Gavel, ShieldCheck, UsersRound } from 'lucide-react'
import {
  createHackathonDraft,
  createHostOrganization,
  respondToJudgeAssignment,
  reviewMoransApplication,
  submitHackathonForReview,
  submitJudgeEvaluation,
  submitProjectSubmission,
} from '@/app/actions/morans'
import { Button } from '@/components/ui/button'
import { EmptyState, PageHeading, SafetyNotice, SectionHeading } from '@/components/platform/dashboard-primitives'
import { PlatformShell } from '@/components/platform/platform-shell'
import type { SessionUser } from '@/lib/auth/session'
import type { DatabaseStatus } from '@/lib/db'
import type { getMoransWorkspace } from '@/lib/data/morans'

type MoransWorkspaceData = Awaited<ReturnType<typeof getMoransWorkspace>>

const statusMessages: Record<string, string> = {
  'host-submitted': 'Your host application was sent for platform review.',
  'event-draft-created': 'Your event draft was created. It is not public until reviewed and published.',
  'host-not-approved': 'The host organization must be approved before creating or submitting events.',
  'event-submitted': 'Your event was submitted for platform review.',
  'event-already-submitted': 'That event is not in a state that can be submitted.',
  'assignment-accepted': 'You accepted the judge assignment. Assigned submissions are now available below.',
  'assignment-declined': 'You declined the judge assignment. Decline before scoring if you have a conflict.',
  'evaluation-submitted': 'Your evaluation was saved for the assigned submission.',
  'application-reviewed': 'The participant application was updated.',
  'application-already-reviewed': 'That application is no longer awaiting review.',
  'application-not-accepted': 'A participant application must be eligible or accepted before submitting a project.',
  'submission-submitted': 'Your project submission was received.',
  'already-submitted': 'A final submission already exists for this event.',
  'submission-closed': 'Submissions are not open for this event.',
  'access-denied': 'Your current role does not allow that action.',
  'database-unavailable': 'The database is temporarily unavailable. No changes were saved.',
}

function readableStatus(value: string) {
  return value.replaceAll('_', ' ')
}

function safeExternalUrl(value: string | null) {
  if (!value) return null

  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}

export function MoransWorkspace({
  databaseStatus,
  user,
  workspace,
  statusMessage,
}: {
  databaseStatus: DatabaseStatus
  user: SessionUser
  workspace: MoransWorkspaceData
  statusMessage?: string
}) {
  const notice = statusMessage ? statusMessages[statusMessage] : undefined
  const isAdmin = workspace.platformAdmin

  return (
    <PlatformShell active="morans-workspace" databaseStatus={databaseStatus} user={user}>
      <PageHeading
        eyebrow="MORANS · PERSONAL WORKSPACE"
        title="Your competition workspace"
        description="Participant, host, and judge views are assembled from your own applications and active assignments."
        status={<span className="page-status">{isAdmin ? 'Platform admin' : 'Signed in'}</span>}
      />

      <SafetyNotice title="Private records are checked on the server">
        You can see your own participant records, host organizations where you are an active member, and submissions assigned to you as an accepted judge. Public sign-up does not grant host or administrator roles.
      </SafetyNotice>

      {notice ? <p className="operation-status" role="status">{notice}</p> : null}
      {workspace.status !== 'ready' ? (
        <SafetyNotice title="Workspace records are unavailable">
          {workspace.status === 'not-configured'
            ? 'PostgreSQL is not configured for this environment.'
            : workspace.status === 'schema-not-ready'
              ? 'The MORANS workspace tables are not available yet.'
              : 'The workspace could not be loaded. Check the database connection and try again.'}
        </SafetyNotice>
      ) : null}

      <section aria-label="Your MORANS account" className="metric-grid">
        <article className="metric-card">
          <div className="metric-card-heading">
            <span aria-hidden="true" className="metric-icon"><UsersRound /></span>
            <span className="metric-label">Applications</span>
          </div>
          <p className="metric-value">{workspace.applications.length}</p>
          <p className="metric-detail">Your account only.</p>
        </article>
        <article className="metric-card">
          <div className="metric-card-heading">
            <span aria-hidden="true" className="metric-icon"><ClipboardCheck /></span>
            <span className="metric-label">Submissions</span>
          </div>
          <p className="metric-value">{workspace.participantSubmissions.length}</p>
          <p className="metric-detail">Your project records only.</p>
        </article>
        <article className="metric-card">
          <div className="metric-card-heading">
            <span aria-hidden="true" className="metric-icon"><CalendarDays /></span>
            <span className="metric-label">Host organizations</span>
          </div>
          <p className="metric-value">{workspace.hostOrganizations.length}</p>
          <p className="metric-detail">Active memberships only.</p>
        </article>
        <article className="metric-card">
          <div className="metric-card-heading">
            <span aria-hidden="true" className="metric-icon"><Gavel /></span>
            <span className="metric-label">Judge assignments</span>
          </div>
          <p className="metric-value">{workspace.judgeAssignments.length}</p>
          <p className="metric-detail">Assigned events only.</p>
        </article>
      </section>

      <section aria-labelledby="participant-heading" className="surface-card">
        <div className="section-heading-row">
          <SectionHeading
            id="participant-heading"
            eyebrow="PARTICIPANT"
            title="My applications and submissions"
            description="Apply to a published event from the public catalogue. A host must mark your application eligible or accepted before you can submit a project."
          />
          <Link className="topbar-link" href="/morans#events">Browse events <ArrowRight aria-hidden="true" /></Link>
        </div>

        {workspace.applications.length > 0 ? (
          <ul className="record-list">
            {workspace.applications.map((application) => {
              const submission = workspace.participantSubmissions.find(
                (item) => item.hackathonId === application.hackathonId,
              )
              const canSubmit = ['eligible', 'accepted'].includes(application.status) && !submission

              return (
                <li className="record-list-item record-list-item-stacked" key={application.id}>
                  <div className="record-main">
                    <div>
                      <strong>{application.title}</strong>
                      <span>Application status: {readableStatus(application.status)}</span>
                      {submission ? <span>Submission status: {readableStatus(submission.status)}</span> : null}
                    </div>
                    <span className="record-status">{readableStatus(application.status)}</span>
                  </div>
                  {canSubmit ? (
                    <form action={submitProjectSubmission} className="workflow-form participant-submission-form">
                      <input name="hackathonId" type="hidden" value={application.hackathonId} />
                      <fieldset className="workflow-fieldset">
                        <legend>Submit your project</legend>
                        <label className="workflow-field" htmlFor={`submission-title-${application.id}`}>
                          <span>Project title</span>
                          <input id={`submission-title-${application.id}`} maxLength={140} minLength={3} name="title" required type="text" />
                        </label>
                        <label className="workflow-field" htmlFor={`submission-summary-${application.id}`}>
                          <span>Project summary</span>
                          <textarea id={`submission-summary-${application.id}`} maxLength={3000} name="summary" rows={3} />
                        </label>
                        <label className="workflow-field" htmlFor={`submission-url-${application.id}`}>
                          <span>Project URL</span>
                          <input id={`submission-url-${application.id}`} maxLength={500} name="projectUrl" placeholder="https://…" type="url" />
                        </label>
                      </fieldset>
                      <Button type="submit">Submit project</Button>
                    </form>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState
            icon={UsersRound}
            title="No applications yet"
            description="Browse published events and apply. Applications are private to your account and the assigned host team."
          />
        )}
      </section>

      <section aria-labelledby="host-heading" className="surface-card">
        <SectionHeading
          id="host-heading"
          eyebrow="HOST / ORGANISER"
          title="Host operations"
          description="Host applications start in review. Approved owners and organisers can create event drafts and review participant applications for their own events."
        />

        {workspace.hostOrganizations.length > 0 ? (
          <div className="host-organization-list">
            {workspace.hostOrganizations.map((organization) => {
              const events = workspace.hostEvents.filter(
                (event) => event.hostOrganizationId === organization.organizationId,
              )
              const canManage = ['owner', 'organiser'].includes(organization.role)
              const applications = workspace.hostApplications.filter((application) =>
                events.some((event) => event.id === application.hackathonId),
              )

              return (
                <article className="host-organization-card" key={organization.organizationId}>
                  <div className="record-main">
                    <div>
                      <h3>{organization.organizationName}</h3>
                      <span>Your role: {readableStatus(organization.role)}</span>
                    </div>
                    <span className="record-status">{readableStatus(organization.verificationStatus)}</span>
                  </div>

                  {organization.verificationStatus === 'approved' && canManage ? (
                    <form action={createHackathonDraft} className="workflow-form">
                      <input name="organizationId" type="hidden" value={organization.organizationId} />
                      <fieldset className="workflow-fieldset">
                        <legend>Create an event draft</legend>
                        <label className="workflow-field" htmlFor={`event-title-${organization.organizationId}`}>
                          <span>Event title</span>
                          <input id={`event-title-${organization.organizationId}`} maxLength={120} minLength={3} name="title" required type="text" />
                        </label>
                        <label className="workflow-field" htmlFor={`event-summary-${organization.organizationId}`}>
                          <span>Summary</span>
                          <textarea id={`event-summary-${organization.organizationId}`} maxLength={1200} name="summary" rows={3} />
                        </label>
                        <div className="workflow-field-grid">
                          <label className="workflow-field" htmlFor={`event-format-${organization.organizationId}`}>
                            <span>Format</span>
                            <select id={`event-format-${organization.organizationId}`} name="format" required defaultValue="online">
                              <option value="online">Online</option>
                              <option value="in_person">In person</option>
                              <option value="hybrid">Hybrid</option>
                            </select>
                          </label>
                          <label className="workflow-field" htmlFor={`event-location-${organization.organizationId}`}>
                            <span>Location (optional)</span>
                            <input id={`event-location-${organization.organizationId}`} maxLength={180} name="location" type="text" />
                          </label>
                        </div>
                      </fieldset>
                      <Button type="submit">Create draft</Button>
                    </form>
                  ) : organization.verificationStatus !== 'approved' ? (
                    <p className="form-note">Event creation is locked until the host organization is approved.</p>
                  ) : null}

                  {events.length > 0 ? (
                    <div className="host-event-list">
                      <h4>Events</h4>
                      {events.map((event) => (
                        <div className="host-event-row" key={event.id}>
                          <div className="record-main">
                            <div><strong>{event.title}</strong><span>{readableStatus(event.status)}</span></div>
                            <span className="record-status">{readableStatus(event.status)}</span>
                          </div>
                          {canManage && ['draft', 'needs_information'].includes(event.status) ? (
                            <form action={submitHackathonForReview}>
                              <input name="hackathonId" type="hidden" value={event.id} />
                              <Button size="sm" type="submit" variant="outline">Submit for review</Button>
                            </form>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {applications.length > 0 && canManage ? (
                    <div className="host-event-list">
                      <h4>Participant applications</h4>
                      {applications.map((application, index) => (
                        <div className="host-event-row" key={application.id}>
                          <div className="record-main">
                            <div>
                              <strong>{application.hackathonTitle}</strong>
                              <span>Applicant {index + 1} · {readableStatus(application.status)}</span>
                            </div>
                            <span className="record-status">{readableStatus(application.status)}</span>
                          </div>
                          {application.status === 'submitted' ? (
                            <div className="inline-actions">
                              {['eligible', 'accepted', 'waitlisted', 'needs_information', 'rejected'].map((decision) => (
                                <form action={reviewMoransApplication} key={decision}>
                                  <input name="applicationId" type="hidden" value={application.id} />
                                  <input name="decision" type="hidden" value={decision} />
                                  <Button size="xs" type="submit" variant={decision === 'accepted' ? 'default' : 'outline'}>
                                    {decision === 'needs_information' ? 'Request info' : readableStatus(decision)}
                                  </Button>
                                </form>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        ) : (
          <div className="host-application-panel">
            <EmptyState
              icon={CalendarDays}
              title="No host organisation is linked to your account"
              description="Submit an organisation request. You will become its owner, but event creation remains locked until verification."
            />
            <form action={createHostOrganization} className="workflow-form">
              <fieldset className="workflow-fieldset">
                <legend>Request a host workspace</legend>
                <label className="workflow-field" htmlFor="host-name">
                  <span>Organisation name</span>
                  <input id="host-name" maxLength={120} minLength={2} name="name" required type="text" />
                </label>
                <label className="workflow-field" htmlFor="host-type">
                  <span>Organisation type</span>
                  <select id="host-type" name="organizationType" required defaultValue="student_club">
                    <option value="individual">Individual</option>
                    <option value="student_club">Student club</option>
                    <option value="university">University</option>
                    <option value="company">Company</option>
                    <option value="ngo">NGO</option>
                    <option value="community">Community</option>
                    <option value="other">Other</option>
                  </select>
                </label>
              </fieldset>
              <Button type="submit">Submit host request</Button>
            </form>
          </div>
        )}
      </section>

      <section aria-labelledby="judge-heading" className="surface-card">
        <SectionHeading
          id="judge-heading"
          eyebrow="JUDGE"
          title="Assigned reviews"
          description="Judges can accept or decline an assignment. Only accepted assignments expose submitted projects, and your own participant submissions are excluded."
        />

        {workspace.judgeAssignments.length > 0 ? (
          <div className="judge-assignment-list">
            {workspace.judgeAssignments.map((assignment) => {
              const submissions = workspace.judgeSubmissions.filter(
                (submission) => submission.hackathonId === assignment.hackathonId,
              )

              return (
                <article className="judge-assignment-card" key={assignment.id}>
                  <div className="record-main">
                    <div><h3>{assignment.title}</h3><span>Assignment status: {readableStatus(assignment.status)}</span></div>
                    <span className="record-status">{readableStatus(assignment.status)}</span>
                  </div>

                  {assignment.status === 'pending' ? (
                    <div className="inline-actions">
                      {(['accepted', 'declined'] as const).map((response) => (
                        <form action={respondToJudgeAssignment} key={response}>
                          <input name="assignmentId" type="hidden" value={assignment.id} />
                          <input name="response" type="hidden" value={response} />
                          <Button size="sm" type="submit" variant={response === 'accepted' ? 'default' : 'outline'}>
                            {response === 'accepted' ? 'Accept assignment' : 'Decline / conflict'}
                          </Button>
                        </form>
                      ))}
                    </div>
                  ) : (
                    <p className="form-note">If you have a conflict of interest, decline before scoring.</p>
                  )}

                  {assignment.status === 'accepted' ? (
                    <div className="judge-submission-list">
                      {submissions.length > 0 ? submissions.map((submission) => {
                        const evaluation = workspace.judgeEvaluations.find(
                          (item) => item.submissionId === submission.id,
                        )
                        const projectUrl = safeExternalUrl(submission.projectUrl)

                        return (
                          <article className="judge-submission-card" key={submission.id}>
                            <div className="record-main">
                              <div>
                                <h4>{submission.title}</h4>
                                <span>{readableStatus(submission.status)}</span>
                              </div>
                              {evaluation ? <span className="record-status">Score {evaluation.score} / 100</span> : null}
                            </div>
                            {submission.summary ? <p className="event-summary">{submission.summary}</p> : null}
                            {projectUrl ? <a className="external-project-link" href={projectUrl} rel="noreferrer" target="_blank">Open project</a> : null}
                            {evaluation ? (
                              <p className="form-note">Your evaluation is {readableStatus(evaluation.status)}.</p>
                            ) : (
                              <form action={submitJudgeEvaluation} className="workflow-form">
                                <input name="submissionId" type="hidden" value={submission.id} />
                                <fieldset className="workflow-fieldset">
                                  <legend>Submit evaluation</legend>
                                  <label className="workflow-field" htmlFor={`score-${submission.id}`}>
                                    <span>Score (0–100)</span>
                                    <input id={`score-${submission.id}`} max="100" min="0" name="score" required step="0.001" type="number" />
                                  </label>
                                  <label className="workflow-field" htmlFor={`feedback-${submission.id}`}>
                                    <span>Feedback</span>
                                    <textarea id={`feedback-${submission.id}`} maxLength={5000} name="feedback" rows={3} />
                                  </label>
                                </fieldset>
                                <Button type="submit">Submit evaluation</Button>
                              </form>
                            )}
                          </article>
                        )
                      }) : (
                        <EmptyState
                          icon={ClipboardCheck}
                          title="No submitted projects are assigned yet"
                          description="The judging queue only includes submissions from events assigned to you."
                        />
                      )}
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        ) : (
          <EmptyState
            icon={Gavel}
            title="No judge assignments"
            description="A platform administrator must assign an event before judge records become visible."
          />
        )}
      </section>

      {isAdmin ? (
        <section className="governance-card">
          <div className="governance-icon" aria-hidden="true"><ShieldCheck /></div>
          <div className="governance-copy">
            <p className="section-eyebrow">PLATFORM ADMIN</p>
            <h2>Review and provision access</h2>
            <p>Admin actions are audited and only available to accounts with the Managed Auth administrator role.</p>
          </div>
          <Link className="action-button" href="/platform/admin">Open admin workspace <ArrowRight aria-hidden="true" /></Link>
        </section>
      ) : null}
    </PlatformShell>
  )
}
