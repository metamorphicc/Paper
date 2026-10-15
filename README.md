# Paperclub

HyperEVM community hub: protocol overview, public address profiles, signed points, trading sandbox, token/rewards proposals and strategy research. Hosted application state uses PostgreSQL; desktop development also supports SQLite. The site uses English and UTC. Development branch: `paperclub-development`. **Local commits only; no push or publication.**

## Start

Requires Node.js 24.11.1+ and npm. Dependencies are pinned in the lockfile.

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run dev
```

Open `http://127.0.0.1:3000`. The server binds to loopback. `npm.cmd run index` adds bounded PAPER Transfer coverage to the configured database. Profiles need no wallet or signature; points participation uses an origin-bound EIP-191 proof. For Vercel, connect a PostgreSQL database, configure the public origin and follow [the deployment guide](docs/VERCEL.md). Prebuild prepares/checks the schema before publishing.

## Implemented locally

- Seven English pages: Overview, Terminal, Profile, Community, Treasury, Rewards and Research.
- Actual protocol/API/RPC reads and BTC/ETH prices; source/time/block tracking. Available USDC, queued USDC, PAPER and rewards remain separate.
- Isolated signed trading/staking/withdrawal sandbox with virtual funds, stable-ID retry, cancel, expiry and session revoke. Public demo keys are never intended for funds.
- Fixed-supply token, immutable funded Merkle claim and bounded treasury contracts; compiled and deployed only to in-process simulated chain 31337 for tests.
- Deterministic campaign snapshots and proof inspector. Tokenomics is **unselected**; CLUB and a 1-billion cap are test proposals. Existing points provide no token rights.
- Sequential path model, completed-candle replay and cash-only vault accounting research. No actual vault custody/deposits. PAPER has no assumed cash value.
- Bounded API I/O, local request guards, upgrade checks, online SQLite backup/restore and incident playbook.
- Explicit deployment-plan validation, self-contained compiler/source package and isolated deployment/funding/claim/treasury rehearsal. Public deployment parameters remain unset.
- Durable PostgreSQL Community/challenges/points, public origin guards, shared indexer/snapshots, readiness endpoint and bounded consistent export/fresh-target restore.

## Checks

```powershell
npm.cmd run check
npm.cmd run check:web
npm.cmd test
npm.cmd run contracts:compile
npm.cmd run build
npm.cmd audit
npm.cmd run launch:check
npm.cmd run release:prepare
npm.cmd run release:package
npm.cmd run release:verify
npm.cmd run release:rehearse
npm.cmd run qa:hosted
# With a local server running:
npm.cmd run smoke:web
```

65 tests and 17 production HTTP scenarios with a simulated Vercel environment passed, including a signed challenge surviving a Next process restart against a real local PostgreSQL engine over TCP. Community passed five responsive widths with active controls. Earlier local HTTP/browser evidence is retained in [current validation](docs/VALIDATION.md). The current Papertrade intakeControls read schema is supported. The official HTTP/signing adapter remains behind financial release gates; real Papertrade settlement is unverified. See [adapter substeps](docs/LIVE-ADAPTER.md). A Neon database/Vercel deployment has not been provisioned or tested by the agent.

Public-money launch is blocked: source/ABI/domain/collateral/relayer settlement and exact API/RPC reconciliation remain unverified; tokenomics, budgets/recipients and independent audit are outstanding. Live trade/staking, public claims, deposits, buybacks and deployment remain disabled. The launch checker records missing evidence and cannot deploy anything.

## Tools and documents

`strategy:replay` captures historical-price scenarios; `monitor:upgrades` compares implementations; `data:backup` verifies scratch restore; `rewards:snapshot` requires explicit CLAIM_CONTRACT and SNAPSHOT_BUDGET_RAW. These commands do not trade or deploy to mainnet. Indexer and monitoring are manual, with no installed scheduler.

`db:migrate` prepares a configured PostgreSQL schema. `database:backup` exports the selected shared/local database; `database:restore` requires BACKUP_FILE and a fresh empty migrated target. Exports are bounded review/transfer tools; configure production backups/PITR in the selected provider. Standalone indexer/backup/snapshot commands read database variables from the shell, and use the same database as the website. Existing desktop SQLite files are preserved; they are not silently uploaded to a provider.

- [Sequential continuation and commits](docs/CONTINUATION.md)
- [Tokenomics proposals](docs/TOKENOMICS.md)
- [Strategy and vault research](docs/STRATEGY.md)
- [Security findings and launch blockers](docs/SECURITY.md)
- [Operations and recovery](docs/OPERATIONS.md)
- [Deployment preparation and local rehearsal](docs/DEPLOYMENT.md)
- [Vercel database setup and readiness](docs/VERCEL.md)
- [Original plan](docs/PLAN.md), [assessment](docs/ASSESSMENT.md), [integration evidence](docs/INTEGRATION.md)

SQLite Node 24 is experimental; coverage is partial and not a lifetime ranking. Runtime databases/backups, environment files, build outputs and generated contract artifacts are ignored. Standalone scripts read environment variables from the shell; Next reads its own environment files. No private key is needed for reads, indexing or backups.
