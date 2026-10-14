import { formatUnits } from 'viem';
import { closePnl, bustPrice, validateOpen, WAD } from '../protocol/quote.js';
import type { TradingState } from '../protocol/official.js';
export type Bar = { time: number; open: bigint; high: bigint; low: bigint; close: bigint };
export type Strategy = 'no-trade' | 'long' | 'paired';
export type PathConfig = {
  strategy: Strategy;
  capital: bigint;
  margin: bigint;
  leverage: number;
  latencyBars: number;
  pairDelayBars: number;
  holdBars: number;
  cycleBars: number;
  actionCost: bigint;
  maxLoss: bigint;
  queueProfit: boolean;
  releaseQueueEveryBars: number | null;
  outageBars: number[];
  pauseBars: number[];
  paperPerDollar: bigint;
  emissionChanges?: { bar: number; rate: bigint }[];
  rewardDistributions?: { bar: number; amount: bigint }[];
  externalStake: bigint;
  externalStakeGrowthBps: number;
};
type Position = { id: number; long: boolean; entry: bigint; opened: number };
export function simulatePath(bars: Bar[], state: TradingState, config: PathConfig) {
  if (
    !bars.length ||
    bars.length > 10000 ||
    config.capital <= 0n ||
    config.margin <= 0n ||
    config.actionCost < 0n ||
    config.maxLoss <= 0n ||
    config.maxLoss > config.capital ||
    config.paperPerDollar < 0n ||
    config.externalStake < 0n ||
    !['no-trade', 'long', 'paired'].includes(config.strategy)
  )
    throw new Error('Invalid path inputs');
  for (const field of [
    'latencyBars',
    'pairDelayBars',
    'holdBars',
    'cycleBars',
    'externalStakeGrowthBps',
  ] as const)
    if (!Number.isSafeInteger(config[field]) || config[field] < 0)
      throw new Error('Invalid timing inputs');
  if (
    config.latencyBars < 1 ||
    config.holdBars < 1 ||
    config.cycleBars < 1 ||
    config.externalStakeGrowthBps > 10000 ||
    (config.releaseQueueEveryBars !== null &&
      (!Number.isSafeInteger(config.releaseQueueEveryBars) || config.releaseQueueEveryBars < 1))
  )
    throw new Error('Invalid timing inputs');
  const checkBar = (index: number) =>
    Number.isSafeInteger(index) && index >= 0 && index < bars.length;
  if (
    [...config.pauseBars, ...config.outageBars].some((index) => !checkBar(index)) ||
    (config.emissionChanges ?? []).some((row) => !checkBar(row.bar) || row.rate < 0n) ||
    (config.rewardDistributions ?? []).some((row) => !checkBar(row.bar) || row.amount < 0n)
  )
    throw new Error('Invalid scenario schedule');
  if (
    bars.some(
      (bar, index) =>
        !Number.isSafeInteger(bar.time) ||
        bar.time < 0 ||
        bar.low <= 0n ||
        bar.high < bar.low ||
        bar.open < bar.low ||
        bar.open > bar.high ||
        bar.close < bar.low ||
        bar.close > bar.high ||
        (index > 0 && bar.time <= bars[index - 1]!.time),
    )
  )
    throw new Error('Invalid price path');
  const instrument = state.instruments.find((row) => row.symbol === 'BTC');
  if (!instrument) throw new Error('BTC market required');
  if (config.strategy !== 'no-trade')
    validateOpen(formatUnits(config.margin, 18), config.leverage, instrument, state);
  let cash = config.capital,
    queue = 0n,
    paper = 0n,
    harvest = 0n,
    externalStake = config.externalStake,
    costs = 0n,
    rate = config.paperPerDollar;
  let positions: Position[] = [],
    nextId = 0,
    stopped = false,
    peak = config.capital,
    maxDrawdown = 0n,
    liquidations = 0;
  const scheduled: { bar: number; long: boolean }[] = [],
    events: { bar: number; type: string; id?: number; amountRaw?: string }[] = [],
    series: {
      time: number;
      cashRaw: string;
      queuedRaw: string;
      equityRaw: string;
      paperRaw: string;
      positions: number;
    }[] = [];
  function cost(bar: number) {
    const paid = cash < config.actionCost ? cash : config.actionCost;
    cash -= paid;
    costs += paid;
    events.push({ bar, type: 'action-cost', amountRaw: String(paid) });
  }
  function close(position: Position, price: bigint, bar: number, liquidation = false) {
    const value = closePnl(
      config.margin,
      config.leverage,
      position.entry,
      price,
      position.long,
      instrument!,
    );
    if (value.netPnl > 0n && config.queueProfit) {
      cash += config.margin;
      queue += value.netPnl;
    } else cash += config.margin + value.netPnl;
    if (value.netPnl < 0n) {
      const basis =
        liquidation || config.queueProfit ? -value.netPnl : (-value.netPnl * 98n) / 100n;
      paper += (basis * rate) / WAD;
    }
    if (liquidation) liquidations++;
    else cost(bar);
    positions = positions.filter((row) => row.id !== position.id);
    events.push({
      bar,
      type: liquidation ? 'liquidation' : 'close',
      id: position.id,
      amountRaw: String(value.netPnl),
    });
  }
  function equity(price: bigint) {
    return (
      cash +
      queue +
      positions.reduce(
        (sum, p) =>
          sum +
          config.margin +
          closePnl(config.margin, config.leverage, p.entry, price, p.long, instrument!).netPnl,
        0n,
      )
    );
  }
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i]!,
      outage = config.outageBars.includes(i),
      paused = config.pauseBars.includes(i);
    for (const change of config.emissionChanges ?? []) if (change.bar === i) rate = change.rate;
    // Requests created at a completed prior bar execute at a later bar's open.
    for (const position of [...positions])
      if (i - position.opened >= config.holdBars && !outage) close(position, bar.open, i);
    for (const request of scheduled.filter((row) => row.bar === i)) {
      if (stopped || outage || paused || cash < config.margin + config.actionCost) {
        events.push({ bar: i, type: 'open-skipped' });
        continue;
      }
      cost(i);
      cash -= config.margin;
      const position = { id: ++nextId, long: request.long, entry: bar.open, opened: i };
      positions.push(position);
      events.push({ bar: i, type: request.long ? 'open-long' : 'open-short', id: position.id });
    }
    // Conservative OHLC liquidation: ordering within the candle is unknown.
    for (const position of [...positions]) {
      const bust = bustPrice(
        position.entry,
        config.leverage,
        position.long,
        BigInt(instrument.bustBufferRaw),
      );
      if (position.long ? bar.low <= bust : bar.high >= bust) close(position, bust, i, true);
    }
    if (
      config.releaseQueueEveryBars &&
      i > 0 &&
      i % config.releaseQueueEveryBars === 0 &&
      !outage
    ) {
      cash += queue;
      events.push({ bar: i, type: 'queue-release', amountRaw: String(queue) });
      queue = 0n;
    }
    externalStake = (externalStake * BigInt(10000 + config.externalStakeGrowthBps)) / 10000n;
    for (const distribution of config.rewardDistributions ?? [])
      if (distribution.bar === i && paper > 0n) {
        const reward = (distribution.amount * paper) / (paper + externalStake);
        cash += reward;
        harvest += reward;
        events.push({ bar: i, type: 'modeled-harvest', amountRaw: String(reward) });
      }
    const value = equity(bar.close);
    if (value > peak) peak = value;
    if (peak - value > maxDrawdown) maxDrawdown = peak - value;
    if (config.capital - value >= config.maxLoss && !stopped) {
      stopped = true;
      events.push({ bar: i, type: 'loss-limit-stop' });
    }
    // Fixed cadence uses no future candle to decide an order.
    if (!stopped && config.strategy !== 'no-trade' && i % config.cycleBars === 0) {
      scheduled.push({ bar: i + config.latencyBars, long: true });
      if (config.strategy === 'paired')
        scheduled.push({ bar: i + config.latencyBars + config.pairDelayBars, long: false });
    }
    series.push({
      time: bar.time,
      cashRaw: String(cash),
      queuedRaw: String(queue),
      equityRaw: String(value),
      paperRaw: String(paper),
      positions: positions.length,
    });
  }
  const last = series.at(-1)!;
  return {
    strategy: config.strategy,
    capitalRaw: String(config.capital),
    cashRaw: last.cashRaw,
    queuedRaw: last.queuedRaw,
    equityRaw: last.equityRaw,
    netEquityRaw: String(BigInt(last.equityRaw) - config.capital),
    paperRaw: String(paper),
    modeledHarvestRaw: String(harvest),
    actionCostsRaw: String(costs),
    maxDrawdownRaw: String(maxDrawdown),
    liquidations,
    stopped,
    openPositions: positions.length,
    series,
    events,
    liveExecution: false,
    assumptions: [
      'OHLC ordering is unknown; adverse intrabar extremes trigger conservative liquidation.',
      'Automatic liquidation is assumed to continue during our relayer outage.',
      'Orders execute at later opens; no future candle enters order decisions.',
      'Current impact/buffer is held constant; historical parameter changes are unknown.',
      'PAPER mint rate, distribution and stake growth are explicit scenario assumptions.',
      'PAPER has no assigned cash value; queued profit is excluded from spendable cash.',
      'Action costs are USDC-equivalent scenario inputs, not measured protocol charges.',
    ],
  };
}
