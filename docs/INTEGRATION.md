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
