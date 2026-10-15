import test from 'node:test';
import assert from 'node:assert/strict';
import { privateKeyToAccount } from 'viem/accounts';
import { testPostgres } from './test-postgres.js';
import { migrateDatabase } from './schema.js';
import { WebStore } from './store.js';
import { exportDatabase, restoreDatabase } from './backup.js';
import { PersistentCampaign } from '../community/persistent.js';
import type { BlockRecord, TokenEvent } from '../indexer/store.js';
const hash = (n: string) => '0x' + n.repeat(64),
  alice = '0x' + 'aa'.repeat(20),
  zero = '0x' + '00'.repeat(20);
const blocks: BlockRecord[] = [
  { number: 10, hash: hash('1'), parentHash: hash('0'), timestamp: 100 },
  { number: 11, hash: hash('2'), parentHash: hash('1'), timestamp: 101 },
];
const event: TokenEvent = {
  chainId: 999,
  contract: alice,
  blockNumber: 11,
  blockHash: hash('2'),
  txHash: hash('5'),
  logIndex: 0,
  from: zero,
  to: alice,
  amountRaw: '100000000000000000000000000000000000000000000001',
};
test('PostgreSQL indexer conserves exact amounts through concurrent replay, rejects conflicts/gaps and atomically replaces a reorg', async () => {
  const fixture = await testPostgres();
  try {
    await migrateDatabase(fixture.database);
    const store = new WebStore(fixture.database);
    const result = await Promise.all([
      store.applyBatch('paper', 999, blocks, [event]),
      store.applyBatch('paper', 999, blocks, [event]),
    ]);
    assert.equal(
      result.reduce((sum, row) => sum + row.inserted, 0),
      1,
    );
    assert.equal((await store.mintedRanking())[0]!.mintedRaw, event.amountRaw);
    await assert.rejects(
      store.applyBatch('paper', 999, blocks, [{ ...event, amountRaw: '1' }]),
      /Conflicting/,
    );
    await assert.rejects(
      store.applyBatch(
        'paper',
        999,
        [{ number: 14, hash: hash('4'), parentHash: hash('3'), timestamp: 104 }],
        [],
      ),
      /gap/,
    );
    assert.equal((await store.cursor('paper'))!.through_block, 11);
    assert.equal(
      (await store.applyBatch('paper', 999, [{ ...blocks[1]!, hash: hash('3') }], [])).reorgFrom,
      11,
    );
    assert.equal((await store.history(alice)).length, 0);
    assert.equal((await store.statistics()).events, 0);
  } finally {
    await fixture.close();
  }
});
test('consistent database export restores campaign and index state only into an empty target, including serial counters', async () => {
  const source = await testPostgres(),
    target = await testPostgres();
  try {
    await migrateDatabase(source.database);
    await migrateDatabase(target.database);
    const store = new WebStore(source.database),
      restored = new WebStore(target.database);
    await store.applyBatch('paper', 999, blocks, [event]);
    await store.saveSnapshot('protocol', '999', 'official-indexer', 11, { raw: event.amountRaw });
    const wallet = privateKeyToAccount(('0x' + '22'.repeat(32)) as `0x${string}`),
      origin = 'http://127.0.0.1:3000';
    const campaign = new PersistentCampaign(source.database),
      challenge = await campaign.issue(wallet.address, 'join', origin);
    const signature = await wallet.signMessage({ message: challenge.message });
    await campaign.claim({ id: challenge.id, signature, origin });
    const backup = await exportDatabase(source.database);
    const damaged = structuredClone(backup);
    damaged.tables.events[0]!.amount_raw = '1';
    await assert.rejects(restoreDatabase(target.database, damaged), /checksum/);
    const result = await restoreDatabase(target.database, backup);
    assert.equal(result.replacedExistingData, false);
    assert.equal((await restored.mintedRanking())[0]!.mintedRaw, event.amountRaw);
    const replay = new PersistentCampaign(target.database);
    assert.equal((await replay.participant(wallet.address)).total, 10);
    await assert.rejects(replay.claim({ id: challenge.id, signature, origin }), /used/);
    await assert.rejects(restoreDatabase(target.database, backup), /empty/);
    await restored.saveSnapshot('protocol', '999', 'official-indexer', 12, { raw: 'new' });
    await restored.applyBatch('paper', 999, blocks, [event]);
    assert.equal(
      (await restored.latestSnapshot<{ raw: string }>('protocol', '999'))!.value.raw,
      'new',
    );
    assert.equal((await restored.statistics()).events, 1);
  } finally {
    await target.close();
    await source.close();
  }
});
