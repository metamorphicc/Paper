import test from 'node:test';
import assert from 'node:assert/strict';
import { getContractAddress, keccak256, toHex, type Address } from 'viem';
import {
  buildDeploymentPlan,
  validateDeploymentParameters,
  type DeploymentParameters,
} from './plan.js';
import { verifyClaim } from '../rewards/snapshot.js';
const a = ('0x' + '11'.repeat(20)) as Address,
  b = ('0x' + '22'.repeat(20)) as Address,
  asset = ('0x' + '33'.repeat(20)) as Address;
export function fixtureParameters(): DeploymentParameters {
  return {
    schemaVersion: 1,
    status: 'draft',
    targetChainId: 31337,
    deployer: a,
    startNonce: '1',
    token: {
      name: 'Local Test Token',
      symbol: 'TEST',
      capRaw: '1000',
      allocations: [{ recipient: a, amountRaw: '1000' }],
    },
    campaign: {
      campaignId: keccak256(toHex('local-campaign')),
      budgetRaw: '300',
      deadline: 2000,
      recovery: a,
      members: [{ address: b, points: 10 }],
    },
    treasury: {
      asset,
      assetDecimals: 6,
      operator: a,
      reserveRaw: '80000000',
      dailyLimitRaw: '20000000',
      fundingRaw: '100000000',
      destinations: [b],
    },
  };
}
test('deployment plan binds chain, deployer nonce, contract address and immutable campaign budget', () => {
  const p = fixtureParameters(),
    plan = buildDeploymentPlan(p, 1000);
  assert.equal(plan.deployments[1]!.address, getContractAddress({ from: a, nonce: 2n }));
  assert.equal(plan.snapshot.domain.claimContract, plan.deployments[1]!.address);
  assert.equal(plan.snapshot.domain.chainId, 31337);
  assert.equal(plan.snapshot.budgetRaw, p.campaign.budgetRaw);
  assert.equal(verifyClaim(plan.snapshot.root, plan.snapshot.claims[0]!), true);
  assert.equal(plan.automaticDeploy, false);
  assert.equal(plan.launchApproved, false);
  assert.equal(buildDeploymentPlan(p, 1500).reviewDigest, plan.reviewDigest);
  const changed = buildDeploymentPlan({ ...p, startNonce: '2' }, 1000);
  assert.notEqual(changed.snapshot.root, plan.snapshot.root);
  assert.notEqual(changed.reviewDigest, plan.reviewDigest);
  assert.notEqual(
    buildDeploymentPlan({ ...p, targetChainId: 999 }, 1000).snapshot.root,
    plan.snapshot.root,
  );
});
test('deployment review rejects missing inputs, duplicate allocations, unit mistakes and budget shortfalls', () => {
  assert.ok(validateDeploymentParameters({}, 1000).length > 10);
  const cases: [unknown, string][] = [
    [{ ...fixtureParameters(), targetChainId: 1 }, 'targetChainId'],
    [{ ...fixtureParameters(), startNonce: '01' }, 'startNonce'],
    [{ ...fixtureParameters(), startNonce: String(1n << 64n) }, 'startNonce'],
    [{ ...fixtureParameters(), approved: true }, 'approved'],
    [
      { ...fixtureParameters(), token: { ...fixtureParameters().token, capRaw: 1000 } },
      'token.capRaw',
    ],
    [
      {
        ...fixtureParameters(),
        token: {
          ...fixtureParameters().token,
          allocations: [
            { recipient: a, amountRaw: '500' },
            { recipient: a, amountRaw: '500' },
          ],
        },
      },
      'token.allocations.1.recipient',
    ],
    [
      { ...fixtureParameters(), campaign: { ...fixtureParameters().campaign, budgetRaw: '1001' } },
      'campaign.budgetRaw',
    ],
    [
      { ...fixtureParameters(), campaign: { ...fixtureParameters().campaign, deadline: 1000 } },
      'campaign.deadline',
    ],
    [
      { ...fixtureParameters(), treasury: { ...fixtureParameters().treasury, assetDecimals: 18 } },
      'treasury.assetDecimals',
    ],
    [
      {
        ...fixtureParameters(),
        treasury: { ...fixtureParameters().treasury, fundingRaw: '99999999' },
      },
      'treasury.fundingRaw',
    ],
  ];
  for (const [value, field] of cases) {
    assert.ok(
      validateDeploymentParameters(value, 1000).some((row) => row.field === field),
      field,
    );
    assert.throws(() => buildDeploymentPlan(value, 1000), /Invalid deployment/);
  }
});
