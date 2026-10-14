import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseTrading } from './official.js';
import { WAD, bustPrice, closePnl, validateOpen } from './quote.js';
const state = parseTrading(
  JSON.parse(
    readFileSync(
      new URL('../../research/frontend/state-trading.json', import.meta.url),
      'utf8',
    ).replace(/^\uFEFF/, ''),
  ),
);
const btc = state.instruments[0]!;
test('fixed-point close separates raw gain, impact and net payout', () => {
  const value = closePnl(1000n * WAD, 100, 1_000_000n, 1_001_000n, true, btc);
  assert.equal(value.rawPnl, 100n * WAD);
  assert.ok(value.netPnl > 72n * WAD && value.netPnl < 73n * WAD);
  assert.equal(closePnl(WAD, 100, 1_000_000n, 1_000_010n, true, btc).netPnl, 0n);
});
test('high leverage bust forfeits full margin before zero-equity move', () => {
  const trigger = bustPrice(1_000_000n, 1000, true, BigInt(btc.bustBufferRaw));
  assert.ok(trigger > 999_000n && trigger < 1_000_000n);
  assert.equal(bustPrice(1_234_567n, 37, true, BigInt(btc.bustBufferRaw)), 1_201_772n);
  const value = closePnl(100n * WAD, 1000, 1_000_000n, trigger, true, btc);
  assert.equal(value.netPnl, -100n * WAD);
  assert.equal(value.liquidated, true);
});
test('limits, pauses and partial decimal amounts are validated before signatures', () => {
  assert.throws(() => validateOpen('1', 100, btc, state), /margin/);
  assert.throws(() => validateOpen('10', 1, btc, state), /notional/);
  assert.throws(() => validateOpen('10', 1001, btc, state), /Leverage/);
  assert.throws(() => validateOpen('10', 100, btc, { ...state, tradingPaused: true }), /paused/);
  assert.equal(validateOpen('10.000000000000000001', 100, btc, state).margin, 10n * WAD + 1n);
});
