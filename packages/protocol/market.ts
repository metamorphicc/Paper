import { parseUnits } from 'viem';
import { integerString, object } from './official.js';
export type MarketQuote = {
  coin: 'BTC' | 'ETH';
  time: number;
  bid: string;
  ask: string;
  midpointRaw: string;
  priceScale: number;
  source: 'hyperliquid-bbo';
};
export async function marketQuote(
  coin: 'BTC' | 'ETH',
  fetcher: typeof fetch = fetch,
): Promise<MarketQuote> {
  const response = await fetcher('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'l2Book', coin }),
    signal: AbortSignal.timeout(8_000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error('BBO data unavailable');
  const value = object(await response.json());
  if (
    value.coin !== coin ||
    typeof value.time !== 'number' ||
    !Number.isSafeInteger(value.time) ||
    Math.abs(Date.now() - value.time) > 30_000 ||
    !Array.isArray(value.levels) ||
    !Array.isArray(value.levels[0]) ||
    !Array.isArray(value.levels[1])
  )
    throw new Error('Stale or invalid BBO');
  const bid = object(value.levels[0][0]).px,
    ask = object(value.levels[1][0]).px;
  if (
    typeof bid !== 'string' ||
    typeof ask !== 'string' ||
    !/^\d+(\.\d+)?$/.test(bid) ||
    !/^\d+(\.\d+)?$/.test(ask)
  )
    throw new Error('Invalid book price');
  const b = parseUnits(bid, 8),
    a = parseUnits(ask, 8);
  if (b <= 0n || a < b) throw new Error('Crossed book');
  const priceScale = coin === 'BTC' ? 10 : 100;
  const midpointRaw = ((a + b) * BigInt(priceScale)) / (2n * 100_000_000n);
  return {
    coin,
    time: value.time,
    bid,
    ask,
    midpointRaw: integerString(String(midpointRaw)),
    priceScale,
    source: 'hyperliquid-bbo',
  };
}
export async function marketCandles(coin: 'BTC' | 'ETH', fetcher: typeof fetch = fetch) {
  const to = Date.now(),
    from = to - 24 * 60 * 60 * 1000;
  const response = await fetcher('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'candleSnapshot',
      req: { coin, interval: '15m', startTime: from, endTime: to },
    }),
    signal: AbortSignal.timeout(8_000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error('Candle data unavailable');
  const values: unknown = await response.json();
  if (!Array.isArray(values) || values.length > 200) throw new Error('Invalid candles');
  const result = values.map((value) => {
    const row = object(value);
    if (
      row.s !== coin ||
      typeof row.t !== 'number' ||
      !Number.isSafeInteger(row.t) ||
      typeof row.c !== 'string' ||
      !/^\d+(\.\d+)?$/.test(row.c)
    )
      throw new Error('Invalid candle');
    return { time: row.t, close: Number(row.c) };
  });
  if (
    result.some(
      (row, index) =>
        !Number.isFinite(row.close) ||
        row.close <= 0 ||
        (index > 0 && row.time <= result[index - 1]!.time),
    )
  )
    throw new Error('Invalid candle ordering');
  return result;
}
