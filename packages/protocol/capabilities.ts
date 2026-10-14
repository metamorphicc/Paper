import features from '../../config/features.json' with { type: 'json' };
import release from '../../config/trading-release.json' with { type: 'json' };
import manifest from '../../research/contracts/manifest.json' with { type: 'json' };
import domains from '../../research/signature-domains.json' with { type: 'json' };
export const capabilities = [
  {
    id: 'read',
    title: 'Public data',
    status: 'available',
    reason: 'RPC and narrow read-only ABIs; each field retains its source.',
  },
  {
    id: 'history',
    title: 'PAPER history',
    status: 'available',
    reason: 'Standard Transfer events; trade event schemas are unverified.',
  },
  {
    id: 'trade',
    title: 'Live trading',
    status: 'blocked',
    reason:
      'Browser EIP-712 and /intents were observed; source equivalence, third-party access and settlement are unverified.',
  },
  {
    id: 'staking',
    title: 'Live staking',
    status: 'blocked',
    reason:
      'Staking domain matched a latest RPC separator observation; source equivalence, third-party writes and settlement remain unverified.',
  },
  {
    id: 'builder',
    title: 'Builder revenue',
    status: 'planned',
    reason: 'Documented as coming soon; modeled revenue is zero.',
  },
  {
    id: 'contract-wallet',
    title: 'Contract wallets / vault',
    status: 'unverified',
    reason: 'EIP-1271 and the full deposit/withdrawal lifecycle are unverified.',
  },
  {
    id: 'sandbox',
    title: 'Local terminal',
    status: 'available',
    reason: 'Mock settlement and intent lifecycle with virtual funds.',
  },
] as const;
export function liveSubmissionReadiness() {
  const checks = {
    implementationSourceVerified:
      manifest.records.length === 8 &&
      manifest.records.every((row) => row.sourceEquivalenceVerified),
    exchangeDomainVerified: domains.contracts.some(
      (row) => row.name === 'Exchange' && row.domainObserved,
    ),
    cancellationDomainVerified: release.cancellationDomainVerified,
    collateralLifecycleVerified: release.collateralLifecycleVerified,
    thirdPartyAccessVerified: release.thirdPartyAccessVerified,
    settlementVerified: release.settlementVerified,
    sessionAuthorizationVerified: release.sessionAuthorizationVerified,
    releaseApproved: release.approved && features.tradingSubmission,
  };
  return {
    enabled: Object.values(checks).every(Boolean),
    checks,
    blockers: Object.entries(checks)
      .filter(([, value]) => !value)
      .map(([key]) => key),
  };
}
export function assertLiveSubmissionAllowed(): void {
  if (!liveSubmissionReadiness().enabled)
    throw new Error(
      'Live submission blocked: third-party relayer access, source equivalence and settlement are unverified.',
    );
}
