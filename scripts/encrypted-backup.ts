import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { databaseConnection } from '../packages/storage/config.js';
import { openWebStore } from '../packages/storage/open.js';
import { exportDatabase, restoreDatabase } from '../packages/storage/backup.js';
import {
  encryptBackup,
  decryptBackup,
  MAX_ENCRYPTED_BACKUP_BYTES,
} from '../packages/storage/encrypted.js';
import { rehearseRestore } from '../packages/storage/restore-rehearsal.js';
let store: Awaited<ReturnType<typeof openWebStore>> | undefined;
try {
  const key = process.env.BACKUP_ENCRYPTION_KEY;
  if (!key || !databaseConnection(process.env))
    throw new Error('Shared database and backup encryption key required');
  store = await openWebStore(process.env);
  if (process.argv.includes('--restore')) {
    const file = process.env.BACKUP_FILE;
    if (!file || (await stat(file)).size > MAX_ENCRYPTED_BACKUP_BYTES)
      throw new Error('Set a bounded encrypted BACKUP_FILE');
    const backup = decryptBackup(await readFile(file, 'utf8'), key);
    console.log(JSON.stringify(await restoreDatabase(store.sql, backup)));
  } else {
    const backup = await exportDatabase(store.sql),
      encrypted = encryptBackup(backup, key);
    const directory = resolve('data/backups');
    await mkdir(directory, { recursive: true });
    const file = resolve(
      directory,
      'database-' +
        new Date().toISOString().replace(/[:.]/g, '-') +
        '-' +
        randomUUID().slice(0, 8) +
        '.encrypted.json',
    );
    await writeFile(file, encrypted, { flag: 'wx', mode: 0o600 });
    // Verify the bytes read from disk, not only the in-memory export, before allowing artifact upload.
    const disk = await readFile(file, 'utf8'),
      verified = await rehearseRestore(decryptBackup(disk, key));
    const report = {
      observedAtUtc: new Date().toISOString(),
      stage: 'verified-local-export',
      sha256: createHash('sha256').update(disk).digest('hex'),
      bytes: Buffer.byteLength(disk),
      encrypted: true,
      offsiteUploadConfirmed: false,
      ...verified,
    };
    await store.saveSnapshot('operations', 'backup', 'worker', Date.now(), report);
    await mkdir('data/operations', { recursive: true });
    await writeFile('data/operations/backup.json', JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  }
} catch {
  console.error(
    'Encrypted backup failed. Check database configuration, backup key, file limits and empty restore target. No existing database is replaced.',
  );
  process.exitCode = 1;
} finally {
  await store?.close();
}
