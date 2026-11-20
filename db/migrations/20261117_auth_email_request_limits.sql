BEGIN;

CREATE TABLE IF NOT EXISTS public.auth_email_request_limits (
  email_hash text PRIMARY KEY
    CHECK (email_hash ~ '^[0-9a-f]{64}$'),
  last_requested_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;

