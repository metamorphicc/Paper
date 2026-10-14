import test from 'node:test';
import assert from 'node:assert/strict';
import type { Address, Hex } from 'viem';
import { reconcileReceipts, type ReceiptWindow, type ReceiptEvidence } from './receipts.js';
const treasury = '0x0000000000000000000000000000000000000001' as Address;
const sender = '0x0000000000000000000000000000000000000002' as Address;
const asset = '0x0000000000000000000000000000000000000003' as Address;
const h = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as Hex;
const window: ReceiptWindow = {
  chainId: 999,
  treasury,
  asset,
  fromBlock: 10n,
  toBlock: 11n,
  headBlock: 15n,
  minConfirmations: 5,
  openingBalance: 100n,
  closingBalance: 130n,
  canonicalHashes: { 10: h(10), 11: h(11) },
};
const receipt: ReceiptEvidence = {
  transactionHash: h(100),
  blockNumber: 10n,
  blockHash: h(10),
  status: 'success',
  transfers: [
    { asset, from: sender, to: treasury, amount: 50n, logIndex: 0 },
    { asset, from: treasury, to: sender, amount: 20n, logIndex: 1 },
    { asset, from: treasury, to: treasury, amount: 200n, logIndex: 2 },
  ],
};
test('confirmed transfer reconciliation is idempotent, handles self transfers and never invents revenue', () => {
  const result = reconcileReceipts(window, [receipt, receipt]);
  assert.equal(result.reconciled, true);
  assert.equal(result.receivedRaw, '50');
  assert.equal(result.sentRaw, '20');
  assert.equal(result.transfers.length, 3);
  assert.equal(result.realizedRevenueRaw, null);
  assert.equal(result.buybacksVerified, false);
  assert.equal(result.burnsVerified, false);
  const conflicting = { ...receipt, transfers: [{ ...receipt.transfers[0]!, amount: 51n }] };
  assert.throws(() => reconcileReceipts(window, [receipt, conflicting]), /Conflicting/);
});
test('failed, orphaned, removed and shallow receipts cannot reconcile as settled funds', () => {
  for (const invalid of [
    { ...receipt, status: 'reverted' as const },
    { ...receipt, blockHash: h(999) },
    { ...receipt, transfers: [{ ...receipt.transfers[0]!, removed: true }] },
    { ...receipt, blockNumber: 11n, blockHash: h(11) },
  ]) {
    const result = reconcileReceipts({ ...window, headBlock: 14n }, [invalid]);
    assert.equal(result.reconciled, false);
    assert.ok(result.issues.length > 0);
  }
});
test('missing logs, unrelated assets and outside-window evidence expose incomplete accounting', () => {
  const missing = reconcileReceipts(window, []);
  assert.equal(missing.reconciled, false);
  assert.equal(missing.discrepancyRaw, '30');
  assert.equal(
    reconcileReceipts(window, [
      { ...receipt, transfers: receipt.transfers.map((x) => ({ ...x, asset: sender })) },
    ]).receivedRaw,
    '0',
  );
  assert.equal(reconcileReceipts(window, [{ ...receipt, blockNumber: 9n }]).reconciled, false);
  const exactEmpty = reconcileReceipts({ ...window, closingBalance: 100n }, []);
  assert.equal(exactEmpty.reconciled, true);
  assert.throws(() => reconcileReceipts({ ...window, minConfirmations: 0 }, []));
});
