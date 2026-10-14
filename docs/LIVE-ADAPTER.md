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

Before forwarding, the production guard checks chain 999 and all eight reviewed implementation slots/runtime hashes against latest RPC observations. Unavailable or changed code stops submission; these reads are not an atomic or trustless snapshot. The deadline is checked again after this guard. Changes to the order fields or loss of fresh pricing while the wallet dialog is open stop submission. A prepared intent can request a signature once; retries reuse the retained signature. An error during retry or cancellation preserves the original intent ID, because rejection of that request does not prove the original order never executed.

The Terminal control currently prepares OpenPosition and supports its retained-ID lifecycle. Transport schemas cover the observed action set, but full close/stake/withdraw product flows and their actual settlement are not validated by this open/cancel implementation. Contract-wallet signatures and active-session verification are not enabled; the main EOA signing path remains release-gated too.

## Tests

Four additional tests exercise a real loopback HTTP server, official wire encoding, acknowledgement identity, cancellation binding, Retry-After behavior, wrong signer/range rejection, unknown status, concurrent nonce allocation, exact signed retry and authority invalidation. All 53 package tests pass. Socket fixtures do not represent Papertrade settlement. No real signed intent, deposit, staking transaction, withdrawal or cancellation was submitted during validation.

Root/web typechecks, formatting and production build passed. 26 HTTP checks cover the readiness endpoint, unknown/invalid intent status, submit/cancel blocking and foreign-origin rejection. Trading controls were checked at 320, 375, 414, 768 and 1280px: English text, no horizontal overflow/protruding controls, 24/32px direct-section gaps and disabled Sign and submit. Evidence: `artifacts/design/trading-responsive.json`, `trading-connection.jpg` and `research/http-smoke.json`. One public profile RPC observation temporarily lacked pendingReward; the strict positive-read smoke check passed on rerun without weakening its assertion.

## Completion dependencies

To close launch blocks 1–2 fully, obtain official source/ABI and supported relayer/test-environment documentation, verify current domains and deployed implementations, prove collateral/recovery and contract-wallet behavior, then run a reviewed end-to-end lifecycle in an authorized environment with explicit capital limits. No test deployment has been provided. Public-money feature flags remain false and release blockers are exposed by `/api/trading/readiness`.

The user confirmed that they have no official Papertrade test-environment access or third-party relayer documentation. This dependency is externally unavailable, rather than an unanswered request for user information. Local fixtures and public read-only observations remain useful but cannot establish supported signed submission or settlement. Mainnet orders are not a substitute for this missing validation. Blocks 1–2 remain partially implemented; no automatic release follows this clarification.
