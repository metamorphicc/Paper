# Security review

Security decision: **Do not launch yet** for public money/custody. Local read-only and isolated test use passed the checks below. Risk level for public financial launch: **High**, due to unresolved integration and audit coverage.

## Threat model

Valuable assets are user signatures, future claim budgets/treasury funds, and reliable financial state. Trust boundaries: browser → local API → public official API/RPC; campaign signatures → SQLite; reviewed manifest → funded immutable claims; future multisig → treasury spend policy. Browser sandbox keys are publicly documented demo keys for virtual funds, never user keys. No user deposit or official live write route exists.

## Confirmed findings and fixes

| Severity / category | Evidence | Fix / state |
|---|---|---|
| Medium / OWASP A04 resource exhaustion | Campaign POST and official JSON reader previously checked length after complete `text()` buffering | Added bounded streaming UTF-8 reader, byte limits, declared-length checks and timeout; campaign oversize returns 413 |
| Medium / A04 unrestricted requests | Each uncached profile could request wallet history and RPC reads; no route-wide rate bound | Added process-local route budgets and Retry-After; local-host/origin read guards. This is not distributed production rate limiting |
| Medium / A09 information leakage | probe-chain wrote full transport errors; custom RPC URLs could include credentials | Reports/logs now use error class names; API RPC reads already redact transport details. No credential exposure was observed |
| Low / deployment availability | Next normalized the internal request URL to localhost while browser Origin/Host used 127.0.0.1, rejecting valid campaign requests | Bind Origin to the validated local Host; test both aliases and cross-origin rejection. Oversized same-origin HTTP POST now reaches the correct 413 guard |
| High dependency advisory in development tools | solc pulled tmp 0.2.6; npm audit identified GHSA-7c78-jf6q-g5cm | Pinned compatible tmp 0.2.7 override; npm audit reports zero vulnerabilities after installation and local compilation/tests pass |

Input/signature checks: campaign origin/address/action/nonce/expiry are verified server-side; only verified claims update points; duplicate action and challenge replay rejected. Prototype action names use Object.hasOwn. Rate protection by address is not proof of unique humans. SQL values are parameterized; profile lookup is intentionally public. React renders text, with no unsafe HTML/eval usage found. Monetary flags are enforced at API/transport boundaries; changing a client flag cannot enable official writes.

Claims/token/treasury: actual local EVM tests verify cap, no privileged mint/tax/upgrade, domain-bound Merkle proofs, replay, underfunded rollback, claim recipient, expiry/recovery and treasury authorization/reserve/daily limit. Review found no additional confirmed contract exploit in this scope. Immutable operator/recovery/destination rights must be disclosed and supplied as reviewed multisig addresses before real deployment. A transferred token does not prove a swap or burn.

## Fix order and launch gates

1. Today: bounded I/O, request guards, redacted RPC diagnostics and dependency patch completed. Preserve disabled money actions.
2. Before any public deployment: choose tokenomics/budget/recipients, verify protocol ABI/domain/collateral/relayer, implement distributed abuse controls and production storage/privacy policy, test supported browser wallets and EIP-1271.
3. Before user custody: independent contract review/audit, HyperEVM-specific testing, deployment/source verification, actual settlement/recovery evidence and funded reserve/withdrawal limits. The cash-only vault model is not a custody contract.

Coverage gaps: no independent audit, static analyzer/fuzzer or fork of verified Papertrade source; no attack tests against third-party services; no real wallet/funds used. No payment webhooks or multi-tenant authentication exist. Files selected by the claim inspector remain browser-local; no upload endpoint exists. Local API guards are not intended for a public host. Browser-wallet provider errors may be provider-local text; our own product messages and labels use English.
