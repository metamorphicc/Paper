import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { testPostgres } from './test-postgres.js';
import { migrateDatabase } from './schema.js';
import { exportDatabase, restoreDatabase } from './backup.js';
import { encryptBackup, decryptBackup } from './encrypted.js';
import { rehearseRestore } from './restore-rehearsal.js';
import { WebStore } from './store.js';
import { PersistentCampaign } from '../community/persistent.js';
import { privateKeyToAccount } from 'viem/accounts';
test('authenticated encrypted exports roundtrip through isolated PostgreSQL without plaintext, and reject tampering or wrong keys', async () => {
  const db = await testPostgres();
  try {
    await migrateDatabase(db.database);
    const wallet = privateKeyToAccount(('0x' + '22'.repeat(32)) as `0x${string}`),
      origin = 'http://127.0.0.1:3000';
    const campaign = new PersistentCampaign(db.database),
      challenge = await campaign.issue(wallet.address, 'join', origin);
    await campaign.claim({
      id: challenge.id,
      origin,
      signature: await wallet.signMessage({ message: challenge.message }),
    });
    await new WebStore(db.database).saveSnapshot('protocol', '999', 'official-indexer', 123, {
      amount: '123456789012345678901234567890',
    });
    const backup = await exportDatabase(db.database),
      key = randomBytes(32).toString('hex'),
      encrypted = encryptBackup(backup, key);
    assert.ok(!encrypted.includes(wallet.address.toLowerCase()));
    assert.ok(!encrypted.includes(challenge.message));
    assert.ok(!encrypted.includes(key));
    assert.notEqual(encryptBackup(backup, key), encrypted);
    const decoded = decryptBackup(encrypted, key);
    assert.deepEqual(decoded, backup);
    const verified = await rehearseRestore(decoded);
    assert.equal(verified.scratchRestoreVerified, true);
    assert.equal(verified.rows.campaign_claims, 1);
    assert.equal(verified.productionRestorePerformed, false);
    for (const field of ['ciphertext', 'tag', 'iv'] as const) {
      const changed = JSON.parse(encrypted);
      const bytes = Buffer.from(changed[field], 'base64');
      bytes[0] = bytes[0]! ^ 1;
      changed[field] = bytes.toString('base64');
      assert.throws(() => decryptBackup(JSON.stringify(changed), key), /authenticated/);
    }
    assert.throws(() => decryptBackup(encrypted, randomBytes(32).toString('hex')), /authenticated/);
    assert.throws(() => encryptBackup(backup, 'not-a-key'), /32-byte/);
    const wrong = JSON.parse(encrypted);
    wrong.extra = 'untrusted';
    assert.throws(() => decryptBackup(JSON.stringify(wrong), key), /authenticated/);
    await assert.rejects(restoreDatabase(db.database, decoded), /empty/);
  } finally {
    await db.close();
  }
});
