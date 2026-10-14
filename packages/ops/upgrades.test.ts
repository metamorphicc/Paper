import test from 'node:test';
import assert from 'node:assert/strict';
import { compareImplementations } from './upgrades.js';
test('implementation monitor reports changed code, changed address and unavailable observations without enabling writes', () => {
  const before = {
    Exchange: { address: '0x' + '11'.repeat(20), runtimeHash: '0x' + 'aa'.repeat(32) },
  };
  assert.equal(compareImplementations(before, before).status, 'unchanged');
  const changed = compareImplementations(before, {
    Exchange: { address: '0x' + '22'.repeat(20), runtimeHash: '0x' + 'bb'.repeat(32) },
  });
  assert.equal(changed.changes.length, 2);
  assert.equal(changed.liveSubmission, false);
  assert.equal(compareImplementations(before, {}).status, 'changed');
  assert.equal(
    compareImplementations(before, { Exchange: { address: 'bad', runtimeHash: 'bad' } }).status,
    'changed',
  );
});
