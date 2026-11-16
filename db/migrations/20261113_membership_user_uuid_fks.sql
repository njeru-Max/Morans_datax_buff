
BEGIN;

LOCK TABLE
  public.datax_institution_memberships,
  public.morans_host_memberships
IN ACCESS EXCLUSIVE MODE;

-- Convert the membership user IDs from text to UUID.
ALTER TABLE public.datax_institution_memberships
  ALTER COLUMN user_id TYPE uuid
  USING user_id::uuid;

ALTER TABLE public.morans_host_memberships
  ALTER COLUMN user_id TYPE uuid
  USING user_id::uuid;

-- Require each membership to reference an existing application user.
ALTER TABLE public.datax_institution_memberships
  ADD CONSTRAINT datax_memberships_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.app_users(id)
  ON DELETE RESTRICT;

ALTER TABLE public.morans_host_memberships
  ADD CONSTRAINT morans_host_memberships_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.app_users(id)
  ON DELETE RESTRICT;

COMMIT;
