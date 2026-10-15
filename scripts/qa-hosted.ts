import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { request as httpRequest } from 'node:http';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { privateKeyToAccount } from 'viem/accounts';
import { testPostgres } from '../packages/storage/test-postgres.js';
import { migrateDatabase } from '../packages/storage/schema.js';
const require = createRequire(import.meta.url);
const fixture = await testPostgres();
await migrateDatabase(fixture.database);
const socket = createServer();
await new Promise<void>((done) => socket.listen(0, '127.0.0.1', done));
const address = socket.address();
assert.ok(address && typeof address === 'object');
const port = address.port;
await new Promise<void>((done) => socket.close(() => done()));
const base = 'http://127.0.0.1:' + port,
  origin = 'https://paperclub.example';
const forbiddenDirectory = resolve('data', 'serverless-must-not-write-' + randomUUID());
let child: ChildProcess | undefined,
  output = '';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function boot() {
  child = spawn(
    process.execPath,
    [
      require.resolve('next/dist/bin/next'),
      'start',
      '--hostname',
      '127.0.0.1',
      '--port',
      String(port),
    ],
    {
      cwd: resolve('apps/web'),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'production',
        DATABASE_URL: fixture.url,
        PAPERCLUB_APP_ORIGIN: origin,
        VERCEL: '',
        AWS_LAMBDA_FUNCTION_NAME: '',
        PAPERCLUB_DATA_DIR: forbiddenDirectory,
      },
    },
  );
  child.stdout!.on('data', (data) => {
    output = (output + String(data)).slice(-16000);
  });
  child.stderr!.on('data', (data) => {
    output = (output + String(data)).slice(-16000);
  });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error('Production process exited before readiness');
    try {
      const response = await fetch(base + '/api/health', { signal: AbortSignal.timeout(2000) });
      if (response.status === 200) {
        assert.equal((await response.json()).storage, 'postgres');
        return;
      }
    } catch {}
    await sleep(200);
  }
  throw new Error('Production readiness timed out');
}
async function stop() {
  const active = child;
  child = undefined;
  if (!active || active.exitCode !== null) return;
  const closed = new Promise<void>((done) => active.once('exit', () => done()));
  active.kill();
  await closed;
}
async function post(body: unknown, requestOrigin = origin) {
  return hostedRequest('/api/campaign', 'POST', JSON.stringify(body), requestOrigin);
}
function hostedRequest(
  path: string,
  method = 'GET',
  body?: string,
  requestOrigin?: string,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      new URL(base + path),
      {
        method,
        headers: {
          Host: 'paperclub.example',
          ...(requestOrigin ? { Origin: requestOrigin } : {}),
          ...(body
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
            : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let bytes = 0;
        res.on('data', (data) => {
          bytes += data.length;
          if (bytes > 500000) res.destroy(new Error('Response exceeds QA limit'));
          else chunks.push(data);
        });
        res.on('end', () =>
          resolve(new Response(Buffer.concat(chunks), { status: res.statusCode })),
        );
        res.on('error', reject);
      },
    );
    req.setTimeout(10000, () => req.destroy(new Error('Hosted request timed out')));
    req.on('error', reject);
    req.end(body);
  });
}
const checks: { name: string; status: number }[] = [];
try {
  await boot();
  for (const path of [
    '/',
    '/leaderboard',
    '/trade',
    '/profile',
    '/rewards',
    '/research',
    '/treasury',
  ]) {
    const response = await fetch(base + path, { signal: AbortSignal.timeout(25000) });
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.ok(!html.includes('This page couldn') && !html.includes('Application error'), path);
    checks.push({ name: path, status: 200 });
  }
  const wallet = privateKeyToAccount(('0x' + '22'.repeat(32)) as `0x${string}`);
  const issued = await post({ operation: 'challenge', address: wallet.address, action: 'join' });
  assert.equal(issued.status, 200, 'Challenge: ' + (await issued.clone().text()));
  const challenge = await issued.json(),
    signature = await wallet.signMessage({ message: challenge.message });
  checks.push({ name: 'HTTPS origin challenge', status: 200 });
  await stop();
  await boot();
  const claimed = await post({ operation: 'claim', id: challenge.id, signature });
  assert.equal(claimed.status, 200, 'Claim: ' + (await claimed.clone().text()));
  assert.equal((await claimed.json()).participant.total, 10);
  checks.push({ name: 'Claim after server restart', status: 200 });
  const replay = await post({ operation: 'claim', id: challenge.id, signature });
  assert.ok([400, 409].includes(replay.status));
  checks.push({ name: 'Replay rejected', status: replay.status });
  const foreign = await post(
    { operation: 'challenge', address: wallet.address, action: 'join' },
    'https://evil.example',
  );
  assert.equal(foreign.status, 400);
  checks.push({ name: 'Foreign origin rejected', status: 400 });
  const summary = await hostedRequest('/api/campaign');
  assert.equal(summary.status, 200);
  const data = await summary.json();
  assert.equal(data.metrics.participants, 1);
  assert.equal(data.leaderboard[0].points, 10);
  checks.push({ name: 'Shared leaderboard', status: 200 });
  const page = await fetch(base + '/leaderboard');
  assert.equal(page.status, 200);
  assert.ok((await page.text()).includes('Community leaderboard'));
  checks.push({ name: 'Community after claim', status: 200 });
  const live = await hostedRequest('/api/intents', 'POST', '{}', origin);
  assert.equal(live.status, 403);
  assert.equal((await live.json()).liveSubmission, false);
  checks.push({ name: 'Financial release gate unchanged', status: 403 });
  assert.equal(
    existsSync(forbiddenDirectory),
    false,
    'PostgreSQL runtime must not create local SQLite files',
  );
  await writeFile(
    'research/hosted-runtime-qa.json',
    JSON.stringify(
      {
        observedAtUtc: new Date().toISOString(),
        scope: 'local production server with pg/TCP and PostgreSQL WASM engine',
        hostedDeploymentTested: false,
        userWalletUsed: false,
        storage: 'postgres',
        serverRestartPreservedChallenge: true,
        localDatabaseDirectoryCreated: false,
        checks,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    JSON.stringify({
      checks: checks.length,
      serverRestartPreservedChallenge: true,
      localSqliteWrites: false,
      preview: base + '/leaderboard',
    }),
  );
  if (process.argv.includes('--preview')) {
    console.log('Preview ready. Send a line to stop the owned server and database.');
    await new Promise<void>((done) => {
      process.stdin.resume();
      process.stdin.once('data', () => done());
    });
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Hosted QA failed');
  if (output) console.error(output.replaceAll(fixture.url, '[local-test-database]'));
  process.exitCode = 1;
} finally {
  await stop();
  await fixture.close();
}
