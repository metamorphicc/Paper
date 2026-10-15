import type { BlockRecord, TokenEvent } from './store.js';
export function validateIndexBatch(
  stream: string,
  chainId: number,
  blocks: BlockRecord[],
  events: TokenEvent[],
) {
  if (!stream || !Number.isSafeInteger(chainId) || chainId <= 0 || blocks.length === 0)
    throw new Error('Invalid index batch');
  const first = blocks[0]!,
    last = blocks.at(-1)!;
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index]!;
    if (
      !Number.isSafeInteger(block.number) ||
      block.number < 0 ||
      !/^0x[\da-f]{64}$/i.test(block.hash) ||
      !/^0x[\da-f]{64}$/i.test(block.parentHash)
    )
      throw new Error('Invalid block header');
    if (
      index > 0 &&
      (block.number !== blocks[index - 1]!.number + 1 ||
        block.parentHash.toLowerCase() !== blocks[index - 1]!.hash.toLowerCase())
    )
      throw new Error('Non-contiguous block ancestry');
  }
  const headers = new Map(blocks.map((block) => [block.number, block.hash.toLowerCase()]));
  for (const event of events) {
    if (
      event.chainId !== chainId ||
      headers.get(event.blockNumber) !== event.blockHash.toLowerCase() ||
      !/^0x[\da-f]{64}$/i.test(event.txHash) ||
      !Number.isSafeInteger(event.logIndex) ||
      event.logIndex < 0 ||
      !/^(0|[1-9]\d*)$/.test(event.amountRaw) ||
      event.amountRaw.length > 78 ||
      !/^0x[\da-f]{40}$/i.test(event.from) ||
      !/^0x[\da-f]{40}$/i.test(event.to)
    )
      throw new Error('Event does not match canonical batch');
  }
  if (blocks.length > 2048 || events.length > 5000)
    throw new Error('Index batch exceeds its row limit');
  const keys = new Set<string>();
  for (const block of blocks)
    if (!Number.isSafeInteger(block.timestamp) || block.timestamp < 0)
      throw new Error('Invalid block timestamp');
  for (const event of events) {
    if (!/^0x[\da-f]{40}$/i.test(event.contract) || BigInt(event.amountRaw) >= 1n << 256n)
      throw new Error('Invalid token event');
    const key = event.txHash.toLowerCase() + ':' + event.logIndex;
    if (keys.has(key)) throw new Error('Duplicate event in batch');
    keys.add(key);
  }
  return { first, last };
}
