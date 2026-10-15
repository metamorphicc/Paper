import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { privateKeyToAccount } from 'viem/accounts';
import { testPostgres } from '../packages/storage/test-postgres.js';
import { migrateDatabase } from '../packages/storage/schema.js';
import { PersistentCampaign } from '../packages/community/persistent.js';
import { WebStore } from '../packages/storage/store.js';
const require = createRequire(import.meta.url),
  source = await testPostgres(),
  target = await testPostgres();
const key = randomBytes(32).toString('hex');
await mkdir('data', { recursive: true });
const directory = await mkdtemp(resolve('data/encrypted-backup-qa-'));
async function command(connection: string, restore: boolean, file?: string) {
  const child = spawn(
    process.execPath,
    [
      require.resolve('tsx/cli'),
      resolve('scripts/encrypted-backup.ts'),
      ...(restore ? ['--restore'] : []),
    ],
    {
      cwd: directory,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        DATABASE_URL: connection,
        POSTGRES_URL: '',
        BACKUP_ENCRYPTION_KEY: key,
        BACKUP_FILE: file ?? '',
      },
    },
  );
  let output = '';
  child.stdout.on('data', (data) => {
    output = (output + String(data)).slice(-20000);
  });
  child.stderr.on('data', (data) => {
    output = (output + String(data)).slice(-20000);
  });
  const timeout = setTimeout(() => child.kill(), 45000);
  try {
    const code = await new Promise<number | null>((done, reject) => {
      child.once('exit', done);
      child.once('error', reject);
    });
    assert.ok(
      !output.includes(key) && !output.includes(source.url) && !output.includes(target.url),
    );
    return { code, output };
  } finally {
    clearTimeout(timeout);
  }
}
try {
  await migrateDatabase(source.database);
  await migrateDatabase(target.database);
  const wallet = privateKeyToAccount(('0x' + '22'.repeat(32)) as `0x${string}`),
    origin = 'http://127.0.0.1:3000';
  const service = new PersistentCampaign(source.database),
    challenge = await service.issue(wallet.address, 'join', origin);
  const signature = await wallet.signMessage({ message: challenge.message });
  await service.claim({ id: challenge.id, signature, origin });
  await new WebStore(source.database).saveSnapshot('protocol', '999', 'official-indexer', 123, {
    raw: '123456789012345678901234567890',
  });
  const exported = await command(source.url, false);
  assert.equal(exported.code, 0, exported.output);
  const files = await readdir(resolve(directory, 'data/backups'));
  assert.equal(files.length, 1);
  assert.ok(files[0]!.endsWith('.encrypted.json'));
  const file = resolve(directory, 'data/backups', files[0]!);
  const contents = await readFile(file, 'utf8');
  assert.ok(!contents.includes(wallet.address.toLowerCase()));
  const restored = await command(target.url, true, file);
  assert.equal(restored.code, 0, restored.output);
  const participant = new PersistentCampaign(target.database);
  assert.equal((await participant.participant(wallet.address)).total, 10);
  await assert.rejects(participant.claim({ id: challenge.id, signature, origin }), /used/);
  assert.equal(
    (await new WebStore(target.database).latestSnapshot<{ raw: string }>('protocol', '999'))!.value
      .raw,
    '123456789012345678901234567890',
  );
  assert.equal((await command(target.url, true, file)).code, 1);
  assert.equal((await participant.participant(wallet.address)).total, 10);
  const report = {
    observedAtUtc: new Date().toISOString(),
    scope: 'encrypted backup CLI with two isolated PostgreSQL fixtures',
    productionDatabaseUsed: false,
    encryptedDiskFileOnly: true,
    diskBytesRestoredToScratchEngineBeforeSuccess: true,
    separateTargetRestoreVerified: true,
    pointsRestored: 10,
    usedChallengeReplayRejected: true,
    exactSnapshotValueRestored: true,
    nonemptyTargetRejected: true,
    credentialsOrKeyInOutput: false,
    githubArtifactUploadTested: false,
  };
  await writeFile('research/encrypted-backup-qa.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally {
  await target.close();
  await source.close();
}
