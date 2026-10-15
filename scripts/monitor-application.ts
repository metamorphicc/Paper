import { mkdir, writeFile } from 'node:fs/promises';
import { probeApplication } from '../packages/ops/application.js';
try {
  const origin = process.env.PAPERCLUB_APP_ORIGIN;
  if (!origin) throw new Error('Set PAPERCLUB_APP_ORIGIN for the deployed application');
  const report = await probeApplication(origin);
  await mkdir('data/operations', { recursive: true });
  await writeFile('data/operations/application.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  if (report.status !== 'healthy') process.exitCode = 1;
} catch {
  console.error('Application monitoring failed. Check the configured HTTPS origin and deployment.');
  process.exitCode = 1;
}
