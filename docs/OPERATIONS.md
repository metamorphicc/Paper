# Local operations and incident playbook

This workspace runs on loopback and has no public scheduler, hosting or mainnet write path. Secrets belong in ignored environment files, not research reports. No private key is required by read/index/backup scripts. The local EVM uses in-process simulated chain 31337; no remote RPC is configured there.

## Routine checks

```powershell
npm.cmd run monitor:upgrades
npm.cmd run data:backup
npm.cmd run index
npm.cmd run check
npm.cmd run check:web
npm.cmd test
npm.cmd audit
```

Upgrade checks compare all eight implementation addresses/runtime hashes against the saved manifest on one RPC block. Exit 0 means unchanged, 2 means changed, 1 means unavailable. Unchanged code does not mean verified source or safe trading. A changed or unavailable report never enables writes. Check is manual; no automatic background schedule or notifications are installed.

Indexer validates contiguous canonical headers and overlapping logs. It stops on an unsupported upgrade, cursor gap or reorg outside the overlap. Coverage is partial; do not reset the start block or publish lifetime results from it. Capture a fresh manifest only after review of the new implementation/source/domain.

`data:backup` uses SQLite online backup, SHA-256, quick_check and restoration into an isolated scratch directory. It compares event/snapshot counts and reports coverage. It does not replace the running database. Backups and their manifests remain under ignored `data/backups/`; `research/backup-validation.json` contains public validation metadata. Full production retention/encryption/off-device backup policy is not configured.

## Recovery procedures

1. Stop the owned server with Ctrl+C before any manual restore. Preserve the current SQLite, WAL/SHM and a validated backup. Never overwrite the only copy.
2. Choose a backup whose manifest, SHA-256 and quick_check pass. Restore it to a new data directory and set PAPERCLUB_DATA_DIR to that directory. Leave the original intact.
3. Start the local app and verify balances/source timestamps, campaign totals and index coverage. Run the indexer to replay from the restored cursor; idempotence/reorg tests must still pass.
4. A report marked unavailable or stale is not a zero balance. Keep read warnings visible and retry within rate limits. Avoid automatic order re-signing; unknown intents must be checked/retried with the same ID.

## Financial incidents and release blockers

Papertrade upgrade/domain/collateral/relayer uncertainty: keep live submission off, save pinned evidence, investigate official sources. Official account recovery links remain accessible without this UI. Do not create direct write calldata from unverified ABIs.

Local sandbox error: only the virtual account may be reset. Do not delete campaign/index data to repair a browser simulator. Claims proposal error: regenerate an unapproved manifest with reproducible inputs; an immutable deployed root cannot be replaced. Underfunded claims remain retryable, as verified on the local EVM. Unclaimed recovery rights become usable only after the stated deadline.

Before a real token/treasury/vault launch: select tokenomics and budgets; review multisig/recipient/recovery addresses; verify source and receipts; independently audit contracts; validate HyperEVM behavior, withdrawal/queue limits and production abuse/monitoring/storage. A stop cannot undo exposure already open, and queued profit is not withdrawable cash.
