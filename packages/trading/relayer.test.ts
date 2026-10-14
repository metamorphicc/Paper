import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { privateKeyToAccount } from 'viem/accounts';
import { parseTrading } from '../protocol/official.js';
import { actionTypes, officialTypedData, type IntentMessage } from '../protocol/intents.js';
import {
  MockRelayer,
  LiveRelayerTransport,
  sandboxTypedData,
  sandboxId,
  type Action,
} from './relayer.js';
import { WAD } from '../protocol/quote.js';
const user = privateKeyToAccount(('0x' + '11'.repeat(32)) as `0x${string}`),
  session = privateKeyToAccount(('0x' + '44'.repeat(32)) as `0x${string}`);
const instrument = parseTrading(
  JSON.parse(
    readFileSync(
      new URL('../../research/frontend/state-trading.json', import.meta.url),
      'utf8',
    ).replace(/^\uFEFF/, ''),
  ),
).instruments[0]!;
let nonce = 1n;
async function payload(action: Action, fields: IntentMessage = {}, signer = user) {
  const message = { user: user.address, ...fields, nonce: nonce++, deadline: 1000n };
  return {
    action,
    message,
    signature: await signer.signTypedData(sandboxTypedData(actionTypes[action], message)),
  };
}
const open = { instrumentId: 0, isLong: true, size: 100n * WAD, leverage: 100, useDebt: false };
test('same signed intent retry is idempotent; reservations prevent queued double-spending', async () => {
  const relay = new MockRelayer(user.address, instrument, 1_000_000n, () => 0);
  const envelope = await payload('openPosition', open);
  const accepted = await relay.submit(envelope);
  assert.equal((await relay.submit(envelope)).id, accepted.id);
  assert.equal(relay.available(), 2400n * WAD);
  relay.settle(accepted.id);
  relay.settle(accepted.id);
  assert.equal(relay.ledger.positions.length, 1);
  assert.equal(relay.ledger.balanceRaw, String(2400n * WAD));
  await assert.rejects(
    relay.submit(await payload('openPosition', { ...open, size: 2500n * WAD })),
    /collateral/,
  );
});
test('ambiguous timeout retains stable id; cancellation and expiry release pending exposure', async () => {
  let now = 0;
  const relay = new MockRelayer(user.address, instrument, 1_000_000n, () => now),
    envelope = await payload('openPosition', open);
  relay.ambiguousNext = true;
  await assert.rejects(relay.submit(envelope), /unknown/);
  const id = sandboxId('OpenPosition', envelope.message);
  assert.equal(relay.status(id).status, 'queued');
  relay.cancel(id);
  assert.equal(relay.available(), 2500n * WAD);
  const second = await relay.submit(await payload('openPosition', open));
  now = 1_000_001;
  assert.equal(relay.status(second.id).status, 'expired');
  assert.equal(relay.available(), 2500n * WAD);
});
test('queued profit is distinct from spendable collateral and loss mints only virtual PAPER', async () => {
  const relay = new MockRelayer(user.address, instrument, 1_000_000n, () => 0);
  let receipt = await relay.submit(await payload('openPosition', open));
  relay.settle(receipt.id);
  relay.queueProfit = true;
  receipt = await relay.submit(await payload('closePositions', { positionIds: ['1'] }));
  relay.settle(receipt.id, 1_001_000n);
  assert.equal(relay.ledger.balanceRaw, String(2500n * WAD));
  assert.ok(BigInt(relay.ledger.queuedRaw) > 0n);
  assert.equal(relay.ledger.paperRaw, '0');
  relay.releaseQueue();
  assert.equal(relay.ledger.queuedRaw, '0');
});
test('a revoked session cannot trade and a session can never sign staking or withdrawal', async () => {
  const relay = new MockRelayer(user.address, instrument, 1_000_000n, () => 0);
  const register = await relay.submit(
    await payload('registerSessionKey', {
      key: session.address,
      expiry: 2000n,
      feeAddress: '0x' + '00'.repeat(20),
    }),
  );
  relay.settle(register.id);
  const signed = await payload('openPosition', open, session);
  assert.equal((await relay.submit(signed)).status, 'queued');
  await assert.rejects(
    relay.submit(await payload('withdrawToCore', { amount: 1n }, session)),
    /Wallet signature/,
  );
  relay.revoke(session.address);
  await assert.rejects(relay.submit(await payload('openPosition', open, session)), /revoked/);
});
test('wrong official domain, used nonce, pause and outage fail before any financial transport', async () => {
  const relay = new MockRelayer(user.address, instrument, 1_000_000n, () => 0),
    envelope = await payload('openPosition', open);
  const official = {
    ...envelope,
    signature: await user.signTypedData(officialTypedData('OpenPosition', envelope.message)),
  };
  await assert.rejects(relay.submit(official), /signature/);
  relay.outage = true;
  await assert.rejects(relay.submit(envelope), /unavailable/);
  relay.outage = false;
  relay.paused = true;
  await assert.rejects(relay.submit(envelope), /paused/);
  await assert.rejects(new LiveRelayerTransport().submit(envelope), /blocked/);
});
test('local stake/unstake/claim and USD-6 withdrawal roundtrip', async () => {
  const relay = new MockRelayer(user.address, instrument, 1_000_000n, () => 0);
  relay.ledger.paperRaw = String(1000n * WAD);
  let receipt = await relay.submit(await payload('paperStake', { amount: 500n * WAD }));
  relay.settle(receipt.id);
  relay.distributeTestRewards(10n * WAD);
  receipt = await relay.submit(await payload('paperClaim'));
  relay.settle(receipt.id);
  assert.equal(relay.ledger.balanceRaw, String(2510n * WAD));
  receipt = await relay.submit(await payload('paperUnstake', { amount: 500n * WAD }));
  relay.settle(receipt.id);
  assert.equal(relay.ledger.paperRaw, String(1000n * WAD));
  receipt = await relay.submit(await payload('withdrawToCore', { amount: 10_000_000n }));
  relay.settle(receipt.id);
  assert.equal(relay.ledger.balanceRaw, String(2500n * WAD));
});
test('pending withdrawals reserve funds and reused nonces cannot create another request', async () => {
  const relay = new MockRelayer(user.address, instrument, 1_000_000n, () => 0);
  const first = await payload('withdrawToCore', { amount: 10_000_000n });
  await relay.submit(first);
  assert.equal(relay.available(), 2490n * WAD);
  await assert.rejects(
    relay.submit(await payload('openPosition', { ...open, size: 2500n * WAD })),
    /collateral/,
  );
  const message = { ...first.message, amount: 20_000_000n };
  const signature = await user.signTypedData(sandboxTypedData('WithdrawToCore', message));
  await assert.rejects(relay.submit({ action: 'withdrawToCore', message, signature }), /Nonce/);
});
test('failed mixed-market close rolls back every ledger change', async () => {
  const relay = new MockRelayer(user.address, instrument, 1_000_000n, () => 0);
  relay.ledger.positions = [
    {
      id: '1',
      instrumentId: 0,
      isLong: true,
      marginRaw: String(100n * WAD),
      leverage: 100,
      entryPriceRaw: '1000000',
    },
    {
      id: '2',
      instrumentId: 1,
      isLong: true,
      marginRaw: String(100n * WAD),
      leverage: 100,
      entryPriceRaw: '1000000',
    },
  ];
  const before = JSON.stringify(relay.ledger),
    receipt = await relay.submit(await payload('closePositions', { positionIds: ['1', '2'] }));
  assert.equal(relay.settle(receipt.id, 1_001_000n).status, 'failed');
  assert.equal(JSON.stringify(relay.ledger), before);
});
