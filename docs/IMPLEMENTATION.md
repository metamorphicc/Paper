# Реализация этапов 1–3

Разрешение пользователя: выполнить этапы 1–3, разделить на подэтапы и коммитить последовательно. **Никаких push, публикации или денежных транзакций.** Каждый подэтап завершается проверкой и локальным коммитом. Код и независимые mock/fork проверки продолжаются даже при внешних ограничениях; неподтверждённый live write не подменяется mock-успехом.

| Подэтап | Результат | Статус |
|---|---|---|
| 0 | Сохранить исходный исследовательский стенд | В работе |
| 1.1 | ABI/source текущих implementations и происхождение данных | Ожидает |
| 1.2 | Live economics, read-only adapter и capability matrix | Ожидает |
| 1.3 | Intents/relayer, подписи, deposits/withdrawals и contract wallet evidence | Ожидает |
| 2.1 | Web app, навигация, общий data API и дизайн | Ожидает |
| 2.2 | Persistent indexer, replay/reorg, profiles и snapshots | Ожидает |
| 2.3 | Leaderboard, treasury, points campaign и pilot metrics | Ожидает |
| 3.1 | Wallet connection, risk calculator и signature preview | Ожидает |
| 3.2 | Trading/staking adapter, intent lifecycle, retry/cancel и emergency actions | Ожидает |
| 3.3 | Интеграционные проверки, responsive QA и запуск локального preview | Ожидает |

## Условия проверки

Документировать отдельно verified source, live RPC, UI/relayer доступность и mock transport. Реальные значения не заменять нулями при ошибке чтения. Список возможностей и UI отражают подтверждённый доступ. Если контрактный relayer недоступен или официальный тестовый deployment отсутствует, реализуем и проверяем пользовательский lifecycle на явно обозначенном локальном transport, сохраняя live submission выключенным.

Изменения к исходному плану: PostgreSQL остаётся production-вариантом; локальный persistent store выбираем по доступности окружения с явными ограничениями. Важны сохранность истории, deterministic replay и backup/restore, а не запуск лишнего сервиса.
