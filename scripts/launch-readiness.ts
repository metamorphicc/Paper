import { readFile, writeFile } from 'node:fs/promises';
import { launchReadiness } from '../packages/ops/readiness.js';
import { validateDeploymentParameters } from '../packages/release/plan.js';
const token = JSON.parse(await readFile('config/tokenomics.json', 'utf8'));
const manifest = JSON.parse(await readFile('research/contracts/manifest.json', 'utf8')) as {
  records: { sourceEquivalenceVerified: boolean }[];
};
const validation = JSON.parse(await readFile('research/integration-validation.json', 'utf8'));
const deployment = JSON.parse(await readFile('config/deployment.json', 'utf8'));
const deploymentIssues = validateDeploymentParameters(deployment, Math.floor(Date.now() / 1000));
const rehearsal = await readFile('research/deployment-rehearsal.json', 'utf8')
  .then((text) => JSON.parse(text))
  .catch(() => null);
const gates = {
  protocolSourceVerified:
    manifest.records.length === 8 && manifest.records.every((row) => row.sourceEquivalenceVerified),
  tokenomicsApproved: token.status === 'approved' && token.launchApproved === true,
  liquidityBudgetSelected: token.initialLiquidityUsdc !== null,
  campaignBudgetSelected: token.campaignBudgetRaw !== null,
  recipientsAndMultisigReviewed: token.recipientAddresses !== null,
  deploymentParametersComplete: deploymentIssues.length === 0,
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
    'Draft deployment parameter checks and self-contained compiler verification package',
    'Isolated local deployment/funding/claim/treasury receipt rehearsal',
  ],
  integrationEvidencePresent: !!validation,
  deploymentIssues,
  localDeploymentRehearsal: rehearsal
    ? {
        scope: rehearsal.scope,
        chainId: rehearsal.chainId,
        publicChainUsed: rehearsal.publicChainUsed,
        confirmedTransactions: rehearsal.receipts.length,
        treasuryReconciled: rehearsal.reconciliation.reconciled,
        launchEvidence: false,
      }
    : null,
  explanation:
    'Passing local checks does not supply missing launch parameters, verified protocol integration, independent audit or real settlement evidence.',
};
await writeFile('research/launch-readiness.json', JSON.stringify(report, null, 2) + '\n');
console.log({ decision: report.decision, blockers: report.blockers.length, liveSubmission: false });
