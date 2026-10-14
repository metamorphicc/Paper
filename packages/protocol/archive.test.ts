import test from 'node:test';
import assert from 'node:assert/strict';
import { assertHistoricalState, type HistoricalRpc } from './archive.js';
const sentinel = '0x0000000000000000000000000000000000000001' as const;
test('archive canary rejects providers that silently serve latest code or call results for genesis', async () => {
  const rpc: HistoricalRpc = {
    getBytecode: async ({ blockNumber }) => (blockNumber === 0n ? '0x' : '0x6000'),
    call: async () => ({ data: '0x' }),
  };
  assert.equal((await assertHistoricalState(rpc, sentinel)).historicalCanaryPassed, true);
  await assert.rejects(
    assertHistoricalState({ ...rpc, getBytecode: async () => '0x6000' }, sentinel),
    /unsupported/,
  );
  await assert.rejects(
    assertHistoricalState({ ...rpc, call: async () => ({ data: '0x01' }) }, sentinel),
    /unsupported/,
  );
  await assert.rejects(
    assertHistoricalState(
      {
        ...rpc,
        call: async () => {
          throw new Error('Archive unavailable');
        },
      },
      sentinel,
    ),
    /unavailable/,
  );
});
