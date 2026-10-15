# Current local validation

14 October 2026. Branch `paperclub-development`; local commits only. No push, hosting publication, mainnet deployment or real financial transaction.

- 44 tests passed: protocol/economics, campaign proof/replay, canonical index/reorg/backup, actual local EVM token/claims/treasury, deterministic Merkle claims, path and vault accounting, request guards, upgrade/readiness and wallet-error mapping.
- Root and web TypeScript checks passed. Prettier check passed. npm audit reports zero known vulnerabilities; toolchain tmp is pinned to patched 0.2.7.
- Seven English pages, metadata, errors and accessibility labels. UTC dates. Source and browser checks found no Cyrillic product text. All seven pages checked at 320 / 375 / 414 / 768 px: 28 checks without horizontal overflow. Browser Research scenario/metric switching shows cash and economic equity separately.
- HTTP smoke checks seven pages, protocol/market/campaign and two public profiles; active profile has 75 completed trades and RPC pendingReward. Invalid input, foreign Origin and oversized POST rejected; official live intent API remains 403.
- Contract compilation: solc 0.8.37, optimizer 200 runs, Cancun target, OpenZeppelin 5.6.1. Deployments only inside simulated chain 31337. Hyperevm-specific validation and independent audit remain absent.
- Manual upgrade check: eight implementation addresses/runtime hashes unchanged at block 48519192. Source verification remains false. SQLite backup quick_check and isolated restore/table counts passed; 689 indexed events, 31 snapshots at backup time. The live database was not replaced.
- Replay: 673 completed BTC candles with contiguous 15-minute times and hashed input. Current protocol parameters used as explicit assumptions. The paired case lost about $416 on hypothetical $2,000 while around $429 remained queued; this does not establish performance or approved capital limits.

Evidence: `research/http-smoke.json`, `dependency-audit.json`, `local-contracts.json`, `path-replay.json`, `upgrade-check.json`, `backup-validation.json`, `launch-readiness.json`; browser evidence in `artifacts/qa/english-*.json` and screenshots. Historical QA documents/snapshots describe earlier stages and are not current metrics.

Public-money decision: **Do not launch**. Tokenomics, budgets and actual recipients are unselected; verified protocol source/domain/collateral/third-party settlement, exact reconciliation, contract-wallet support, independent audit, real HyperEVM settlement and production operations remain unresolved. Token/claims/treasury prototypes and cash-only vault model are review artifacts. There is no deployable public vault or funded claim campaign.

## Subsequent UI correction

After stage 6 was committed, slogan headings were replaced with functional section names across the site. Wallet feedback supports a dismiss button, Escape, six-second automatic expiry and clearing on route/account/network changes. Browser checks confirmed dismiss, Escape, timed expiry and navigation reset, plus popup containment at 320/375/414/768 px. All seven page headings were verified in English with no wallet message on entry. Evidence: `artifacts/qa/ui-followup.json` and `ui-clean-research.jpg`. Web typecheck/format check and the updated production build passed.

## Horizontal application design revision

The rejected warm palette was replaced with the original light Cobalt system. Sidebar navigation became a top application bar with a mobile menu. Overview now uses real public BTC/ETH BBO quotes and 15-minute candles, selectable 1h/24h windows, pointer inspection, background refresh and explicit loading/unavailable/cached states. Links select the correct market in Terminal. Research, community and reward controls remain operational.

- Production build and web TypeScript checks passed; 44 existing tests passed.
- 35 browser layout checks: seven routes at 320, 375, 414, 768 and 1280px. No horizontal overflow or protruding visible content; every direct section gap is 24px mobile or 32px larger. This verifies the specific touching-block bug, beyond just viewport overflow.
- Mobile menu closes on route change; background main/footer are inert while open. Wallet error dismissal still removes the popup. Research scenario selection updates modeled balances. Overview period selection changes the plotted candle window. ETH market link opens Terminal with ETH selected.
- Twelve contrast checks passed: text >=4.5:1; controls/focus >=3:1. Exact colors are in tokens.css; evidence is in artifacts/design/contrast.json.
- HTTP smoke passed 19 checks, including seven pages, public market/profile data and origin/body-size/write guards.
- Browser evidence: artifacts/design/overview-full.jpg and research-spacing.jpg. Source/reference evidence remains separate from runtime data; no source video published.

