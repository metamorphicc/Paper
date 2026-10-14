import { writeFile } from 'node:fs/promises';
import { parseUnits, keccak256, toHex } from 'viem';
import { OfficialReadClient, object } from '../packages/protocol/official.js';
import {
  simulatePath,
  type Bar,
  type PathConfig,
  type Strategy,
} from '../packages/strategy/path.js';
import { WAD } from '../packages/protocol/quote.js';
const to = Math.floor(Date.now() / 900000) * 900000 - 1,
  from = to - 7 * 86400000;
const request = {
  type: 'candleSnapshot',
  req: { coin: 'BTC', interval: '15m', startTime: from, endTime: to },
};
const [response, state] = await Promise.all([
  fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(15000),
    redirect: 'error',
  }),
  new OfficialReadClient().trading(),
]);
if (!response.ok) throw new Error('Historical candle API unavailable');
const values: unknown = await response.json();
if (!Array.isArray(values) || values.length < 100 || values.length > 1000)
  throw new Error('Invalid replay window');
const bars: Bar[] = values.map((value) => {
  const row = object(value);
  if (
    row.s !== 'BTC' ||
    row.i !== '15m' ||
    typeof row.t !== 'number' ||
    typeof row.T !== 'number' ||
    !Number.isSafeInteger(row.t) ||
    !Number.isSafeInteger(row.T) ||
    row.t < from - 900000 ||
    row.T > to ||
    row.T - row.t !== 899999
  )
    throw new Error('Invalid historical candle');
  function price(key: string) {
    const value = row[key];
    if (typeof value !== 'string' || !/^\d+(\.\d{1,8})?$/.test(value))
      throw new Error('Invalid candle price');
    return (parseUnits(value, 8) * 10n) / 100000000n;
  }
  return { time: row.t, open: price('o'), high: price('h'), low: price('l'), close: price('c') };
});
if (bars.some((bar, index) => index > 0 && bar.time - bars[index - 1]!.time !== 900000))
  throw new Error('Historical candle gap; do not silently replay missing prices');
const base: PathConfig = {
  strategy: 'no-trade',
  capital: 2000n * WAD,
  margin: 100n * WAD,
  leverage: 100,
  latencyBars: 1,
  pairDelayBars: 1,
  holdBars: 2,
  cycleBars: 6,
  actionCost: WAD,
  maxLoss: 400n * WAD,
  queueProfit: true,
  releaseQueueEveryBars: null,
  outageBars: [],
  pauseBars: [],
  paperPerDollar: 100n * WAD,
  externalStake: 1000000n * WAD,
  externalStakeGrowthBps: 0,
};
const results = (['no-trade', 'long', 'paired'] as Strategy[]).map((strategy) =>
  simulatePath(bars, state, { ...base, strategy }),
);
const sensitivity = [
  { name: 'paired-with-queue-release', changes: { releaseQueueEveryBars: 24 } },
  { name: 'paired-outage', changes: { outageBars: [1, 2, 3, 4, 5] } },
  {
    name: 'paired-decay-and-dilution',
    changes: {
      emissionChanges: [{ bar: Math.floor(bars.length / 2), rate: 25n * WAD }],
      externalStakeGrowthBps: 1,
    },
  },
].map(({ name, changes }) => ({
  name,
  result: simulatePath(bars, state, { ...base, strategy: 'paired', ...changes }),
}));
const report = {
  observedAtUtc: new Date().toISOString(),
  kind: 'historical-price-scenario-not-backtest',
  source: {
    endpoint: 'https://api.hyperliquid.xyz/info',
    request,
    candles: bars.length,
    fromUtc: new Date(bars[0]!.time).toISOString(),
    throughUtc: new Date(bars.at(-1)!.time + 899999).toISOString(),
    inputHash: keccak256(toHex(JSON.stringify(values))),
    currentTradingBlock: state.indexedThroughBlock,
  },
  settings: base,
  results,
  sensitivity,
  liveExecution: false,
};
await writeFile(
  'research/path-replay.json',
  JSON.stringify(report, (_, value) => (typeof value === 'bigint' ? String(value) : value), 2) +
    '\n',
);
console.table(
  results.map(
    ({ strategy, cashRaw, queuedRaw, netEquityRaw, paperRaw, liquidations, stopped }) => ({
      strategy,
      cashRaw,
      queuedRaw,
      netEquityRaw,
      paperRaw,
      liquidations,
      stopped,
    }),
  ),
);
