import { readFile, writeFile } from 'node:fs/promises';
import { launchReadiness } from '../packages/ops/readiness.js';
const token = JSON.parse(await readFile('config/tokenomics.json', 'utf8'));
const manifest = JSON.parse(await readFile('research/contracts/manifest.json', 'utf8')) as {
  records: { sourceEquivalenceVerified: boolean }[];
};
const validation = JSON.parse(await readFile('research/integration-validation.json', 'utf8'));
const gates = {
  protocolSourceVerified:
    manifest.records.length === 8 && manifest.records.every((row) => row.sourceEquivalenceVerified),
  tokenomicsApproved: token.status === 'approved' && token.launchApproved === true,
  liquidityBudgetSelected: token.initialLiquidityUsdc !== null,
  campaignBudgetSelected: token.campaignBudgetRaw !== null,
  recipientsAndMultisigReviewed: token.recipientAddresses !== null,
  officialDomainVerified: false,
  collateralFlowVerified: false,
  thirdPartyRelayerSettlementVerified: false,
  contractWalletCompatibilityVerified: false,
  exactApiRpcReconciliation: false,
  independentAuditComplete: false,
  hyperEvmContractsTested: false,
  productionOpsValidated: false,
  claimsPrefunded: false,
  capitalPilotApproved: false,
};
const report = {
  observedAtUtc: new Date().toISOString(),
  scope: 'public financial launch',
  ...launchReadiness(gates),
  gates,
  localCapabilities: [
    'English read-only hub',
    'Signed local points',
    'Isolated virtual trading sandbox',
    'Local EVM token/claims/treasury tests',
    'Historical-price scenario replay',
    'Cash-only vault accounting research',
    'Manual upgrade check and validated SQLite backup',
  ],
  integrationEvidencePresent: !!validation,
  explanation:
    'Passing local checks does not supply missing launch parameters, verified protocol integration, independent audit or real settlement evidence.',
};
await writeFile('research/launch-readiness.json', JSON.stringify(report, null, 2) + '\n');
console.log({ decision: report.decision, blockers: report.blockers.length, liveSubmission: false });
