# Интеграция: доказательства и ограничения

## 1.1 — идентификация реализации

`scripts/discover-contracts.ts` читает EIP-1967 implementation slot, runtime bytecode и его keccak256 на одном блоке. Из CBOR metadata извлекает compiler marker и CID; пытается получить source/ABI через Sourcify v2, HyperEVMScan и IPFS gateways. Ответы и SHA-256 сохранены в `research/contracts/manifest.json`.

14.10.2026, блок 48509455: восемь implementations присутствуют; compiler marker 0.8.24. Все explorer pages показывают Unverified. Sourcify отвечает 404, IPFS gateways — 429; полные ABI/source не получены. Наличие CBOR compiler marker не определяет optimizer settings и не доказывает source equivalence.

Это внешний пробел в доказательствах, а не успешно проверенные исходники. На следующем шаге добавляем узкие read-only ABI по опубликованным getter names, проверяя конкретные returns. Выдуманные Solidity events и торговые подписи не используются для live operations.

## Как повторить

```powershell
npx.cmd tsx scripts/discover-contracts.ts
```

Все downloads рассматриваются как данные. Сценарий не компилирует и не исполняет чужой код. Никаких wallet signatures или денежных операций.

## 1.2 — реальные чтения и browser evidence

`packages/protocol/read.ts` читает 16 narrow getters на фиксированном блоке, с явным unavailable вместо нуля. `readProfile` прочитал PAPER balance, staked balance, pending reward и внутренний balance для трёх контрольных contract addresses. Два блока данных сохранены в `research/live-protocol.json` и `research/control-profiles.json`.

Обычный HTTP GET `/` возвратил 404, но браузер открыл официальный `/trade/btc`. Из наблюдаемых assets извлечены endpoint URLs, schemaVersion=1, instrument tuples и typed-data. Ничего из загруженного JS не исполняется нашим проектом. SHA-256 и исходные URL в `research/official-state.json`; большие vendor bundles остаются локальными ignored файлами.

Подтверждённые read endpoints: `/state/trading`, `/query/protocol/summary`, `/query/protocol/queue-summary`, `/state/user/live?wallet=ADDRESS` (SSE wallet frame), `/query/accounts/ADDRESS/...` (history), `/state/leaderboard/accounts`. Парсер ограничивает размер, типы, chain instrument IDs/scales, lifecycle и Retry-After. Два wallet frames успешно получены и привязаны к адресам.

Official wire/build используют internal USD и PAPER с 18 decimals; withdrawal amount и external collateral — 6 decimals. Onchain cliff/decay/raw balances согласуются с этой шкалой. Не применять external 6 decimals к internal account balances.

**Расхождение collateral:** docs публикуют `0xb88339cb7199b77e23db6e890353e22632ba630f`, production browser wire — `0x6b9e773128f453f5c2c60935ee2de2cbc5390a24`. Deposits остаются отключёнными до проверки фактического пути; адрес из browser bundle не заменяет docs молча.

## 1.3 — intents, relayer и точность сверки

В `packages/protocol/intents.ts` перенесены наблюдаемые schemas RegisterSessionKey, OpenPosition, Close, WithdrawToCore, Stake, Unstake, Claim и CancelIntent. Сохранены порядок/типы полей, разные domains и алгоритм v2 intent ID. Локальный тест на никогда не финансируемом test account проверяет подпись, recovery, сериализацию и стабильный ID; подпись не отправляется в сеть.

Observed POST route `/intents`, cancellation `/intents/ID/cancel`, header X-Papertrade-Build и Retry-After присутствуют в official assets. Это доказательство browser surface, не подтверждение разрешённого стороннего доступа, CORS/cookie контекста или settlement. Live POST не делался.

`scripts/validate-integration.ts` фиксирует совпадение type-hash literals с runtime и пробует EIP-5267 domain. В данном чтении domain getters недоступны. Сверка official summary с RPC на заявленном `source.block` обнаружила несовпадение supply/stake/tracked LP; queue совпала. Причина не установлена: нельзя объявлять summary точным canonical snapshot. API и RPC в UI имеют отдельное происхождение, timestamp и status; live submission выключен также при таких расхождениях.

Deposit/withdraw: внутренний margin/balance USD-18; WithdrawToCore typed amount — external USD-6. Withdrawals требуют wallet signature, session key не используется. Полный sweep/finalize/withdraw lifecycle и contract wallets не проверены. Emergency revoke/withdraw показываем как пользовательский переход к официальному интерфейсу/контракту, без выдуманного calldata.

## Read-only domain follow-up

`npm run read:domains` checks the RPC chain ID, pins one block, resolves both EIP-1967 implementations and records their runtime hashes. It compares the observed frontend domains with public `DOMAIN_SEPARATOR()` / `domainSeparator()` getters and attempts EIP-5267 introspection. It submits no signatures, transactions or relayer POST requests.

