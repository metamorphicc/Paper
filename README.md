# Paperclub · Papertrade × мемкоин

Локальный независимый хаб на HyperEVM: обзор протокола, профиль адреса, community points, treasury и торговый терминал. Этапы 1–3 разделены на девять подэтапов с последовательными локальными коммитами. **Никаких push или публикации.** Мемкоин, buyback и vault относятся к этапам 4–6 и ещё не реализованы.

Терминал получает реальные BTC/ETH BBO и свечи. Open/close, stake/unstake/claim, withdrawal и session keys работают в явно обозначенном локальном sandbox с виртуальным балансом и отдельным signing domain. Реальная торговля, staking и депозиты отключены: verified source/ABI, third-party relayer access и settlement пока не подтверждены. Это готовый локальный прототип, не денежный production launch.

## Запуск

Windows PowerShell, Node.js 24.11.1+, npm. Next.js 16.4.0, React 19.3.0, viem 2.57.6; зависимости закреплены в lockfile.

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run index
npm.cmd run dev
```

Открыть `http://127.0.0.1:3000`. Сервер слушает loopback. Приватный ключ не нужен. Публичные профили доступны без подключения кошелька. Browser wallet используется только по действию пользователя: просмотр адреса/сети, preview и подпись локальной points-кампании.

```powershell
npm.cmd run check
npm.cmd run check:web
npm.cmd test
npm.cmd run build
# При запущенном локальном сервере:
npm.cmd run smoke:web
```

## Результат и ограничения

- 27 тестов: экономика, схемы данных/подписи, risk calculator, reorg/replay/backup, campaign proof и sandbox lifecycle.
- SQLite хранит блоки, PAPER Transfer events, cursors и снимки. Coverage частичный: первый проход 64 блока, последующие — максимум 128 за запуск. Это не lifetime leaderboard. SQLite API Node 24 experimental.
- Net PnL, available/queued USDC, PAPER и claimable rewards показаны отдельно; неизвестные данные отображаются как «—». API и RPC имеют собственные источники/блоки, exact reconciliation пока не подтверждена.
- Builder codes пока planned; доход считается нулевым. Points максимум 70 на адрес, без обещаний токенов и без награды за потери. Защита от повторных claims не доказывает уникальность человека.
- Все восемь implementations имеют bytecode, но explorer показывает unverified source. Есть расхождение collateral address между docs и frontend. Реальные write-пути остаются заблокированными в UI и transport.

## Документы

- [Подэтапы и локальные коммиты](docs/IMPLEMENTATION.md)
- [Запуск, данные и sandbox](docs/LOCAL_APP.md)
- [Проверки и браузерное QA](docs/QA.md)
- [Интеграция и открытые внешние вопросы](docs/INTEGRATION.md)
- [Полный план этапов 1–6](docs/PLAN.md)
- [Оценка идеи](docs/ASSESSMENT.md), [архитектура](docs/ARCHITECTURE.md), [источники](docs/SOURCES.md)

`research/` содержит публичные снимки с UTC-временем и происхождением. `data/` с локальной SQLite, `.env` и runtime build files исключены из Git. Скрипты исследовательских reads: `capture`, `probe`, `read:protocol`, `validate:integration`; `simulate` — условная модель, не прогноз доходности. `.env.example` показывает конфигурацию; standalone-скрипты получают переменные из PowerShell, Next также читает свою `.env.local`.
