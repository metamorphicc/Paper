import test from 'node:test';
import assert from 'node:assert/strict';
import { sqliteDatabase } from '../storage/sql.js';
import { migrateDatabase } from '../storage/schema.js';
import { WebStore } from '../storage/store.js';
import { operationStatus } from './status.js';
test('operations status distinguishes missing, failed, stale and restored job evidence without claiming offsite durability', async () => {
  const db = await sqliteDatabase(':memory:');
  try {
    await migrateDatabase(db);
    const store = new WebStore(db);
    assert.equal((await operationStatus(store)).status, 'degraded');
    await store.saveSnapshot('operations', 'indexer', 'worker', 1, { caughtUp: true });
    await store.saveSnapshot('operations', 'upgrades', 'worker', 2, { status: 'unchanged' });
    await store.saveSnapshot('operations', 'backup', 'worker', 3, {
      stage: 'verified-local-export',
      scratchRestoreVerified: true,
    });
    let status = await operationStatus(store);
    assert.equal(status.status, 'healthy');
    assert.equal(status.offsiteUploadVerifiedByThisCheck, false);
    await store.saveSnapshot('operations', 'worker-failure', 'worker', 4, { component: 'indexer' });
    status = await operationStatus(store);
    assert.equal(status.checks.noUnresolvedWorkerFailure, false);
    await db.query('UPDATE snapshots SET observed_at=? WHERE identity=?', [
      new Date(Date.now() + 10).toISOString(),
      'indexer',
    ]);
    assert.equal((await operationStatus(store)).status, 'healthy');
    status = await operationStatus(store, Date.now() + 7200000);
    assert.equal(status.checks.indexFreshAndCaughtUp, false);
    assert.equal(status.checks.verifiedBackupExportWithin36Hours, true);
    assert.equal(
      (await operationStatus(store, Date.now() + 37 * 3600000)).checks
        .verifiedBackupExportWithin36Hours,
      false,
    );
  } finally {
    await db.close();
  }
});
