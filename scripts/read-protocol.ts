import { mkdir, writeFile } from 'node:fs/promises';
import { readProfile, readProtocol } from '../packages/protocol/read.js';
import { ADDRESSES } from '../packages/protocol/registry.js';
const snapshot = await readProtocol();
await mkdir(new URL('../research/', import.meta.url), { recursive: true });
await writeFile(
  new URL('../research/live-protocol.json', import.meta.url),
  JSON.stringify(snapshot, null, 2) + '\n',
);
console.table(Object.entries(snapshot.values).map(([field, value]) => ({ field, ...value })));
// Staking/tokenomics contracts are deterministic control addresses, not invented users.
const profiles = await Promise.all(
  [ADDRESSES.PaperStaking, ADDRESSES.Exchange, ADDRESSES.PaperTokenomics].map((address) =>
    readProfile(address),
  ),
);
await writeFile(
  new URL('../research/control-profiles.json', import.meta.url),
  JSON.stringify(profiles, null, 2) + '\n',
);
console.log(
  `Latest observations, sampled head ${snapshot.blockNumber}; ${profiles.length} control profiles recorded. State is not block-pinned.`,
);
