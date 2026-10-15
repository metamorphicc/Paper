# Локальная версия Paperclub

Рабочее название — Paperclub. Это независимый продукт, не официальный frontend Papertrade. Сеть для просмотра — HyperEVM 999.

## Запуск

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run index
npm.cmd run dev
```

Приложение: `http://127.0.0.1:3000`. Dev server слушает loopback. Проверка root и profile API дала HTTP 200. Для production-сборки локально: `npm.cmd run build`, затем `npm.cmd run start --workspace=@paperclub/web`.

## Данные

`data/paperclub.sqlite` — локальный persistent store, исключён из Git. SQLite Node 24 пока experimental; это локальный стенд. Production storage требует отдельного решения и эксплуатационных проверок. Индексатор сохраняет полные block headers, standard PAPER Transfer logs и coverage cursor; повторный запуск обрабатывает overlap для reorg. Начальный диапазон ограничен 64 блоками, расширение максимум 128 блоков за запуск. Укажите `INDEX_FROM_BLOCK` для более раннего старта в новой базе. Lifetime-статистика не вычисляется из такого частичного диапазона.

Official protocol/wallet snapshots хранятся с источником, block и временем. При ошибке API отображается stale cache, а не нулевые balances. Exact chain reconciliation пока не подтверждена. Пользовательские available и queued средства, PAPER и net realized PnL показаны раздельно.

## Кампания

`founding-01`: join 10 points, риск-квиз 40, tracking собственного подписанного адреса 20. Максимум 70 points. Wallet proof EIP-191 связан с origin, campaign, action, nonce и expiry. Challenge одноразовый; повторный claim одного action не увеличивает points. Нужен browser wallet и chain 999. Points не дают права на токены или выплаты; торговля, потери и объём не награждаются.

Anti-abuse ограничивает повторные claims и rate challenge issuance. Это не доказательство уникальности человека и не полная защита от sybil. Реальные metrics показывают подтверждённых локальных участников и повторные подписанные действия в другой день. Цели pilot предварительные: 20 активных адресов, 30% returning share; CAC и допустимая стоимость требуют бюджета пользователя.

Treasury без `TREASURY_ADDRESS` показывает неизвестные значения. Если задать публичный адрес через переменную окружения, используется тот же wallet reader. Buyback и денежные операции этого этапа не включены.

## Терминал

`/trade`: BTC/ETH BBO midpoint, 24 часа 15-минутных свечей, bigint risk calculator с текущим impact/buffer и documented win-fee assumption. Получение цены не гарантирует цену исполнения. Margin/notional/leverage проверяются по live trading state. Preview официальной схемы не подписывается и не отправляется; nonce в preview — placeholder.

«Попробовать локально» активирует sandbox с 2 500 виртуальными USDC. Он использует публичные демонстрационные ключи, отдельный domain `Paperclub Sandbox` и zero verifying contract. Эти ключи не предназначены для средств. Sandbox сохраняется в localStorage; Cross-tab mutations сериализованы через Navigator Locks. Retry использует прежний intent ID, queued profit показывается отдельно. Можно проверить timeout, lost response, expiry/cancel, staking/claim, withdrawal, session registration/revoke и outage. Резервы pending open/withdraw не позволяют потратить одни средства дважды. Модельный PAPER mint/reward не является прогнозом протокола.

Реальные open/close/staking/deposit/withdrawal выключены; `/api/intents` отвечает 403. Кнопки аварийного выхода ведут в официальный интерфейс и docs; calldata по неподтверждённому ABI не формируется. Browser wallet connection и community signing не проверены с кошельком пользователя; signature verification покрыта тестовыми EOA. EIP-1271 не подтверждён.

## Проверки и хранение

`npm.cmd run check`, `npm.cmd run check:web`, `npm.cmd test`, `npm.cmd run build`. `npm.cmd run smoke:web` требует сервер на loopback:3000; читает страницы, BBO, публичные профили и проверяет блокировку live intents/wrong origin. Отчёт — `research/http-smoke.json`, браузерные evidence — `artifacts/qa/`. Последние 75 trades из official API; net PnL = adjusted PnL − user-paid fee один раз. Нет history page при ошибке — это «недоступно», не «нет сделок».

Индексатор запускается вручную через `npm.cmd run index`. Coverage и последняя проверка — `research/index-run.json`. Store имеет online `backupTo` и restore/replay tests; production scheduler, deployment и эксплуатационная система backups здесь не настроены.

После QA управляемый агентом preview остановлен. Запустите `npm.cmd run dev` для просмотра; Ctrl+C завершает сервер. Никаких файлов в удалённый репозиторий или hosting не отправлялось.

## Workspace installation and Vercel build

The web workspace directly declares `viem@2.57.6` as a runtime dependency, plus `typescript@7.0.2` and `@types/node@26.6.5` as build dependencies. Root dependencies support research scripts; they must not be the only declaration of packages imported by the website. The shared root `package-lock.json` records both consumers.

For a Vercel project using Root Directory `apps/web`, keep the repository files outside that directory available: the app imports `packages/`, `config/`, `research/` and root `tokens.css`. Build command: `npm run build`. Use Node 24.11.1+ and install development dependencies for the build. A workspace-scoped install can run from the repository root:

```powershell
npm.cmd ci --workspace=@paperclub/web --include-workspace-root=false --include=dev --ignore-scripts
npm.cmd run build --workspace=@paperclub/web
```

The missing-dependency error was reproduced in an isolated temporary checkout using the original manifests and a workspace-only install: `terminal.tsx`, sandbox and other components could not resolve viem. After the manifest/lockfile fix, a separate checkout installed 97 packages without the root research toolchain; the complete webpack build and TypeScript check passed on Windows, Node 24.11.1/npm 11.3.0. No existing node_modules, environment file or application database was copied. This validates the build fix locally; no Vercel deployment or hosted runtime was tested.

References: [Next.js module resolution errors](https://nextjs.org/docs/messages/module-not-found), [Vercel monorepos](https://vercel.com/docs/monorepos). Existing local-storage/API/release limitations still apply; this dependency fix does not enable public money operations.
