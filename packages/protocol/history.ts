import { isAddress } from 'viem';
import { OfficialReadClient, object, integerString } from './official.js';
export type TradeRow = {
  timestampMs: number;
  txHash: string;
  positionId: string;
  symbol: string;
  isLong: boolean;
  leverage: number;
  kind: 'PositionClosed' | 'Liquidated';
  marginRaw: string;
  netPnlRaw: string;
  paperMintedRaw: string;
};
export function parseTradeHistory(value: unknown) {
  const raw = object(value);
  if (
    !Array.isArray(raw.items) ||
    raw.items.length > 200 ||
    (raw.nextCursor !== null && typeof raw.nextCursor !== 'string')
  )
    throw new Error('Invalid trade history');
  const items = raw.items.map((value) => {
    const row = object(value);
    if (
      typeof row.timestampMs !== 'number' ||
      !Number.isSafeInteger(row.timestampMs) ||
      typeof row.txHash !== 'string' ||
      !/^0x[\da-f]{64}$/i.test(row.txHash) ||
      typeof row.symbol !== 'string' ||
      !['BTC', 'ETH'].includes(row.symbol) ||
      typeof row.isLong !== 'boolean' ||
      typeof row.leverage !== 'number' ||
      !Number.isInteger(row.leverage) ||
      row.leverage < 1 ||
      !['PositionClosed', 'Liquidated'].includes(String(row.kind))
    )
      throw new Error('Invalid trade row');
    const adjusted = integerString(row.adjustedPnlRaw, true),
      fee = integerString(row.userPaidFeeRaw);
    return {
      timestampMs: row.timestampMs,
      txHash: row.txHash,
      positionId: integerString(row.positionId),
      symbol: row.symbol,
      isLong: row.isLong,
      leverage: row.leverage,
      kind: row.kind as TradeRow['kind'],
      marginRaw: integerString(row.marginRaw),
      netPnlRaw: String(BigInt(adjusted) - BigInt(fee)),
      paperMintedRaw: integerString(row.paperMintedRaw),
    };
  });
  const keys = items.map((row) => `${row.txHash}:${row.positionId}`);
  if (new Set(keys).size !== keys.length) throw new Error('Duplicate trade history');
  return { items, nextCursor: raw.nextCursor as string | null };
}
export async function tradeHistory(address: string, client = new OfficialReadClient()) {
  if (!isAddress(address)) throw new Error('Invalid address');
  return parseTradeHistory(
    await client.get(`/query/accounts/${address.toLowerCase()}/trades?filter=all&limit=75`),
  );
}
