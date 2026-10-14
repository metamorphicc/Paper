import test from 'node:test';
import assert from 'node:assert/strict';
import { privateKeyToAccount } from 'viem/accounts';
import { identifyIntent, officialTypedData, serializeSigned } from './intents.js';
// Deterministic test account only; never funded and never used with a network transport.
const account = privateKeyToAccount(('0x' + '11'.repeat(32)) as `0x${string}`);
test('observed schema round-trips signature, signer and stable v2 intent id locally', async () => {
  const message = { user: account.address, instrumentId: 0, isLong: true, size: 10n ** 18n, leverage: 100, useDebt: false, nonce: 42n, deadline: 2_000_000_000n };
  const signature = await account.signTypedData(officialTypedData('OpenPosition', message));
  const result = await identifyIntent('OpenPosition', message, signature);
  assert.equal(result.signer, account.address.toLowerCase());
  assert.equal(result.intentId, (await identifyIntent('OpenPosition', message, signature)).intentId);
  const signed = serializeSigned(message, signature);
  assert.equal(signed.size, '1000000000000000000');
  assert.ok(signed.v === '27' || signed.v === '28');
  assert.notEqual(result.digest, (await identifyIntent('OpenPosition', { ...message, nonce: 43n }, signature)).digest);
});
test('signature preview rejects extra/missing fields and staking uses its own domain', () => {
  assert.throws(() => officialTypedData('Claim', { user: account.address }), /fields/);
  assert.equal(officialTypedData('Claim', { user: account.address, nonce: 1n, deadline: 2n }).domain.name, 'PaperStaking');
});
