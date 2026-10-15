# Scheduled application operations

Two GitHub Actions workflows are prepared and locally checked. They have not been pushed, activated or run on GitHub by the agent. They do not trade, deploy contracts, fund claims, change tokenomics, or deploy the website.

| Workflow | UTC schedule | Asia/Novosibirsk | Work |
|---|---|---|---|
| Application operations | Minutes 7, 22, 37, 52 each hour | Same minutes | GET-only application probe, pinned upgrade check, bounded confirmed indexing, worker/backup freshness |
| Encrypted database backup | 03:41 daily | 10:41 daily | Consistent export, encryption, full scratch restoration, encrypted artifact upload |

Both support manual workflow_dispatch. Schedules run on the repository's default branch and can be delayed or dropped; public-repository schedules may be disabled after inactivity. This cadence is not an uptime guarantee. Workflow concurrency prevents overlapping runs of the same workflow; database indexing remains atomic/idempotent if a local command overlaps. Failed/behind runs exit nonzero. There is no new public administrative endpoint or cron bearer secret.

## Account setup

1. Push/review the prepared commits yourself and put the workflow files on the repository's default branch. The agent performs no push, merge or deployment. A feature-branch push alone does not activate scheduled runs.
2. In GitHub repository Settings → Environments, create `production-operations`. Restrict deployment branches to the default branch. Per-run required approvals can prevent unattended schedules; choose controls appropriate to your account.
3. Add environment secrets under `production-operations`: DATABASE_URL (the application's pooled PostgreSQL URL, not its website URL); BACKUP_ENCRYPTION_KEY (32 random bytes as 64 hexadecimal characters); optionally HYPEREVM_ARCHIVE_RPC_URL (your production archive provider). The public research RPC default has no availability/capacity commitment. The database must already be migrated.
4. Generate the backup key **locally**, then keep a separate secure recovery copy outside GitHub. Command: `node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"`. Do not run key generation in CI, paste its output into chat or commit the key. Do not add it to public Vercel variables.
5. Under Settings → Secrets and variables → Actions → Variables, optionally set PAPERCLUB_APP_ORIGIN to the actual public HTTPS origin. Default: `https://paper-sooty.vercel.app`.
6. Review Actions runner allowance/billing and provider limits, then set the **repository variable** PAPERCLUB_OPERATIONS_ENABLED to `true`. Every-15-minute runs can consume substantial runner minutes; adjust cadence/batch limits to measured workload and budget. Slower scheduling may require more catch-up capacity.
7. Manually run **Encrypted database backup** first, then **Application operations**. Check the first successful runs, download the encrypted artifact/verification report, and confirm recovery with the separately retained key. Local tests do not prove account artifact retention/access/recovery configuration.
8. Configure your own GitHub workflow-failure notifications, provider firewall/monitoring and Neon backup/restore retention. No email, Slack message or external notification subscription was created by this work.

Dependencies install with npm ci --ignore-scripts before database secrets are passed to individual steps. Actions are pinned to immutable commit SHAs, contents permission is read-only and checkout credentials are not persisted. Artifact paths contain only encrypted database files or safe operation metadata. Do not broaden upload paths to data/**.

## Coverage and monitoring

The worker verifies archive capability/chain 999 and eight implementations at one confirmed block against the reviewed manifest. Drift fails the job and stops indexing; the manifest is never automatically refreshed. This does not verify source or settlement. The Transfer reader rechecks the token runtime and canonical anchor before atomic persistence.

Scheduled indexing defaults to 16 batches: up to 128 headers per batch, 12-block replay overlap, 50-block log requests, three confirmations and an eight-minute budget before starting another batch. An in-flight batch is bounded by RPC/database timeouts and the workflow's 12-minute limit. Exhaustion reports behind, not full coverage. First-run coverage is a recent window; it does not establish lifetime rankings. Historical backfill requires a reviewed INDEX_FROM_BLOCK. Error output omits transport URLs/credentials.

Results are stored in shared snapshots. `npm run ops:status` reports degraded if index/upgrade evidence is missing, not caught up, over one hour old, or a worker failure follows the last successful index. Verified exports must be less than 36 hours old. This check explicitly does not establish offsite upload: confirm the separate artifact-upload step succeeds. Financial release gates stay false.

## Encrypted recovery

`database:backup:encrypted` exports a repeatable-read snapshot, encrypts it in memory with AES-256-GCM and a fresh random nonce, writes ciphertext, reads that file back, authenticates it and restores all exported tables into a separate PostgreSQL WASM engine over TCP. Full table comparison must pass before upload. Limits: 100,000 rows/table and about 20 MB plaintext. Use provider backups/PITR for larger data and recovery points between exports.

1. Download an encrypted artifact from a successful run; preserve the original database and artifact. Obtain the matching key from separate secure storage without logging it.
2. Provision a **separate new database**. Set its DATABASE_URL in your shell and run `npm run db:migrate`. Never point recovery commands at the running production database.
3. Set BACKUP_FILE to the downloaded `.encrypted.json` file and BACKUP_ENCRYPTION_KEY to the matching key. Run `npm run database:restore:encrypted`.
4. Restore rejects altered ciphertext, wrong keys/schema and any nonempty target application table. Inserts/sequence counters are transactional. Check participant totals, used-challenge replay protection, snapshots and index coverage. `npm run qa:backup` proves these with two isolated PostgreSQL fixtures and signed test data; no production user key is used.
5. After reviewing the restored result, change application database configuration through your normal reviewed deployment process, then rerun monitoring/indexing. This tool never overwrites existing production data.

The key is not in the artifact. Retain old keys while their exports are retained; losing the key makes its export unrecoverable. Artifact retention defaults to 14 days. Encryption and local restore verification do not establish provider SLA, independent audit, production load capacity or financial launch approval.

References: [GitHub schedules](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets), [artifacts](https://docs.github.com/en/actions/tutorials/store-and-share-data), [Neon restore](https://neon.com/docs/postgres/backup-restore/branch-restore), [Node crypto](https://nodejs.org/api/crypto.html#cryptocreatecipherivalgorithm-key-iv-options).
