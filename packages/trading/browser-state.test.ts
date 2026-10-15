import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { privateKeyToAccount } from 'viem/accounts';
import { parseTrading } from '../protocol/official.js';
import { MockRelayer, sandboxTypedData } from './relayer.js';
import { parseBrowserSandbox } from './browser-state.js';
test('browser sandbox restore validates complete state and refuses corrupt ledgers, amounts, receipts and cross-account data', async () => {
  const user = privateKeyToAccount(('0x' + '11'.repeat(32)) as `0x${string}`),
    instrument = parseTrading(
      JSON.parse(readFileSync('research/current-trading-state.json', 'utf8')),
    ).instruments[0]!;
  const relay = new MockRelayer(user.address, instrument, 500000n, () => 1000);
  const message = { user: user.address, amount: 10_000_000n, nonce: 1n, deadline: 100n };
  await relay.submit({
    action: 'withdrawToCore',
    message,
    signature: await user.signTypedData(sandboxTypedData('WithdrawToCore', message)),
  });
  const envelope = { version: 1, user: user.address, state: relay.serialize() };
  const encode = (v: unknown) =>
    JSON.stringify(v, (_, value) => (typeof value === 'bigint' ? String(value) : value));
  assert.equal(parseBrowserSandbox(encode(envelope), user.address).receipts.length, 1);
  for (const change of [
    (v: typeof envelope) => {
      v.state.ledger.balanceRaw = 'bad';
    },
    (v: typeof envelope) => {
      v.state.ledger.balanceRaw = '-1';
    },
    (v: typeof envelope) => {
      v.state.ledger.positions = null as never;
    },
    (v: typeof envelope) => {
      v.state.receipts[0]!.id = ('0x' + '00'.repeat(32)) as `0x${string}`;
    },
    (v: typeof envelope) => {
      v.state.receipts.push(v.state.receipts[0]!);
    },
    (v: typeof envelope) => {
      v.user = ('0x' + '22'.repeat(20)) as `0x${string}`;
    },
  ]) {
    const changed = structuredClone(envelope);
    change(changed);
    assert.throws(() => parseBrowserSandbox(encode(changed), user.address), /Saved local account/);
  }
  assert.throws(() => parseBrowserSandbox('{', user.address), /Saved local account/);
});
