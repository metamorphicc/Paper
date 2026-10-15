import 'server-only';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { WebStore } from '../../../packages/storage/store.js';
import { openWebStore } from '../../../packages/storage/open.js';
import { validateDatabaseConfiguration } from '../../../packages/storage/config.js';
import { OfficialReadClient, object, integerString } from '../../../packages/protocol/official.js';
import { isAddress } from 'viem';

export function repoRoot() {
  let path = process.cwd();
  for (let index = 0; index < 5; index++) {
    const file = join(path, 'package.json');
    if (
      existsSync(file) &&
      JSON.parse(readFileSync(file, 'utf8')).name === 'papertrade-meme-research'
    )
      return path;
    path = dirname(path);
  }
  throw new Error('Repository root not found');
}
let store: Promise<WebStore> | undefined;
export function database(): Promise<WebStore> {
  if (store) return store;
  store = (async () => {
    const connection = validateDatabaseConfiguration(process.env);
    return openWebStore(process.env, connection ? undefined : join(repoRoot(), 'data'));
  })();
  void store.catch(() => {
    store = undefined;
  });
  return store;
}
const api = new OfficialReadClient();
export async function protocolData() {
  const db = await database();
  const cached = await db.latestSnapshot<Awaited<ReturnType<OfficialReadClient['summary']>>>(
    'protocol',
    '999',
  );
  if (cached && Date.now() - Date.parse(cached.observedAt) < 10_000)
    return {
      ...cached,
      stale: Date.now() - cached.value.source.at > 60_000,
      source: 'official-indexer',
      reconciled: false,
    };
  try {
    const value = await api.summary();
    await db.saveSnapshot('protocol', '999', 'official-indexer', Number(value.source.block), value);
    return {
      value,
      observedAt: new Date().toISOString(),
      block: Number(value.source.block),
      stale: Date.now() - value.source.at > 60_000,
      source: 'official-indexer',
      reconciled: false,
    };
  } catch {
    if (cached) return { ...cached, stale: true, source: 'official-indexer', reconciled: false };
    throw new Error('Protocol data unavailable');
  }
}
export type WalletProfile = {
  address: string;
  block: number;
  sourceAt: number;
  availableRaw: string;
  queuedRaw: string;
  lockedRaw: string;
  paperRaw: string;
  stakedRaw: string;
  pendingBaseRaw: string;
  realizedPnlRaw: string;
  claimedRaw: string;
  tradedNotionalRaw: string;
  openPositions: unknown[];
  operations: unknown[];
};
function parseWallet(snapshot: Record<string, unknown>, address: string): WalletProfile {
  if (String(snapshot.address).toLowerCase() !== address.toLowerCase())
    throw new Error('Account mismatch');
  const paper = object(snapshot.paper),
    funds = object(snapshot.funds),
    lifetime = object(snapshot.lifetime);
  const block = snapshot.indexedThroughBlock,
    timestamp = snapshot.indexedThroughTimestamp;
  if (
    typeof block !== 'number' ||
    !Number.isSafeInteger(block) ||
    typeof timestamp !== 'number' ||
    !Number.isSafeInteger(timestamp)
  )
    throw new Error('Invalid wallet source');
  if (!Array.isArray(snapshot.openPositions) || !Array.isArray(snapshot.operations))
    throw new Error('Invalid positions');
  return {
    address: address.toLowerCase(),
    block,
    sourceAt: timestamp * 1000,
    availableRaw: integerString(funds.availableBalance),
    queuedRaw: integerString(funds.availableQueued),
    lockedRaw: integerString(snapshot.locked),
    paperRaw: integerString(paper.balance),
    stakedRaw: integerString(paper.staked),
    pendingBaseRaw: integerString(paper.pendingBase),
    realizedPnlRaw: integerString(lifetime.realizedPnlRaw, true),
    claimedRaw: integerString(lifetime.paperRewardsClaimedRaw),
    tradedNotionalRaw: integerString(lifetime.tradedNotionalRaw),
    openPositions: snapshot.openPositions,
    operations: snapshot.operations,
  };
}
export async function walletData(address: string) {
  if (!isAddress(address)) throw new Error('Invalid address');
  const db = await database();
  const cached = await db.latestSnapshot<WalletProfile>('wallet', address);
  if (cached && Date.now() - Date.parse(cached.observedAt) < 15_000)
    return { ...cached, stale: Date.now() - cached.value.sourceAt > 60_000 };
  try {
    const value = parseWallet(await api.wallet(address), address);
    await db.saveSnapshot('wallet', address, 'official-indexer', value.block, value);
    return {
      value,
      block: value.block,
      observedAt: new Date().toISOString(),
      stale: Date.now() - value.sourceAt > 60_000,
    };
  } catch {
    if (cached) return { ...cached, stale: true };
    throw new Error('Wallet data unavailable');
  }
}
