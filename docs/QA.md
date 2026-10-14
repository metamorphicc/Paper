# Проверки этапов 1–3 · 14 октября 2026

Проверено в Windows PowerShell, Node 24.11.1, Next 16.4.0. Evidence содержит UTC-время; интерфейс показывает время Новосибирска. Реальные финансовые транзакции и official relayer write-запросы не выполнялись.

## Автоматические проверки

| Проверка                  | Результат                                                                                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root и web TypeScript     | Без ошибок                                                                                                                                            |
| 27 unit/integration tests | 27 passed, 0 failed                                                                                                                                   |
| Production webpack build  | Успешно; 11 routes включая not-found                                                                                                                  |
| Prettier check            | Все исходники форматированы                                                                                                                           |
| HTTP smoke                | Пять страниц, protocol, BTC/ETH market, campaign и два публичных профиля — 200; invalid address — 400; live intent — 403; campaign wrong origin — 400 |
| Индексатор                | Повторный bounded проход: 505 новых events, всего 689; coverage 48510776–48510954, reorg не обнаружен                                                 |

Tests проверяют signed origin/nonce/expiry и replay кампании, backup/restore и canonical reorg, exact bigint economics/net fee, typed schema/signature recovery, резерв pending open/withdraw, stable ID retry, очередь выигрыша, revoke/expiry sessions и ограничения session permissions. Failed mixed-market close откатывает весь ledger. Live transport отвергает все write operations до обращения к сети.

`research/http-smoke.json` — воспроизводимый HTTP отчёт, включая профиль с 75 completed trades и успешный `pendingReward` RPC. `research/index-run.json` — coverage cursor и статистика реального PAPER indexer. Данные профилей принадлежат публичным адресам из protocol registry/onchain events; кошелёк пользователя в тестах не использовался.

## Браузерная проверка

С помощью автоматизации в браузере:

- Все пять страниц проверены при 320 / 375 / 414 / 768 px; 20 измерений без горизонтального overflow. Заполненный профиль с 75 trades дополнительно проверен при этих четырёх ширинах: overflow отсутствует. JSON evidence и screenshots — `artifacts/qa/`.
- Mobile menu открывает навигацию и закрывается при выборе страницы. Поиск фильтрует страницы, Enter переводит на выбранную страницу и закрывает dialog. Найден и исправлен повторный default Enter click, заново открывавший поиск.
- Профиль без подписи показывает реальные available/queued/PAPER/staked, net realized PnL, onchain PAPER activity, claimable rewards из отдельного RPC и trade history. API и RPC blocks показаны отдельно.
- Sandbox: open → queued → local settlement → close; виртуальный выигрыш попал в queued USDC отдельно от available. Lost response → retry прежнего ID → cancel вернул резерв, не создал позицию. Статусы и ID сохранены в локальной истории.
- Исправлены мелкие подписи chart axis, поздний ответ рынка после смены BTC/ETH, устаревший cache status, min margin/stake и восстановление профиля после invalid input.
- Контраст объявленных цветов: минимум 5.55:1 для проверенных текстовых пар, focus 12.65:1; отчёт `contrast.json`. Это проверка token pairs, не полный accessibility audit. Focus ring, skip link, native dialog и reduced-motion присутствуют.

Итоговые screenshots: `overview-desktop.jpg`, `profile-desktop.jpg`, `profile-375.jpg`, `trade-320.jpg`–`trade-768.jpg`, `sandbox-recovery.jpg`. Временный viewport override сброшен; owned preview server остановлен после проверок.

## Что не подтверждено

Source/ABI текущих implementations unverified; official domain getter недоступен; сторонний relayer settlement и contract-wallet support не доказаны. Collateral docs/frontend расходятся, exact API/RPC reconciliation не пройдена. Builder payout не запущен. Реальные денежные operations заблокированы, обхода через API нет.

Injected wallet connection/account switching реализованы, но interaction с реальным кошельком пользователя не проводилась. Community proof проверен EOA test signatures, не EIP-1271. LocalStorage sandbox не является custody и не доказывает безопасность official contracts. SQLite experimental, coverage частичный; production auth/rate limiting/storage/monitoring и аудит не входят в готовность этого локального прототипа.

Финальный Git результат: baseline + девять последовательных подэтапов в `paperclub-development`, без push и публикации. Коммиты и оставшиеся внешние критерии — IMPLEMENTATION.md.
