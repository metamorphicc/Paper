# Strategy research

This is a research model, not a deployed strategy or validated performance forecast. Capital is hypothetical. No treasury or user funds are traded. Contract-wallet compatibility and official relayer settlement are still unverified.

## Path model

Orders are decided after a completed candle and execute at a later candle's open. Long and short legs can open in different candles; they are not treated as atomic. Each position closes after its own holding period. Opens can be skipped during pauses/outage or insufficient cash. Existing exposure still faces conservative intrabar liquidation; automatic external liquidation during our outage is an explicit assumption.

OHLC bars do not reveal tick order or precompile BBO. Adverse low/high reaching bust price causes full-margin loss. Current impact/buffer settings are held constant, with documented 2% win-fee assumption. Real historical changes, relayer price enforcement, queue solvency and latency distribution are unknown. Therefore historical prices with current parameters are a scenario replay, not a historical backtest.

Compare no-trade baseline, periodic long and delayed paired positions. Inputs include capital, margin, leverage, latency, holding/cycle intervals, USDC-equivalent action costs and maximum loss. A loss stop prevents new openings; it cannot undo existing exposure or bypass an unavailable relayer.

PAPER is a separate unpriced asset. Mint rate, emission changes, external stake growth and pool distributions are scenario inputs, not measured future yields. Only explicitly modeled distributions add harvested USDC; a zero-distribution scenario cannot create yield. Queued profit contributes to economic equity but never to spendable cash until a modeled keeper release. Native gas and bridging fees need separate measurement before any pilot.

Initial research scenarios use $2,000 hypothetical capital, $100 margin per leg, 100x leverage, one-bar latency and delay, two-bar holds, six-bar cycles, $1 action costs and a $400 maximum-loss stop. These are test settings, not approved risk limits. A 15-minute candle model cannot estimate actual millisecond execution and misses liquidation paths between ticks.

Tests cover no-trade cash conservation, flat-price costs, delayed one-leg liquidation, no-lookahead prefix equality, outage/pauses, queued payout and release. Full token balances are never assigned a presumed USDC price.

## Reproducible price replay

`npm.cmd run strategy:replay` fetches the latest seven days of completed BTC 15-minute OHLC bars from the [Hyperliquid candleSnapshot API](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint), rejects gaps/unclosed bars and saves request, input hash, current parameter block, scenario inputs and full model results in `research/path-replay.json`. Current live config is not presented as historical config.

The first captured run ended with baseline cash $2,000. The paired scenario had about $1,155 spendable cash, $429 queued profit and −$416 economic result. The $400 loss-stop triggered, but did not cap final loss: existing exposure continued. PAPER was tracked separately without cash valuation. The long scenario also triggered its stop. This result does not validate farming profitability or justify higher leverage, public deposits or a capital pilot.

## Cash-only vault accounting

`CashVaultModel` is an isolated accounting model, not a Solidity vault or public custody API. Shares price cash NAV only. Requesting redemption burns shares and moves cash into a reserved payment ticket; later deposits cannot fund that ticket. Existing queued/PAPER beneficial entitlements are allocated to holders at accrual and remain attached to their accounts after shares burn. A new depositor does not inherit earlier entitlements. Queue settlement creates a separate cash claim; it does not spend the vault's deposit cash.

Tests cover loss allocation, partial redemption, exact reserved payments, replay rejection, queue settlement after exit, deposit isolation, rounding and exhausted NAV. The model does not solve open-position NAV, bridge settlement, actual non-transferable PAPER distribution or contract-wallet execution. Those issues and independent audit block a deployable public vault. The Research page shows modeled scenarios and this boundary; it provides no deposit/trading action.
