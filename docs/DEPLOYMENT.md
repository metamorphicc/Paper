# Deployment preparation

This is review tooling for token, funded campaign and bounded treasury contracts. It cannot deploy to a public chain, authorize capital or enable Papertrade/vault operations. Tokenomics and recipients remain unselected.

## Substep 3.1: explicit parameters and address binding

`npm run release:prepare` validates `config/deployment.json` and writes `research/deployment-plan.json`. Missing inputs are reported; no proposal is silently converted into launch parameters. Amounts must be canonical decimal strings, with explicit six-decimal treasury asset units. Full token allocations must equal cap; the deployer's allocation must cover campaign funding; treasury funding must cover reserve plus one daily budget. Duplicate recipients/members/destinations, unsupported chains, unsafe integers and unknown fields are rejected.

Three consecutive CREATE deployments are planned from an explicit deployer/startNonce: ClubToken, CampaignClaims, TreasuryBudget. Snapshot proofs bind the target chain, predicted claims address, campaign ID, account and amount. A nonce/chain/parameter change requires a new reviewed plan and proofs. No funding or other transaction may consume a nonce between these deployments. A review digest binds the recorded parameters, deployment sequence and snapshot.

The status is always draft; parameter completeness is separate from release evidence. Address validation does not prove multisig control, recipient consent, available balance or safety of an asset. Actual balances, source equivalence, independent audit, receipts, deployment approval and current nonce must be checked separately. No private key is read by preparation.

Two focused tests prove domain/nonce binding, determinism without timestamps, and rejection of incomplete, duplicate, unsafe or underfunded parameters. Current public inputs remain incomplete. A local rehearsal may use explicitly labelled fixture accounts and budgets; those do not populate the public configuration.

## Substep 3.2: self-contained verification input

`npm run release:package` captures all 18 Solidity sources used by the three production contracts, compiler version/settings, per-source hashes, npm lockfile version/integrity provenance, constructor immutable references and artifact hashes. Generated review files are `artifacts/release/standard-input.json` and `compilation.json`; they contain public source code only. Imported source code retains its upstream license notices. The first compiler pass discovers transitive dependencies; the final artifacts come from the self-contained input, without filesystem import callbacks.

`npm run release:verify` recompiles the saved input using the exact installed compiler version, checks every source/artifact hash and immutable reference map, and rejects a changed package. The hashes bind reviewed content, not the publisher's identity or an independent audit. Lockfile provenance records expected package integrity; it is not a fresh verification of an installed npm tarball.

Compiler runtime templates contain constructor immutable placeholders. Runtime comparison must match every other executable/metadata byte and then independently check all expected immutable getter values. Masking constructor slots alone does not verify those values. Local tests reproduce all three artifacts, detect an imported ERC20 decimals change despite an unchanged primary source, and reject executable-byte changes/invalid immutable references. These are our contracts; Papertrade source equivalence remains unresolved.

## Substep 3.3: isolated deployment rehearsal

`npm run release:rehearse` creates and destroys an in-process chain 31337 through the existing hardcoded local EVM helper. It accepts no RPC URL, private key or public deployment plan. Its accounts, token name, allocations and budgets are fixtures; public configuration stays untouched. A six-decimal TESTUSDC fixture lives under `contracts/fixtures/`, excluded from production compilation/package discovery.

The rehearsal deploys the fixture and the three planned contracts, checks current nonces and predicted addresses, matches actual transaction creation input to encoded bytecode/constructor arguments, compares runtime outside compiler-declared immutable slots, and reads every expected immutable getter plus initial supply/allocations/destination policy. It then funds campaign and treasury, submits a third-party claim paying its designated member, spends an allowed treasury amount, advances local time and recovers the unclaimed campaign remainder.

Nine successful canonical receipts are recorded. Eight invalid actions are rejected: unauthorized spend, wrong claim recipient, duplicate claim, premature recovery, daily-limit excess, reserve-floor violation after a day reset, expired claim and unauthorized recovery. Separate injected nonce-drift and constructor-substitution scenarios abort before funding.

The actual local ERC20 receipts reconcile 100 TESTUSDC incoming, 10 outgoing and 90 remaining. The accounting window starts after fixture deployment, because the asset has no callable state at genesis. Transfers are not classified as realized revenue, buybacks or burns. Evidence: `research/deployment-rehearsal.json`, including fixture parameters, plan/proofs, actual code/creation hashes, getter-check results, transaction/block hashes and raw-unit balance reconciliation.

All 59 package tests, TypeScript and formatting checks passed. Compiler-package replay passed. Current public deployment review still reports 17 incomplete fields; launch-check now also requires deployment-parameter completeness. Local receipts do not satisfy audit, HyperEVM validation, public custody or Papertrade settlement gates.

Verified Papertrade integration and contract-wallet support remain prerequisites for any strategy vault. This deployment recipe contains no vault custody contract or production trading adapter activation.
