import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openWebStore } from '../packages/storage/open.js';
import { exportDatabase, restoreDatabase } from '../packages/storage/backup.js';
const store = await openWebStore(process.env);
try {
  if (process.argv.includes('--restore')) {
    const file = process.env.BACKUP_FILE;
    if (!file) throw new Error('Set BACKUP_FILE and a fresh migrated target database');
    if ((await stat(file)).size > 20_010_000) throw new Error('Backup file exceeds restore limit');
    const result = await restoreDatabase(store.sql, JSON.parse(await readFile(file, 'utf8')));
    console.log(result);
  } else {
    const data = await exportDatabase(store.sql),
      directory = resolve('data/backups');
    await mkdir(directory, { recursive: true });
    const file = resolve(
      directory,
      'database-' +
        new Date().toISOString().replace(/[:.]/g, '-') +
        '-' +
        randomUUID().slice(0, 8) +
        '.json',
    );
    await writeFile(file, JSON.stringify(data) + '\n', { flag: 'wx' });
    console.log({
      file,
      sha256: data.sha256,
      tables: Object.fromEntries(
        Object.entries(data.tables).map(([name, rows]) => [name, rows.length]),
      ),
      source: store.sql.dialect,
    });
  }
} finally {
  await store.close();
}
