# Strategy research

This is a research model, not a deployed strategy or validated performance forecast. Capital is hypothetical. No treasury or user funds are traded. Contract-wallet compatibility and official relayer settlement are still unverified.

## Path model

Orders are decided after a completed candle and execute at a later candle's open. Long and short legs can open in different candles; they are not treated as atomic. Each position closes after its own holding period. Opens can be skipped during pauses/outage or insufficient cash. Existing exposure still faces conservative intrabar liquidation; automatic external liquidation during our outage is an explicit assumption.

OHLC bars do not reveal tick order or precompile BBO. Adverse low/high reaching bust price causes full-margin loss. Current impact/buffer settings are held constant, with documented 2% win-fee assumption. Real historical changes, relayer price enforcement, queue solvency and latency distribution are unknown. Therefore historical prices with current parameters are a scenario replay, not a historical backtest.

Compare no-trade baseline, periodic long and delayed paired positions. Inputs include capital, margin, leverage, latency, holding/cycle intervals, USDC-equivalent action costs and maximum loss. A loss stop prevents new openings; it cannot undo existing exposure or bypass an unavailable relayer.

PAPER is a separate unpriced asset. Mint rate, emission changes, external stake growth and pool distributions are scenario inputs, not measured future yields. Only explicitly modeled distributions add harvested USDC; a zero-distribution scenario cannot create yield. Queued profit contributes to economic equity but never to spendable cash until a modeled keeper release. Native gas and bridging fees need separate measurement before any pilot.

Initial research scenarios use $2,000 hypothetical capital, $100 margin per leg, 100x leverage, one-bar latency and delay, two-bar holds, six-bar cycles, $1 action costs and a $400 maximum-loss stop. These are test settings, not approved risk limits. A 15-minute candle model cannot estimate actual millisecond execution and misses liquidation paths between ticks.

Tests cover no-trade cash conservation, flat-price costs, delayed one-leg liquidation, no-lookahead prefix equality, outage/pauses, queued payout and release. Full token balances are never assigned a presumed USDC price.
