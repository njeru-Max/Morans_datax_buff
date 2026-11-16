BEGIN;

LOCK TABLE public.morans_judge_assignments,
           public.morans_evaluations
IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.morans_judge_assignments) <> 0
     OR (SELECT count(*) FROM public.morans_evaluations) <> 0 THEN
    RAISE EXCEPTION 'Migration stopped: target tables must be empty.';
  END IF;

  IF (
    SELECT count(*)
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        (table_name = 'morans_judge_assignments'
         AND column_name IN ('judge_user_id', 'assigned_by_user_id'))
        OR
        (table_name = 'morans_evaluations'
         AND column_name = 'judge_user_id')
      )
      AND data_type = 'text'
  ) <> 3 THEN
    RAISE EXCEPTION 'Migration stopped: expected three text columns.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'app_users'
      AND column_name = 'id'
      AND data_type = 'uuid'
  ) THEN
    RAISE EXCEPTION 'Migration stopped: app_users.id must be UUID.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname IN (
      'morans_judge_assignments_judge_user_id_fkey',
      'morans_judge_assignments_assigned_by_user_id_fkey',
      'morans_evaluations_judge_user_id_fkey'
    )
  ) THEN
    RAISE EXCEPTION 'Migration stopped: one or more target constraint names already exist.';
  END IF;
END $$;

ALTER TABLE public.morans_judge_assignments
  ALTER COLUMN judge_user_id TYPE uuid USING judge_user_id::uuid,
  ALTER COLUMN assigned_by_user_id TYPE uuid USING assigned_by_user_id::uuid;

ALTER TABLE public.morans_evaluations
  ALTER COLUMN judge_user_id TYPE uuid USING judge_user_id::uuid;

ALTER TABLE public.morans_judge_assignments
  ADD CONSTRAINT morans_judge_assignments_judge_user_id_fkey
    FOREIGN KEY (judge_user_id)
    REFERENCES public.app_users(id) ON DELETE RESTRICT,
  ADD CONSTRAINT morans_judge_assignments_assigned_by_user_id_fkey
    FOREIGN KEY (assigned_by_user_id)
    REFERENCES public.app_users(id) ON DELETE RESTRICT;

ALTER TABLE public.morans_evaluations
  ADD CONSTRAINT morans_evaluations_judge_user_id_fkey
    FOREIGN KEY (judge_user_id)
    REFERENCES public.app_users(id) ON DELETE RESTRICT;

COMMIT;