import { compareImplementations } from './upgrades.js';
import type { IndexChain, ReviewedImplementations } from '../indexer/runner.js';
export async function checkImplementations(chain: IndexChain, expected: ReviewedImplementations) {
  if ((await chain.chainId()) !== 999) throw new Error('Wrong chain');
  await chain.assertHistoricalCapability();
  const block = (await chain.head()) - 3;
  if (!Number.isSafeInteger(block) || block < 0) throw new Error('Invalid confirmed head');
  const anchor = await chain.header(block);
  const entries = await Promise.all(
    Object.keys(expected).map(
      async (name) => [name, await chain.implementation(name, block)] as const,
    ),
  );
  if ((await chain.header(block)).hash.toLowerCase() !== anchor.hash.toLowerCase())
    throw new Error('Upgrade-check anchor changed');
  return {
    observedAtUtc: new Date().toISOString(),
    chainId: 999,
    block,
    blockHash: anchor.hash,
    statePinned: true,
    trustlessStateProof: false,
    ...compareImplementations(expected, Object.fromEntries(entries)),
  };
}
export function reviewedImplementations(value: unknown): ReviewedImplementations {
  const records = (value as { records?: unknown[] } | null)?.records;
  const names = [
    'Exchange',
    'BatchExecutor',
    'PaperToken',
    'PaperStaking',
    'PaperTokenomics',
    'SessionKeyManager',
    'PriceOracle',
    'DepositProxyFactory',
  ];
  if (!Array.isArray(records) || records.length !== names.length)
    throw new Error('Invalid reviewed manifest');
  const expected: ReviewedImplementations = {};
  for (const record of records) {
    const row = record as { name: string; implementation: string; runtimeHash: string };
    if (
      !row ||
      !names.includes(row.name) ||
      expected[row.name] ||
      !/^0x[\da-f]{40}$/i.test(row.implementation) ||
      !/^0x[\da-f]{64}$/i.test(row.runtimeHash)
    )
      throw new Error('Invalid reviewed manifest');
    expected[row.name] = { address: row.implementation, runtimeHash: row.runtimeHash };
  }
  return expected;
}
