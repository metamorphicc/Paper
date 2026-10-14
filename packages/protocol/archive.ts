import { toFunctionSelector, type Address, type PublicClient } from 'viem';
export type HistoricalRpc = Pick<PublicClient, 'getBytecode' | 'call'>;

/** Capability canary against a known post-genesis ERC-20. Not a trustless state proof. */
export async function assertHistoricalState(client: HistoricalRpc, sentinel: Address) {
  const [currentCode, genesisCode, genesisCall] = await Promise.all([
    client.getBytecode({ address: sentinel }),
    client.getBytecode({ address: sentinel, blockNumber: 0n }),
    client.call({ to: sentinel, data: toFunctionSelector('totalSupply()'), blockNumber: 0n }),
  ]);
  if (
    !currentCode ||
    currentCode === '0x' ||
    (genesisCode && genesisCode !== '0x') ||
    (genesisCall.data && genesisCall.data !== '0x')
  )
    throw new Error('Historical state is unsupported or the post-genesis canary is invalid');
  return {
    historicalCanaryPassed: true,
    sentinel,
    checkpointBlock: '0',
    trustlessStateProof: false,
  } as const;
}
