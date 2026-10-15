import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { openWebStore } from '../packages/storage/open.js';
import { databaseConnection } from '../packages/storage/config.js';
import { runIndexer } from '../packages/indexer/runner.js';
import { indexChain } from '../packages/indexer/rpc.js';
import { checkImplementations, reviewedImplementations } from '../packages/ops/worker.js';
let store: Awaited<ReturnType<typeof openWebStore>> | undefined;
let component = 'configuration';
try {
  if (!databaseConnection(process.env))
    throw new Error('Shared database required for production operations');
  const expected = reviewedImplementations(
      JSON.parse(await readFile('research/contracts/manifest.json', 'utf8')),
    ),
    chain = indexChain();
  store = await openWebStore(process.env);
  component = 'implementations';
  const upgrades = await checkImplementations(chain, expected);
  await store.saveSnapshot('operations', 'upgrades', 'worker', Date.now(), upgrades);
  if (upgrades.status !== 'unchanged') throw new Error('Reviewed implementations changed');
  component = 'indexer';
  const indexing = await runIndexer(store, chain, expected, {
    maxBatches: Number(process.env.INDEX_MAX_BATCHES ?? 16),
    fromBlock: process.env.INDEX_FROM_BLOCK ? Number(process.env.INDEX_FROM_BLOCK) : undefined,
  });
  await store.saveSnapshot('operations', 'indexer', 'worker', Date.now(), indexing);
  const report = {
    observedAtUtc: new Date().toISOString(),
    status: indexing.caughtUp ? 'healthy' : 'behind',
    upgrades,
    indexing,
  };
  await mkdir('data/operations', { recursive: true });
  await writeFile('data/operations/worker.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  if (!indexing.caughtUp) process.exitCode = 2;
} catch {
  const failure = {
    observedAtUtc: new Date().toISOString(),
    status: 'failed',
    component,
    liveSubmission: false,
  };
  if (store)
    await store
      .saveSnapshot('operations', 'worker-failure', 'worker', Date.now(), failure)
      .catch(() => {});
  console.error(JSON.stringify(failure));
  process.exitCode = 1;
} finally {
  await store?.close();
}
