import { writeFile, mkdir } from 'node:fs/promises';
import { isAddress, keccak256, toHex, type Address } from 'viem';
import { openWebStore } from '../packages/storage/open.js';
import { PersistentCampaign } from '../packages/community/persistent.js';
import { createSnapshot } from '../packages/rewards/snapshot.js';
import { publicClient } from '../packages/protocol/registry.js';
import { CAMPAIGN_ID } from '../packages/community/campaign.js';
const contract = process.env.CLAIM_CONTRACT,
  budget = process.env.SNAPSHOT_BUDGET_RAW;
if (!contract || !isAddress(contract) || !budget || !/^\d+$/.test(budget) || BigInt(budget) <= 0n)
  throw new Error(
    'Set explicit CLAIM_CONTRACT and positive SNAPSHOT_BUDGET_RAW. No default campaign budget.',
  );
const client = publicClient();
if ((await client.getChainId()) !== 999) throw new Error('Expected HyperEVM 999');
const head = await client.getBlockNumber();
const block = await client.getBlock({ blockNumber: head - 3n });
const cutoff = Number(block.timestamp) * 1000;
const store = await openWebStore(process.env);
try {
  const members = await new PersistentCampaign(store.sql).membersAt(cutoff);
  const snapshot = createSnapshot(members, BigInt(budget), {
    chainId: 999,
    claimContract: contract as Address,
    campaignId: keccak256(toHex(CAMPAIGN_ID)),
  });
  const source = {
    campaign: CAMPAIGN_ID,
    block: String(block.number),
    blockHash: block.hash,
    cutoffUtc: new Date(cutoff).toISOString(),
    eligibility: 'Signed campaign ledger only; no PAPER mint ranking',
    storage: store.sql.dialect,
    inputHash: keccak256(toHex(JSON.stringify(members))),
  };
  const manifest = {
    schemaVersion: 1,
    status: 'review-only',
    liveClaims: false,
    source,
    ...snapshot,
  };
  const path = `data/campaign-${block.number}.json`;
  await mkdir('data', { recursive: true });
  await writeFile(path, JSON.stringify(manifest, null, 2) + '\n');
  console.log({ path, participants: members.length, root: snapshot.root, liveClaims: false });
} finally {
  await store.close();
}
