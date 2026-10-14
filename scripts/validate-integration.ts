import { readFile, writeFile } from 'node:fs/promises';
import { keccak256, toHex, parseAbi, type Address } from 'viem';
import { intentDomain, intentTypes } from '../packages/protocol/intents.js';
import { ADDRESSES, archiveClient } from '../packages/protocol/registry.js';
import { assertHistoricalState } from '../packages/protocol/archive.js';
const manifest = JSON.parse(
  await readFile(new URL('../research/contracts/manifest.json', import.meta.url), 'utf8'),
);
const state = JSON.parse(
  await readFile(new URL('../research/official-state.json', import.meta.url), 'utf8'),
);
const client = archiveClient();
await assertHistoricalState(client, ADDRESSES.PaperToken);
const comparisons = await Promise.all(
  [
    ['PaperToken', 'totalSupply', state.summary.paper.supply],
    ['PaperStaking', 'totalStaked', state.summary.paper.staked],
    ['PaperTokenomics', 'trackedLpUsd', state.summary.paper.trackedLp],
    ['Exchange', 'totalQueued', state.summary.balances.queue],
  ].map(async ([name, method, expected]) => {
    const signature: string = `function ${method}() view returns (${method === 'trackedLpUsd' ? 'int256' : 'uint256'})`;
    const actual = await client.readContract({
      address: ADDRESSES[name as keyof typeof ADDRESSES],
      abi: parseAbi([signature]),
      functionName: method!,
      blockNumber: BigInt(state.summary.source.block),
    });
    return {
      contract: name,
      method,
      block: state.summary.source.block,
      expected,
      actual: String(actual),
      matches: String(actual) === expected,
    };
  }),
);
const typeHashes = await Promise.all(
  Object.entries(intentTypes).map(async ([type, fields]) => {
    const encoding = `${type}(${fields.map((field) => `${field.type} ${field.name}`).join(',')})`;
    const hash = keccak256(toHex(encoding));
    const name =
      type === 'Stake' || type === 'Unstake' || type === 'Claim'
        ? 'PaperStaking'
        : type === 'RegisterSessionKey'
          ? 'SessionKeyManager'
          : 'Exchange';
    const code = await readFile(
      new URL(`../research/contracts/${name}.runtime.hex`, import.meta.url),
      'utf8',
    );
    return {
      type,
      encoding,
      hash,
      contract: name,
      hashLiteralInRuntime: code.toLowerCase().includes(hash.slice(2)),
    };
  }),
);
const domainAbi = parseAbi([
  'function eip712Domain() view returns (bytes1 fields, string name, string version, uint256 chainId, address verifyingContract, bytes32 salt, uint256[] extensions)',
]);
const domains = await Promise.all(
  ['Exchange', 'PaperStaking'].map(async (name) => {
    try {
      const value = await client.readContract({
        address: ADDRESSES[name as 'Exchange' | 'PaperStaking'],
        abi: domainAbi,
        functionName: 'eip712Domain',
      });
      return {
        contract: name,
        status: 'observed',
        fields: value[0],
        name: value[1],
        version: value[2],
        chainId: String(value[3]),
        verifyingContract: value[4],
        salt: value[5],
        extensions: value[6].map(String),
        expected: intentDomain(name === 'Exchange' ? 'OpenPosition' : 'Stake'),
      };
    } catch {
      return { contract: name, status: 'unavailable' };
    }
  }),
);
const report = {
  observedAtUtc: new Date().toISOString(),
  comparisons,
  typeHashes,
  domains,
  relayer: {
    endpoint: 'https://exchange.papertrade.xyz/intents',
    evidence: 'Observed official index bundle POST route; no POST submitted',
    accessTested: false,
  },
  contractWallet: {
    eip1271Verified: false,
    reason: 'No verified source or authorised contract-wallet settlement test',
  },
  sourceEquivalenceVerified: manifest.records.every(
    (row: { sourceEquivalenceVerified: boolean }) => row.sourceEquivalenceVerified,
  ),
  depositVerified: false,
  limitations: [
    'Hash literals and EIP-5267 domain are partial evidence, not a full contract security review.',
    'No official test deployment, funding or real signed intents used.',
  ],
};
await writeFile(
  new URL('../research/integration-validation.json', import.meta.url),
  JSON.stringify(report, null, 2) + '\n',
);
console.table(comparisons);
console.table(domains);
if (comparisons.some((row) => !row.matches))
  console.warn(
    'Snapshot fields differ at the declared source block; report is partial evidence, not an exact onchain reconciliation.',
  );
