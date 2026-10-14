import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:3000';
const routes = [
  '/',
  '/trade',
  '/profile',
  '/leaderboard',
  '/treasury',
  '/rewards',
  '/research',
  '/api/protocol',
  '/api/market?coin=BTC',
  '/api/market?coin=ETH',
  '/api/campaign',
];
const results = [];
for (const path of routes) {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(30_000) });
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
  results.push({ path, status: response.status });
}
const address = '0xaad6c7b0cc3014fc80ffedae0ed7ce5967b0f016';
const profileResponse = await fetch(`${base}/api/profile/${address}`, {
  signal: AbortSignal.timeout(30_000),
});
assert.equal(profileResponse.status, 200);
const profile = await profileResponse.json();
assert.equal(profile.value.address, address);
assert.ok(profile.value.block > 0);
assert.ok(profile.trades !== null, 'Official trade history should return a page');
results.push({
  path: `/api/profile/${address}`,
  status: 200,
  trades: profile.trades.items.length,
  pendingRewardStatus: profile.pendingReward?.value.status ?? 'unavailable',
});
// Public address observed in the locally indexed PAPER mint events.
const activeAddress = '0x6b8c262ca939adbe3793d3eca519a9d64f74d184';
const activeResponse = await fetch(`${base}/api/profile/${activeAddress}`, {
  signal: AbortSignal.timeout(30_000),
});
assert.equal(activeResponse.status, 200);
const activeProfile = await activeResponse.json();
assert.equal(activeProfile.value.address, activeAddress);
assert.ok(activeProfile.trades?.items.length > 0, 'Read completed trades, not just an empty page');
results.push({
  path: `/api/profile/${activeAddress}`,
  status: 200,
  trades: activeProfile.trades.items.length,
  pendingRewardStatus: activeProfile.pendingReward?.value.status ?? 'unavailable',
});
const invalid = await fetch(base + '/api/profile/not-an-address');
assert.equal(invalid.status, 400);
results.push({ path: '/api/profile/not-an-address', status: 400 });
const live = await fetch(base + '/api/intents', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
});
assert.equal(live.status, 403);
assert.equal((await live.json()).liveSubmission, false);
results.push({ path: 'POST /api/intents', status: 403 });
const origin = await fetch(base + '/api/campaign', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.example' },
  body: '{}',
});
assert.equal(origin.status, 400);
results.push({ path: 'POST /api/campaign wrong origin', status: 400 });
const foreignRead = await fetch(base + '/api/campaign', {
  headers: { Origin: 'https://untrusted.example' },
});
assert.equal(foreignRead.status, 403);
results.push({ path: 'GET /api/campaign wrong origin', status: 403 });
const oversized = await fetch(base + '/api/campaign', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: base },
  body: JSON.stringify({ padding: 'x'.repeat(11000) }),
});
assert.equal(oversized.status, 413);
results.push({ path: 'POST /api/campaign oversized', status: 413 });
const invalidMarket = await fetch(base + '/api/market?coin=INVALID');
assert.equal(invalidMarket.status, 400);
results.push({ path: '/api/market?coin=INVALID', status: 400 });
await writeFile(
  new URL('../research/http-smoke.json', import.meta.url),
  JSON.stringify(
    { observedAtUtc: new Date().toISOString(), base, results, realTransactionsSubmitted: false },
    null,
    2,
  ) + '\n',
);
console.table(results);
