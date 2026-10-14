import test from 'node:test';
import assert from 'node:assert/strict';
import { privateKeyToAccount } from 'viem/accounts';
import { Store } from '../indexer/store.js';
import { Campaign } from './campaign.js';
const alice = privateKeyToAccount(('0x' + '22'.repeat(32)) as `0x${string}`);
const bob = privateKeyToAccount(('0x' + '33'.repeat(32)) as `0x${string}`);
const origin = 'http://127.0.0.1:3000';
test('points require wallet proof, bind origin, reject replay and cap one claim per action', async () => {
  const store = new Store(':memory:');
  const campaign = new Campaign(store);
  try {
    const challenge = campaign.issue(alice.address, 'join', origin);
    const signature = await alice.signMessage({ message: challenge.message });
    await assert.rejects(
      campaign.claim({ id: challenge.id, signature, origin: 'http://localhost:3000' }),
      /origin/,
    );
    await assert.rejects(
      campaign.claim({
        id: challenge.id,
        signature: await bob.signMessage({ message: challenge.message }),
        origin,
      }),
      /Signature/,
    );
    assert.equal((await campaign.claim({ id: challenge.id, signature, origin })).awarded, 10);
    await assert.rejects(campaign.claim({ id: challenge.id, signature, origin }), /used/);
    const another = campaign.issue(alice.address, 'join', origin);
    assert.equal(
      (
        await campaign.claim({
          id: another.id,
          signature: await alice.signMessage({ message: another.message }),
          origin,
        })
      ).awarded,
      0,
    );
    assert.equal(campaign.participant(alice.address).total, 10);
  } finally {
    store.close();
  }
});
test('quiz requires participation and exact risk answers; challenges expire', async () => {
  const store = new Store(':memory:');
  let now = 1000;
  const campaign = new Campaign(store, () => now);
  try {
    const quiz = campaign.issue(alice.address, 'quiz', origin);
    const signature = await alice.signMessage({ message: quiz.message });
    await assert.rejects(campaign.claim({ id: quiz.id, signature, origin, answers: [] }), /risk/);
    await assert.rejects(
      campaign.claim({
        id: quiz.id,
        signature,
        origin,
        answers: ['queued-is-debt', 'profit-is-adjusted', 'paper-is-not-cash'],
      }),
      /Join/,
    );
    now += 300_001;
    await assert.rejects(campaign.claim({ id: quiz.id, signature, origin }), /expired/);
  } finally {
    store.close();
  }
});