This validates the local design revision. Source equivalence, EIP-712 domain, relayer access, contract-wallet settlement, capital choices and a public-money pilot remain unresolved.

Read-only integration follow-up: root/web typechecks passed. The domain reader observed the PaperStaking public separator matching the expected domain at block 48531432; Exchange remains unavailable through the tested getters. Chain ID, implementation/runtime hashes, actual separators and block hash are retained in research/signature-domains.json. No signature, transaction or relayer POST was submitted, and no feature gate changed.

## Treasury and RPC continuation validation

- Root/web typechecks, production build and all 49 tests passed (44 earlier tests + archive canary + four treasury receipt tests).
- 21 HTTP checks passed, including `/api/treasury`, foreign-origin rejection and explicit latest-state provenance on profile RPC rewards.
- Treasury UI verified at 320, 375, 414, 768 and 1280px: English text, no horizontal overflow, 24/32px direct-section gaps. Evidence: artifacts/design/treasury-responsive.json and treasury-receipts.jpg.
- The confirmed-transfer pipeline was tested with actual receipts on local EVM chain 31337. It did not use user wallets, keys, actual capital, HyperEVM deployments or relayer writes.
- A public PAPER sample exposed latest-state substitution on the default RPC. That experiment is invalid historical accounting evidence and is labelled accordingly. Current readers do not silently reuse it.
- Live treasury results require explicit reviewed addresses/assets and an archive provider passing capability/consistency checks. These values remain unselected. Revenue, buybacks and burns are not inferred from transfer logs.

## Launch blocks 1–2 implementation validation

- Public dRPC archive canary passed. Four named summary fields matched at block 48510016. A 128-block public PAPER/PaperStaking window reconciled 38 transfers with zero boundary discrepancy. This is not a configured Paperclub treasury or complete protocol reconciliation.
- Current official assets were captured as data with source URLs and hashes; client build 32abe9f9c6a6. Verified source/ABI, Exchange/cancellation domains and actual relayer/collateral/session/contract-wallet settlement remain incomplete.
- All 53 package tests passed, including real loopback HTTP wire checks, signed retry, authority invalidation and retention of the original ID after rejected cancellation. These use local test keys only.
- 26 HTTP checks passed. Submit/cancel stay 403, unknown status stays explicitly unconfirmed, and readiness exposes eight blockers. Root/web typechecks, Prettier and production build passed.
- Trading UI passed five viewport widths (320/375/414/768/1280), English text, containment, 24/32px section spacing and disabled financial controls. Evidence: artifacts/design/trading-responsive.json and trading-connection.jpg.
- No real user signature, deposit, order, staking, withdrawal or cancellation was submitted. Launch blocks 1–2 are implemented in part and remain open for external verification and full lifecycle settlement.

## Deployment preparation continuation

- All 59 package tests pass (six added deployment/compiler/rehearsal tests), root TypeScript and formatting pass. Self-contained compiler package reproduces three artifacts from 18 bundled sources with no import/network callback. Imported-source changes and runtime changes are detected.
- Actual local EVM chain 31337 rehearsal verifies nonce/address binding, creation input, runtime/immutable getters, exact token supply/allocations, funded claims, recovery and six-decimal treasury receipts. Nine successful receipts, eight denied actions, and separate nonce-drift/constructor-substitution aborts are recorded.
- Treasury cash reconciles 100 test USDC received, 10 spent and 90 remaining. Test fixture state predating deployment is not treated as a callable zero balance; the receipt window starts at its creation block. No revenue or protocol settlement is inferred.
- Preparation reports 17 missing public parameters. Launch remains blocked on 16 gates including deployment-parameter completeness; fixture evidence is explicitly not public launch evidence. No API/UI/dependency changes required a new browser/build run. Earlier 26 HTTP checks and responsive evidence describe the preceding website change.
- Evidence: research/deployment-plan.json, deployment-rehearsal.json, launch-readiness.json and artifacts/release/{standard-input,compilation}.json. No private key, user wallet, public-chain transaction, independent audit or Papertrade source verification was used/claimed.

## Web workspace dependency fix

