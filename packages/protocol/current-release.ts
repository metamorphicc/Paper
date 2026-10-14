import { keccak256, type Address } from 'viem';
import manifest from '../../research/contracts/manifest.json' with { type: 'json' };
import { assertLiveSubmissionAllowed } from './capabilities.js';
import { publicClient, IMPLEMENTATION_SLOT } from './registry.js';
/** Always run immediately before forwarding a signed financial payload. */
export async function assertCurrentLiveRelease() {
  assertLiveSubmissionAllowed();
  const client = publicClient();
  if ((await client.getChainId()) !== 999) throw new Error('Wrong release RPC chain');
  await Promise.all(
    manifest.records.map(async (row) => {
      const slot = await client.getStorageAt({
        address: row.proxy as Address,
        slot: IMPLEMENTATION_SLOT,
        blockTag: 'latest',
      });
      if (
        !slot ||
        slot.length !== 66 ||
        '0x' + slot.slice(-40) !== row.implementation.toLowerCase()
      )
        throw new Error('Implementation changed; live transport stopped');
      const code = await client.getBytecode({
        address: row.implementation as Address,
        blockTag: 'latest',
      });
      if (!code || keccak256(code) !== row.runtimeHash)
        throw new Error('Runtime changed; live transport stopped');
    }),
  );
  assertLiveSubmissionAllowed();
}
