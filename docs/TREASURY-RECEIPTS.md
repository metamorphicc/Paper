# Treasury receipt accounting

The reader covers confirmed ERC-20 transfers for one explicitly selected treasury/asset and a bounded block window. It verifies chain ID, successful receipts, canonical receipt blocks, log identity and minimum confirmations. Duplicate evidence is idempotent; conflicting duplicates fail. Self transfers do not change cash flow. Balances at both window boundaries must agree with observed net transfers; otherwise reconciliation is false.

Received assets remain unclassified. Deposits, token issuance and arbitrary incoming transfers do not become realized revenue. A transfer out is not proof of a buyback; a Transfer to zero is not automatically a reviewed burn workflow. `realizedRevenueRaw` remains null and verified buyback/burn flags remain false. The reader never authorizes spending.

## Configuration and replay

Use a separately selected archive endpoint in `HYPEREVM_ARCHIVE_RPC_URL`; the standard HyperEVM endpoint supports latest state only. The reader checks a known post-genesis ERC-20 at genesis using both code and raw eth_call. This rejects the observed latest-only substitution, but is a capability canary rather than a trustless state proof. Historical logs are requested in 50-block chunks. Limits: 2048 blocks, 200 observed logs, 100 receipts, batches of ten, default 20 confirmations.

```powershell
npm run read:treasury -- --address REVIEWED_TREASURY_ADDRESS --asset REVIEWED_ASSET_ADDRESS --blocks 256
```

Both addresses must be supplied explicitly. CLI samples do not configure the product treasury. The dashboard uses `TREASURY_ADDRESS` and `TREASURY_ASSET_ADDRESS`; no address or asset has been selected for this project. Unconfigured values stay unavailable. `/api/treasury` is local-origin guarded and read-only; confirmed results share a 15-second request cache. Unavailable archive data does not fall back to invented balances.

Token amounts retain bigint units; display values are approximated only when fractional digits are shortened, with the exact value available on hover. Internal protocol USD/PAPER/queue data are separate from ERC-20 receipt accounting.

## Validation and limitations

Four treasury tests cover actual local EVM receipts, wrong-chain rejection, self transfers, duplicates, failed/orphaned/removed/shallow receipts and missing evidence. One separate archive test rejects silently substituted current state and failed reads. The local EVM mint/transfer/burn sequence reconciles correctly; this is not a HyperEVM deployment or live treasury test.

The initial public PAPER sample returned a mismatch because the default RPC served current balances for both requested historical blocks. It is retained in `research/treasury-latest-only-experiment.json` with `historicalStateTrusted=false`; it does not establish an accounting defect in PAPER. No accepted historical treasury result was generated. Production accounting still needs a reviewed archive provider, selected addresses/assets, source review, full coverage policy and revenue/swap/burn receipt evidence.
