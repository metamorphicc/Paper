import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store, type BlockRecord, type TokenEvent } from './store.js';
const hash = (digit: string) => '0x' + digit.repeat(64);
const alice = '0x' + 'aa'.repeat(20), zero = '0x' + '00'.repeat(20);
const blocks: BlockRecord[] = [{ number: 10, hash: hash('1'), parentHash: hash('0'), timestamp: 100 }, { number: 11, hash: hash('2'), parentHash: hash('1'), timestamp: 101 }];
const event: TokenEvent = { chainId: 999, contract: alice, blockNumber: 11, blockHash: hash('2'), txHash: hash('5'), logIndex: 0, from: zero, to: alice, amountRaw: '10000000000000000001' };
test('replay is idempotent and retains exact token amounts', () => {
  const store = new Store(':memory:');
  assert.equal(store.applyBatch('paper', 999, blocks, [event]).inserted, 1);
  assert.equal(store.applyBatch('paper', 999, blocks, [event]).inserted, 0);
  assert.equal(store.mintedRanking()[0]?.mintedRaw, event.amountRaw); store.close();
});
test('reorg removes orphaned events and rebuilds the cursor atomically', () => {
  const store = new Store(':memory:'); store.applyBatch('paper', 999, blocks, [event]);
  const fork = [{ ...blocks[1]!, hash: hash('3') }];
  assert.equal(store.applyBatch('paper', 999, fork, []).reorgFrom, 11);
  assert.equal(store.history(alice).length, 0); assert.equal(store.cursor('paper')?.through_block, 11); store.close();
});
test('cursor gaps, bad ancestry and mismatched log blocks never advance coverage', () => {
  const store = new Store(':memory:'); store.applyBatch('paper', 999, blocks, [event]);
  assert.throws(() => store.applyBatch('paper', 999, [{ number: 14, hash: hash('4'), parentHash: hash('3'), timestamp: 104 }], []), /gap/);
  assert.throws(() => store.applyBatch('paper', 999, blocks, [{ ...event, blockHash: hash('6') }]), /canonical/);
  assert.equal(store.cursor('paper')?.through_block, 11); store.close();
});
test('backup restores exact snapshots and coverage in a new database', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'paperclub-test-')); const file = join(directory, 'backup.sqlite');
  const store = new Store(':memory:');
  try {
    store.applyBatch('paper', 999, blocks, [event]); store.saveSnapshot('protocol', '999', 'official-indexer', 11, { amount: event.amountRaw });
    await store.backupTo(file); const restored = new Store(file);
    try { assert.equal(restored.latestSnapshot<{amount:string}>('protocol', '999')?.value.amount, event.amountRaw); assert.equal(restored.statistics().events, 1); }
    finally { restored.close(); }
  } finally { store.close(); if (!directory.startsWith(join(tmpdir(), 'paperclub-test-'))) throw new Error('Unexpected cleanup target'); rmSync(directory, { recursive: true, force: true }); }
});
