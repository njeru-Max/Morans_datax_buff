import type { ReactNode } from 'react'
import { ShieldAlert, type LucideIcon } from 'lucide-react'

export function PageHeading({
  eyebrow,
  title,
  description,
  status,
}: {
  eyebrow: string
  title: string
  description: string
  status?: ReactNode
}) {
  return (
    <header className="page-heading">
      <div>
        <p className="page-eyebrow">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {status ? <div className="page-heading-status">{status}</div> : null}
    </header>
  )
}

export function SafetyNotice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="safety-notice" role="note">
      <span className="safety-icon" aria-hidden="true">
        <ShieldAlert />
      </span>
      <div className="safety-copy">
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </aside>
  )
}

export function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon
  label: string
  value: string | number
  detail: string
}) {
  return (
    <article className="metric-card">
      <div className="metric-card-heading">
        <span aria-hidden="true" className="metric-icon">
          <Icon />
        </span>
        <span className="metric-label">{label}</span>
      </div>
      <p className="metric-value">{value}</p>
      <p className="metric-detail">{detail}</p>
    </article>
  )
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
}: {
  id?: string
  eyebrow?: string
  title: string
  description?: string
}) {
  return (
    <div className="section-heading">
      {eyebrow ? <p className="section-eyebrow">{eyebrow}</p> : null}
      <h2 className="section-title" id={id}>{title}</h2>
      {description ? <p className="section-description">{description}</p> : null}
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon
  title: string
  description: string
}) {
  return (
    <div className="empty-state" role="status">
      <span aria-hidden="true" className="empty-icon">
        <Icon />
      </span>
      <h3 className="empty-title">{title}</h3>
      <p className="empty-description">{description}</p>
    </div>
  )
}