The user's Vercel `Can't resolve 'viem'` failure was reproduced with the original manifests in an isolated copy installed with `npm ci --workspace=@paperclub/web --include-workspace-root=false --include=dev --ignore-scripts`. The web workspace now explicitly declares viem and its TypeScript/Node-type build dependencies; lockfile updated with no version upgrades. In a separate temporary checkout, the same scoped install and complete `next build --webpack` passed; normal web typecheck and git diff checks passed too. Verification ran on Windows/Node 24.11.1/npm 11.3.0, without copied node_modules, environment files or runtime databases. No UI behavior changed, remote push or hosted deployment was performed. Build instructions: LOCAL_APP.md.

## Persistent hosted application continuation

- The public Community URL returned HTTP 500/digest 2650510194. Its code unconditionally depended on local writable SQLite/repository discovery; no hosted database was connected. The user rejected permanent unavailable-component placeholders, so the runtime now selects a durable PostgreSQL backend with real signed participation and build-time configuration/schema validation.
- All 65 package tests passed. Added coverage uses the actual pg TCP driver against PostgreSQL WASM (PGlite), shared/cold clients, atomic replay/rollback/expiry/rates, exact amounts, indexer concurrency/reorg/conflicts and consistent export/fresh-target restore with sequence counters. This is not a remote Neon cluster or a substitute for provider load testing.
- Root/web TypeScript, formatting and production build passed. Seventeen production HTTP scenarios with VERCEL=1 passed: actual prebuild rejects missing connection, migrates a fresh database, all seven pages load, a signed challenge survives server restart, points persist, replay/foreign origins are rejected, public protocol/market/readiness reads work, and financial writes remain blocked. No local SQLite directory was created.
- Community browser checks passed at 320/375/414/768/1280px: test-wallet entry displayed, Join/quiz controls enabled, English text, no horizontal overflow and 24/32px spacing. Evidence: artifacts/design/community-postgres.jpg and community-postgres-responsive.json. No user wallet prompt/signature was used.
- Live API checks exposed the upstream intakeControls schema change. Current official JSON and browser-observed decoder assets confirm the new three-field mapping; a strict backward-compatible parser and regression test restore protocol/market reads. No new write build/source/settlement approval is inferred.
- Evidence: research/hosted-runtime-qa.json, current-trading-state.json, current-trading-schema-evidence.json. Production database provisioning, actual Vercel deployment and provider backup/firewall/monitoring configuration remain external tasks. See VERCEL.md. No push, publication or financial action was performed.
- A separate clean temporary source copy passed `npm ci --workspace=@paperclub/web --include-workspace-root=false --include=dev --ignore-scripts --no-audit --no-fund` and the full web production build without root research dependencies, copied node_modules, environment files or runtime databases. This verifies scoped dependency installation/build separately from the strict hosted PostgreSQL runtime scenarios above.

## Production operations continuation

- The actual public deployment passed 13 GET-only HTTP/response-contract checks on 15 October 2026: seven pages, ready/PostgreSQL health, campaign data, disabled financial release, fresh protocol summary and BTC/ETH quotes. Evidence: research/production-application-check.json. No participant, user signature or intent was created; production signed participation is not claimed.
- Public archive RPC rehearsal with a separate PostgreSQL fixture compared eight pinned implementation addresses/runtime hashes, then indexed 64 confirmed blocks/49 Transfer events. Evidence: research/operations-chain-qa.json. No production database access or financial write occurred; partial coverage is explicit.
- All 70 package tests pass. Five new tests cover the application probe, bounded archive worker and restart/replay/error paths, operations freshness/failure recovery and authenticated backup encryption/restoration. Root/web typechecks and formatting pass. These operator-only additions do not change the website UI; the preceding production build/responsive evidence remains the relevant UI validation.
- The real encrypted backup CLI wrote only ciphertext, read it back, authenticated and fully restored tables in a scratch engine before success. A second isolated target restored points=10, rejected used-challenge replay, preserved exact raw snapshot values and rejected nonempty-target restore. Evidence: research/encrypted-backup-qa.json. Wrong keys/tampering are unit-tested. Credentials/key were not printed; no production export, restore or GitHub upload was performed.
- Both workflow files passed actionlint 1.7.12. Its official release zip matched the published SHA-256 checksum before execution. checkout v7.0.1, setup-node v7.1.0 and upload-artifact v7.0.2 tags were resolved through official GitHub release/ref APIs and pinned to immutable commits; action metadata inputs were checked. No GitHub workflow was activated or run; actual runner/provider account integration remains to be validated after owner setup/push.
