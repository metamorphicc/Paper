import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { tradeHistory } from '../packages/protocol/history.js';
const address = '0x6b8c262ca939adbe3793d3eca519a9d64f74d184';
try {
  const first = await tradeHistory(address);
  assert.ok(first.items.length > 0 && first.nextCursor);
  const second = await tradeHistory(address, undefined, first.nextCursor);
  assert.ok(second.items.length > 0);
  const firstKeys = new Set(first.items.map((row) => row.txHash + ':' + row.positionId));
  assert.ok(second.items.every((row) => !firstKeys.has(row.txHash + ':' + row.positionId)));
  const report = {
    observedAtUtc: new Date().toISOString(),
    scope: 'official public read API, existing public research address',
    address,
    sourceDecoder: 'research/frontend/index-9zxq8TOY.js function Uh/Gh: limit/filter/cursor',
    firstPageItems: first.items.length,
    secondPageItems: second.items.length,
    cursorContinuationVerified: true,
    duplicateRowsAcrossPages: false,
    signedRequest: false,
    financialWrites: false,
  };
  await writeFile('research/history-pagination-qa.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} catch {
  console.error(
    'Official history pagination check failed. No signed or financial request was made.',
  );
  process.exitCode = 1;
}
