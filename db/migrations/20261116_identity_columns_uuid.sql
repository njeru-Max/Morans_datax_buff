
BEGIN;

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

DO $$
DECLARE
  target_count integer;
  invalid_count bigint;
  missing_account_count bigint;
BEGIN
  -- Refuse to run unless all seven target columns are text.
  SELECT count(*)
  INTO target_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND data_type = 'text'
    AND is_nullable = 'NO'
    AND (
      (table_name = 'datax_institutions' AND column_name = 'owner_user_id')
      OR (table_name = 'datax_import_batches' AND column_name = 'created_by_user_id')
      OR (table_name = 'morans_host_organizations' AND column_name = 'owner_user_id')
      OR (table_name = 'morans_hackathons' AND column_name = 'created_by_user_id')
      OR (table_name = 'morans_applications' AND column_name = 'participant_user_id')
      OR (table_name = 'morans_submissions' AND column_name = 'participant_user_id')
      OR (table_name = 'platform_audit_log' AND column_name = 'actor_user_id')
    );

  IF target_count <> 7 THEN
    RAISE EXCEPTION
      'Migration stopped: expected seven text NOT NULL columns; found %.',
      target_count;
  END IF;

  -- Reject non-UUID values before casting.
  SELECT count(*)
  INTO invalid_count
  FROM (
    SELECT owner_user_id AS value
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
    UNION ALL
    SELECT actor_user_id FROM public.platform_audit_log
  ) values_to_check
  WHERE value IS NULL
     OR value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  IF invalid_count <> 0 THEN
    RAISE EXCEPTION
      'Migration stopped: found % NULL or invalid UUID values.',
      invalid_count;
  END IF;

  -- Validate account existence for the six columns that will get FKs.
  SELECT count(*)
  INTO missing_account_count
  FROM (
    SELECT owner_user_id AS value FROM public.datax_institutions
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
  ) identity_values
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.app_users u
    WHERE u.id = identity_values.value::uuid
  );

  IF missing_account_count <> 0 THEN
    RAISE EXCEPTION
      'Migration stopped: found % identity values without a matching account.',
      missing_account_count;
  END IF;

  -- Prevent collisions with existing constraint names.
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname IN (
      'datax_institutions_owner_user_id_fkey',
      'datax_import_batches_created_by_user_id_fkey',
      'morans_host_organizations_owner_user_id_fkey',
      'morans_hackathons_created_by_user_id_fkey',
      'morans_applications_participant_user_id_fkey',
      'morans_submissions_participant_user_id_fkey'
    )
  ) THEN
    RAISE EXCEPTION
      'Migration stopped: a planned foreign-key constraint name already exists.';
  END IF;
END $$;

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

ALTER TABLE public.platform_audit_log
  ALTER COLUMN actor_user_id TYPE uuid USING actor_user_id::uuid;

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

COMMIT;
