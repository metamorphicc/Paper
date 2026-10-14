import test from 'node:test';
import assert from 'node:assert/strict';
import { spendingCapacity, validateBuyback } from './policy.js';
test('buyback budget excludes queued claims and is bounded by cash, net realized revenue and period limits', () => {
  const policy = {
    reserveRaw: 80n,
    periodLimitRaw: 15n,
    spentRaw: 5n,
    maxImpactBps: 100,
    maxQuoteAgeMs: 1000,
  };
  assert.equal(spendingCapacity(100n, 1000n, policy), 10n);
  assert.equal(
    spendingCapacity(100n, 0n, policy),
    0n,
    'zero revenue forbids spending capital as profit',
  );
  const quote = {
    spendRaw: 10n,
    expectedOutRaw: 100n,
    minimumOutRaw: 95n,
    impactBps: 50,
    observedAtMs: 1000,
  };
  assert.equal(validateBuyback(100n, 20n, policy, quote, 1500).executionEnabled, false);
  assert.throws(() => validateBuyback(100n, 20n, policy, { ...quote, spendRaw: 11n }, 1500));
  assert.throws(() => validateBuyback(100n, 20n, policy, { ...quote, impactBps: 101 }, 1500));
  assert.throws(() => validateBuyback(100n, 20n, policy, quote, 2001));
});
