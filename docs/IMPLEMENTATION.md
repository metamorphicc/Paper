# Реализация этапов 1–3

Разрешение пользователя: выполнить этапы 1–3, разделить на подэтапы и коммитить последовательно. **Никаких push, публикации или денежных транзакций.** Каждый подэтап завершается проверкой и локальным коммитом. Код и независимые mock/fork проверки продолжаются даже при внешних ограничениях; неподтверждённый live write не подменяется mock-успехом.

| Подэтап | Результат | Статус |
|---|---|---|
| 0 | Сохранить исходный исследовательский стенд | Готово: 37959f1 |
| 1.1 | ABI/source текущих implementations и происхождение данных | Проверка реализована; source/ABI внешне недоступны, см. INTEGRATION.md |
| 1.2 | Live economics, read-only adapter и capability matrix | Готово: 16 RPC getters, 3 RPC profiles, 2 official SSE wallet frames; parser tests прошли |
| 1.3 | Intents/relayer, подписи, deposits/withdrawals и contract wallet evidence | Код и локальные signature checks готовы; third-party settlement/source/domain и collateral path внешне не подтверждены |
| 2.1 | Web app, навигация, общий data API и дизайн | Готово: 166bd71; production build и web typecheck прошли |
| 2.2 | Persistent indexer, replay/reorg, profiles и snapshots | Готово: 184 live PAPER events на 64 блоках; 4 store tests, profile API и overview HTTP 200 |
| 2.3 | Leaderboard, treasury, points campaign и pilot metrics | Готово: signed local points, quiz, per-address cap, mint activity и treasury view; 2 campaign security tests |
| 3.1 | Wallet connection, risk calculator и signature preview | Готово: injected wallet, account/network invalidation, real BBO/candles, fixed-point risk и observed schema preview; 3 quote tests |
| 3.2 | Trading/staking adapter, intent lifecycle, retry/cancel и emergency actions | Ожидает |
| 3.3 | Интеграционные проверки, responsive QA и запуск локального preview | Ожидает |

## Условия проверки

Документировать отдельно verified source, live RPC, UI/relayer доступность и mock transport. Реальные значения не заменять нулями при ошибке чтения. Список возможностей и UI отражают подтверждённый доступ. Если контрактный relayer недоступен или официальный тестовый deployment отсутствует, реализуем и проверяем пользовательский lifecycle на явно обозначенном локальном transport, сохраняя live submission выключенным.

Изменения к исходному плану: PostgreSQL остаётся production-вариантом; локальный persistent store выбираем по доступности окружения с явными ограничениями. Важны сохранность истории, deterministic replay и backup/restore, а не запуск лишнего сервиса.
