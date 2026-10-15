# Vercel application deployment

The application uses PostgreSQL for durable Community points, one-time challenges, signed participation, protocol snapshots and indexed PAPER activity. Desktop development can retain its existing SQLite data. Hosted requests do not open a SQLite file, use `/tmp` as a fake database, or reset campaign state on cold start.

## Connect the database

For a first Neon database, the current native-integration path is:

1. Open [Neon Postgres in the Vercel Marketplace](https://vercel.com/marketplace/neon), click Install, then choose Create New Neon Account and Continue if you do not already have an account.
2. Select a plan and region close to the application's Vercel Functions region, then name the database `paperclub`. Review the displayed plan terms before creating it.
3. Open Storage → the new database → Connect Project. Select `paper-sooty`, enable Production, and click Connect. Keep the environment-variable prefix empty so the application receives DATABASE_URL. For Preview deployments, enable isolated Preview Branching rather than sharing production data.
4. In `paper-sooty` → Settings → Environment Variables, confirm DATABASE_URL exists for Production. The native integration supplies the pooled URL. Do not copy its value into source code or chat.
5. Add PAPERCLUB_APP_ORIGIN with value `https://paper-sooty.vercel.app` to Production. A custom production domain must use its actual HTTPS origin instead.
6. Check the application build settings below, then deploy the new code after pushing it yourself. Redeploying an old commit will not include the PostgreSQL fix. Tables are created by the existing prebuild step; no manual SQL/Prisma command is needed.
7. Open `https://paper-sooty.vercel.app/api/health`: expect HTTP 200 and status `ready`, storage `postgres`, schemaVersion `1`. Then open `/leaderboard` and test signed participation.

These UI labels and variable behavior are described in [Neon's native integration walkthrough](https://neon.com/docs/guides/vercel-managed-integration). No remote database has been provisioned by local development checks.

Application configuration requirements:

1. In the Vercel project, connect a PostgreSQL database such as Neon through the Marketplace/Storage integration. Connect it to this project and the intended deployment environments.
2. Confirm that the server-side `DATABASE_URL` environment variable is populated. `POSTGRES_URL` is also supported. Do not add a `NEXT_PUBLIC_` prefix or paste credentials into chat/source control. Use the provider's pooled connection URL for serverless requests.
3. Set `PAPERCLUB_APP_ORIGIN=https://paper-sooty.vercel.app` for the production domain. Exact HTTPS origins from Vercel's production/deployment URL variables are recognized too. Configure custom domains explicitly.
4. Use Root Directory `apps/web`, Node 24.x, and allow source files outside that directory. Keep Build Command `npm run build` and install devDependencies. The workspace declares its runtime/build dependencies directly.
5. Push the reviewed local commits yourself and deploy. No push or deployment is performed automatically by this repository's development workflow.

The `prebuild` step loads Next environment configuration, validates the hosted database/origin setup, applies additive transactional schema migrations, then checks schema version before webpack runs. Missing/unreachable database configuration fails the build with an operator-facing explanation. It does not publish a Community page with permanently disabled controls or silently switch a hosted campaign to local memory.

To prepare a configured database separately, run `npm run db:migrate` from the repository root. It runs the same preparation script in the web workspace. Existing tables/data are retained; migrations are serialized with a PostgreSQL transaction/advisory lock. The connection must have permission to create the application tables/indexes.

## Verify the result

`GET /api/health` must return HTTP 200 with `status: ready`, `storage: postgres`, `schemaVersion: 1`. Then verify `/leaderboard`, `/api/campaign`, market/profile reads and a signed Join. A challenge issued before a function restart must still be claimable afterwards; replay must not increase points. `/api/intents` remains behind its independent financial release gate.

`npm run qa:hosted` runs the compiled production application with VERCEL=1 against a local PostgreSQL WASM engine over TCP using the actual pg driver. It first proves missing-database preparation fails, then prepares a fresh database using the actual prebuild script. Seventeen HTTP scenarios cover all seven routes, public HTTPS-origin challenge/claim, restart persistence, replay, foreign-origin rejection, leaderboard, protocol/market/readiness data and unchanged financial gating. It verifies no local database directory is created. This is not a deployed Neon/Vercel test. In an interactive terminal, `--preview` retains a loopback preview until a line is sent on stdin for browser QA; it disables the simulated Vercel host restriction for that local browser view only.

Database TLS requires certificate verification for remote hosts. Host/credential/TLS query-parameter overrides are rejected; driver errors and credential URLs are not returned to clients. Origins are bound to an explicit configured host; untrusted forwarded-host headers do not authorize requests. Challenge rates and consumption are transactional in the shared database. The process-local read limiter is supplementary and does not replace provider firewall/rate controls or prove unique humans.

Database backups, retention, regional placement and production account access must be configured in the selected provider. No actual token budget, treasury address or financial release decision is inferred from a successful application deployment.

## Indexing, reward snapshots and data transfer

`npm run index` and `npm run rewards:snapshot` select the same PostgreSQL connection when DATABASE_URL/POSTGRES_URL is present in the shell. Otherwise they use desktop SQLite. Do not run an operator command against a different database from the website. Indexing uses atomic per-chain transactions, contiguous coverage/reorg checks, bounded rows, exact raw token amounts and idempotent inserts; conflicting canonical events stop the batch. No scheduler has been created. Arrange operator runs or a reviewed production job before advertising continuous indexed history.

`npm run database:backup` creates a consistent logical export under ignored `data/backups` with a checksum. PostgreSQL exports use a repeatable-read, read-only snapshot. The bounded format supports at most 100,000 rows per table and about 20 MB; use the provider's backup/PITR tools for larger databases. It includes campaign challenges/points and indexed state but no database credentials or user wallet keys. Treat it as private operational data and keep it outside Git/public hosting.

To restore, provision a separate fresh database, run migrations, set its DATABASE_URL and BACKUP_FILE in the shell, then run `npm run database:restore`. Any nonempty application table rejects the restore; existing production data is never truncated or replaced. All inserts and sequence-counter restoration run in one transaction. The checksum detects accidental changes; it does not authenticate an untrusted backup publisher. Restore tests verify points, replay protection, exact amounts, snapshots and future serial inserts. `data:backup` remains a desktop SQLite tool and refuses to run when a shared database is configured.

References: [Vercel filesystem behavior](https://vercel.com/docs/functions/runtimes#file-system-support), [Neon/Vercel integration](https://neon.com/docs/guides/vercel-overview), [node-postgres transactions](https://node-postgres.com/features/transactions).
