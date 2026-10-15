# Deployment preparation

This is review tooling for token, funded campaign and bounded treasury contracts. It cannot deploy to a public chain, authorize capital or enable Papertrade/vault operations. Tokenomics and recipients remain unselected.

## Substep 3.1: explicit parameters and address binding

`npm run release:prepare` validates `config/deployment.json` and writes `research/deployment-plan.json`. Missing inputs are reported; no proposal is silently converted into launch parameters. Amounts must be canonical decimal strings, with explicit six-decimal treasury asset units. Full token allocations must equal cap; the deployer's allocation must cover campaign funding; treasury funding must cover reserve plus one daily budget. Duplicate recipients/members/destinations, unsupported chains, unsafe integers and unknown fields are rejected.

Three consecutive CREATE deployments are planned from an explicit deployer/startNonce: ClubToken, CampaignClaims, TreasuryBudget. Snapshot proofs bind the target chain, predicted claims address, campaign ID, account and amount. A nonce/chain/parameter change requires a new reviewed plan and proofs. No funding or other transaction may consume a nonce between these deployments. A review digest binds the recorded parameters, deployment sequence and snapshot.

The status is always draft; parameter completeness is separate from release evidence. Address validation does not prove multisig control, recipient consent, available balance or safety of an asset. Actual balances, source equivalence, independent audit, receipts, deployment approval and current nonce must be checked separately. No private key is read by preparation.

Two focused tests prove domain/nonce binding, determinism without timestamps, and rejection of incomplete, duplicate, unsafe or underfunded parameters. Current public inputs remain incomplete. A local rehearsal may use explicitly labelled fixture accounts and budgets; those do not populate the public configuration.

## Remaining substeps

- 3.2: self-contained compiler input, dependency provenance and reproducible verification package.
- 3.3: actual local EVM deployment/funding/claim/treasury receipt rehearsal, with code/constructor/immutable-state reconciliation.

Verified Papertrade integration and contract-wallet support remain prerequisites for any strategy vault. This deployment recipe contains no vault custody contract or production trading adapter activation.
