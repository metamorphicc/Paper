import { parseAbi, keccak256, toFunctionSelector, type Address } from 'viem';
import { ADDRESSES, CHAIN_ID, IMPLEMENTATION_SLOT, publicClient } from './registry.js';

export type Observation = { status: 'ok'; raw: string; signature: string; unit: string }
  | { status: 'unavailable'; reason: string; signature: string; unit: string };
export type ProtocolSnapshot = {
  observedAtUtc: string; blockTimestampUtc: string; chainId: number; blockNumber: string; blockHash: string | null;
  fingerprint: string; implementations: Record<string, { address: string; runtimeHash: string }>;
  values: Record<string, Observation>; limitations: string[];
};
// Narrow, documented or selector-probed getters only. No write ABI is inferred.
export const reads = [
  ['PaperToken', 'totalSupply', 'function totalSupply() view returns (uint256)', 'PAPER-18'],
  ['PaperToken', 'decimals', 'function decimals() view returns (uint8)', 'count'],
  ['Exchange', 'lpBankrollAvailable', 'function lpBankrollAvailable() view returns (uint256)', 'USD-18-frontend-crosschecked'],
  ['Exchange', 'treasury', 'function treasury() view returns (uint256)', 'raw-unverified-USD'],
  ['Exchange', 'sideBucket', 'function sideBucket() view returns (uint256)', 'raw-unverified-USD'],
  ['Exchange', 'totalQueued', 'function totalQueued() view returns (uint256)', 'raw-unverified-USD'],
  ['Exchange', 'stakerFeeAccumulator', 'function stakerFeeAccumulator() view returns (uint256)', 'raw-unverified-USD'],
  ['Exchange', 'tradingPaused', 'function tradingPaused() view returns (bool)', 'flag'],
  ['Exchange', 'owner', 'function owner() view returns (address)', 'address'],
  ['PaperTokenomics', 'trackedLpUsd', 'function trackedLpUsd() view returns (int256)', 'raw-unverified-USD'],
  ['PaperTokenomics', 'lpFlatThresholdUsd', 'function lpFlatThresholdUsd() view returns (uint256)', 'raw-unverified-USD'],
  ['PaperTokenomics', 'tailDecayScaleUsd', 'function tailDecayScaleUsd() view returns (uint256)', 'raw-unverified-USD'],
  ['PaperTokenomics', 'tailProgressUsd', 'function tailProgressUsd() view returns (uint256)', 'raw-unverified-USD'],
  ['PaperTokenomics', 'flatRate', 'function flatRate() view returns (uint256)', 'raw-unverified-rate'],
  ['PaperStaking', 'totalStaked', 'function totalStaked() view returns (uint256)', 'PAPER-18'],
  ['PaperStaking', 'accRewardPerShare', 'function accRewardPerShare() view returns (uint256)', 'raw-accumulator'],
] as const;

function reason(error: unknown) {
  // Do not return transport URLs or request dumps that could contain credentials.
  return error instanceof Error ? error.name : 'ReadError';
}
export async function readProtocol(): Promise<ProtocolSnapshot> {
  const client = publicClient();
  if (await client.getChainId() !== CHAIN_ID) throw new Error('Wrong RPC chain');
  const blockNumber = await client.getBlockNumber();
  const block = await client.getBlock({ blockNumber });
  const entries = await Promise.all(Object.entries(ADDRESSES).map(async ([name, address]) => {
    const slot = await client.getStorageAt({ address, blockNumber, slot: IMPLEMENTATION_SLOT });
    const implementation = slot && BigInt(slot) !== 0n ? '0x' + slot.slice(-40) : address;
    const code = await client.getCode({ address: implementation as Address, blockNumber });
    if (!code || code === '0x') throw new Error(`No code: ${name}`);
    return [name, { address: implementation, runtimeHash: keccak256(code) }] as const;
  }));
  const implementations = Object.fromEntries(entries);
  const observations = await Promise.all(reads.map(async ([contract, method, signature, unit]) => {
    try {
      const value = await client.readContract({ address: ADDRESSES[contract], abi: parseAbi([signature]), functionName: method, blockNumber });
      return [`${contract}.${method}`, { status: 'ok', raw: String(value), signature, unit } satisfies Observation] as const;
    } catch (error) {
      return [`${contract}.${method}`, { status: 'unavailable', reason: reason(error), signature, unit } satisfies Observation] as const;
    }
  }));
  return { observedAtUtc: new Date().toISOString(), blockTimestampUtc: new Date(Number(block.timestamp) * 1000).toISOString(),
    chainId: CHAIN_ID, blockNumber: blockNumber.toString(), blockHash: block.hash,
    fingerprint: keccak256(new TextEncoder().encode(JSON.stringify(implementations))), implementations,
    values: Object.fromEntries(observations), limitations: [
      'Narrow read ABI does not establish complete source equivalence or event schemas.',
      'Official frontend wire/build confirms internal USD-18, withdrawal USD-6; remaining raw fields retain provenance labels.',
      'Official browser schemas observed; source equivalence and approved third-party submission remain unverified.',
    ] };
}

export async function readProfile(address: Address, blockNumber?: bigint) {
  const client = publicClient();
  if (await client.getChainId() !== CHAIN_ID) throw new Error('Wrong RPC chain');
  blockNumber ??= await client.getBlockNumber();
  const fields = [
    ['PaperToken', 'balanceOf', 'function balanceOf(address) view returns (uint256)', 'PAPER-18'],
    ['PaperStaking', 'pendingReward', 'function pendingReward(address) view returns (uint256)', 'raw-unverified-USD'],
    ['PaperStaking', 'stakedBalance', 'function stakedBalance(address) view returns (uint256)', 'PAPER-18'],
    ['Exchange', 'balances', 'function balances(address) view returns (uint256)', 'raw-unverified-USD'],
  ] as const;
  const values = await Promise.all(fields.map(async ([contract, method, signature, unit]) => {
    try {
      const raw = await client.readContract({ address: ADDRESSES[contract], abi: parseAbi([signature]), functionName: method, args: [address], blockNumber });
      return [method, { status: 'ok', raw: String(raw), signature, unit } satisfies Observation] as const;
    } catch (error) {
      return [method, { status: 'unavailable', reason: reason(error), signature, unit } satisfies Observation] as const;
    }
  }));
  return { address, chainId: CHAIN_ID, blockNumber: blockNumber.toString(), observedAtUtc: new Date().toISOString(), values: Object.fromEntries(values) };
}
export function selector(signature: string) { return toFunctionSelector(signature); }
