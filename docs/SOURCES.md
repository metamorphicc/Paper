# Факты и источники

Проверка: 14 октября 2026, Новосибирск (UTC+7). Текст источников находится в `research/official-docs.json`, исходный asset и SHA-256 сохранены. Документация — утверждение издателя; состояние конкретной реализации нужно проверять отдельно.

## Что установлено

| Тезис | Статус и уточнение | Первичный источник |
|---|---|---|
| HyperEVM mainnet chain 999 | Официальные docs и успешный RPC read | [HyperEVM](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm) |
| BTC/ETH до 1000x; synthetic trades | Описано протоколом; параметры рынков не прочитаны live | [FAQ](https://docs.papertrade.xyz/#/intro/faq) |
| Pricing через BBO | Описано; residual manipulation risk признан | [Pricing](https://docs.papertrade.xyz/#/how/pricing-bbo), [Risk](https://docs.papertrade.xyz/#/how/risk) |
| Нет notional fee/spread/funding | Есть haircut на прибыль и win fee; абсолютное «торговля бесплатна» неверно | [Impact](https://docs.papertrade.xyz/#/how/asymmetric-impact) |
| Builder codes | В docs Not yet live / Coming soon; 1% LP-revenue carve, no firm date | [Builders](https://docs.papertrade.xyz/#/how/builder-codes) |
| Торговля и staking gated relayer | Direct calls для этих действий не открыты по docs | [Architecture](https://docs.papertrade.xyz/#/how/architecture), [Staking](https://docs.papertrade.xyz/#/paper/staking) |
| PAPER non-transferable на launch | Текущий transfer flag не проверен; нельзя предполагать открытые transfers | [PAPER](https://docs.papertrade.xyz/#/paper/overview) |
| 100 PAPER/$ | Flat launch region; для solvent close basis ниже raw loss | [Mint curve](https://docs.papertrade.xyz/#/how/mint-curve) |
| Stakers получают USDC | Fee share и excess; liquidity/queue/distribution условия существенны | [Staking](https://docs.papertrade.xyz/#/paper/staking), [Queue](https://docs.papertrade.xyz/#/how/solvency-queue) |
| Депозиты USDC | HyperCore spot flow; ERC-20 transfer в proxy не засчитывается автоматически | [Deposits](https://docs.papertrade.xyz/#/how/deposits) |
| Управление и upgrade | Owner может обновлять implementation; docs публикуют timelock 7 days и multisig 2-of-3, не проверены live | [Addresses](https://docs.papertrade.xyz/#/dev/contract-addresses), [Risk](https://docs.papertrade.xyz/#/how/risk) |
| Addresses существуют onchain | Bytecode на 11/11 опубликованных адресах, блок 48508187 | `research/chain-snapshot.json` |

Успешный RPC read стандартных методов PAPER дал symbol PAPER, decimals 18 и totalSupply `7014332481220165713285292372` base units. Это около 7,014 млрд PAPER; supply не равен staked supply и не позволяет вычислить долю treasury.

## Что остаётся неизвестным

- Проверенные ABI/source code текущих implementations и ABI/events после upgrade. Ссылки explorer доступны в docs, но получение страницы через web-инструмент не удалось.
- Live LP, queue, emissions HWM, total stake, fee/impact settings, current transfer restrictions и history оплаченных rewards. Снимок bytecode их не подтверждает.
- Relayer API, форматы/доступ стороннего frontend, поддержка contract wallet и permissionless future flow.
- Реальное время запуска builder codes и окончательная трактовка payout basis.
- Наличие официального тестового deployment Papertrade. HyperEVM testnet chain 998 сам по себе не доказывает наличие Papertrade testnet.
- Доступность exchange.papertrade.xyz из данного окружения: один HTTP запрос через PowerShell получил 404; web-fetch не вернул текст. Это не доказательство остановки сервиса или недоступности в обычном браузере.
- Доходность и безопасность PaperStrategy/PaperDAO/PaperVault. Упоминания чужих проектов не используются как evidence прибыльности нашего vault; их контракты и treasury не исследовались.

## Разделение доказательств

`official-docs.json` фиксирует опубликованную механику. `chain-snapshot.json` фиксирует конкретные публичные reads и block hash. `economics-scenarios.json` — наши условные расчёты с launch constants и заданными revenue/share, а не измерения бизнеса. Поиск нашёл сторонние публикации, но технические выводы опираются на первичные источники и собственные воспроизводимые reads.

Источники и снимки надо обновлять перед реализацией денежных операций. Если docs и source расходятся, сохраняем расхождение и проверяем implementation, а не выбираем более выгодную интерпретацию.
