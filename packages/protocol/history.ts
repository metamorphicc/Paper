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
    (raw.nextCursor !== null &&
      (typeof raw.nextCursor !== 'string' ||
        raw.nextCursor.length < 1 ||
        raw.nextCursor.length > 2048 ||
        /[\u0000-\u001f\u007f]/.test(raw.nextCursor)))
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
export async function tradeHistory(
  address: string,
  client = new OfficialReadClient(),
  cursor: string | null = null,
) {
  if (!isAddress(address)) throw new Error('Invalid address');
  if (
    cursor !== null &&
    (typeof cursor !== 'string' ||
      cursor.length < 1 ||
      cursor.length > 2048 ||
      /[\u0000-\u001f\u007f]/.test(cursor))
  )
    throw new Error('Invalid history cursor');
  const query = new URLSearchParams({ filter: 'all', limit: '75' });
  if (cursor !== null) query.set('cursor', cursor);
  // The public endpoint rejects unsorted query keys with a canonical-URL error.
  query.sort();
  const page = parseTradeHistory(
    await client.get(`/query/accounts/${address.toLowerCase()}/trades?${query}`),
  );
  if (page.nextCursor !== null && page.nextCursor === cursor)
    throw new Error('History returned a repeated cursor');
  return page;
}
