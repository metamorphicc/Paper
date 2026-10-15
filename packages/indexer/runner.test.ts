import test from 'node:test';
import assert from 'node:assert/strict';
import { testPostgres } from '../storage/test-postgres.js';
import { migrateDatabase } from '../storage/schema.js';
import { WebStore } from '../storage/store.js';
import { runIndexer, type IndexChain } from './runner.js';
import { checkImplementations, reviewedImplementations } from '../ops/worker.js';
const hash = (n: number) => '0x' + n.toString(16).padStart(64, '0');
const impl = { address: '0x' + '11'.repeat(20), runtimeHash: hash(9999) };
const names = [
  'Exchange',
  'BatchExecutor',
  'PaperToken',
  'PaperStaking',
  'PaperTokenomics',
  'SessionKeyManager',
  'PriceOracle',
  'DepositProxyFactory',
];
const expected = Object.fromEntries(names.map((name) => [name, impl]));
function fixture() {
  let changed = false,
    anchorChanged = false,
    unsupported = false,
    reads = 0;
  const chunks: [number, number][] = [];
  const chain: IndexChain = {
    async chainId() {
      return 999;
    },
    async head() {
      return 303;
    },
    async assertHistoricalCapability() {
      if (unsupported) throw new Error('No archive');
    },
    async header(number) {
      return {
        number,
        timestamp: 1000 + number,
        hash: hash(number + (anchorChanged && number === 300 && reads++ > 0 ? 1 : 0)),
        parentHash: hash(number - 1),
      };
    },
    async implementation() {
      return changed ? { ...impl, runtimeHash: hash(1) } : impl;
    },
    async transfers(from, to) {
      chunks.push([from, to]);
      return from <= 110 && to >= 110
        ? [
            {
              chainId: 999,
              contract: impl.address,
              blockNumber: 110,
              blockHash: hash(110),
              txHash: hash(500),
              logIndex: 0,
              from: '0x' + '0'.repeat(40),
              to: '0x' + '22'.repeat(20),
              amountRaw: '1234567890123456789012345678901234567890',
            },
          ]
        : [];
    },
  };
  return {
    chain,
    chunks,
    change: () => {
      changed = true;
    },
    reorg: () => {
      anchorChanged = true;
      reads = 0;
    },
    noArchive: () => {
      unsupported = true;
    },
  };
}
test('bounded PostgreSQL indexing advances after restart, overlaps idempotently and reports incomplete coverage', async () => {
  const db = await testPostgres();
  try {
    await migrateDatabase(db.database);
    const store = new WebStore(db.database),
      source = fixture();
    const first = await runIndexer(store, source.chain, expected, {
      fromBlock: 100,
      maxBatches: 1,
    });
    assert.equal(first.through, 227);
    assert.equal(first.caughtUp, false);
    assert.equal(first.lagBlocks, 73);
    const next = await runIndexer(new WebStore(db.database), source.chain, expected, {
      maxBatches: 2,
    });
    assert.equal(next.through, 300);
    assert.equal(next.caughtUp, true);
    assert.equal(next.coverageFrom, 100);
    assert.equal((await store.statistics()).events, 1);
    assert.equal(
      (await store.mintedRanking())[0]!.mintedRaw,
      '1234567890123456789012345678901234567890',
    );
    assert.ok(source.chunks.every(([from, to]) => to - from < 50));
    const repeated = await runIndexer(store, source.chain, expected);
    assert.equal(repeated.batches[0]!.inserted, 0);
    source.change();
    await assert.rejects(runIndexer(store, source.chain, expected), /Implementation/);
    assert.equal((await store.cursor('paper-transfers'))!.through_block, 300);
    await assert.rejects(runIndexer(store, source.chain, expected, { maxBatches: 65 }), /bounds/);
  } finally {
    await db.close();
  }
});
test('archive, chain and anchor failures leave cursor untouched; pinned upgrade check detects changes without approving source', async () => {
  const db = await testPostgres();
  try {
    await migrateDatabase(db.database);
    const store = new WebStore(db.database);
    const unsupported = fixture();
    unsupported.noArchive();
    await assert.rejects(runIndexer(store, unsupported.chain, expected), /archive/);
    const wrong = fixture();
    wrong.chain.chainId = async () => 1;
    await assert.rejects(runIndexer(store, wrong.chain, expected), /chain/);
    const reorg = fixture();
    reorg.reorg();
    await assert.rejects(runIndexer(store, reorg.chain, expected), /anchor/);
    assert.equal(await store.cursor('paper-transfers'), undefined);
    const source = fixture();
    const report = await checkImplementations(source.chain, expected);
    assert.equal(report.status, 'unchanged');
    assert.equal(report.sourceVerification, false);
    assert.equal(report.statePinned, true);
    source.change();
    assert.equal((await checkImplementations(source.chain, expected)).status, 'changed');
    assert.deepEqual(
      reviewedImplementations({
        records: names.map((name) => ({
          name,
          implementation: impl.address,
          runtimeHash: impl.runtimeHash,
        })),
      }),
      expected,
    );
    assert.throws(() => reviewedImplementations({ records: [] }), /manifest/);
    assert.throws(
      () =>
        reviewedImplementations({
          records: names.map(() => ({
            name: 'PaperToken',
            implementation: impl.address,
            runtimeHash: impl.runtimeHash,
          })),
        }),
      /manifest/,
    );
  } finally {
    await db.close();
  }
});
