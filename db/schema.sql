-- Local PostgreSQL identity, authentication sessions, and scoped dashboard roles.
CREATE TABLE IF NOT EXISTS public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  email_verified boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('platform_admin', 'data_x_admin', 'morans_admin')),
  granted_by_user_id uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS auth_sessions_user_active_idx ON public.auth_sessions (user_id, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS app_user_roles_user_idx ON public.app_user_roles (user_id, role);
CREATE TABLE IF NOT EXISTS public.auth_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  succeeded boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_login_attempts_email_time_idx ON public.auth_login_attempts (email, attempted_at DESC) WHERE succeeded = false;

CREATE TABLE IF NOT EXISTS public.auth_action_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL
    REFERENCES public.app_users(id) ON DELETE CASCADE,
  purpose text NOT NULL
    CHECK (purpose IN ('email_verification', 'password_reset')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_action_tokens_user_purpose_idx
  ON public.auth_action_tokens (user_id, purpose, expires_at);

CREATE TABLE IF NOT EXISTS public.auth_email_request_limits (
  email_hash text PRIMARY KEY
    CHECK (email_hash ~ '^[0-9a-f]{64}$'),
  last_requested_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.datax_institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  country_code text,
  status text NOT NULL DEFAULT 'pilot' CHECK (status IN ('pilot', 'active', 'paused', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.datax_institution_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.datax_institutions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN ('institution_admin', 'programme_lead', 'analyst', 'instructor', 'viewer')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.datax_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.datax_institutions(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  original_filename text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated', 'committed', 'failed')),
  period_start date,
  period_end date,
  rows_total integer NOT NULL DEFAULT 0 CHECK (rows_total >= 0),
  rows_valid integer NOT NULL DEFAULT 0 CHECK (rows_valid >= 0),
  rows_rejected integer NOT NULL DEFAULT 0 CHECK (rows_rejected >= 0),
  source_checksum text,
  created_at timestamptz NOT NULL DEFAULT now(),
  validated_at timestamptz,
  committed_at timestamptz,
  CHECK (rows_valid + rows_rejected <= rows_total),
  CHECK (period_start IS NULL OR period_end IS NULL OR period_start <= period_end)
);

CREATE TABLE IF NOT EXISTS public.datax_metric_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.datax_institutions(id) ON DELETE CASCADE,
  source_batch_id uuid NOT NULL REFERENCES public.datax_import_batches(id) ON DELETE RESTRICT,
  metric_key text NOT NULL,
  programme text NOT NULL DEFAULT 'all',
  cohort_label text NOT NULL DEFAULT 'all',
  period_start date NOT NULL,
  period_end date NOT NULL,
  metric_value numeric(14, 4) NOT NULL,
  metric_definition_version text NOT NULL DEFAULT 'v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, source_batch_id, metric_key, programme, cohort_label, period_start, period_end),
  CHECK (period_start <= period_end)
);

CREATE TABLE IF NOT EXISTS public.morans_host_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  name text NOT NULL,
  organization_type text NOT NULL CHECK (organization_type IN ('individual', 'student_club', 'university', 'company', 'ngo', 'community', 'other')),
  verification_status text NOT NULL DEFAULT 'draft' CHECK (verification_status IN ('draft', 'submitted', 'needs_information', 'approved', 'rejected', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.morans_host_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.morans_host_organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN ('owner', 'organiser', 'finance_officer', 'judge_coordinator')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.morans_hackathons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_type text NOT NULL DEFAULT 'official' CHECK (host_type IN ('official', 'external')),
  host_organization_id uuid REFERENCES public.morans_host_organizations(id) ON DELETE RESTRICT,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  summary text NOT NULL DEFAULT '',
  format text NOT NULL DEFAULT 'online' CHECK (format IN ('in_person', 'online', 'hybrid')),
  location text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'under_review', 'needs_information', 'published', 'paused', 'closed', 'rejected', 'archived')),
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by_user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((host_type = 'official' AND host_organization_id IS NULL) OR (host_type = 'external' AND host_organization_id IS NOT NULL)),
  CHECK (registration_opens_at IS NULL OR registration_closes_at IS NULL OR registration_opens_at <= registration_closes_at),
  CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at <= ends_at)
);

CREATE TABLE IF NOT EXISTS public.morans_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hackathon_id uuid NOT NULL REFERENCES public.morans_hackathons(id) ON DELETE CASCADE,
  participant_user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'needs_information', 'eligible', 'accepted', 'waitlisted', 'rejected', 'withdrawn')),
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hackathon_id, participant_user_id)
);

CREATE TABLE IF NOT EXISTS public.morans_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hackathon_id uuid NOT NULL REFERENCES public.morans_hackathons(id) ON DELETE CASCADE,
  participant_user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  project_url text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'locked', 'withdrawn')),
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.morans_judge_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hackathon_id uuid NOT NULL REFERENCES public.morans_hackathons(id) ON DELETE CASCADE,
  judge_user_id uuid NOT NULL
    REFERENCES public.app_users(id) ON DELETE RESTRICT,
  assigned_by_user_id uuid NOT NULL
    REFERENCES public.app_users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hackathon_id, judge_user_id)
);

CREATE TABLE IF NOT EXISTS public.morans_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hackathon_id uuid NOT NULL REFERENCES public.morans_hackathons(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL REFERENCES public.morans_submissions(id) ON DELETE CASCADE,
  judge_user_id uuid NOT NULL
     REFERENCES public.app_users(id) ON DELETE RESTRICT,
  rubric_version text NOT NULL DEFAULT 'v1',
  score numeric(7, 3) NOT NULL CHECK (score >= 0 AND score <= 100),
  feedback text NOT NULL DEFAULT '',
  conflict_declared boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submission_id, judge_user_id)
);

CREATE TABLE IF NOT EXISTS public.platform_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  module_key text NOT NULL CHECK (module_key IN ('data_x', 'morans', 'platform')),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS datax_import_batches_institution_created_idx ON public.datax_import_batches (institution_id, created_at DESC);
CREATE INDEX IF NOT EXISTS datax_metric_records_institution_period_idx ON public.datax_metric_records (institution_id, metric_key, period_end DESC);
CREATE INDEX IF NOT EXISTS morans_hackathons_public_schedule_idx ON public.morans_hackathons (status, published_at DESC, starts_at);
CREATE INDEX IF NOT EXISTS morans_hackathons_host_created_idx ON public.morans_hackathons (host_organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS morans_applications_hackathon_status_idx ON public.morans_applications (hackathon_id, status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS morans_submissions_hackathon_status_idx ON public.morans_submissions (hackathon_id, status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS morans_judge_assignments_hackathon_status_idx ON public.morans_judge_assignments (hackathon_id, status);
CREATE INDEX IF NOT EXISTS morans_evaluations_hackathon_status_idx ON public.morans_evaluations (hackathon_id, status, score DESC);
CREATE INDEX IF NOT EXISTS platform_audit_log_entity_created_idx ON public.platform_audit_log (module_key, entity_type, entity_id, created_at DESC);

ALTER TABLE public.datax_institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datax_institution_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datax_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datax_metric_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.morans_host_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.morans_host_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.morans_hackathons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.morans_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.morans_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.morans_judge_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.morans_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS morans_published_events_read ON public.morans_hackathons;
CREATE POLICY morans_published_events_read ON public.morans_hackathons FOR SELECT USING (status = 'published');

