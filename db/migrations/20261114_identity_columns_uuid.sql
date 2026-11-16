
BEGIN;

-- Prevent concurrent writes while validating and converting identity columns.
LOCK TABLE
  public.app_users,
  public.datax_institutions,
  public.datax_import_batches,
  public.morans_host_organizations,
  public.morans_hackathons,
  public.morans_applications,
  public.morans_submissions,
  public.platform_audit_log
IN ACCESS EXCLUSIVE MODE;

-- Stop safely if any stored identity is not a valid UUID or if a business
-- identity does not reference an existing app_users row.
DO $$
DECLARE
  bad_value_count integer;
  orphan_count integer;
BEGIN
  WITH identities AS (
    SELECT 'datax_institutions.owner_user_id' AS source_column,
           owner_user_id AS identity_value, true AS requires_account
    FROM public.datax_institutions
    UNION ALL
    SELECT 'datax_import_batches.created_by_user_id',
           created_by_user_id, true
    FROM public.datax_import_batches
    UNION ALL
    SELECT 'morans_host_organizations.owner_user_id',
           owner_user_id, true
    FROM public.morans_host_organizations
    UNION ALL
    SELECT 'morans_hackathons.created_by_user_id',
           created_by_user_id, true
    FROM public.morans_hackathons
    UNION ALL
    SELECT 'morans_applications.participant_user_id',
           participant_user_id, true
    FROM public.morans_applications
    UNION ALL
    SELECT 'morans_submissions.participant_user_id',
           participant_user_id, true
    FROM public.morans_submissions
    UNION ALL
    SELECT 'platform_audit_log.actor_user_id',
           actor_user_id, false
    FROM public.platform_audit_log
  )
  SELECT count(*) INTO bad_value_count
  FROM identities
  WHERE identity_value IS NULL
     OR identity_value !~*
       '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  IF bad_value_count > 0 THEN
    RAISE EXCEPTION
      'Migration stopped: % identity values are not valid UUID strings.',
      bad_value_count;
  END IF;

  WITH identities AS (
    SELECT owner_user_id AS identity_value
    FROM public.datax_institutions
    UNION ALL
    SELECT created_by_user_id FROM public.datax_import_batches
    UNION ALL
    SELECT owner_user_id FROM public.morans_host_organizations
    UNION ALL
    SELECT created_by_user_id FROM public.morans_hackathons
    UNION ALL
    SELECT participant_user_id FROM public.morans_applications
    UNION ALL
    SELECT participant_user_id FROM public.morans_submissions
  )
  SELECT count(*) INTO orphan_count
  FROM identities i
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.app_users u
    WHERE u.id = i.identity_value::uuid
  );

  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      'Migration stopped: % business identity values have no matching app_users row.',
      orphan_count;
  END IF;
END $$;

-- Convert the six business identity columns.
ALTER TABLE public.datax_institutions
  ALTER COLUMN owner_user_id TYPE uuid USING owner_user_id::uuid;

ALTER TABLE public.datax_import_batches
  ALTER COLUMN created_by_user_id TYPE uuid USING created_by_user_id::uuid;

ALTER TABLE public.morans_host_organizations
  ALTER COLUMN owner_user_id TYPE uuid USING owner_user_id::uuid;

ALTER TABLE public.morans_hackathons
  ALTER COLUMN created_by_user_id TYPE uuid USING created_by_user_id::uuid;

ALTER TABLE public.morans_applications
  ALTER COLUMN participant_user_id TYPE uuid USING participant_user_id::uuid;

ALTER TABLE public.morans_submissions
  ALTER COLUMN participant_user_id TYPE uuid USING participant_user_id::uuid;

-- Preserve NOT NULL and enforce account references for business records.
ALTER TABLE public.datax_institutions
  ADD CONSTRAINT datax_institutions_owner_user_id_fkey
  FOREIGN KEY (owner_user_id)
  REFERENCES public.app_users(id) ON DELETE RESTRICT;

ALTER TABLE public.datax_import_batches
  ADD CONSTRAINT datax_import_batches_created_by_user_id_fkey
  FOREIGN KEY (created_by_user_id)
  REFERENCES public.app_users(id) ON DELETE RESTRICT;

ALTER TABLE public.morans_host_organizations
  ADD CONSTRAINT morans_host_organizations_owner_user_id_fkey
  FOREIGN KEY (owner_user_id)
  REFERENCES public.app_users(id) ON DELETE RESTRICT;

ALTER TABLE public.morans_hackathons
  ADD CONSTRAINT morans_hackathons_created_by_user_id_fkey
  FOREIGN KEY (created_by_user_id)
  REFERENCES public.app_users(id) ON DELETE RESTRICT;

ALTER TABLE public.morans_applications
  ADD CONSTRAINT morans_applications_participant_user_id_fkey
  FOREIGN KEY (participant_user_id)
  REFERENCES public.app_users(id) ON DELETE RESTRICT;

ALTER TABLE public.morans_submissions
  ADD CONSTRAINT morans_submissions_participant_user_id_fkey
  FOREIGN KEY (participant_user_id)
  REFERENCES public.app_users(id) ON DELETE RESTRICT;

-- Convert the audit actor ID but deliberately do not add an account FK.
ALTER TABLE public.platform_audit_log
  ALTER COLUMN actor_user_id TYPE uuid USING actor_user_id::uuid;

COMMIT;
