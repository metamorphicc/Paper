# План реализации

Цель: выпустить единый продукт с хабом, торговым интерфейсом, новым мемкоином/rewards и vault. Начинаем на HyperEVM; мемкоина пока нет. Весь набор входит в архитектуру, но денежные модули запускаются по своим критериям готовности.

План веду по результатам и проверкам, не только по срокам. Оценки ниже — рабочие дни разработки при одном разработчике; аудит, внешние ответы и изменения протокола в них не входят. Переход к следующему техническому этапу зависит от завершения проверок. Публичный deploy, торговля средствами и выпуск токена — отдельные реальные действия после review готового результата.

**Статус 14.10.2026:** локальный код этапов 1–3 реализован; девять подэтапов и baseline сохраняются последовательными коммитами без push. Подробности — [IMPLEMENTATION.md](IMPLEMENTATION.md), проверки — [QA.md](QA.md). Verified source/ABI, domain, third-party relayer settlement, collateral flow и exact reconciliation ещё требуют внешней проверки. Галочки ниже обозначают конкретный реализованный результат, а не готовность денежного launch.

**Продолжение:** ветка `paperclub-development`, весь сайт на английском. Локальные подэтапы 4–6 выполнены в доступном контуре: token/claims/treasury contracts с EVM-тестами, snapshots, path replay, cash-only vault model, security fixes и ops tooling. Параметры токена и бюджет пользователь ещё не выбрал. Это не денежный launch: independent audit, production custody и verified protocol integration остаются открытыми. Актуальные результаты и подэтапы — [CONTINUATION.md](CONTINUATION.md), [VALIDATION.md](VALIDATION.md).

## Уже выполнено

- [x] Проверить исходные утверждения по официальной документации.
- [x] Подготовить Node/TypeScript/viem workspace и закрепить зависимости.
- [x] Сохранить 23 страницы docs с SHA-256; сверить опубликованные адреса.
- [x] Проверить HyperEVM RPC и bytecode на 11 адресах на одном блоке.
- [x] Сделать close-only экономическую модель, queued payout и dilution-сценарии.
- [x] Запустить typecheck и четыре теста; описать допущения и ограничения.
- [x] Подготовить оценку, архитектуру и данный план.

## Этап 1. Доказать доступность интеграции — 2–4 дня

- [ ] Получить проверенные ABI и исходники текущих proxy implementations, сверить compiler/settings и address/chain.
- [x] Прочитать live markets/impact/buffer, emissions HWM, LP/queue, total stake/rewards и owner getters; сохранить observations. Win-fee остаётся documented assumption, все admin roles не раскрыты.
- [x] Проверить exchange UI, read API, wallet SSE и observed intent/status/cancel schemas. Регистрация стороннего relayer и write rate limits не подтверждены.
- [x] Реализовать read-only adapter и воспроизводимый mock PoC без средств. Официальный domain getter и EIP-1271 остаются неподтверждёнными.
- [ ] Проверить HyperEVM↔HyperCore deposit/withdraw flow, asset units и recovery после failed sweep.
- [x] Составить матрицу возможностей с evidence: reads/sandbox доступны; реальные trading/staking и contract wallet не подтверждены; builder planned.

**Готово, когда:** ABI/implementation и минимум две воспроизводимые операции чтения экономических параметров совпадают с explorer/официальным UI; доступные write-пути документированы. Неясный relayer блокирует trading/vault, но позволяет продолжать хаб. Builder остаётся отключённым до подтверждённого запуска и payout basis.

## Этап 2. Общий продукт и хаб — 4–7 дней

- [x] Создать Next.js app и дизайн с профилем, leaderboard, treasury и статусами будущих модулей.
- [x] Добавить SQLite и indexer стандартных PAPER Transfer events; backup/restore, cursor, replay и reorg tests. Trading events по неизвестному ABI не декодируются.
- [x] Показать net PnL, PAPER, claimable RPC reward, available/queued balance, источники и актуальность; API/RPC reconciliation не объявляется успешной.
- [x] Реализовать локальную points-кампанию, per-address cap, origin-bound proof и защиту повторного claim; публичный pilot не запущен.
- [x] Реализовать метрики подтверждённых адресов и возвратных действий; предложить pilot targets. CAC и финальные цели требуют бюджета, sybil uniqueness не доказана.

**Готово, когда:** результаты для нескольких контрольных адресов совпадают с chain, replay не удваивает данные, устаревшие данные явно отмечаются и пользователи проходят весь read-only сценарий.

## Этап 3. Торговый интерфейс — 5–10 дней после этапа 1

- [x] Добавить wallet connection, official signature preview, risk calculator и локальный intent lifecycle. Кошелёк пользователя не использовался в QA.
- [x] Реализовать open/close, status, retry/cancel, stake/unstake/claim/withdraw в отдельном signed sandbox. Official live transport блокирует отправку до внешней проверки.
- [x] Показать fee/impact assumption, bust price и queued profit отдельно от available USDC.
- [x] Проверить session revoke, withdrawal, outage, expiry и account/network invalidation в коде/локальных тестах. Реальные emergency actions представлены официальными ссылками, не непроверенным calldata.
- [x] Добавить builder capability planned с нулевым доходом до подтверждённого payout.

**Готово, когда:** один пользовательский lifecycle воспроизводится на разрешённом тестовом контуре; просроченная подпись/двойной submit не создают новую позицию; аварийные действия доступны без нашей UI. Если протокол не предоставляет тестовый контур, пользовательский денежный pilot не заменяется неявной mainnet-транзакцией.

