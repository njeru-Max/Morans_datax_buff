# Nelsen Savannah — Data X + MORANS

A Next.js platform with separate Data X education analytics and MORANS hackathon workspaces. PostgreSQL is the only database and identity store. No external authentication provider is used.

## Current architecture

- PostgreSQL 16 is used for application data, local accounts, dashboard roles, and revocable sessions.
- Passwords are stored as salted Node.js `scrypt` hashes. Plain-text passwords are never stored.
- Session tokens are random, stored only as SHA-256 hashes in PostgreSQL, and sent to the browser in an `HttpOnly`, `SameSite=Lax` cookie. Production cookies are `Secure`.
- Dashboard roles are independent: `platform_admin`, `data_x_admin`, and `morans_admin`. Public sign-up grants no administrator role.
- `proxy.ts` is only a navigation convenience. Protected server pages and actions must perform authoritative PostgreSQL session/role checks.
- Existing business tables remain in `db/schema.sql`. This clean-install workflow creates a new database and new accounts; it does not migrate external identity-provider users or data.

## Prerequisites

Install Node.js 20.9+, pnpm 12, and Docker Desktop. Start Docker Desktop before running the database commands. Run all commands from this project directory in the VS Code terminal.

## Windows PowerShell: clean local setup

1. Install packages:

   ```powershell
   corepack enable
   pnpm install
   ```

2. Create your ignored local environment file:

   ```powershell
   Copy-Item .env.example .env.local
   ```

3. Start PostgreSQL:

   ```powershell
   docker compose up -d
   docker compose ps
   ```

   The container binds to `127.0.0.1:5432` only. The credentials in `compose.yaml` are for local development and must never be reused in production.

4. Create tables and indexes:

   ```powershell
   pnpm db:setup
   ```

5. Create the first platform administrator. Use a long unique password (12+ characters). The password is read from an environment variable rather than a command-line argument, to reduce shell-history exposure:

   ```powershell
   $env:ADMIN_NAME = "Platform Administrator"
   $env:ADMIN_EMAIL = "admin@example.com"
   $env:ADMIN_PASSWORD = "replace-with-a-long-unique-password"
   $env:ADMIN_ROLES = "platform_admin,data_x_admin,morans_admin"
   pnpm admin:create
   Remove-Item Env:ADMIN_NAME, Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD, Env:ADMIN_ROLES
   ```

   Replace the example email and password locally. Do not send passwords to anyone or commit them. You may create separate administrators by running the command with a different email and one role at a time:

   - `ADMIN_ROLES=data_x_admin` — Data X dashboard administrator
   - `ADMIN_ROLES=morans_admin` — MORANS dashboard administrator
   - `ADMIN_ROLES=platform_admin` — platform-wide administrator

   The CLI can also reset the password for an existing email. Roles are additive; remove a role explicitly from `app_user_roles` if it should be revoked.

6. Start the app:

   ```powershell
   pnpm dev
   ```

   Open `http://localhost:3000`. Database health: `http://localhost:3000/api/health/db`.

## Useful checks

```powershell
pnpm typecheck
pnpm test:security
pnpm build
```

The security tests check critical source/schema invariants. They do not replace live integration tests against a running PostgreSQL server. A build and database test should be run locally after dependencies and Docker are installed.

## Roles and access

| Role | Intended scope | How it is granted |
|---|---|---|
| `platform_admin` | Platform administration and cross-module provisioning | `pnpm admin:create` or a controlled database change by an authorized operator |
| `data_x_admin` | Data X administration | `pnpm admin:create` or a controlled database change |
| `morans_admin` | MORANS administration | `pnpm admin:create` or a controlled database change |
| ordinary user | Only normal user and membership-scoped workflows | Public sign-up; no admin privileges |

A person can hold more than one dashboard role. Admin roles are not inferred from email addresses, public form fields, or client-side state. Never expose `DATABASE_URL` to browser code.

## Database and operational notes

- `db/schema.sql` is idempotent for the current clean-install schema. `pnpm db:setup` runs it in a transaction.
- Local Docker data persists in the `platform_postgres_data` volume. To intentionally start from an empty local database, stop the stack and remove the volume with `docker compose down -v`. **This permanently deletes the local database**; do this only when you are certain you do not need the data.
- Back up before schema changes. For local backup: `docker exec nelsen-platform-postgres pg_dump -U platform -d data_platform -Fc -f /tmp/nelsen.dump` followed by `docker cp nelsen-platform-postgres:/tmp/nelsen.dump ./nelsen.dump`.
- For production, use a managed PostgreSQL provider of your choice, unique secrets, TLS, least-privilege database roles, scheduled backups with restore drills, rate limiting at the edge, monitoring, and a reviewed migration pipeline. Do not deploy the development credentials from `compose.yaml`.
- This repository currently uses application-level authorization. Review the SQL row-level security policies against the actual deployment database role before enabling forced RLS; a forced policy with no matching app policy can break normal workflows.

## Metrics: definitions and limitations

- **Data X assigned institutions**: institutions linked to the current account through the institution/membership model; it is not a count of all institutions in the database.
- **Data X import batches**: import metadata records. Creating a batch does not mean its file has been uploaded, validated, or committed.
- **Data X validated/committed batches**: batches in the validated or committed states; these are workflow counts, not counts of valid rows.
- **Data X aggregate measures**: metric-record rows. This is not the number of unique metric types, students, or institutions.
- **MORANS published events**: events whose status is `published`; it does not mean registration is currently open.
- **MORANS applications/submissions**: distinguish submitted records from drafts. Any UI label that counts both should be interpreted as records, not completed submissions.
- **MORANS accepted judge assignments**: accepted assignments, not completed evaluations. Evaluation completion should be counted separately by evaluation status.
- **Admin directory lists**: current admin screens cap some lists at 200 rows. Counts shown from those lists are not reliable global totals unless separately queried with `COUNT(*)`.

## Seven-phase delivery checklist

1. **Environment and identity migration** — local PostgreSQL, `.env.example`, no third-party auth dependency, app-owned accounts/sessions/roles, bootstrap administrator.
2. **Authentication and roles** — hashed passwords, expiring revocable sessions, no public self-promotion, separate role gates and safe redirects.
3. **Data X ingestion** — CSV upload/validation/commit must be treated as a separate release gate; validate headers/types/periods, detect duplicates, preserve source checksum, and make commit transactional/idempotent.
4. **MORANS workflows** — test participant, host, organiser, judge, assignment, evaluation, and publication transitions with ownership checks.
5. **Security and authorization** — test unauthenticated access, role boundaries, input validation, SQL parameterization, CSRF protections, rate limits, audit coverage, and dependency audit.
6. **Operations and deployment** — production secrets, migrations, backups and restore drill, health checks, logging, error handling, rollback plan, TLS and least privilege.
7. **Usability and pilot** — keyboard/accessibility review, actionable validation errors, loading/empty/error states, metric definitions, end-to-end pilot and acceptance sign-off.

A checked item is not considered complete merely because a page renders; it needs automated tests and a manual end-to-end run against PostgreSQL.
