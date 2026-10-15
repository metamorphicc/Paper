import assert from 'node:assert/strict';
import { testPostgres } from './test-postgres.js';
import { migrateDatabase } from './schema.js';
import { exportDatabase, restoreDatabase, type DatabaseBackup } from './backup.js';
/** Scratch engine only; no production URL, filesystem restore or target overwrite is accepted. */
export async function rehearseRestore(backup: DatabaseBackup) {
  const target = await testPostgres();
  try {
    await migrateDatabase(target.database);
    const restored = await restoreDatabase(target.database, backup);
    const roundtrip = await exportDatabase(target.database);
    assert.deepEqual(roundtrip.tables, backup.tables);
    return {
      scratchRestoreVerified: true,
      sourceDigest: backup.sha256,
      rows: restored.counts,
      productionRestorePerformed: false,
      verifier: 'PostgreSQL-WASM-over-TCP',
    };
  } finally {
    await target.close();
  }
}
