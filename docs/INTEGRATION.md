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
