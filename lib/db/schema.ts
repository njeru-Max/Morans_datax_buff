import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

export const appUsers = pgTable('app_users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('user'),
  emailVerified: boolean('email_verified').notNull().default(false),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const authActionTokens = pgTable('auth_action_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => appUsers.id, { onDelete: 'cascade' }),
  purpose: text('purpose').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})


export const appUserRoles = pgTable('app_user_roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => appUsers.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  grantedByUserId: uuid('granted_by_user_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const dataxInstitutions = pgTable('datax_institutions', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => appUsers.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  countryCode: text('country_code'),
  status: text('status').notNull().default('pilot'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const dataxInstitutionMemberships = pgTable('datax_institution_memberships', {
  id: uuid('id').defaultRandom().primaryKey(),
  institutionId: uuid('institution_id')
    .notNull()
    .references(() => dataxInstitutions.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => appUsers.id, { onDelete: 'restrict' }),
  role: text('role').notNull(),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const dataxImportBatches = pgTable('datax_import_batches', {
  id: uuid('id').defaultRandom().primaryKey(),
  institutionId: uuid('institution_id')
    .notNull()
    .references(() => dataxInstitutions.id, { onDelete: 'cascade' }),
  createdByUserId: uuid('created_by_user_id').notNull().references(() => appUsers.id, { onDelete: 'restrict' }),
  originalFilename: text('original_filename'),
  status: text('status').notNull().default('draft'),
  periodStart: date('period_start'),
  periodEnd: date('period_end'),
  rowsTotal: integer('rows_total').notNull().default(0),
  rowsValid: integer('rows_valid').notNull().default(0),
  rowsRejected: integer('rows_rejected').notNull().default(0),
  sourceChecksum: text('source_checksum'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  validatedAt: timestamp('validated_at', { withTimezone: true }),
  committedAt: timestamp('committed_at', { withTimezone: true }),
})

export const dataxMetricRecords = pgTable('datax_metric_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  institutionId: uuid('institution_id')
    .notNull()
    .references(() => dataxInstitutions.id, { onDelete: 'cascade' }),
  sourceBatchId: uuid('source_batch_id')
    .notNull()
    .references(() => dataxImportBatches.id, { onDelete: 'restrict' }),
  metricKey: text('metric_key').notNull(),
  programme: text('programme').notNull().default('all'),
  cohortLabel: text('cohort_label').notNull().default('all'),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  metricValue: numeric('metric_value', { precision: 14, scale: 4 }).notNull(),
  metricDefinitionVersion: text('metric_definition_version').notNull().default('v1'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const moransHostOrganizations = pgTable('morans_host_organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => appUsers.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  organizationType: text('organization_type').notNull(),
  verificationStatus: text('verification_status').notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const moransHostMemberships = pgTable('morans_host_memberships', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => moransHostOrganizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => appUsers.id, { onDelete: 'restrict' }),
  role: text('role').notNull(),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const moransHackathons = pgTable('morans_hackathons', {
  id: uuid('id').defaultRandom().primaryKey(),
  hostType: text('host_type').notNull().default('official'),
  hostOrganizationId: uuid('host_organization_id').references(
    () => moransHostOrganizations.id,
    { onDelete: 'restrict' },
  ),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  summary: text('summary').notNull().default(''),
  format: text('format').notNull().default('online'),
  location: text('location'),
  status: text('status').notNull().default('draft'),
  registrationOpensAt: timestamp('registration_opens_at', { withTimezone: true }),
  registrationClosesAt: timestamp('registration_closes_at', { withTimezone: true }),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  createdByUserId: uuid('created_by_user_id').notNull().references(() => appUsers.id, { onDelete: 'restrict' }),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const moransApplications = pgTable('morans_applications', {
  id: uuid('id').defaultRandom().primaryKey(),
  hackathonId: uuid('hackathon_id')
    .notNull()
    .references(() => moransHackathons.id, { onDelete: 'cascade' }),
  participantUserId: uuid('participant_user_id').notNull().references(() => appUsers.id, { onDelete:  'restrict' }),
  status: text('status').notNull().default('submitted'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const moransSubmissions = pgTable('morans_submissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  hackathonId: uuid('hackathon_id')
    .notNull()
    .references(() => moransHackathons.id, { onDelete: 'cascade' }),
  participantUserId: uuid('participant_user_id').notNull().references(() => appUsers.id, { onDelete: 'restrict' }),
  title: text('title').notNull(),
  summary: text('summary').notNull().default(''),
  projectUrl: text('project_url'),
  status: text('status').notNull().default('draft'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})


export const moransJudgeAssignments = pgTable('morans_judge_assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  hackathonId: uuid('hackathon_id')
    .notNull()
    .references(() => moransHackathons.id, { onDelete: 'cascade' }),
  judgeUserId: uuid('judge_user_id')
    .notNull()
    .references(() => appUsers.id, { onDelete: 'restrict' }),
  assignedByUserId: uuid('assigned_by_user_id')
    .notNull()
    .references(() => appUsers.id, { onDelete: 'restrict' }),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const moransEvaluations = pgTable('morans_evaluations', {
  id: uuid('id').defaultRandom().primaryKey(),
  hackathonId: uuid('hackathon_id')
    .notNull()
    .references(() => moransHackathons.id, { onDelete: 'cascade' }),
  submissionId: uuid('submission_id')
    .notNull()
    .references(() => moransSubmissions.id, { onDelete: 'cascade' }),
  judgeUserId: uuid('judge_user_id')
    .notNull()
    .references(() => appUsers.id, { onDelete: 'restrict' }),
  rubricVersion: text('rubric_version').notNull().default('v1'),
  score: numeric('score', { precision: 7, scale: 3 }).notNull(),
  feedback: text('feedback').notNull().default(''),
  conflictDeclared: boolean('conflict_declared').notNull().default(false),
  status: text('status').notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const platformAuditLog = pgTable('platform_audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorUserId: uuid('actor_user_id').notNull(),
  moduleKey: text('module_key').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
