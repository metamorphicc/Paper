import { isAddress, zeroAddress, type Address, type Hex } from 'viem';

export type TransferEvidence = {
  asset: Address;
  from: Address;
  to: Address;
  amount: bigint;
  logIndex: number;
  removed?: boolean;
};
export type ReceiptEvidence = {
  transactionHash: Hex;
  blockNumber: bigint;
  blockHash: Hex;
  status: 'success' | 'reverted';
  transfers: TransferEvidence[];
};
export type ReceiptWindow = {
  chainId: number;
  treasury: Address;
  asset: Address;
  fromBlock: bigint;
  toBlock: bigint;
  headBlock: bigint;
  minConfirmations: number;
  openingBalance: bigint;
  closingBalance: bigint;
  canonicalHashes: Record<string, Hex>;
};
const hash = (value: string) => /^0x[0-9a-fA-F]{64}$/.test(value);
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Confirmed asset flows only. Incoming transfers never become revenue or buybacks by inference. */
export function reconcileReceipts(window: ReceiptWindow, receipts: ReceiptEvidence[]) {
  if (
    !Number.isSafeInteger(window.chainId) ||
    window.chainId < 1 ||
    !isAddress(window.treasury, { strict: false }) ||
    !isAddress(window.asset, { strict: false }) ||
    same(window.treasury, zeroAddress) ||
    same(window.asset, zeroAddress) ||
    !Number.isSafeInteger(window.minConfirmations) ||
    window.minConfirmations < 1 ||
    window.fromBlock < 1n ||
    window.toBlock < window.fromBlock ||
    window.headBlock < window.toBlock ||
    window.openingBalance < 0n ||
    window.closingBalance < 0n
  )
    throw new Error('Invalid receipt window');
  const events = new Map<
    string,
    {
      transactionHash: Hex;
      blockNumber: string;
      blockHash: Hex;
      logIndex: number;
      from: string;
      to: string;
      amountRaw: string;
      direction: 'in' | 'out' | 'self';
    }
  >();
  const issues: { transactionHash: Hex; reason: string }[] = [];
  for (const receipt of receipts) {
    const canonical = window.canonicalHashes[String(receipt.blockNumber)];
    let reason = '';
    if (!hash(receipt.transactionHash) || !hash(receipt.blockHash))
      reason = 'Invalid receipt identity';
    else if (receipt.blockNumber < window.fromBlock || receipt.blockNumber > window.toBlock)
      reason = 'Outside requested window';
    else if (receipt.status !== 'success') reason = 'Transaction did not succeed';
    else if (!canonical || !hash(canonical) || !same(receipt.blockHash, canonical))
      reason = 'Receipt is not canonical';
    else if (window.headBlock - receipt.blockNumber + 1n < BigInt(window.minConfirmations))
      reason = 'Insufficient confirmations';
    if (reason) {
      issues.push({ transactionHash: receipt.transactionHash, reason });
      continue;
    }
    for (const transfer of receipt.transfers) {
      if (
        !same(transfer.asset, window.asset) ||
        (!same(transfer.from, window.treasury) && !same(transfer.to, window.treasury))
      )
        continue;
      if (
        !isAddress(transfer.from, { strict: false }) ||
        !isAddress(transfer.to, { strict: false }) ||
        transfer.removed ||
        transfer.amount < 0n ||
        transfer.amount >= 2n ** 256n ||
        !Number.isSafeInteger(transfer.logIndex) ||
        transfer.logIndex < 0
      ) {
        issues.push({
          transactionHash: receipt.transactionHash,
          reason: 'Invalid or removed transfer',
        });
        continue;
      }
      const direction: 'in' | 'out' | 'self' =
        same(transfer.from, window.treasury) && same(transfer.to, window.treasury)
          ? 'self'
          : same(transfer.to, window.treasury)
            ? 'in'
            : 'out';
      const event = {
        transactionHash: receipt.transactionHash.toLowerCase() as Hex,
        blockNumber: String(receipt.blockNumber),
        blockHash: receipt.blockHash.toLowerCase() as Hex,
        logIndex: transfer.logIndex,
        from: transfer.from.toLowerCase(),
        to: transfer.to.toLowerCase(),
        amountRaw: String(transfer.amount),
        direction,
      };
      const key = `${event.transactionHash}:${event.logIndex}`;
      const previous = events.get(key);
      if (previous && JSON.stringify(previous) !== JSON.stringify(event))
        throw new Error('Conflicting transfer evidence');
      events.set(key, event);
    }
  }
  const transfers = [...events.values()].sort((a, b) =>
    BigInt(a.blockNumber) < BigInt(b.blockNumber)
      ? -1
      : BigInt(a.blockNumber) > BigInt(b.blockNumber)
        ? 1
        : a.logIndex - b.logIndex,
  );
  let received = 0n,
    sent = 0n;
  for (const row of transfers) {
    if (row.direction === 'in') received += BigInt(row.amountRaw);
    if (row.direction === 'out') sent += BigInt(row.amountRaw);
  }
  const expectedClosing = window.openingBalance + received - sent;
  const discrepancy = window.closingBalance - expectedClosing;
  return {
    chainId: window.chainId,
    treasury: window.treasury.toLowerCase(),
    asset: window.asset.toLowerCase(),
    fromBlock: String(window.fromBlock),
    toBlock: String(window.toBlock),
    headBlock: String(window.headBlock),
    minConfirmations: window.minConfirmations,
    openingBalanceRaw: String(window.openingBalance),
    closingBalanceRaw: String(window.closingBalance),
    receivedRaw: String(received),
    sentRaw: String(sent),
    netFlowRaw: String(received - sent),
    expectedClosingBalanceRaw: String(expectedClosing),
    discrepancyRaw: String(discrepancy),
    reconciled: discrepancy === 0n && issues.length === 0,
    transfers,
    issues,
    realizedRevenueRaw: null,
    buybacksVerified: false,
    burnsVerified: false,
    limitations: [
      'Transfers are not evidence of earned revenue, swaps or burns.',
      'Reconciliation covers this asset and block window only; it is not full treasury history.',
      'Rebasing, fees without Transfer events or incomplete RPC logs can prevent reconciliation.',
    ],
  };
}
