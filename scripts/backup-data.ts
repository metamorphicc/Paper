import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdtemp, copyFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { Store } from '../packages/indexer/store.js';
import { DatabaseSync } from 'node:sqlite';
const source = new Store(resolve(process.env.PAPERCLUB_DATA_DIR ?? 'data', 'paperclub.sqlite'));
const file = `data/backups/paperclub-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`;
const scratchPrefix = join(tmpdir(), 'paperclub-restore-'),
  scratch = await mkdtemp(scratchPrefix);
try {
  await source.backupTo(file);
  await copyFile(file, join(scratch, 'restored.sqlite'));
  const restored = new Store(join(scratch, 'restored.sqlite'));
  try {
    const integrity = restored.db.prepare('PRAGMA quick_check').get();
    if (!integrity || Object.values(integrity)[0] !== 'ok')
      throw new Error('Backup integrity check failed');
    const stats = restored.statistics();
    // Compare with the captured backup, not a live source that can change during validation.
    const captured = new DatabaseSync(file, { readOnly: true });
    try {
      const tables = captured
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        .all() as { name: string }[];
      for (const { name } of tables) {
        if (!/^[a-zA-Z0-9_]+$/.test(name)) throw new Error('Unexpected table name');
        const query = `SELECT count(*) AS n FROM "${name}"`;
        const expected = captured.prepare(query).get() as { n: number };
        const actual = restored.db.prepare(query).get() as { n: number };
        if (expected.n !== actual.n) throw new Error('Backup table count mismatch');
      }
    } finally {
      captured.close();
    }
    const manifest = {
      observedAtUtc: new Date().toISOString(),
      backupFile: file,
      sha256: createHash('sha256')
        .update(await readFile(file))
        .digest('hex'),
      integrity: 'ok',
      scratchRestore: true,
      statistics: stats,
      liveDatabaseReplaced: false,
    };
    await writeFile(`${file}.json`, JSON.stringify(manifest, null, 2) + '\n');
    await writeFile('research/backup-validation.json', JSON.stringify(manifest, null, 2) + '\n');
    console.log(manifest);
  } finally {
    restored.close();
  }
} finally {
  source.close();
  if (!resolve(scratch).startsWith(resolve(scratchPrefix)))
    throw new Error('Unexpected scratch directory');
  await rm(scratch, { recursive: true, force: true });
}
