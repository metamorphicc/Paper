import test from 'node:test';
import assert from 'node:assert/strict';
import { requestWallet, WalletRequestError } from './provider.js';
test('wallet feedback is English, does not echo provider payloads and preserves add-network recovery code', async () => {
  await assert.rejects(
    requestWallet(
      {
        request: async () => {
          throw { code: 4001, message: 'untrusted-provider-payload' };
        },
      },
      { method: 'personal_sign' },
    ),
    /Wallet request declined/,
  );
  try {
    await requestWallet(
      {
        request: async () => {
          throw { code: 4902, message: 'untrusted-provider-payload' };
        },
      },
      { method: 'wallet_switchEthereumChain' },
    );
    assert.fail('should reject');
  } catch (error) {
    assert.ok(error instanceof WalletRequestError);
    assert.equal(error.code, 4902);
    assert.ok(!error.message.includes('untrusted'));
  }
  assert.equal(
    await requestWallet({ request: async () => ['0xaccount'] }, { method: 'eth_accounts' }).then(
      (value) => Array.isArray(value),
    ),
    true,
  );
});