At block 48531432, PaperStaking's `DOMAIN_SEPARATOR()` equals the computed separator for name `PaperStaking`, version `1`, chain ID `999` and staking proxy address `0xaad6c7b0cc3014fc80ffedae0ed7ce5967b0f016`. This confirms that domain at the pinned block; EIP-5267 remains unavailable. Exchange's two tested separator getters and EIP-5267 remain unavailable, so its observed frontend name `String` is still unconfirmed onchain. Unavailable getters do not prove that an internal domain is absent.

The report is `research/signature-domains.json`. CancelIntent's separate domain is outside these checks. Matching a domain does not verify signature authorization, EIP-1271, relayer access, deposits, settlement or source equivalence. The financial launch gate remains incomplete and live submission remains disabled.

## Integration access observations

A passive follow-up (`npm run probe:integration`) retried source metadata for the archived Exchange/PaperStaking implementations: Sourcify returned 404, IPFS returned 429. No verified ABI/source was obtained. A standard OPTIONS preflight for `/intents`, with the local frontend origin and observed request-header names, returned 405. This does not establish that server-to-server access is denied; it also supplies no permission or settlement proof. No POST, signature or transaction was submitted.

Archived runtime PUSH analysis found no EIP-1271 magic constants in the four checked implementations. This is a static clue, not proof of incompatibility: optimized code, indirect calls or nonstandard paths can escape this check. The positive contract-wallet evidence required by stage 5 is still absent. Public vault integration remains blocked, so treasury receipt accounting and other local work proceed independently. Evidence and limitations are recorded in research/integration-surface.json.

## Correction: default RPC state is latest-only

This section supersedes earlier wording that described state calls as pinned to a historical block. The default HyperEVM RPC supports only latest state for eth_call, eth_getCode and eth_getStorageAt. Block headers and historical receipts remain available. See the primary RPC specification: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm/json-rpc.

A capability probe requested PaperToken code/balance at genesis and two later blocks; the default provider returned the same current code and balance for every tag. Accordingly, the earlier API/RPC comparisons are not historical reconciliation evidence. The observed mismatch does not establish a protocol accounting defect. Earlier manifest/domain head numbers are context, not proof that the corresponding state was read at that block.

Current protocol/profile/domain readers now request latest explicitly and mark statePinned=false. Domain equality for PaperStaking remains a latest observation; Exchange remains unconfirmed. Historical comparison and treasury receipt readers require a separately configured archive RPC and a post-genesis ERC-20 canary that checks both code and raw eth_call at genesis. The canary is a capability test, not a trustless state proof. Historical log queries are split into at most 50-block ranges.

No feature gate is enabled by this correction. An archive provider still must pass the canary and balance/receipt consistency checks before its historical values are used.

## 2026-10-15: public archive research source

The public dRPC endpoint passed the post-genesis code/call canary. The four captured official summary fields (PAPER supply, total stake, tracked LP and queued payouts) matched archive reads at source block 48510016. This verifies those named fields, not every protocol/wallet field. Evidence includes the source block hash in integration-validation.json.

Use `https://hyperliquid.drpc.org?include_hl_native_tx=true` for the public research default. dRPC documents the native-transaction flag for consistent block/receipt routing. Without it, the reader rejected inconsistent log/receipt identities; with it, the selected 128-block PAPER sample contained 38 confirmed transfers and reconciled with boundary balances (zero discrepancy). The sample is the public PaperStaking address, not a selected Paperclub treasury. Evidence is in treasury-receipts.json. This public endpoint is a tested research source, not a production SLA or a trustless state proof.

Exchange/CancelIntent domains, source equivalence, relayer settlement, collateral lifecycle and contract-wallet evidence remain unresolved. No live financial write was made.

## 2026-10-15: current read schema compatibility

Production HTTP checks exposed `Unknown intake schema`: `/state/trading` now returns `intakeControls: [revision, minimumPaperStakeRaw, disabledActions]`, replacing the earlier four-field `intake` tuple. Browser-observed current frontend `hooks-Dgib49eE.js` confirms that exact three-field decoder and its minimum/actions mapping. Public JSON plus 10 public JavaScript assets were captured with URLs/hashes as data; no downloaded code was executed. Evidence: current-trading-state.json and current-trading-schema-evidence.json.

The reader accepts these two observed layouts, preserves stake minimum and action pauses, rejects ambiguous/malformed/unsafe values, and records the removed global net-interest field as null rather than inventing a zero/unlimited cap. Instrument deployment/lifecycle checks remain intact. Regression tests cover current and legacy payloads. This restores read compatibility; it does not approve a new write build, prove contract source/domain equivalence, or enable financial writes.
