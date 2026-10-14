export const REQUIRED_LAUNCH_GATES = [
  'protocolSourceVerified',
  'tokenomicsApproved',
  'liquidityBudgetSelected',
  'campaignBudgetSelected',
  'recipientsAndMultisigReviewed',
  'officialDomainVerified',
  'collateralFlowVerified',
  'thirdPartyRelayerSettlementVerified',
  'contractWalletCompatibilityVerified',
  'exactApiRpcReconciliation',
  'independentAuditComplete',
  'hyperEvmContractsTested',
  'productionOpsValidated',
  'claimsPrefunded',
  'capitalPilotApproved',
] as const;
export function launchReadiness(gates: Record<string, boolean | null>) {
  const evidence = Object.fromEntries(
    REQUIRED_LAUNCH_GATES.map((gate) => [gate, gates[gate] ?? null]),
  );
  const blockers = Object.entries(evidence)
    .filter(([, value]) => value !== true)
    .map(([gate, value]) => ({ gate, status: value === null ? 'unknown' : 'not-satisfied' }));
  return {
    decision: blockers.length ? 'do-not-launch' : 'ready-for-human-release-review',
    blockers,
    liveSubmission: false,
    automaticDeploy: false,
  };
}
