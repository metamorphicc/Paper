# Vercel application deployment

The application uses PostgreSQL for durable Community points, one-time challenges, signed participation, protocol snapshots and indexed PAPER activity. Desktop development can retain its existing SQLite data. Hosted requests do not open a SQLite file, use `/tmp` as a fake database, or reset campaign state on cold start.

## Connect the database

1. In the Vercel project, connect a PostgreSQL database such as Neon through the Marketplace/Storage integration. Connect it to this project and the intended deployment environments.
2. Confirm that the server-side `DATABASE_URL` environment variable is populated. `POSTGRES_URL` is also supported. Do not add a `NEXT_PUBLIC_` prefix or paste credentials into chat/source control. Use the provider's pooled connection URL for serverless requests.
3. Set `PAPERCLUB_APP_ORIGIN=https://paper-sooty.vercel.app` for the production domain. Exact HTTPS origins from Vercel's production/deployment URL variables are recognized too. Configure custom domains explicitly.
4. Use Root Directory `apps/web`, Node 24.x, and allow source files outside that directory. Keep Build Command `npm run build` and install devDependencies. The workspace declares its runtime/build dependencies directly.
5. Push the reviewed local commits yourself and deploy. No push or deployment is performed automatically by this repository's development workflow.

The `prebuild` step loads Next environment configuration, validates the hosted database/origin setup, applies additive transactional schema migrations, then checks schema version before webpack runs. Missing/unreachable database configuration fails the build with an operator-facing explanation. It does not publish a Community page with permanently disabled controls or silently switch a hosted campaign to local memory.

To prepare a configured database separately, run `npm run db:migrate` from the repository root. It runs the same preparation script in the web workspace. Existing tables/data are retained; migrations are serialized with a PostgreSQL transaction/advisory lock. The connection must have permission to create the application tables/indexes.

## Verify the result

`GET /api/health` must return HTTP 200 with `status: ready`, `storage: postgres`, `schemaVersion: 1`. Then verify `/leaderboard`, `/api/campaign`, market/profile reads and a signed Join. A challenge issued before a function restart must still be claimable afterwards; replay must not increase points. `/api/intents` remains behind its independent financial release gate.

`npm run qa:hosted` runs the compiled production application against a local PostgreSQL WASM engine over TCP using the actual pg driver. It checks all seven routes, public HTTPS-origin challenge/claim, restart persistence, replay, foreign-origin rejection, leaderboard data and unchanged financial gating. It verifies that no local database directory is created. This is not a deployed Neon/Vercel test. `--preview` retains the owned local process until a line is sent on stdin for browser QA.

Database TLS requires certificate verification for remote hosts. Host/credential/TLS query-parameter overrides are rejected; driver errors and credential URLs are not returned to clients. Origins are bound to an explicit configured host; untrusted forwarded-host headers do not authorize requests. Challenge rates and consumption are transactional in the shared database. The process-local read limiter is supplementary and does not replace provider firewall/rate controls or prove unique humans.

Database backups, retention, regional placement and production account access must be configured in the selected provider. No actual token budget, treasury address or financial release decision is inferred from a successful application deployment.

References: [Vercel filesystem behavior](https://vercel.com/docs/functions/runtimes#file-system-support), [Neon/Vercel integration](https://neon.com/docs/guides/vercel-overview), [node-postgres transactions](https://node-postgres.com/features/transactions).
