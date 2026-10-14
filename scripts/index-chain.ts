import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { keccak256, parseAbiItem, type Address } from 'viem';
import { ADDRESSES, IMPLEMENTATION_SLOT, publicClient } from '../packages/protocol/registry.js';
import { Store, type BlockRecord, type TokenEvent } from '../packages/indexer/store.js';
const client = publicClient();
if ((await client.getChainId()) !== 999) throw new Error('Wrong chain');
const latest = Number(await client.getBlockNumber()) - 3;
const store = new Store(resolve(process.env.PAPERCLUB_DATA_DIR ?? 'data', 'paperclub.sqlite'));
try {
  const manifest = JSON.parse(
    await readFile(new URL('../research/contracts/manifest.json', import.meta.url), 'utf8'),
  );
  const approved = manifest.records.find((row: { name: string }) => row.name === 'PaperToken');
  const slot = await client.getStorageAt({
    address: ADDRESSES.PaperToken,
    slot: IMPLEMENTATION_SLOT,
  });
  const implementation = ('0x' + slot!.slice(-40)) as Address;
  const code = await client.getCode({ address: implementation });
  if (
    implementation !== approved.implementation ||
    !code ||
    keccak256(code) !== approved.runtimeHash
  )
    throw new Error('Token implementation changed; review before indexing');
  const cursor = store.cursor('paper-transfers');
  const configuredFrom = process.env.INDEX_FROM_BLOCK
    ? Number(process.env.INDEX_FROM_BLOCK)
    : Math.max(0, latest - 63);
  if (!Number.isSafeInteger(configuredFrom) || configuredFrom < 0 || configuredFrom > latest)
    throw new Error('Invalid INDEX_FROM_BLOCK');
  const from = cursor ? Math.max(cursor.from_block, cursor.through_block - 12) : configuredFrom;
  // Bounded batches prevent huge accidental backfills. Re-run to continue larger histories.
  const to = Math.min(latest, from + 127);
  const logs = await client.getLogs({
    address: ADDRESSES.PaperToken,
    event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
    fromBlock: BigInt(from),
    toBlock: BigInt(to),
    strict: true,
  });
  const blocks: BlockRecord[] = [];
  for (let start = from; start <= to; start += 8) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(8, to - start + 1) }, (_, index) =>
        client.getBlock({ blockNumber: BigInt(start + index) }),
      ),
    );
    for (const block of batch) {
      if (!block.hash || block.number === null) throw new Error('Incomplete header');
      blocks.push({
        number: Number(block.number),
        hash: block.hash,
        parentHash: block.parentHash,
        timestamp: Number(block.timestamp),
      });
    }
  }
  const events: TokenEvent[] = logs.map((log) => {
    if (!log.blockHash || !log.transactionHash || log.blockNumber === null || log.logIndex === null)
      throw new Error('Pending log');
    return {
      chainId: 999,
      contract: ADDRESSES.PaperToken,
      blockNumber: Number(log.blockNumber),
      blockHash: log.blockHash,
      txHash: log.transactionHash,
      logIndex: log.logIndex,
      from: log.args.from!,
      to: log.args.to!,
      amountRaw: String(log.args.value),
    };
  });
  const result = store.applyBatch('paper-transfers', 999, blocks, events);
  const statistics = store.statistics();
  console.log(result);
  console.log(statistics);
  await writeFile(
    new URL('../research/index-run.json', import.meta.url),
    JSON.stringify(
      {
        observedAtUtc: new Date().toISOString(),
        result,
        statistics,
        limitations: [
          'Partial block coverage, not lifetime rankings.',
          'Transfer events only; trading event schemas not inferred.',
        ],
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  store.close();
}
