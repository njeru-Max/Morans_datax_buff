BEGIN;

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

COMMIT;
