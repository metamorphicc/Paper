import { mkdir, writeFile } from 'node:fs/promises';
import { databaseConnection } from '../packages/storage/config.js';
import { openWebStore } from '../packages/storage/open.js';
import { operationStatus } from '../packages/ops/status.js';
let store: Awaited<ReturnType<typeof openWebStore>> | undefined;
try {
  if (!databaseConnection(process.env)) throw new Error('Shared PostgreSQL required');
  store = await openWebStore(process.env);
  const report = await operationStatus(store);
  await mkdir('data/operations', { recursive: true });
  await writeFile('data/operations/status.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  if (report.status !== 'healthy') process.exitCode = 1;
} catch {
  console.error('Operations status could not be read from the configured shared database.');
  process.exitCode = 1;
} finally {
  await store?.close();
}
