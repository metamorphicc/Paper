import test from 'node:test';
import assert from 'node:assert/strict';
import { keccak256, toHex, type Address } from 'viem';
import { createSnapshot, claimLeaf, verifyClaim } from './snapshot.js';
const domain = {
  chainId: 31337,
  claimContract: ('0x' + 'aa'.repeat(20)) as Address,
  campaignId: keccak256(toHex('campaign')),
};
const members = [1, 2, 3].map((value) => ({
  address: '0x' + String(value).repeat(40),
  points: value * 10,
}));
test('deterministic snapshots conserve every budget unit and bind all claim domains', () => {
  const a = createSnapshot(members, 100n, domain),
    b = createSnapshot([...members].reverse(), 100n, domain);
  assert.deepEqual(a, b);
  assert.equal(
    a.claims.reduce((sum, row) => sum + BigInt(row.amountRaw), 0n),
    100n,
  );
  for (const claim of a.claims) assert.ok(verifyClaim(a.root, claim));
  const claim = a.claims[0]!;
  assert.notEqual(
    claim.leaf,
    claimLeaf({ ...domain, chainId: 999 }, claim.index, claim.account, BigInt(claim.amountRaw)),
  );
  assert.notEqual(
    claim.leaf,
    claimLeaf(
      { ...domain, claimContract: ('0x' + 'bb'.repeat(20)) as Address },
      claim.index,
      claim.account,
      BigInt(claim.amountRaw),
    ),
  );
  assert.ok(
    !verifyClaim(a.root, {
      ...claim,
      leaf: claimLeaf(domain, claim.index, claim.account, BigInt(claim.amountRaw) + 1n),
    }),
  );
  assert.throws(() => createSnapshot([...members, members[0]!], 100n, domain), /Duplicate/);
  assert.throws(() => createSnapshot(members, 1n, domain), /too small/);
  assert.throws(() => createSnapshot([{ ...members[0]!, points: 71 }], 100n, domain), /Invalid/);
});
