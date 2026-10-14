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
