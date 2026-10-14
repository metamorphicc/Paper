import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseTrading } from '../protocol/official.js';
import { WAD } from '../protocol/quote.js';
import { simulatePath, type Bar, type PathConfig } from './path.js';
const state = parseTrading(
  JSON.parse(readFileSync('research/frontend/state-trading.json', 'utf8').replace(/^\uFEFF/, '')),
);
const config: PathConfig = {
  strategy: 'paired',
  capital: 2000n * WAD,
  margin: 100n * WAD,
  leverage: 100,
  latencyBars: 1,
  pairDelayBars: 1,
  holdBars: 2,
  cycleBars: 6,
  actionCost: WAD,
  maxLoss: 400n * WAD,
  queueProfit: false,
  releaseQueueEveryBars: null,
  outageBars: [],
  pauseBars: [],
  paperPerDollar: 100n * WAD,
  externalStake: 1000n * WAD,
  externalStakeGrowthBps: 0,
};
const flat: Bar[] = Array.from({ length: 12 }, (_, i) => ({
  time: i * 900000,
  open: 1000000n,
  high: 1000000n,
  low: 1000000n,
  close: 1000000n,
}));
test('baseline holds cash; flat paired trading loses explicit costs and never values PAPER as cash', () => {
  const baseline = simulatePath(flat, state, { ...config, strategy: 'no-trade' });
  assert.equal(baseline.cashRaw, String(config.capital));
  assert.equal(baseline.netEquityRaw, '0');
  const pair = simulatePath(flat, state, config);
  assert.ok(BigInt(pair.cashRaw) < config.capital);
  assert.equal(pair.paperRaw, '0');
  assert.equal(pair.modeledHarvestRaw, '0');
  assert.equal(pair.openPositions, 0);
});
test('sequential openings expose one leg before the other; intrabar liquidation can stop further trading', () => {
  const path = flat.map((row) => ({ ...row }));
  path[1]!.low = 998000n;
  const result = simulatePath(path, state, { ...config, leverage: 1000, maxLoss: 50n * WAD });
  assert.equal(result.liquidations, 1);
  assert.equal(result.stopped, true);
  assert.ok(BigInt(result.paperRaw) > 0n);
  assert.ok(
    !result.events.some((row) => row.type === 'open-short'),
    'loss stop blocks the delayed second leg',
  );
  assert.equal(
    result.events.find((row) => row.type === 'open-long')?.bar,
    1,
    'never opens on the decision bar',
  );
});
test('outage and pauses skip scheduled opens; no future price changes earlier series', () => {
  const result = simulatePath(flat, state, { ...config, outageBars: [1], pauseBars: [2] });
  assert.ok(
    !result.events.some(
      (row) => row.bar < 3 && row.type.startsWith('open-') && row.type !== 'open-skipped',
    ),
  );
  const changed = flat.map((row) => ({ ...row }));
  changed[10] = { time: 9000000, open: 1000100n, high: 1000500n, low: 1000000n, close: 1000200n };
  assert.deepEqual(
    simulatePath(flat, state, config).series.slice(0, 10),
    simulatePath(changed, state, config).series.slice(0, 10),
  );
  assert.throws(() => simulatePath(flat, state, { ...config, latencyBars: 0 }), /timing/);
});
test('profit queues separately, distribution assumptions never manufacture baseline yield', () => {
  const path = flat.map((row) => ({ ...row }));
  path[3] = { time: 2700000, open: 1001000n, high: 1001000n, low: 1001000n, close: 1001000n };
  const result = simulatePath(path, state, {
    ...config,
    strategy: 'long',
    cycleBars: 100,
    queueProfit: true,
  });
  assert.ok(BigInt(result.queuedRaw) > 0n);
  assert.equal(result.cashRaw, String(config.capital - 2n * WAD));
  const release = simulatePath(path, state, {
    ...config,
    strategy: 'long',
    cycleBars: 100,
    queueProfit: true,
    releaseQueueEveryBars: 4,
  });
  assert.equal(release.queuedRaw, '0');
  assert.ok(BigInt(release.cashRaw) > BigInt(result.cashRaw));
});
