import { writeFile } from 'node:fs/promises';
import { hashDomain, keccak256, parseAbi, toFunctionSelector, type Address } from 'viem';
import {
  ADDRESSES,
  CHAIN_ID,
  IMPLEMENTATION_SLOT,
  publicClient,
} from '../packages/protocol/registry.js';
import { intentDomain } from '../packages/protocol/intents.js';

// Public view calls only. An observed domain is evidence at a pinned block,
// not permission to submit an intent or proof of settlement/source equivalence.
const client = publicClient();
const [chainId, block] = await Promise.all([client.getChainId(), client.getBlock()]);
if (chainId !== CHAIN_ID) throw new Error('Unexpected RPC chain');
const types = {
  EIP712Domain: [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' },
    { name: 'verifyingContract', type: 'address' },
  ],
} as const;
const contracts = await Promise.all(
  (['Exchange', 'PaperStaking'] as const).map(async (name) => {
    const address = ADDRESSES[name];
    const expected = intentDomain(name === 'Exchange' ? 'OpenPosition' : 'Stake');
    const expectedSeparator = hashDomain({
      domain: { ...expected, chainId: BigInt(expected.chainId) },
      types,
    });
    const slot = await client.getStorageAt({
      address,
      slot: IMPLEMENTATION_SLOT,
      blockNumber: block.number,
    });
    if (!slot || slot.length !== 66) throw new Error('Implementation slot unavailable');
    const implementation = `0x${slot.slice(-40)}` as Address;
    const runtime = await client.getBytecode({
      address: implementation,
      blockNumber: block.number,
    });
    if (!runtime || runtime === '0x') throw new Error('Implementation bytecode unavailable');
    const separators = await Promise.all(
      (['DOMAIN_SEPARATOR', 'domainSeparator'] as const).map(async (getter) => {
        const selector = toFunctionSelector(`${getter}()`);
        const selectorLiteralInRuntime = runtime.toLowerCase().includes(selector.slice(2));
        try {
          const value = await client.readContract({
            address,
            abi: parseAbi([`function ${getter}() view returns (bytes32)`]),
            functionName: getter,
            blockNumber: block.number,
          });
          return {
            getter,
            selector,
            selectorLiteralInRuntime,
            status: 'observed',
            value,
            matchesExpected: value === expectedSeparator,
          };
        } catch (error) {
          return {
            getter,
            selector,
            selectorLiteralInRuntime,
            status: 'unavailable',
            errorClass: error instanceof Error ? error.name : 'ReadError',
          };
        }
      }),
    );
    let introspection: Record<string, unknown>;
    try {
      const value = await client.readContract({
        address,
        abi: parseAbi([
          'function eip712Domain() view returns (bytes1 fields, string name, string version, uint256 chainId, address verifyingContract, bytes32 salt, uint256[] extensions)',
        ]),
        functionName: 'eip712Domain',
        blockNumber: block.number,
      });
      introspection = {
        status: 'observed',
        fields: value[0],
        name: value[1],
        version: value[2],
        chainId: String(value[3]),
        verifyingContract: value[4],
        salt: value[5],
        extensions: value[6].map(String),
        matchesExpected:
          value[0] === '0x0f' &&
          value[1] === expected.name &&
          value[2] === expected.version &&
          value[3] === BigInt(expected.chainId) &&
          value[4].toLowerCase() === address.toLowerCase() &&
          value[6].length === 0,
      };
    } catch (error) {
      introspection = {
        status: 'unavailable',
        errorClass: error instanceof Error ? error.name : 'ReadError',
      };
    }
    return {
      name,
      address,
      implementation,
      runtimeHash: keccak256(runtime),
      expected,
      expectedSeparator,
      separators,
      introspection,
      domainObservedAtBlock:
        separators.some((row) => row.status === 'observed' && row.matchesExpected) ||
        introspection.matchesExpected === true,
    };
  }),
);
const report = {
  observedAtUtc: new Date().toISOString(),
  chainId,
  block: String(block.number),
  blockHash: block.hash,
  contracts,
  evidenceComplete: contracts.every((row) => row.domainObservedAtBlock),
  liveSubmission: false,
  limitations: [
    'Only common public separator getters and EIP-5267 were tested; unavailable does not prove the absence of an internal domain.',
    'Domain evidence alone does not verify intent execution, EIP-1271, relayer access, deposits or source equivalence.',
    'CancelIntent has a separate observed frontend domain and is not covered by these checks.',
  ],
};
await writeFile('research/signature-domains.json', JSON.stringify(report, null, 2) + '\n');
console.table(
  contracts.map((row) => ({
    contract: row.name,
    block: String(block.number),
    introspection: row.introspection.status,
    separator: row.separators.map((value) => `${value.getter}:${value.status}`).join(', '),
    domainObservedAtBlock: row.domainObservedAtBlock,
  })),
);
if (!report.evidenceComplete)
  console.warn('Domain evidence remains incomplete. Live submission stays disabled.');