## Этап 4. Мемкоин, rewards и treasury — 5–10 дней

- [ ] Выбрать имя/тикер, cap, distribution, campaign reserve, initial liquidity, права admin и бюджет. Подготовить варианты с расчётами, затем зафиксировать решения пользователя.
- [x] Реализовать token/rewards и treasury contracts в локальном EVM; фиксированный выпуск, отсутствие privileged mint/tax, immutable claims и лимиты treasury. Реального deploy нет.
- [x] Реализовать deterministic snapshots, proofs, claims и защиту повторного получения; CLI требует явный бюджет и target address.
- [ ] Публиковать распределение supply и полномочия; не называть распределение «fair launch», пока правила не соответствуют этому описанию.
- [ ] Treasury dashboard: полученный USDC, затраты, PAPER, queue и исполненные buybacks; сверка transaction receipts.
- [x] Реализовать расчёт buyback policy из cash/revenue, reserve, period и price-impact limits; execution выключен.

**Готово, когда:** supply/claims/permissions invariants проходят тесты, все allocations объяснимы, budget моделируется при нулевом builder revenue. Контракты развёрнуты только в тестовом контуре; mainnet launch идёт после отдельного review готовых параметров и результатов.

## Этап 5. Vault и strategy research — 7–15 дней

- [x] Расширить модель до sequential path simulation с задержкой ног, conservative OHLC liquidation, queue, modeled harvest, pauses/outage и emission sensitivity.
- [x] Сравнить no-trade baseline, periodic long и парную стратегию на условном капитале; PAPER не оценивается как cash.
- [x] Подключить replay завершённых BTC candles и no-lookahead tests. Historical protocol config неизвестен; текущие параметры обозначены как допущение.
- [ ] Проверить contract-wallet integration. Если она недоступна, зафиксировать vault как blocked capability и продолжать остальные модули.
- [ ] Подготовить стратегию на собственном ограниченном капитале только после симуляции и отдельного review её write-пути и бюджета.
- [x] Определить cash-only accounting model shares/NAV/redemption и сохранения queued/PAPER entitlements; это не deployable public vault.
- [x] Проверить partial redemption, deposit/payment isolation и path liquidation/outages локально. Реальные HyperCore/owner/recovery сценарии ещё не подтверждены.

**Готово, когда:** capital-at-risk и drawdown укладываются в заранее выбранные лимиты; downside сценарии понятны; cash redeem возможен по заявленным правилам без продажи non-transferable PAPER. Положительный APY на коротком периоде не считается доказательством. Если модель не проходит, public deposits не включаются; treasury-данные и хаб продолжают работать.

## Этап 6. Проверка и ограниченный запуск — 5–10 дней плюс внешний аудит

- [ ] Провести review token/rewards/treasury/vault контрактов и wallet/relayer границ; независимый аудит перед публичным custody.
- [x] Добавить local EVM/accounting invariants, manual upgrade monitoring, incident playbook и backup/restore. Fork tests по verified Papertrade source ещё невозможны.
- [ ] Подготовить конкретные адреса deploy, неизменяемые правила claims, лимиты, бюджет и начальную ликвидность к финальному review.
- [ ] После разрешения соответствующего денежного действия включать модули с небольшими лимитами, наблюдая реальные settled receipts и cash availability.
- [ ] Расширять лимиты только по результатам pilot; не компенсировать отрицательную экономику повышением плеча.

**Готово, когда:** пользователь видит проверяемый продукт, contracts verified, транзакции и treasury сходятся, rollback/stop сценарии отработаны. Даты внешних protocol capabilities не предсказываем.

## Порядок работы

Следующие работы: закрыть внешние вопросы этапа 1 перед live write; отдельно выбрать tokenomics и бюджет этапа 4. Общий хаб и локальный торговый lifecycle уже доступны. Vault design использует результаты adapter и симуляций; sandbox не доказывает возможности контрактного vault.

Ориентир полного объёма — **6–12 недель разработки**, плюс аудит и внешние ожидания; первичный read-only продукт — около **1–2 недель**. Эти оценки предварительные, до ABI/relayer spike и выбора tokenomics. Существующий стенд не называется готовым MVP.

Решения, которые потребуются позднее: бюджет, ticker/supply/allocation, initial liquidity, юрисдикция публичного продукта, формат rewards/buyback и максимальный допустимый убыток treasury. Их отсутствие сейчас не мешает исследовать интеграцию и строить read-only хаб.

### Дополнение после продолжения интеграции

- [x] Повторить passive source/relayer probe и сохранить ограничения; direct OPTIONS вернул 405, это не settlement proof.
- [x] Исправить ошибочную привязку historical RPC state к блоку: стандартный RPC поддерживает latest state; архивные чтения теперь требуют отдельного источника и canary.
- [x] Реализовать confirmed treasury transfer reader, балансовую сверку, local EVM receipt tests и dashboard/API. Выбор treasury/asset/archive provider и доказательства конкретных buyback/burn остаются открытыми.

Продолжение не меняет незакрытые денежные критерии этапов 1, 4–6. Исторические заметки о pinned state заменены correction в INTEGRATION.md. Актуальные проверки: 49 tests, production build, 21 HTTP checks и пять дополнительных viewport checks Treasury.
