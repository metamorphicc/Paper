import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createPublicClient, http, keccak256, type Address } from 'viem';
import { hyperliquid } from 'viem/chains';

const config = JSON.parse(
  await readFile(new URL('../config/protocol.json', import.meta.url), 'utf8'),
);
const client = createPublicClient({
  chain: hyperliquid,
  transport: http(config.rpcUrl, { timeout: 15_000, retryCount: 1 }),
});
if ((await client.getChainId()) !== 999) throw new Error('Wrong chain');
const blockNumber = await client.getBlockNumber();
const root = new URL('../research/contracts/', import.meta.url);
await mkdir(root, { recursive: true });
function base58(hex: string) {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let number = BigInt('0x' + hex);
  let result = '';
  while (number > 0) {
    result = alphabet[Number(number % 58n)] + result;
    number /= 58n;
  }
  return result;
}
async function attempt(url: string) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    const content = response.ok ? await response.text() : null;
    return { url, status: response.status, content };
  } catch (error) {
    return { url, status: 'network-error', error: String(error).slice(0, 200), content: null };
  }
}
const records = await Promise.all(
  (Object.entries(config.contracts) as [string, string][]).slice(0, 8).map(async ([name, raw]) => {
    const proxy = raw.toLowerCase() as Address;
    const slot = await client.getStorageAt({
      address: proxy,
      blockTag: 'latest',
      slot: '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc',
    });
    const implementation =
      slot && BigInt(slot) !== 0n ? (('0x' + slot.slice(-40)) as Address) : proxy;
    const runtime = await client.getCode({ address: implementation, blockTag: 'latest' });
    if (!runtime || runtime === '0x') throw new Error(`No code at ${name}`);
    const cbor = runtime.match(/a264697066735822(1220[0-9a-f]{64})64736f6c6343([0-9a-f]{6})0033$/i);
    const cid = cbor ? base58(cbor[1]!) : null;
    const compiler = cbor ? [...Buffer.from(cbor[2]!, 'hex')].join('.') : null;
    await writeFile(new URL(`${name}.runtime.hex`, root), runtime + '\n');
    const urls = [
      `https://sourcify.dev/server/v2/contract/999/${implementation}?fields=all`,
      `https://hyperevmscan.io/address/${implementation}#code`,
      ...(cid ? [`https://ipfs.io/ipfs/${cid}`, `https://dweb.link/ipfs/${cid}`] : []),
    ];
    const responses = await Promise.all(urls.map(attempt));
    let metadataPresent = false;
    let explorerVerified = false;
    let abiPresent = false;
    for (const [index, response] of responses.entries()) {
      if (!response.content) continue;
      const file = `${name}.${index === 1 ? 'explorer.html' : `source-${index}.json`}`;
      await writeFile(new URL(file, root), response.content);
      if (index === 1)
        explorerVerified =
          !response.content.includes('Contract: Unverified') &&
          response.content.includes('js-copytextarea2');
      try {
        const json = JSON.parse(response.content);
        const abi = json.abi ?? json.output?.abi;
        if (Array.isArray(abi)) {
          await writeFile(new URL(`${name}.abi.json`, root), JSON.stringify(abi, null, 2) + '\n');
          abiPresent = true;
        }
        if (json.sources && json.compiler) metadataPresent = true;
      } catch {
        /* HTML and failure responses are evidence, not metadata */
      }
    }
    return {
      name,
      proxy,
      implementation,
      runtimeHash: keccak256(runtime),
      runtimeBytes: (runtime.length - 2) / 2,
      compilerFromCbor: compiler,
      metadataCid: cid,
      metadataPresent,
      abiPresent,
      explorerVerified,
      sourceEquivalenceVerified: false,
      attempts: responses.map(({ content, ...rest }) => ({
        ...rest,
        sha256: content ? createHash('sha256').update(content).digest('hex') : null,
      })),
    };
  }),
);
const report = {
  observedAtUtc: new Date().toISOString(),
  chainId: 999,
  blockNumber: blockNumber.toString(),
  statePinned: false,
  stateMode: 'latest-observation',
  records,
  limitations: [
    'Block number is sampled head context. Default RPC state methods support latest only, so code/storage observations are not pinned to that block.',
    'Metadata/ABI presence alone does not prove source equivalence; compilation match is required.',
    'No retrieved JavaScript or Solidity is executed.',
  ],
};
await writeFile(new URL('manifest.json', root), JSON.stringify(report, null, 2) + '\n');
console.table(
  records.map(({ name, compilerFromCbor, metadataPresent, abiPresent, explorerVerified }) => ({
    name,
    compilerFromCbor,
    metadataPresent,
    abiPresent,
    explorerVerified,
  })),
);
