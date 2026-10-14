import test from 'node:test';
import assert from 'node:assert/strict';
import { pairedClose, profitableClose, rewardProjection } from './model.js';

test('deadband eliminates gains from very small price moves', () => {
  assert.equal(profitableClose(100_000, 0.00001).netGain, 0);
  assert.equal(profitableClose(100_000, 0).netGain, 0);
});
test('paired closes conserve economic equity but reduce liquid cash when wins queue', () => {
  const result = pairedClose({ marginPerLeg: 1000, leverage: 100, absoluteMove: 0.001,
    assumedPaperPerLossDollar: 100, queueActive: true, winPaidFraction: 0 });
  assert.ok(result.economicCost > 0 && result.economicCost < result.rawLoss);
  assert.ok(Math.abs(result.availableCash + result.queuedGain - (result.initialCash - result.economicCost)) < 1e-9);
  assert.equal(result.availableCash, 1900);
  assert.equal(result.mintedPaperApprox, 10_000);
});
test('rejects high leverage examples needing separate liquidation modeling', () => {
  assert.throws(() => pairedClose({ marginPerLeg: 1000, leverage: 1000, absoluteMove: 0.001,
    assumedPaperPerLossDollar: 100, queueActive: false, winPaidFraction: 1 }), /liquidation/);
  assert.throws(() => profitableClose(1, NaN));
});
test('external stake growth dilutes returns and zero revenue cannot repay positive cost', () => {
  const base = { acquisitionCost: 1000, initialStakeShare: 0.01, monthlyPaidPoolRewards: 10_000, months: 12 };
  const fixed = rewardProjection({ ...base, monthlyOtherStakeGrowth: 0 });
  const diluted = rewardProjection({ ...base, monthlyOtherStakeGrowth: 0.2 });
  assert.ok(diluted.cumulativeReceived < fixed.cumulativeReceived);
  assert.equal(fixed.breakEvenMonth, 10);
  assert.equal(rewardProjection({ ...base, monthlyPaidPoolRewards: 0, monthlyOtherStakeGrowth: 0 }).breakEvenMonth, null);
});
