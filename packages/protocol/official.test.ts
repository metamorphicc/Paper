import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OfficialReadClient, parseSummary, parseTrading } from './official.js';
const state = JSON.parse(
  readFileSync(
    new URL('../../research/frontend/state-trading.json', import.meta.url),
    'utf8',
  ).replace(/^\uFEFF/, ''),
);
const summary = JSON.parse(
  readFileSync(
    new URL('../../research/frontend/query-protocol-summary.json', import.meta.url),
    'utf8',
  ).replace(/^\uFEFF/, ''),
);
test('official market tuples preserve bigint amounts and enforce deployment/lifecycle', () => {
  const parsed = parseTrading(state);
  assert.equal(parsed.instruments[0]?.symbol, 'BTC');
  assert.equal(parsed.instruments[0]?.baseRateRaw, '100000000000000000');
  const bad = structuredClone(state);
  bad.instruments[0][3] = '100';
  assert.throws(() => parseTrading(bad), /Deployment/);
  assert.throws(() => parseTrading({ ...state, schemaVersion: 2 }), /schema/);
});
test('summary values never pass through floating point', () => {
  assert.equal(parseSummary(summary).paper.supply, summary.paper.supply);
  assert.throws(
    () => parseSummary({ ...summary, balances: { ...summary.balances, lp: 100 } }),
    /integer/,
  );
});
test('read client rejects write paths and observes Retry-After without retry loop', async () => {
  let calls = 0;
  const client = new OfficialReadClient(async () => {
    calls++;
    return new Response('', { status: 429, headers: { 'Retry-After': '10' } });
  });
  await assert.rejects(client.get('/intents'), /Unsupported/);
  await assert.rejects(client.summary(), /rate limited/);
  await assert.rejects(client.summary(), /rate limited/);
  assert.equal(calls, 1);
});
