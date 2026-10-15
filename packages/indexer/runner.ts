import type { BlockRecord, TokenEvent } from './store.js';
import type { WebStore } from '../storage/store.js';
import type { Implementation } from '../ops/upgrades.js';
export interface IndexChain {
  chainId(): Promise<number>;
  head(): Promise<number>;
  header(number: number): Promise<BlockRecord>;
  transfers(from: number, to: number): Promise<TokenEvent[]>;
  implementation(name: string, block: number): Promise<Implementation>;
  assertHistoricalCapability(): Promise<void>;
}
export type ReviewedImplementations = Record<string, Implementation>;
export function assertReviewed(expected: Implementation | undefined, actual: Implementation) {
  if (
    !expected ||
    expected.address.toLowerCase() !== actual.address.toLowerCase() ||
    expected.runtimeHash.toLowerCase() !== actual.runtimeHash.toLowerCase()
  )
    throw new Error('Implementation changed or is not reviewed');
}
/** Confirmed Transfer events only. No account, trading or token write calls exist in this worker. */
export async function runIndexer(
  store: WebStore,
  chain: IndexChain,
  expected: ReviewedImplementations,
  options: { maxBatches?: number; fromBlock?: number; maxDurationMs?: number } = {},
) {
  const maxBatches = options.maxBatches ?? 1,
    maxDurationMs = options.maxDurationMs ?? 480000;
  if (
    !Number.isSafeInteger(maxBatches) ||
    maxBatches < 1 ||
    maxBatches > 64 ||
    !Number.isSafeInteger(maxDurationMs) ||
    maxDurationMs < 1000 ||
    maxDurationMs > 600000
  )
    throw new Error('Invalid worker bounds');
  if (
    options.fromBlock !== undefined &&
    (!Number.isSafeInteger(options.fromBlock) || options.fromBlock < 0)
  )
    throw new Error('Invalid INDEX_FROM_BLOCK');
  if ((await chain.chainId()) !== 999) throw new Error('Wrong chain');
  await chain.assertHistoricalCapability();
  const started = Date.now(),
    batches = [];
  let confirmedHead = 0;
  for (let i = 0; i < maxBatches && Date.now() - started < maxDurationMs; i++) {
    confirmedHead = (await chain.head()) - 3;
    if (!Number.isSafeInteger(confirmedHead) || confirmedHead < 0)
      throw new Error('Invalid confirmed head');
    const anchor = await chain.header(confirmedHead);
    assertReviewed(expected.PaperToken, await chain.implementation('PaperToken', confirmedHead));
    const cursor = await store.cursor('paper-transfers');
    const from = cursor
      ? Math.max(cursor.from_block, cursor.through_block - 12)
      : (options.fromBlock ?? Math.max(0, confirmedHead - 63));
    if (from > confirmedHead)
      throw new Error('Cursor or configured start exceeds confirmed chain head');
    const to = Math.min(confirmedHead, from + 127);
    const events: TokenEvent[] = [];
    for (let chunk = from; chunk <= to; chunk += 50)
      events.push(...(await chain.transfers(chunk, Math.min(to, chunk + 49))));
    const blocks: BlockRecord[] = [];
    for (let start = from; start <= to; start += 8)
      blocks.push(
        ...(await Promise.all(
          Array.from({ length: Math.min(8, to - start + 1) }, (_, offset) =>
            chain.header(start + offset),
          ),
        )),
      );
    if ((await chain.header(confirmedHead)).hash.toLowerCase() !== anchor.hash.toLowerCase())
      throw new Error('Confirmed anchor changed while reading');
    assertReviewed(
      expected.PaperToken,
      await chain.implementation('PaperToken', (await chain.head()) - 3),
    );
    batches.push(await store.applyBatch('paper-transfers', 999, blocks, events));
    if (to === confirmedHead) break;
  }
  const cursor = await store.cursor('paper-transfers');
  if (!cursor) throw new Error('Worker did not index a batch');
  const lagBlocks = Math.max(0, confirmedHead - cursor.through_block);
  return {
    observedAtUtc: new Date().toISOString(),
    chainId: 999,
    confirmedHead,
    through: cursor.through_block,
    lagBlocks,
    caughtUp: lagBlocks === 0,
    batches,
    coverageFrom: cursor.from_block,
    coverage: 'partial-transfer-history',
    historicalCapabilityChecked: true,
    liveSubmission: false,
  };
}
