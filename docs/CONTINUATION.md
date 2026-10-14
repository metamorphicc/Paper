# Development continuation

Branch: `paperclub-development`. Local commits only; no push, publication or mainnet transactions.

The UI, errors, accessibility labels and dates use English (UTC). Existing historical research documents retain their original language. New product pages and artifacts use English.

| Step    | Deliverable                                                                    | Status                                                                                                                                                          |
| ------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| English | Translate the full site and rename the branch                                  | Completed; browser checks on all five pages                                                                                                                     |
| 4.1     | Tokenomics proposals, capital scenarios, local Solidity/EVM toolchain          | 202695e; proposals only, not launch approval                                                                                                                    |
| 4.2     | Fixed-supply token, immutable funded Merkle claims and local EVM tests         | 972d47d; compilation and four focused tests                                                                                                                     |
| 4.3     | Deterministic snapshots, treasury budget policy and rewards preview            | 77717c1; deterministic proofs, explicit-budget CLI, cash limits, English rewards page; live claims disabled                                                     |
| 5.1     | Sequential path simulator with latency, liquidation, pauses and queued payouts | 8b1cf75; four path tests, delayed legs, loss stop, emission/distribution sensitivity and no-lookahead check                                                     |
| 5.2     | Historical candle replay and baseline/paired-strategy comparisons              | eb1086e; seven days of completed BTC 15-minute bars, contiguous timestamps and hashed input; baseline, long, paired and three sensitivities                     |
| 5.3     | Cash-only vault accounting, redemption tests and research UI                   | 98c7663; three accounting tests and English research page with selectable scenario/cash/equity charts; no deployable vault or live deposits                     |
| 6.1     | Security review and concrete fixes                                             | 5aa0609; bounded streaming I/O, local API rate/origin guards, redacted diagnostics, dependency patch and security report                                        |
| 6.2     | Upgrade monitor, backup/restore tooling and incident playbook                  | f9a0172; eight implementations unchanged at pinned block, online backup quick_check and scratch/table restore passed; no schedule or public launch              |
| 6.3     | Final integration, responsive checks and launch evidence                       | d0f144f; 44 tests, English browser checks, 28 responsive checks, production build/HTTP smoke, zero npm vulnerabilities; public financial launch remains blocked |

Token name, ticker, allocations, liquidity and capital limits are proposals until the user chooses them. No elapsed time is treated as approval. Local tests may use draft parameters and public demo addresses. Public claims, token deployment and custody remain disabled while required parameters, protocol integration and independent contract audit are unresolved.

The user explicitly confirmed tokenomics is **not selected**. Test settings do not become launch decisions. The public-money checklist remains blocked; `research/launch-readiness.json` records 15 missing/not-satisfied gates. Stage 6 cannot include an actual limited financial launch without this evidence and capital decisions.

UI follow-up after local stage 6: replaced slogan headings with functional section names. Wallet feedback now has explicit dismissal, Escape dismissal, a six-second expiry, and clearing on route/account/network changes. All dismissal paths and four mobile widths passed browser verification; recorded in a separate local commit.

Design revision after user review: restored the original paper/white/cobalt palette, replaced the sidebar with horizontal navigation, and rebuilt Overview around a centered liquidity band, interactive BTC/ETH markets and direct workspace actions. Integration diagnostics are available in an expandable disclosure. All seven routes retain their controls. Section gaps are now controlled centrally: 32px desktop / 24px mobile, including Research chart fragments. Card padding is 32px / 24px. Live market links select the instrument in Terminal. Two sequential local commits cover the shared shell/tokens and Overview functionality; no push.

Remaining product work is protocol source/domain/relayer and contract-wallet integration, a deployable audited vault, chosen tokenomics/capital limits, and production launch evidence. These are not completed by styling, simulated trades or passing local tests. Public money operations remain disabled.

Integration continuation: added a reproducible public signature-domain reader (`npm run read:domains`). At pinned block 48531432, the PaperStaking public domain separator matches the observed frontend domain. Exchange and CancelIntent domain evidence remain incomplete; no live transport or financial gate was enabled. Runtime hashes, getter outcomes and block hash are recorded in research/signature-domains.json.

### Remaining integration work: first follow-up

The passive source/relayer/contract-wallet probe is complete. Source metadata still cannot be verified; OPTIONS `/intents` returned 405 for the local frontend origin. Contract-wallet support remains unproven. These observations do not authorize or simulate settlement. Staking capability copy now reflects the separately confirmed onchain domain while retaining its write/settlement blockers. The next independent deliverable is confirmed treasury transfer accounting (stage 4 dashboard support).
