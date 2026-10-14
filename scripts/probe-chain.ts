import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createPublicClient, http, parseAbi, type Address } from 'viem';
import { hyperliquid } from 'viem/chains';

const config = JSON.parse(
  await readFile(new URL('../config/protocol.json', import.meta.url), 'utf8'),
);
const rpcUrl = process.env.HYPEREVM_RPC_URL ?? config.rpcUrl;
const client = createPublicClient({
  chain: hyperliquid,
  transport: http(rpcUrl, { timeout: 15_000, retryCount: 1 }),
});
const observedAtUtc = new Date().toISOString();
await mkdir(new URL('../research/', import.meta.url), { recursive: true });
try {
  const chainId = await client.getChainId();
  if (chainId !== config.chainId)
    throw new Error(`Expected chain ${config.chainId}; got ${chainId}`);
  const blockNumber = await client.getBlockNumber();
  const block = await client.getBlock({ blockNumber });
  const contracts = [];
  // A single pinned block makes this snapshot internally consistent.
  for (const [name, rawAddress] of Object.entries(config.contracts) as [string, string][]) {
    const address = rawAddress.toLowerCase() as Address;
    try {
      const code = await client.getCode({ address, blockNumber });
      const implementationSlot = await client.getStorageAt({
        address,
        blockNumber,
        slot: '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc',
      });
      contracts.push({
        name,
        address,
        codeBytes: code ? (code.length - 2) / 2 : 0,
        implementationSlot: implementationSlot ?? null,
        status: code && code !== '0x' ? 'code-present' : 'no-code',
      });
    } catch (error) {
      contracts.push({
        name,
        address,
        status: 'read-failed',
        error: error instanceof Error ? error.name : 'ReadError',
      });
    }
  }
  const tokenReads: Record<string, unknown> = {};
  const abi = parseAbi([
    'function totalSupply() view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
  ]);
  for (const functionName of ['totalSupply', 'decimals', 'symbol'] as const) {
    try {
      const value = await client.readContract({
        address: config.contracts.PaperToken.toLowerCase() as Address,
        abi,
        functionName,
        blockNumber,
      });
      tokenReads[functionName] = typeof value === 'bigint' ? value.toString() : value;
    } catch (error) {
      tokenReads[functionName] = { error: error instanceof Error ? error.name : 'ReadError' };
    }
  }
  const report = {
    observedAtUtc,
    status: 'rpc-connected',
    chainId,
    blockNumber: blockNumber.toString(),
    blockHash: block.hash,
    blockTimestampUtc: new Date(Number(block.timestamp) * 1000).toISOString(),
    contracts,
    tokenReads,
    limitations: [
      'Bytecode presence does not verify source or safety.',
      'Builder activation, relayer access and economic state not inferred from bytecode.',
      'No transactions or wallet signing performed.',
    ],
  };
  await writeFile(
    new URL('../research/chain-snapshot.json', import.meta.url),
    JSON.stringify(report, null, 2) + '\n',
  );
  const bad = contracts.filter((contract) => contract.status !== 'code-present');
  console.log(
    `Chain ${chainId}, block ${blockNumber}: ${contracts.length - bad.length}/${contracts.length} contracts have code.`,
  );
  console.log('PAPER standard read methods:', tokenReads);
  if (bad.length) process.exitCode = 1;
} catch (error) {
  await writeFile(
    new URL('../research/chain-snapshot.json', import.meta.url),
    JSON.stringify(
      {
        observedAtUtc,
        status: 'rpc-unavailable',
        error: error instanceof Error ? error.name : 'ReadError',
      },
      null,
      2,
    ) + '\n',
  );
  console.error('RPC snapshot unavailable:', error instanceof Error ? error.name : 'ReadError');
  process.exitCode = 1;
}
