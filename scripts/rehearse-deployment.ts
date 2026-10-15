import { writeFile } from 'node:fs/promises';
import { rehearseDeployment } from '../packages/release/rehearsal.js';
const report = await rehearseDeployment();
await writeFile(
  'research/deployment-rehearsal.json',
  JSON.stringify({ ...report, observedAtUtc: new Date().toISOString() }, null, 2) + '\n',
);
console.log({
  chainId: report.chainId,
  contracts: report.deployed.length,
  confirmedTransactions: report.receipts.length,
  rejectedCases: report.denied.length,
  treasuryReconciled: report.reconciliation.reconciled,
  mainnetDeployed: false,
});
