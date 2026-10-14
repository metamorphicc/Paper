import { writeFile } from 'node:fs/promises';
import { isAddress, type Address } from 'viem';
import { archiveClient } from '../packages/protocol/registry.js';
import { readTreasuryReceipts } from '../packages/treasury/read-receipts.js';
const args = process.argv.slice(2);
function option(name: string) {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}
const treasury = option('--address'),
  asset = option('--asset');
if (
  !treasury ||
  !asset ||
  !isAddress(treasury, { strict: false }) ||
  !isAddress(asset, { strict: false })
)
  throw new Error(
    'Explicit --address and --asset are required; this does not configure the production treasury',
  );
const report = await readTreasuryReceipts(archiveClient(), {
  treasury: treasury as Address,
  asset: asset as Address,
  blocks: Number(option('--blocks') ?? 256),
});
await writeFile(
  'research/treasury-receipts.json',
  JSON.stringify(
    {
      ...report,
      scope: 'Explicit public address sample; not a configured Paperclub treasury',
      liveSubmission: false,
    },
    null,
    2,
  ) + '\n',
);
console.log({
  chainId: report.chainId,
  fromBlock: report.fromBlock,
  toBlock: report.toBlock,
  asset: report.symbol,
  confirmedTransfers: report.transfers.length,
  reconciled: report.reconciled,
  discrepancyRaw: report.discrepancyRaw,
  realizedRevenueRaw: report.realizedRevenueRaw,
});
