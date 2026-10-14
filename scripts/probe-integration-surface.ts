import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { keccak256, toHex, type Hex } from 'viem';
import { boundedText } from '../packages/http/guards.js';

// Passive network observations only: GET metadata and OPTIONS preflight.
// Downloaded source is data; it is neither executed nor treated as verified.
async function observe(url: string, method: 'GET' | 'OPTIONS', headers?: Record<string, string>) {
  try {
    const response = await fetch(url, {
      method,
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
    const body = await boundedText(response, 2000000, 10000);
    let abiPresent = false;
    try {
      const data = JSON.parse(body);
      abiPresent = Array.isArray(data.abi ?? data.output?.abi);
    } catch {
      /* Non-JSON is only an observation. */
    }
    return {
      url,
      method,
      status: response.status,
      bodySha256: createHash('sha256').update(body).digest('hex'),
      abiPresent,
      allowOrigin: response.headers.get('access-control-allow-origin'),
      allowMethods: response.headers.get('access-control-allow-methods'),
      allowHeaders: response.headers.get('access-control-allow-headers'),
      allowCredentials: response.headers.get('access-control-allow-credentials'),
    };
  } catch (error) {
    return {
      url,
      method,
      status: 'unavailable',
      errorClass: error instanceof Error ? error.name : 'ReadError',
    };
  }
}
function pushConstants(code: Hex) {
  const bytes = Buffer.from(code.slice(2), 'hex');
  const result: { offset: number; value: string }[] = [];
  // Strip Solidity CBOR trailer when its declared byte length fits.
  const trailer = bytes.length >= 2 ? bytes.readUInt16BE(bytes.length - 2) : 0;
  const end = trailer > 0 && trailer + 2 < bytes.length ? bytes.length - trailer - 2 : bytes.length;
  for (let pc = 0; pc < end; pc++) {
    const opcode = bytes[pc]!;
    if (opcode < 0x60 || opcode > 0x7f) continue;
    const size = opcode - 0x5f;
    if (pc + size >= end) break;
    result.push({ offset: pc, value: bytes.subarray(pc + 1, pc + 1 + size).toString('hex') });
    pc += size;
  }
  return result;
}
const domainReport = JSON.parse(await readFile('research/signature-domains.json', 'utf8'));
const manifest = JSON.parse(await readFile('research/contracts/manifest.json', 'utf8')) as {
  blockNumber: string;
  records: { name: string; implementation: string; metadataCid: string | null }[];
};
const selected = manifest.records.filter((row: { name: string }) =>
  ['Exchange', 'PaperStaking'].includes(row.name),
);
const sources = await Promise.all(
  selected.map(
    async (row: { name: string; implementation: string; metadataCid: string | null }) => ({
      name: row.name,
      observations: await Promise.all([
        observe(
          `https://sourcify.dev/server/v2/contract/999/${row.implementation}?fields=all`,
          'GET',
        ),
        ...(row.metadataCid ? [observe(`https://ipfs.io/ipfs/${row.metadataCid}`, 'GET')] : []),
      ]),
      sourceEquivalenceVerified: false,
    }),
  ),
);
const runtimeEvidence = await Promise.all(
  ['Exchange', 'PaperStaking', 'BatchExecutor', 'SessionKeyManager'].map(async (name) => {
    const runtime = (
      await readFile(`research/contracts/${name}.runtime.hex`, 'utf8')
    ).trim() as Hex;
    const constants = pushConstants(runtime);
    const signatures = ['String', '1', 'PaperStaking'].map((value) => ({
      value,
      hash: keccak256(toHex(value)),
      pushOffsets: constants
        .filter((row) => row.value === keccak256(toHex(value)).slice(2))
        .map((row) => row.offset),
    }));
    return {
      name,
      runtimeHash: keccak256(runtime),
      eip1271MagicPushOffsets: constants
        .filter((row) => /^1626ba7e(?:0+)?$/.test(row.value))
        .map((row) => row.offset),
      domainHashConstants: signatures,
      contractWalletVerified: false,
    };
  }),
);
const preflight = await observe('https://exchange.papertrade.xyz/intents', 'OPTIONS', {
  Origin: 'http://127.0.0.1:3000',
  'Access-Control-Request-Method': 'POST',
  'Access-Control-Request-Headers': 'content-type,x-papertrade-build',
});
const report = {
  observedAtUtc: new Date().toISOString(),
  sources,
  runtimeEvidence,
  runtimeEvidenceBlock: manifest.blockNumber,
  latestDomainEvidenceBlock: domainReport.block,
  preflight,
  thirdPartyRelayerSettlementVerified: false,
  liveSubmission: false,
  limitations: [
    'A preflight response is not relayer authorization or settlement evidence.',
    'PUSH constants are static clues, not proof that a signing or EIP-1271 execution path exists.',
    'Runtime evidence belongs to the archived manifest block, not a new deployment observation.',
    'Fetched metadata or ABI alone does not prove compiler/source equivalence. No writes or signatures submitted.',
  ],
};
await writeFile('research/integration-surface.json', JSON.stringify(report, null, 2) + '\n');
console.log({
  sourceStatus: sources.map((row) => ({
    name: row.name,
    statuses: row.observations.map((value) => value.status),
  })),
  preflightStatus: preflight.status,
  contractWalletVerified: false,
  liveSubmission: false,
});
