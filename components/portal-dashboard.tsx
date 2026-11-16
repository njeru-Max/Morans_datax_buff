import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Database,
  FileSpreadsheet,
  LockKeyhole,
  ShieldCheck,
  UsersRound,
} from 'lucide-react'
import type { DatabaseStatus } from '@/lib/db'
import type { SessionUser } from '@/lib/auth/session'
import { PlatformShell } from '@/components/platform/platform-shell'
import { PageHeading, SafetyNotice, SectionHeading } from '@/components/platform/dashboard-primitives'

export function PortalDashboard({
  authAvailable,
  databaseStatus,
  user,
}: {
  authAvailable: boolean
  databaseStatus: DatabaseStatus
  user: SessionUser | null
}) {
  return (
    <PlatformShell active="overview" databaseStatus={databaseStatus} user={user}>
      <PageHeading
        eyebrow="NELSEN SAVANNAH · UNIFIED PLATFORM"
        title="Two programmes. One starting point."
        description="Keep education analytics and hackathon operations distinct, while sharing a PostgreSQL foundation and a clear path to production."
      />

      <SafetyNotice title="Access is checked per workspace">
        {authAvailable
          ? 'Sign-in is enabled. Data X requires an active institution membership, and MORANS actions are limited to your participant, host, or judge assignments. Public sign-up never grants administrator access.'
          : 'Account access is temporarily unavailable. Data X requires an active institution membership, and MORANS actions are limited to your participant, host, or judge assignments. Public sign-up never grants administrator access.'}
      </SafetyNotice>

      <section aria-labelledby="workspace-section-heading" className="workspace-section" id="workspaces">
        <div className="section-heading-row">
          <SectionHeading
            id="workspace-section-heading"
            eyebrow="WORKSPACES"
            title="Choose a dashboard"
            description="Each programme has its own workflow, data model, and dashboard."
          />
          <span className="section-count">02 workspaces</span>
        </div>

        <div className="workspace-grid">
          <article className="workspace-card workspace-card-datax">
            <div className="workspace-card-heading">
              <span className="workspace-icon" aria-hidden="true">
                <BarChart3 />
              </span>
              <span className="workspace-card-label">DATA X · EDUCATION ANALYTICS</span>
            </div>
            <h2>Data X Intelligence</h2>
            <p className="workspace-card-description">
              A focused institution workspace for validated imports, cohort outcomes, transparent metrics, and data-quality signals.
            </p>
            <ul className="workspace-feature-list">
              <li><FileSpreadsheet aria-hidden="true" /> Import provenance and validation</li>
              <li><ShieldCheck aria-hidden="true" /> Pilot privacy and metric governance</li>
            </ul>
            <div className="workspace-card-footer">
              <span className="workspace-state">Foundation ready</span>
<Link className="action-button" href="/data-x">
  Open Data X
  <ArrowRight aria-hidden="true" />
  </Link>
            </div>
          </article>

          <article className="workspace-card workspace-card-morans">
            <div className="workspace-card-heading">
              <span className="workspace-icon" aria-hidden="true">
                <CalendarDays />
              </span>
              <span className="workspace-card-label">MORANS · HACKATHON PLATFORM</span>
            </div>
            <h2>MORANS Competition Hub</h2>
            <p className="workspace-card-description">
              A competition-first workspace for the official MORANS programme and approved external organisers.
            </p>
            <ul className="workspace-feature-list">
              <li><UsersRound aria-hidden="true" /> Participant and organiser portals</li>
              <li><LockKeyhole aria-hidden="true" /> Event-level roles and review gates</li>
            </ul>
            <div className="workspace-card-footer">
              <span className="workspace-state">
                {databaseStatus === 'connected' ? 'Public catalogue enabled' : 'Catalogue needs database'}
              </span>
<Link className="action-button" href="/morans">
  Open MORANS
  <ArrowRight aria-hidden="true" />
  </Link>
            </div>
          </article>
        </div>
      </section>

      <section aria-labelledby="foundation-heading" className="foundation-section">
        <div className="foundation-card">
          <div className="foundation-icon" aria-hidden="true">
            <Database />
          </div>
          <div>
            <p className="section-eyebrow">SHARED FOUNDATION</p>
            <h2 id="foundation-heading">
              {databaseStatus === 'connected'
                ? 'PostgreSQL is connected to this environment'
                : databaseStatus === 'not-configured'
                  ? 'Add a PostgreSQL connection'
                  : 'PostgreSQL is not reachable'}
            </h2>
            <p>
              Separate Data X and MORANS tables cover institutions, imports, events, applications, submissions, judging, and audit history.
            </p>
          </div>
          <span className={`foundation-status is-${databaseStatus}`}>
            {databaseStatus === 'connected'
              ? 'Connection verified'
              : databaseStatus === 'not-configured'
                ? 'Local URL required'
                : 'Check connection'}
          </span>
        </div>
      </section>

      <section aria-labelledby="roadmap-heading" className="roadmap-section" id="next-phases">
        <div className="section-heading-row">
          <SectionHeading
            id="roadmap-heading"
            eyebrow="BUILD TOWARD DEPLOYMENT"
            title="A practical route to launch"
            description="The supplied sitemaps describe two sizeable products. This starter puts the shared foundation first and keeps the release gates visible."
          />
          <Link className="roadmap-link" href="/data-x">
            View workspaces <ArrowRight aria-hidden="true" />
          </Link>
        </div>

        <ol className="roadmap-grid">
          <li className="roadmap-card is-current">
            <span className="roadmap-index">01</span>
            <div>
              <p className="roadmap-state">CURRENT FOUNDATION</p>
              <h3>Separate dashboards</h3>
              <p>Shared navigation, PostgreSQL schema, managed sign-in, and distinct Data X and MORANS access scopes.</p>
            </div>
          </li>
          <li className="roadmap-card">
            <span className="roadmap-index">02</span>
            <div>
              <p className="roadmap-state">ACTIVE ACCESS GATES</p>
              <h3>Sign-in and scoped access</h3>
              <p>Server sessions and membership checks protect private institution and event records.</p>
            </div>
          </li>
          <li className="roadmap-card">
            <span className="roadmap-index">03</span>
            <div>
              <p className="roadmap-state">NEXT RELEASE GATES</p>
              <h3>Validation and governance</h3>
              <p>CSV file validation, privacy review, production email setup, and independent cross-role authorization tests.</p>
            </div>
          </li>
        </ol>

        <p className="roadmap-footnote">
          <ShieldCheck aria-hidden="true" /> Draft import metadata and role-scoped competition workflows are enabled. Real learner files, payments, and production email delivery still require separate approval and validation.
        </p>
      </section>
    </PlatformShell>
  )
}
