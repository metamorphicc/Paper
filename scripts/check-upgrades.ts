import { readFile, writeFile } from 'node:fs/promises';
import { readProtocol } from '../packages/protocol/read.js';
import { compareImplementations } from '../packages/ops/upgrades.js';
const expected = JSON.parse(await readFile('research/contracts/manifest.json', 'utf8')) as {
  records: { name: string; implementation: string; runtimeHash: string }[];
};
let report: unknown;
try {
  const observed = await readProtocol();
  const comparison = compareImplementations(
    Object.fromEntries(
      expected.records.map((row) => [
        row.name,
        { address: row.implementation, runtimeHash: row.runtimeHash },
      ]),
    ),
    observed.implementations,
  );
  report = {
    observedAtUtc: new Date().toISOString(),
    chainId: observed.chainId,
    block: observed.blockNumber,
    blockHash: observed.blockHash,
    fingerprint: observed.fingerprint,
    ...comparison,
  };
  if (comparison.changes.length) process.exitCode = 2;
} catch (error) {
  report = {
    observedAtUtc: new Date().toISOString(),
    status: 'unavailable',
    error: error instanceof Error ? error.name : 'ReadError',
    liveSubmission: false,
  };
  process.exitCode = 1;
}
await writeFile('research/upgrade-check.json', JSON.stringify(report, null, 2) + '\n');
console.log(report);
