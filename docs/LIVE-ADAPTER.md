# Live Papertrade adapter

Scope: the user's requested launch blocks 1 (integration) and 2 (real trading transport). This is an implementation with release gates; it is not evidence that real orders have settled.

## Implemented substeps

| Substep                     | Result                                                                                                                                                                                                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 Archive research        | Public dRPC canary passed; four captured summary fields matched at the declared source block. Native-transaction flag fixes observed log/receipt indexing inconsistency.                                                                                         |
| 1.2 Historical receipts     | Public PaperStaking/PAPER sample reconciled: 38 confirmed transfers in 128 blocks, zero boundary-balance discrepancy. No Paperclub treasury configured.                                                                                                          |
| 1.3 Current client contract | Official browser DOM supplied current asset URLs; five public assets captured with SHA-256. Main typed-data schemas/domains remained unchanged; current build is 32abe9f9c6a6. Old asset URLs returned 404. Workspace never executes downloaded JavaScript.      |
| 1.4 External verification   | Verified Solidity/ABI, Exchange/CancelIntent domain, collateral lifecycle, EIP-1271 and third-party settlement remain incomplete. Metadata gateway returned 429. Empty unsigned POST returned 400 with no receipt; it proves no positive access or execution.    |
| 2.1 Signing / authority     | Range-checked official schemas, EOA signature recovery, action-scoped session hook, real deadline/nonce preparation, coordinated nonce storage, wallet/network generation invalidation. Wallet signing checks release readiness before requesting a signature.   |
| 2.2 HTTP transport          | Observed signed wire POST, bound acknowledgement IDs/actions, cancellation signature/domain/path, body/time bounds, rate backoff, no automatic resubmit/re-sign after unknown acknowledgement.                                                                   |
| 2.3 Lifecycle / API         | Real HTTP code replaces the transport stub. Local APIs implement submit/status/cancel and readiness, with local-origin/rate guards and signed-body limits. Public status reads never infer settlement from queue absence.                                        |
| 2.4 Product controls        | Terminal includes guarded wallet signing, submission, status checking, same-payload retry and cancellation. Order preflight requires fresh market/account data and available collateral. Release conditions keep controls disabled while evidence is incomplete. |

## Wire and trust boundaries

`POST https://exchange.papertrade.xyz/intents` uses `{action, signed}`. Signed fields are decimal strings/address/bool values plus r/s/v. X-Papertrade-Build comes from the captured client. The acknowledgement must return the expected intentId/action and a decimal queueRevision. Acknowledgement is not settlement.

Cancellation signs the separate CancelIntent domain. Its ID is bound into the signature and path `/intents/ID/cancel`; the redundant intentId is removed from the HTTP body, matching the observed client. Cancellation acknowledgement is not a guarantee that execution stopped.

No unobserved GET `/intents/ID` endpoint is invented. Status reads use the observed wallet snapshot. A missing operation yields unconfirmed. Successful settlement requires verified transaction/event evidence; that verifier cannot be inferred from unverified source. Private keys are never sent to the backend; signed retries remain in memory. Cross-device nonce uniqueness is not established by browser locking.

Production transport is created with the normal release guard. The injected release callback/fetcher in tests is a trusted test seam, not an HTTP parameter or user-controlled bypass. Enabling configuration alone is not new external evidence. Review source/runtime/domain/collateral and settlement before release.

## Tests

Four additional tests exercise a real loopback HTTP server, official wire encoding, acknowledgement identity, cancellation binding, Retry-After behavior, wrong signer/range rejection, unknown status, concurrent nonce allocation, exact signed retry and authority invalidation. All 53 package tests pass. Socket fixtures do not represent Papertrade settlement. No real signed intent, deposit, staking transaction, withdrawal or cancellation was submitted during validation.

## Completion dependencies

To close launch blocks 1–2 fully, obtain official source/ABI and supported relayer/test-environment documentation, verify current domains and deployed implementations, prove collateral/recovery and contract-wallet behavior, then run a reviewed end-to-end lifecycle in an authorized environment with explicit capital limits. No test deployment has been provided. Public-money feature flags remain false and release blockers are exposed by `/api/trading/readiness`.
