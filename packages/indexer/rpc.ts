import { keccak256, parseAbiItem, type Address } from 'viem';
import { archiveClient, ADDRESSES, IMPLEMENTATION_SLOT } from '../protocol/registry.js';
import { assertHistoricalState } from '../protocol/archive.js';
import type { IndexChain } from './runner.js';
/** Uses an archive endpoint that must honor historical state; raw RPC errors must be redacted by callers. */
export function indexChain(client = archiveClient()): IndexChain {
  return {
    chainId: () => client.getChainId(),
    head: async () => Number(await client.getBlockNumber({ cacheTime: 0 })),
    async assertHistoricalCapability() {
      await assertHistoricalState(client, ADDRESSES.PaperToken);
    },
    async header(number) {
      const block = await client.getBlock({ blockNumber: BigInt(number) });
      if (!block.hash || block.number === null || Number(block.number) !== number)
        throw new Error('Incomplete header');
      return {
        number,
        hash: block.hash,
        parentHash: block.parentHash,
        timestamp: Number(block.timestamp),
      };
    },
    async implementation(name, block) {
      if (!Object.hasOwn(ADDRESSES, name)) throw new Error('Unknown implementation');
      const address = ADDRESSES[name as keyof typeof ADDRESSES],
        blockNumber = BigInt(block);
      const slot = await client.getStorageAt({ address, blockNumber, slot: IMPLEMENTATION_SLOT });
      if (!slot || BigInt(slot) === 0n) throw new Error('Missing implementation slot');
      const implementation = ('0x' + slot.slice(-40)) as Address;
      const code = await client.getCode({ address: implementation, blockNumber });
      if (!code || code === '0x') throw new Error('Missing implementation code');
      return { address: implementation, runtimeHash: keccak256(code) };
    },
    async transfers(from, to) {
      const logs = await client.getLogs({
        address: ADDRESSES.PaperToken,
        event: parseAbiItem(
          'event Transfer(address indexed from, address indexed to, uint256 value)',
        ),
        fromBlock: BigInt(from),
        toBlock: BigInt(to),
        strict: true,
      });
      return logs.map((log) => {
        if (
          !log.blockHash ||
          !log.transactionHash ||
          log.blockNumber === null ||
          log.logIndex === null
        )
          throw new Error('Pending log');
        return {
          chainId: 999,
          contract: ADDRESSES.PaperToken,
          blockNumber: Number(log.blockNumber),
          blockHash: log.blockHash,
          txHash: log.transactionHash,
          logIndex: log.logIndex,
          from: log.args.from,
          to: log.args.to,
          amountRaw: String(log.args.value),
        };
      });
    },
  };
}
