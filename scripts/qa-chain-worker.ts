import { readFile, writeFile } from 'node:fs/promises';
import { testPostgres } from '../packages/storage/test-postgres.js';
import { migrateDatabase } from '../packages/storage/schema.js';
import { WebStore } from '../packages/storage/store.js';
import { indexChain } from '../packages/indexer/rpc.js';
import { runIndexer } from '../packages/indexer/runner.js';
import { checkImplementations, reviewedImplementations } from '../packages/ops/worker.js';
const fixture = await testPostgres();
try {
  await migrateDatabase(fixture.database);
  const store = new WebStore(fixture.database),
    chain = indexChain();
  const expected = reviewedImplementations(
    JSON.parse(await readFile('research/contracts/manifest.json', 'utf8')),
  );
  const upgrades = await checkImplementations(chain, expected);
  if (upgrades.status !== 'unchanged') throw new Error('Implementation changed');
  const indexing = await runIndexer(store, chain, expected);
  const report = {
    observedAtUtc: new Date().toISOString(),
    scope: 'public read-only RPC with isolated PostgreSQL fixture',
    productionDatabaseUsed: false,
    financialWrites: false,
    schedulerActivated: false,
    upgrades,
    indexing,
    statistics: await store.statistics(),
  };
  await writeFile('research/operations-chain-qa.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} catch {
  console.error(
    'Read-only worker rehearsal failed; inspect archive capability, provider availability and reviewed manifest. No production database was used.',
  );
  process.exitCode = 1;
} finally {
  await fixture.close();
}
