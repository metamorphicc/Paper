import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { OfficialReadClient } from '../packages/protocol/official.js';
import { ADDRESSES } from '../packages/protocol/registry.js';
const api = new OfficialReadClient();
const [summary, trading] = await Promise.all([api.summary(), api.trading()]);
const wallets = await Promise.all(
  [ADDRESSES.Exchange, ADDRESSES.PaperStaking].map(async (address) => {
    try {
      return { address, snapshot: await api.wallet(address) };
    } catch (error) {
      return { address, error: error instanceof Error ? error.message : 'Snapshot error' };
    }
  }),
);
const rawRoot = new URL('../research/frontend/', import.meta.url);
const files = await readdir(rawRoot);
const sourceFiles = await Promise.all(
  files
    .filter((file) => file.endsWith('.js'))
    .map(async (file) => ({
      url: `https://exchange.papertrade.xyz/assets/${file}`,
      sha256: createHash('sha256')
        .update(await readFile(new URL(file, rawRoot)))
        .digest('hex'),
    })),
);
const report = {
  observedAtUtc: new Date().toISOString(),
  origin: 'https://exchange.papertrade.xyz',
  summary,
  trading,
  wallets,
  sourceFiles,
  units: {
    internalUsdDecimals: 18,
    paperDecimals: 18,
    withdrawalAmountDecimals: 6,
    evidence:
      'Official wire collateralScale=10^(18-6), typed-data and build USD formatting; RPC threshold/decay checks agree.',
  },
  collateralMismatch: {
    docs: '0xb88339cb7199b77e23db6e890353e22632ba630f',
    frontend: '0x6b9e773128f453f5c2c60935ee2de2cbc5390a24',
    status: 'Unresolved; deposits disabled',
  },
};
await mkdir(new URL('../research/', import.meta.url), { recursive: true });
await writeFile(
  new URL('../research/official-state.json', import.meta.url),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(
  `Official summary block ${summary.source.block}; ${trading.instruments.length} live instrument configs; ${wallets.filter((row) => 'snapshot' in row).length} wallet frames.`,
);
