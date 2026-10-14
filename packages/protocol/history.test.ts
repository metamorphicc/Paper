import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTradeHistory } from './history.js';
test('history net PnL deducts fee once and distinguishes missing history from an empty page', () => {
  const row = {
    timestampMs: 1000,
    txHash: '0x' + '11'.repeat(32),
    positionId: '1',
    symbol: 'BTC',
    isLong: true,
    leverage: 100,
    kind: 'PositionClosed',
    marginRaw: '100000000000000000000',
    adjustedPnlRaw: '1000000000000000001',
    userPaidFeeRaw: '20000000000000000',
    paperMintedRaw: '0',
  };
  assert.equal(
    parseTradeHistory({ items: [row], nextCursor: null }).items[0]?.netPnlRaw,
    '980000000000000001',
  );
  assert.equal(parseTradeHistory({ items: [], nextCursor: null }).items.length, 0);
  assert.throws(() => parseTradeHistory({}), /Invalid/);
  assert.throws(() => parseTradeHistory({ items: [row, row], nextCursor: null }), /Duplicate/);
});
