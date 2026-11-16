# Migration status and release gates

This file distinguishes implemented changes from work that still needs live integration testing. Passing static tests is not the same as a production release approval.

| Phase | Status in this revision | Evidence / remaining release gate |
|---|---|---|
| 1. Environment and identity | Implemented in source | Local PostgreSQL compose file, `.env.example`, SQL identity/session/role tables, Neon-specific code/dependency removal, database setup script, clean-install admin bootstrap. Run the setup commands on Windows to verify against Docker PostgreSQL. |
| 2. Authentication and dashboard roles | Implemented baseline | `scrypt` password hashes, hashed random session tokens, seven-day expiry, server-side session lookup/revocation, login attempt throttling, independent dashboard roles, server-side role gates. Needs live sign-up/sign-in/session-expiry/role-boundary tests. |
| 3. Data X import pipeline | Not production complete | Current import action creates a draft metadata record only. A real CSV upload, row-level validation, duplicate handling, transactional commit, rollback and retry/idempotency tests are required before imports can be described as working. |
| 4. MORANS workflow | Existing workflow code retained; not end-to-end certified | Test participant applications/submissions, host verification, event publication, judge assignment and submitted evaluations with separate users and ownership boundaries against PostgreSQL. |
| 5. Security and authorization | Baseline tests added; full security review outstanding | `pnpm test:security` covers source/schema invariants. Add integration tests for unauthorized server actions, cross-account data access, malformed inputs, brute-force controls, audit log coverage and dependency vulnerabilities. |
| 6. Operations and deployment | Local runbook added; production deployment outstanding | Need Docker verification, clean build, environment/secret review, least-privilege database role, backup/restore drill, deployment health checks, logs, rollback and TLS configuration. |
| 7. UX and pilot | Metric definitions/runbook added; usability acceptance outstanding | Conduct keyboard/screen-reader checks, test empty/error/loading states, verify metric calculations with seeded test fixtures, and run a pilot acceptance checklist. |

## What was actually tested in this environment

- Seven Node built-in test cases pass (`node --test tests/*.test.mjs`).
- `package.json` parses as JSON and `pnpm-lock.yaml` parses as YAML.
- The admin and database setup JavaScript files pass `node --check` syntax checks.
- Application and lockfile scans show no external auth provider package/config references.

Docker, `psql`, installed project dependencies, and network access are unavailable in the current execution environment. Therefore PostgreSQL integration, `pnpm typecheck`, `pnpm build`, browser flows, and the production release gates have **not** been run here. Do not treat this revision as production-approved until those checks pass on the Windows development machine and CI.
