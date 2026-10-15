import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTradeHistory, tradeHistory } from './history.js';
import { OfficialReadClient } from './official.js';
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
test('history pagination binds the address, encodes opaque cursors and rejects repeated or oversized continuation tokens', async () => {
  const address = '0x' + '22'.repeat(20),
    cursor = 'opaque/+?filter=losses&limit=999';
  const client = new OfficialReadClient(async (input, options) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, '/query/accounts/' + address + '/trades');
    assert.equal(url.searchParams.get('cursor'), cursor);
    assert.equal(url.searchParams.get('limit'), '75');
    assert.equal(url.searchParams.get('filter'), 'all');
    assert.deepEqual([...url.searchParams.keys()], ['cursor', 'filter', 'limit']);
    assert.equal(options?.method, 'GET');
    return Response.json({ items: [], nextCursor: null });
  });
  assert.equal((await tradeHistory(address, client, cursor)).nextCursor, null);
  await assert.rejects(tradeHistory(address, client, 'x'.repeat(2049)), /cursor/);
  const looping = new OfficialReadClient(async () =>
    Response.json({ items: [], nextCursor: 'same' }),
  );
  await assert.rejects(tradeHistory(address, looping, 'same'), /repeated cursor/);
});
