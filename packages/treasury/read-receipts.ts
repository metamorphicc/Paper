import {
  decodeEventLog,
  isAddress,
  parseAbi,
  parseAbiItem,
  type Address,
  type PublicClient,
  type Hex,
} from 'viem';
import { reconcileReceipts, type ReceiptEvidence } from './receipts.js';
import { assertHistoricalState, type HistoricalRpc } from '../protocol/archive.js';
import { ADDRESSES } from '../protocol/registry.js';
const transfer = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)',
);
const tokenAbi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
]);
export type TreasuryRpc = HistoricalRpc &
  Pick<
    PublicClient,
    'getChainId' | 'getBlock' | 'getLogs' | 'getTransactionReceipt' | 'readContract'
  >;

/** No write client, no keys and no automatic revenue classification. */
export async function readTreasuryReceipts(
  client: TreasuryRpc,
  options: {
    treasury: Address;
    asset: Address;
    expectedChainId?: number;
    blocks?: number;
    minConfirmations?: number;
  },
) {
  const { treasury, asset } = options;
  const blocks = options.blocks ?? 256,
    minConfirmations = options.minConfirmations ?? 20,
    expectedChainId = options.expectedChainId ?? 999;
  if (
    !isAddress(treasury, { strict: false }) ||
    !isAddress(asset, { strict: false }) ||
    !Number.isSafeInteger(blocks) ||
    blocks < 1 ||
    blocks > 2048 ||
    !Number.isSafeInteger(minConfirmations) ||
    minConfirmations < 1 ||
    minConfirmations > 1000
  )
    throw new Error('Invalid treasury read settings');
  const [chainId, head] = await Promise.all([client.getChainId(), client.getBlock()]);
  if (chainId !== expectedChainId || head.number === null || head.hash === null)
    throw new Error('Unexpected treasury chain or pending head');
  const historicalEvidence = await assertHistoricalState(
    client,
    chainId === 999 ? ADDRESSES.PaperToken : asset,
  );
  const toBlock = head.number - BigInt(minConfirmations) + 1n;
  if (toBlock < 1n) throw new Error('Not enough confirmed chain history');
  const beforeBlock = toBlock > BigInt(blocks) ? toBlock - BigInt(blocks) : 0n;
  const [end, openingBalance, closingBalance, decimals, symbol, incoming, outgoing] =
    await Promise.all([
      client.getBlock({ blockNumber: toBlock }),
      client.readContract({
        address: asset,
        abi: tokenAbi,
        functionName: 'balanceOf',
        args: [treasury],
        blockNumber: beforeBlock,
      }),
      client.readContract({
        address: asset,
        abi: tokenAbi,
        functionName: 'balanceOf',
        args: [treasury],
        blockNumber: toBlock,
      }),
      client.readContract({
        address: asset,
        abi: tokenAbi,
        functionName: 'decimals',
        blockNumber: toBlock,
      }),
      client
        .readContract({
          address: asset,
          abi: tokenAbi,
          functionName: 'symbol',
          blockNumber: toBlock,
        })
        .catch(() => null),
      transferLogs('to'),
      transferLogs('from'),
    ]);
  async function transferLogs(direction: 'from' | 'to') {
    const results = [];
    for (let from = beforeBlock + 1n; from <= toBlock; from += 50n) {
      const end = from + 49n < toBlock ? from + 49n : toBlock;
      results.push(
        ...(await client.getLogs({
          address: asset,
          event: transfer,
          args: { [direction]: treasury },
          fromBlock: from,
          toBlock: end,
          strict: true,
        })),
      );
      if (results.length > 200) throw new Error('Treasury activity exceeds the window limit');
    }
    return results;
  }
  if (decimals < 0 || decimals > 36 || !end.hash) throw new Error('Unsupported asset metadata');
  const observedLogs = [...incoming, ...outgoing];
  if (observedLogs.length > 200)
    throw new Error('Treasury activity exceeds the window limit; request fewer blocks');
  const hashes = [
    ...new Set(
      observedLogs
        .map((row) => row.transactionHash)
        .filter((value): value is Hex => value !== null),
    ),
  ];
  if (hashes.length > 100) throw new Error('Too many receipts in this window');
  const canonicalHashes: Record<string, Hex> = { [String(toBlock)]: end.hash };
  const receipts: ReceiptEvidence[] = [];
  for (let start = 0; start < hashes.length; start += 10) {
    const batch = await Promise.all(
      hashes
        .slice(start, start + 10)
        .map((transactionHash) => client.getTransactionReceipt({ hash: transactionHash })),
    );
    const numbers = [...new Set(batch.map((receipt) => receipt.blockNumber))];
    const canonical = await Promise.all(
      numbers.map((blockNumber) => client.getBlock({ blockNumber })),
    );
    for (const block of canonical) {
      if (!block.hash) throw new Error('Canonical receipt block unavailable');
      canonicalHashes[String(block.number)] = block.hash;
    }
    for (const receipt of batch) {
      const transfers = [];
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== asset.toLowerCase()) continue;
        if (
          log.blockNumber !== receipt.blockNumber ||
          log.blockHash !== receipt.blockHash ||
          log.transactionHash !== receipt.transactionHash ||
          log.logIndex === null
        )
          throw new Error('Receipt log identity mismatch');
        try {
          const event = decodeEventLog({
            abi: [transfer],
            eventName: 'Transfer',
            data: log.data,
            topics: log.topics,
            strict: true,
          });
          transfers.push({
            asset,
            from: event.args.from,
            to: event.args.to,
            amount: event.args.value,
            logIndex: log.logIndex,
            removed: log.removed,
          });
        } catch {
          // Only the exact Transfer signature must decode; other token events are irrelevant.
          if (
            log.topics[0]?.toLowerCase() ===
            '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
          )
            throw new Error('Malformed transfer receipt');
        }
      }
      receipts.push({
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        status: receipt.status,
        transfers,
      });
    }
  }
  const finalEnd = await client.getBlock({ blockNumber: toBlock });
  if (finalEnd.hash !== end.hash) throw new Error('Treasury window changed during the read');
  const ledger = reconcileReceipts(
    {
      chainId,
      treasury,
      asset,
      fromBlock: beforeBlock + 1n,
      toBlock,
      headBlock: head.number,
      minConfirmations,
      openingBalance,
      closingBalance,
      canonicalHashes,
    },
    receipts,
  );
  const ledgerKeys = new Set(
    ledger.transfers.map((row) => `${row.transactionHash}:${row.logIndex}`),
  );
  if (
    observedLogs.some(
      (log) => !ledgerKeys.has(`${log.transactionHash?.toLowerCase()}:${log.logIndex}`),
    )
  )
    throw new Error('Requested transfer missing from receipts');
  return {
    ...ledger,
    observedAtUtc: new Date().toISOString(),
    confirmedThroughBlockHash: end.hash,
    decimals,
    symbol: typeof symbol === 'string' && /^[A-Za-z0-9._-]{1,16}$/.test(symbol) ? symbol : null,
    source: 'rpc-confirmed-receipts' as const,
    historicalEvidence,
  };
}
