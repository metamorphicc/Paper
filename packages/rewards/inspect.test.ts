import test from 'node:test';
import assert from 'node:assert/strict';
import { createSnapshot } from './snapshot.js';
import { inspectClaim } from './inspect.js';
test('claim inspection verifies exact raw units and handles malformed, duplicate, mismatched and oversized claims safely', () => {
  const account = ('0x' + '22'.repeat(20)) as `0x${string}`;
  const manifest = createSnapshot([{ address: account, points: 70 }], 700n, {
    chainId: 999,
    claimContract: ('0x' + '55'.repeat(20)) as `0x${string}`,
    campaignId: ('0x' + 'ab'.repeat(32)) as `0x${string}`,
  });
  assert.equal(inspectClaim(manifest, account).amountRaw, '700');
  for (const invalid of [
    null,
    { ...manifest, claims: [null] },
    { ...manifest, claims: [manifest.claims[0], manifest.claims[0]] },
    { ...manifest, claims: [{ ...manifest.claims[0], amountRaw: '-1' }] },
    { ...manifest, claims: [{ ...manifest.claims[0], amountRaw: '9'.repeat(10000) }] },
    { ...manifest, claims: [{ ...manifest.claims[0], amountRaw: '701' }] },
    { ...manifest, domain: { ...manifest.domain, chainId: 1 } },
  ])
    assert.throws(() => inspectClaim(invalid, account), /manifest|claim|Proof/);
});
