import type { WebStore } from '../storage/store.js';
export async function operationStatus(store: WebStore, now = Date.now()) {
  const snapshots = await Promise.all(
    ['indexer', 'upgrades', 'backup', 'worker-failure'].map((name) =>
      store.latestSnapshot<Record<string, unknown>>('operations', name, 'worker'),
    ),
  );
  const [indexer, upgrades, backup, failure] = snapshots;
  function fresh(snapshot: typeof indexer, maxAgeMs: number) {
    const at = Date.parse(snapshot?.observedAt ?? '');
    return Number.isFinite(at) && now - at >= -30000 && now - at <= maxAgeMs;
  }
  const checks = {
    indexFreshAndCaughtUp: fresh(indexer, 3600000) && indexer?.value.caughtUp === true,
    reviewedImplementationsFreshAndUnchanged:
      fresh(upgrades, 3600000) && upgrades?.value.status === 'unchanged',
    verifiedBackupExportWithin36Hours:
      fresh(backup, 36 * 3600000) &&
      backup?.value.scratchRestoreVerified === true &&
      backup?.value.stage === 'verified-local-export',
    noUnresolvedWorkerFailure:
      !failure ||
      Boolean(indexer && Date.parse(indexer.observedAt) > Date.parse(failure.observedAt)),
  };
  return {
    observedAtUtc: new Date(now).toISOString(),
    status: Object.values(checks).every(Boolean) ? 'healthy' : 'degraded',
    checks,
    lastIndexAt: indexer?.observedAt ?? null,
    lastUpgradeCheckAt: upgrades?.observedAt ?? null,
    lastVerifiedExportAt: backup?.observedAt ?? null,
    offsiteUploadVerifiedByThisCheck: false,
    financialLaunchApproved: false,
  };
}
