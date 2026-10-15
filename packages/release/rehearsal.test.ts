import test from 'node:test';
import assert from 'node:assert/strict';
import { rehearseDeployment } from './rehearsal.js';
test('deployment rehearsal verifies actual code, immutable state, funding, claims and six-decimal treasury receipts', async () => {
  const report = await rehearseDeployment();
  assert.equal(report.chainId, 31337);
  assert.equal(report.deployed.length, 3);
  assert.ok(
    report.deployed.every((row) => row.runtimeTemplateMatched && row.immutableGettersVerified),
  );
  assert.equal(report.receipts.length, 9);
  assert.equal(report.denied.length, 8);
  assert.equal(report.reconciliation.transfers.length, 2);
  assert.equal(report.reconciliation.reconciled, true);
  assert.equal(report.publicChainUsed, false);
  assert.equal(report.launchApproved, false);
});
test('nonce drift and constructor substitution abort deployment rehearsal before funding', async () => {
  await assert.rejects(rehearseDeployment('nonce-drift'), /Deployment nonce changed/);
  await assert.rejects(rehearseDeployment('wrong-constructor'), /Creation input mismatch/);
});
