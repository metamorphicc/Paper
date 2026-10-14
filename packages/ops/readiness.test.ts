import test from 'node:test';
import assert from 'node:assert/strict';
import { launchReadiness, REQUIRED_LAUNCH_GATES } from './readiness.js';
test('unknown launch evidence blocks release and passing checks never authorize automatic money actions', () => {
  const blocked = launchReadiness({
    protocolSourceVerified: true,
    campaignBudgetSelected: null,
    independentAuditComplete: false,
  });
  assert.equal(blocked.decision, 'do-not-launch');
  assert.equal(blocked.blockers.length, 14);
  assert.equal(launchReadiness({}).decision, 'do-not-launch');
  const passed = launchReadiness(
    Object.fromEntries(REQUIRED_LAUNCH_GATES.map((gate) => [gate, true])),
  );
  assert.equal(passed.decision, 'ready-for-human-release-review');
  assert.equal(passed.automaticDeploy, false);
});
