import { isAddress } from 'viem';
import { boundedText } from '../http/guards.js';

export const OFFICIAL_ORIGIN = 'https://exchange.papertrade.xyz';
export type JsonObject = Record<string, unknown>;
export function object(value: unknown): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('Expected object');
  return value as JsonObject;
}
export function integerString(value: unknown, signed = false): string {
  if (
    typeof value !== 'string' ||
    value.length > 79 ||
    !(signed ? /^(0|-?[1-9]\d*)$/ : /^(0|[1-9]\d*)$/).test(value)
  )
    throw new Error('Invalid integer string');
  return value;
}
function safeInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new Error('Invalid safe integer');
  return value;
}
function flag(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('Invalid flag');
  return value;
}
export type Instrument = {
  id: number;
  symbol: string;
  assetIndex: number;
  priceScaleRaw: string;
  active: boolean;
  paused: boolean;
  terminal: boolean;
  retired: boolean;
  closeOnly: boolean;
  frozenBidRaw: string | null;
  frozenAskRaw: string | null;
  rateMultiplierRaw: string;
  positionMultiplierRaw: string;
  maxLeverage: number;
  maxPositionNotionalRaw: string;
  bustBufferRaw: string;
  baseRateRaw: string;
  referenceNotionalRaw: string;
  longOiRaw: string;
  shortOiRaw: string;
  longCapRaw: string;
  shortCapRaw: string;
};
export type TradingState = {
  schemaVersion: 1;
  indexedThroughBlock: number;
  tradingPaused: boolean;
  minimumTradeSizeRaw: string;
  minimumOpenNotionalRaw: string;
  instruments: Instrument[];
  intake: {
    revision: number;
    minimumPaperStakeRaw: string;
    maximumNetOpenInterestRaw: string;
    disabledActions: string[];
  };
};
export function parseTrading(value: unknown): TradingState {
  const v = object(value);
  if (v.schemaVersion !== 1 || !Array.isArray(v.instruments) || v.instruments.length > 100)
    throw new Error('Unknown trading schema');
  const instruments = v.instruments.map((row: unknown) => {
    if (!Array.isArray(row) || row.length !== 23) throw new Error('Unknown instrument tuple');
    if (typeof row[1] !== 'string' || !['BTC', 'ETH'].includes(row[1]))
      throw new Error('Unsupported instrument');
    const expected = row[1] === 'BTC' ? [0, 0, '10'] : [1, 1, '100'];
    if (row[0] !== expected[0] || row[2] !== expected[1] || row[3] !== expected[2])
      throw new Error('Deployment mismatch');
    const item = {
      id: safeInteger(row[0]),
      symbol: row[1],
      assetIndex: safeInteger(row[2]),
      priceScaleRaw: integerString(row[3]),
      active: flag(row[4]),
      paused: flag(row[5]),
      terminal: flag(row[6]),
      retired: flag(row[7]),
      closeOnly: flag(row[8]),
      frozenBidRaw: row[9] === null ? null : integerString(row[9]),
      frozenAskRaw: row[10] === null ? null : integerString(row[10]),
      rateMultiplierRaw: integerString(row[12]),
      positionMultiplierRaw: integerString(row[13]),
      maxLeverage: safeInteger(row[14]),
      maxPositionNotionalRaw: integerString(row[15]),
      bustBufferRaw: integerString(row[16]),
      baseRateRaw: integerString(row[17]),
      referenceNotionalRaw: integerString(row[18]),
      longOiRaw: integerString(row[19]),
      shortOiRaw: integerString(row[20]),
      longCapRaw: integerString(row[21]),
      shortCapRaw: integerString(row[22]),
    };
    if (
      item.paused !== item.terminal ||
      item.closeOnly !== item.paused ||
      item.retired !== (item.paused || !item.active)
    )
      throw new Error('Invalid market lifecycle');
    if (
      item.terminal
        ? row[9] === null || row[10] === null || row[11] === null
        : row[9] !== null || row[10] !== null || row[11] !== null
    )
      throw new Error('Invalid frozen price');
    if (
      BigInt(item.baseRateRaw) >= 10n ** 18n ||
      !item.maxLeverage ||
      item.maxLeverage > 1000 ||
      BigInt(item.priceScaleRaw) <= 0n ||
      BigInt(item.rateMultiplierRaw) <= 0n ||
      BigInt(item.positionMultiplierRaw) <= 0n
    )
      throw new Error('Invalid market range');
    return item;
  });
  if (new Set(instruments.map((item) => item.id)).size !== instruments.length)
    throw new Error('Duplicate market');
  if (
    !Array.isArray(v.intake) ||
    v.intake.length !== 4 ||
    !Array.isArray(v.intake[3]) ||
    !v.intake[3].every((item) => typeof item === 'string')
  )
    throw new Error('Unknown intake schema');
  return {
    schemaVersion: 1,
    indexedThroughBlock: safeInteger(v.indexedThroughBlock),
    tradingPaused: flag(v.tradingPaused),
    minimumTradeSizeRaw: integerString(v.minimumTradeSizeRaw),
    minimumOpenNotionalRaw: integerString(v.minimumOpenNotionalRaw),
    instruments,
    intake: {
      revision: safeInteger(v.intake[0]),
      minimumPaperStakeRaw: integerString(v.intake[1]),
      maximumNetOpenInterestRaw: integerString(v.intake[2]),
      disabledActions: v.intake[3],
    },
  };
}
export type Summary = {
  source: { block: string; at: number; genesis: number };
  balances: Record<'tvl' | 'margin' | 'lp' | 'reserve' | 'queue', string>;
  activity: { volume: string; open: number };
  fees: { pending: string; lifetime: string };
  paper: Record<
    | 'supply'
    | 'staked'
    | 'trackedLp'
    | 'accumulator'
    | 'reserve'
    | 'unallocated'
    | 'pendingRewards'
    | 'cap'
    | 'cliff'
    | 'rate'
    | 'decay'
    | 'tailProgress',
    string
  >;
};
export function parseSummary(value: unknown): Summary {
  const v = object(value);
  if (v.ok !== true) throw new Error('Summary unavailable');
  const source = object(v.source),
    balances = object(v.balances),
    paper = object(v.paper),
    activity = object(v.activity),
    fees = object(v.fees);
  const balanceFields = ['tvl', 'margin', 'lp', 'reserve', 'queue'] as const;
  const paperFields = [
    'supply',
    'staked',
    'trackedLp',
    'accumulator',
    'reserve',
    'unallocated',
    'pendingRewards',
    'cap',
    'cliff',
    'rate',
    'decay',
    'tailProgress',
  ] as const;
  return {
    source: {
      block: integerString(source.block),
      at: safeInteger(source.at),
      genesis: safeInteger(source.genesis),
    },
    balances: Object.fromEntries(
      balanceFields.map((field) => [field, integerString(balances[field])]),
    ) as Summary['balances'],
    paper: Object.fromEntries(
      paperFields.map((field) => [field, integerString(paper[field], field === 'trackedLp')]),
    ) as Summary['paper'],
    activity: { volume: integerString(activity.volume), open: safeInteger(activity.open) },
    fees: { pending: integerString(fees.pending), lifetime: integerString(fees.lifetime) },
  };
}
export class OfficialReadClient {
  private retryAt = 0;
  constructor(private fetcher: typeof fetch = fetch) {}
  async get(path: string): Promise<unknown> {
    if (
      !path.startsWith('/query/') &&
      path !== '/state/trading' &&
      !path.startsWith('/state/leaderboard/')
    )
      throw new Error('Unsupported read path');
    if (Date.now() < this.retryAt)
      throw new Error('Official API rate limited; wait for Retry-After');
    const url = new URL(path, OFFICIAL_ORIGIN);
    if (url.origin !== OFFICIAL_ORIGIN) throw new Error('Unexpected origin');
    const response = await this.fetcher(url, {
      method: 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(12_000),
      headers: { Accept: 'application/json' },
    });
    if (response.status === 429) {
      const header = response.headers.get('Retry-After');
      this.retryAt =
        header && /^\d+$/.test(header) ? Date.now() + Number(header) * 1000 : Date.now() + 30_000;
      throw new Error('Official API rate limited');
    }
    if (!response.ok) throw new Error(`Official API HTTP ${response.status}`);
    const text = await boundedText(response, 2_000_000);
    return JSON.parse(text);
  }
  async trading() {
    return parseTrading(await this.get('/state/trading'));
  }
  async summary() {
    return parseSummary(await this.get('/query/protocol/summary'));
  }
  async wallet(address: string) {
    if (!isAddress(address)) throw new Error('Invalid wallet address');
    const response = await this.fetcher(
      `${OFFICIAL_ORIGIN}/state/user/live?wallet=${address.toLowerCase()}`,
      {
        method: 'GET',
        redirect: 'error',
        signal: AbortSignal.timeout(12_000),
        headers: { Accept: 'text/event-stream' },
      },
    );
    if (
      !response.ok ||
      !response.body ||
      !response.headers.get('content-type')?.includes('text/event-stream')
    )
      throw new Error('Wallet snapshot unavailable');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    try {
      while (text.length < 1_000_000) {
        const chunk = await reader.read();
        if (chunk.done) break;
        text += decoder.decode(chunk.value, { stream: true }).replace(/\r\n/g, '\n');
        for (;;) {
          const index = text.indexOf('\n\n');
          if (index < 0) break;
          const frame = text.slice(0, index);
          text = text.slice(index + 2);
          if (!frame.split('\n').includes('event: wallet')) continue;
          const data = frame
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trimStart())
            .join('\n');
          const snapshot = object(JSON.parse(data));
          if (
            typeof snapshot.address !== 'string' ||
            snapshot.address.toLowerCase() !== address.toLowerCase() ||
            'baseAccountRevision' in snapshot
          )
            throw new Error('Unexpected wallet snapshot');
          safeInteger(snapshot.indexedThroughBlock);
          return snapshot;
        }
      }
      throw new Error('No full wallet frame');
    } finally {
      await reader.cancel();
      reader.releaseLock();
    }
  }
}
