import { spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
export async function productionFixtureServer(databaseUrl: string) {
  const socket = createServer();
  await new Promise<void>((done) => socket.listen(0, '127.0.0.1', done));
  const address = socket.address();
  if (!address || typeof address !== 'object') throw new Error('No fixture port');
  const port = address.port;
  await new Promise<void>((done) => socket.close(() => done()));
  const origin = 'http://127.0.0.1:' + port;
  let child: ChildProcess | undefined,
    output = '';
  async function stop() {
    const active = child;
    child = undefined;
    if (!active || active.exitCode !== null) return;
    const closed = new Promise<void>((done) => active.once('exit', () => done()));
    active.kill();
    await closed;
  }
  async function boot() {
    child = spawn(
      process.execPath,
      [
        createRequire(import.meta.url).resolve('next/dist/bin/next'),
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
          DATABASE_URL: databaseUrl,
          POSTGRES_URL: '',
          VERCEL: '',
          AWS_LAMBDA_FUNCTION_NAME: '',
          PAPERCLUB_APP_ORIGIN: 'https://paperclub.example',
        },
      },
    );
    const capture = (data: unknown) => {
      output = (output + String(data)).replaceAll(databaseUrl, '[fixture-postgres]').slice(-12000);
    };
    child.stdout!.on('data', capture);
    child.stderr!.on('data', capture);
    child.once('error', capture);
    for (let i = 0; i < 100; i++) {
      if (child.exitCode !== null) throw new Error('Fixture server exited: ' + output);
      try {
        if (
          (await fetch(origin + '/api/health', { signal: AbortSignal.timeout(1000) })).status ===
          200
        )
          return;
      } catch {}
      await new Promise((done) => setTimeout(done, 200));
    }
    throw new Error('Fixture server readiness failed: ' + output);
  }
  try {
    await boot();
  } catch (error) {
    await stop();
    throw error;
  }
  return {
    origin,
    stop,
    async restart() {
      await stop();
      await boot();
    },
  };
}
