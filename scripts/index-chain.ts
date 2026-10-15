import { readFile, writeFile } from 'node:fs/promises';
import { openWebStore } from '../packages/storage/open.js';
import { runIndexer } from '../packages/indexer/runner.js';
import { indexChain } from '../packages/indexer/rpc.js';
import { reviewedImplementations } from '../packages/ops/worker.js';
let store: Awaited<ReturnType<typeof openWebStore>> | undefined;
try {
  const expected = reviewedImplementations(
    JSON.parse(
      await readFile(new URL('../research/contracts/manifest.json', import.meta.url), 'utf8'),
    ),
  );
  store = await openWebStore(process.env);
  const result = await runIndexer(store, indexChain(), expected, {
    maxBatches: Number(process.env.INDEX_MAX_BATCHES ?? 1),
    fromBlock: process.env.INDEX_FROM_BLOCK ? Number(process.env.INDEX_FROM_BLOCK) : undefined,
  });
  const statistics = await store.statistics();
  await writeFile(
    new URL('../research/index-run.json', import.meta.url),
    JSON.stringify({ result, statistics }, null, 2) + '\n',
  );
  console.log(JSON.stringify(result));
  if (!result.caughtUp) process.exitCode = 2;
} catch {
  console.error(
    'Indexer stopped. Check archive RPC availability, reviewed implementation, canonical overlap and database configuration.',
  );
  process.exitCode = 1;
} finally {
  await store?.close();
}
