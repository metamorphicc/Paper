import test from 'node:test';
import assert from 'node:assert/strict';
import { CashVaultModel } from './vault.js';
const alice = '0x' + '11'.repeat(20),
  bob = '0x' + '22'.repeat(20),
  charlie = '0x' + '33'.repeat(20);
test('cash shares reflect losses and partial redemption without valuing PAPER or queued rights', () => {
  const vault = new CashVaultModel();
  vault.deposit(alice, 100n);
  vault.deposit(bob, 100n);
  vault.cashPnl(-20n);
  vault.queuedProfit(40n);
  vault.mintedPaper(1000n);
  assert.equal(vault.inspect(alice).redeemableRaw, '90');
  assert.equal(vault.inspect(alice).queuedRaw, '20');
  assert.equal(vault.inspect(alice).paperRaw, '500');
  const request = vault.requestRedeem(alice, 50n);
  assert.equal(request.amountRaw, '45');
  assert.equal(vault.payRedemption(request.id).amount, 45n);
  assert.throws(() => vault.payRedemption(request.id));
  assert.equal(vault.inspect(alice).redeemableRaw, '45');
  assert.equal(
    vault.inspect(alice).queuedRaw,
    '20',
    'existing entitlement survives share redemption',
  );
});
test('new deposits cannot settle earlier queued profit or acquire existing PAPER rights', () => {
  const vault = new CashVaultModel();
  vault.deposit(alice, 100n);
  vault.queuedProfit(30n);
  vault.mintedPaper(50n);
  const request = vault.requestRedeem(alice, 100n);
  vault.deposit(bob, 100n);
  assert.equal(vault.inspect(alice).queuedRaw, '30');
  assert.equal(vault.inspect(bob).queuedRaw, '0');
  assert.equal(vault.inspect(bob).paperRaw, '0');
  assert.equal(vault.payRedemption(request.id).amount, 100n);
  assert.equal(vault.cash, 100n, 'paying reserved withdrawal never consumes later deposits');
  assert.throws(() => vault.withdrawSettledClaim(alice));
  vault.releaseQueued(alice, 30n);
  assert.equal(vault.withdrawSettledClaim(alice), 30n);
  assert.equal(vault.cash, 100n, 'external queue settlement has separate funds');
  vault.stopped = true;
  assert.throws(() => vault.deposit(charlie, 1n));
});
test('rounding cannot overpay or mint zero shares; exhausted NAV blocks recapitalization', () => {
  const vault = new CashVaultModel();
  vault.deposit(alice, 3n);
  vault.deposit(bob, 2n);
  vault.cashPnl(2n);
  vault.queuedProfit(3n);
  assert.equal(BigInt(vault.inspect(alice).queuedRaw) + BigInt(vault.inspect(bob).queuedRaw), 3n);
  assert.throws(() => vault.deposit(charlie, 1n));
  vault.cashPnl(-7n);
  assert.throws(() => vault.deposit(charlie, 5n));
  assert.throws(() => vault.cashPnl(-1n));
});
