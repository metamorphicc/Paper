import { isAddress } from 'viem';
/** Cash-only accounting research. Not a deployable vault or Papertrade integration. */
export class CashVaultModel {
  cash = 0n;
  totalShares = 0n;
  stopped = false;
  shares = new Map<string, bigint>();
  queueRights = new Map<string, bigint>();
  paperRights = new Map<string, bigint>();
  settledClaims = new Map<string, bigint>();
  withdrawals = new Map<number, { account: string; amount: bigint; paid: boolean }>();
  nextRequest = 0;
  private account(address: string) {
    if (!isAddress(address) || address.toLowerCase() === '0x' + '0'.repeat(40))
      throw new Error('Invalid account');
    return address.toLowerCase();
  }
  deposit(address: string, amount: bigint) {
    const account = this.account(address);
    if (this.stopped || amount <= 0n || (this.totalShares > 0n && this.cash === 0n))
      throw new Error('Deposit unavailable');
    const minted = this.totalShares === 0n ? amount : (amount * this.totalShares) / this.cash;
    if (minted === 0n) throw new Error('Deposit rounds to zero');
    this.cash += amount;
    this.totalShares += minted;
    this.shares.set(account, (this.shares.get(account) ?? 0n) + minted);
    return minted;
  }
  cashPnl(amount: bigint) {
    if (this.cash + amount < 0n) throw new Error('Loss exceeds cash');
    this.cash += amount;
  }
  private allocate(amount: bigint, target: Map<string, bigint>) {
    if (amount <= 0n || this.totalShares === 0n) throw new Error('No eligible shares');
    const holders = [...this.shares]
      .filter(([, shares]) => shares > 0n)
      .sort(([a], [b]) => a.localeCompare(b));
    const allocations = holders.map(([account, shares]) => ({
      account,
      amount: (amount * shares) / this.totalShares,
    }));
    let left = amount - allocations.reduce((sum, row) => sum + row.amount, 0n);
    for (let i = 0; left > 0n; i++, left--) allocations[i]!.amount++;
    for (const row of allocations)
      target.set(row.account, (target.get(row.account) ?? 0n) + row.amount);
  }
  queuedProfit(amount: bigint) {
    this.allocate(amount, this.queueRights);
  }
  mintedPaper(amount: bigint) {
    this.allocate(amount, this.paperRights);
  }
  requestRedeem(address: string, shares: bigint) {
    const account = this.account(address),
      owned = this.shares.get(account) ?? 0n;
    if (shares <= 0n || shares > owned) throw new Error('Invalid redemption');
    const amount =
      shares === this.totalShares ? this.cash : (this.cash * shares) / this.totalShares;
    if (amount === 0n) throw new Error('Redemption rounds to zero');
    this.cash -= amount;
    this.totalShares -= shares;
    this.shares.set(account, owned - shares);
    const id = ++this.nextRequest;
    this.withdrawals.set(id, { account, amount, paid: false });
    return {
      id,
      amountRaw: String(amount),
      queuedRightsRaw: String(this.queueRights.get(account) ?? 0n),
      paperRightsRaw: String(this.paperRights.get(account) ?? 0n),
    };
  }
  payRedemption(id: number) {
    const request = this.withdrawals.get(id);
    if (!request || request.paid) throw new Error('Unknown or paid redemption');
    request.paid = true;
    return { account: request.account, amount: request.amount };
  }
  releaseQueued(address: string, amount: bigint) {
    const account = this.account(address),
      right = this.queueRights.get(account) ?? 0n;
    if (amount <= 0n || amount > right) throw new Error('Invalid queued settlement');
    this.queueRights.set(account, right - amount);
    this.settledClaims.set(account, (this.settledClaims.get(account) ?? 0n) + amount);
  }
  withdrawSettledClaim(address: string) {
    const account = this.account(address),
      amount = this.settledClaims.get(account) ?? 0n;
    if (amount === 0n) throw new Error('No settled claim');
    this.settledClaims.set(account, 0n);
    return amount;
  }
  inspect(address: string) {
    const account = this.account(address),
      shares = this.shares.get(account) ?? 0n;
    return {
      cashNavRaw: String(this.cash),
      sharesRaw: String(shares),
      redeemableRaw: String(this.totalShares ? (this.cash * shares) / this.totalShares : 0n),
      queuedRaw: String(this.queueRights.get(account) ?? 0n),
      paperRaw: String(this.paperRights.get(account) ?? 0n),
    };
  }
}
