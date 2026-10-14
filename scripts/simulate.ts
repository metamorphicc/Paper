import { mkdir, writeFile } from 'node:fs/promises';
import { pairedClose, rewardProjection } from '../packages/economics/model.js';

const base = {
  marginPerLeg: 1000,
  leverage: 100,
  absoluteMove: 0.001,
  assumedPaperPerLossDollar: 100,
};
const pairs = [
  {
    name: 'illustrative-solvent-close',
    ...pairedClose({ ...base, queueActive: false, winPaidFraction: 1 }),
  },
  {
    name: 'illustrative-queued-win',
    ...pairedClose({ ...base, queueActive: true, winPaidFraction: 0 }),
  },
];
const projections = [
  { name: 'zero-paid-revenue', paidRewards: 0, otherGrowth: 0.2 },
  { name: 'hypothetical-stable-revenue', paidRewards: 10_000, otherGrowth: 0 },
  { name: 'same-revenue-with-dilution', paidRewards: 10_000, otherGrowth: 0.2 },
].map((row) => ({
  name: row.name,
  ...rewardProjection({
    acquisitionCost: 1000,
    initialStakeShare: 0.01,
    monthlyPaidPoolRewards: row.paidRewards,
    monthlyOtherStakeGrowth: row.otherGrowth,
    months: 12,
  }),
}));
const report = {
  generatedAtUtc: new Date().toISOString(),
  kind: 'illustrative-scenarios-not-live-forecast',
  assumptions: [
    'BTC launch impact constants from official docs, not confirmed as current onchain values.',
    'Both legs enter and close at identical timestamps/prices; real relayer execution may differ.',
    'No liquidations, MEV, gaps, extra execution costs, market pause or changing admin parameters.',
    'Fixed 100 PAPER per eligible dollar for examples only, not the current emission rate.',
    'Queue-active case assumes the winning payout remains queued; actual timing depends on harvest and cash.',
    'PAPER has no assumed liquid market price and is not valued as cash.',
    'Revenue and stake-share scenarios are hypothetical inputs, not measured protocol returns.',
    'Builder revenue set to zero in the business plan until launch and payout basis verification.',
    'Stake owned by the model is constant; external stake grows once per month after distribution.',
  ],
  pairs,
  projections,
};
await mkdir(new URL('../research/', import.meta.url), { recursive: true });
await writeFile(
  new URL('../research/economics-scenarios.json', import.meta.url),
  JSON.stringify(report, null, 2) + '\n',
);
console.table(
  pairs.map((row) => ({
    scenario: row.name,
    netCostUSD: row.economicCost.toFixed(2),
    liquidUSD: row.availableCash.toFixed(2),
    queuedUSD: row.queuedGain.toFixed(2),
    paperApprox: row.mintedPaperApprox,
  })),
);
console.table(
  projections.map((row) => ({
    scenario: row.name,
    received12mUSD: row.cumulativeReceived.toFixed(2),
    breakEvenMonth: row.breakEvenMonth,
  })),
);
