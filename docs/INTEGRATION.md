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
