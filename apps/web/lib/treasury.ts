import 'server-only';
import { isAddress, type Address } from 'viem';
import { archiveClient } from '../../../packages/protocol/registry';
import { readTreasuryReceipts } from '../../../packages/treasury/read-receipts';
export type TreasuryReceiptState =
  | { status: 'not-configured'; source: 'rpc-confirmed-receipts' }
  | { status: 'unavailable'; source: 'rpc-confirmed-receipts'; error: string }
  | {
      status: 'available';
      source: 'rpc-confirmed-receipts';
      value: Awaited<ReturnType<typeof readTreasuryReceipts>>;
    };
const cache = new Map<string, { expiresAt: number; promise: Promise<TreasuryReceiptState> }>();
export async function treasuryReceipts(): Promise<TreasuryReceiptState> {
  const treasury = process.env.TREASURY_ADDRESS,
    asset = process.env.TREASURY_ASSET_ADDRESS;
  if (!treasury || !asset) return { status: 'not-configured', source: 'rpc-confirmed-receipts' };
  if (!isAddress(treasury, { strict: false }) || !isAddress(asset, { strict: false }))
    return {
      status: 'unavailable',
      source: 'rpc-confirmed-receipts',
      error: 'Treasury transfer data is unavailable.',
    };
  const key = treasury.toLowerCase() + ':' + asset.toLowerCase();
  const previous = cache.get(key);
  if (previous && previous.expiresAt > Date.now()) return previous.promise;
  const entry = {
    expiresAt: Number.POSITIVE_INFINITY,
    promise: Promise.resolve({
      status: 'not-configured',
      source: 'rpc-confirmed-receipts',
    } as TreasuryReceiptState),
  };
  entry.promise = Promise.resolve()
    .then(() =>
      readTreasuryReceipts(archiveClient(), {
        treasury: treasury as Address,
        asset: asset as Address,
      }),
    )
    .then((value) => ({
      status: 'available' as const,
      source: 'rpc-confirmed-receipts' as const,
      value,
    }))
    .catch(() => ({
      status: 'unavailable' as const,
      source: 'rpc-confirmed-receipts' as const,
      error:
        'Confirmed transfers require an available archive data source. No accounting result is shown.',
    }))
    .finally(() => {
      entry.expiresAt = Date.now() + 15000;
    });
  if (cache.size >= 4) cache.delete(cache.keys().next().value!);
  cache.set(key, entry);
  return entry.promise;
}
