import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { applicationOrigin, probeApplication } from './application.js';
test('deployed probe uses only GET, checks persistence/release contracts and rejects redirects, oversized and malformed responses', async () => {
  const methods: string[] = [];
  let broken = false;
  const server = createServer((request, response) => {
    methods.push(request.method!);
    if (broken && request.url === '/leaderboard') {
      response.writeHead(302, { Location: '/redirect-target' }).end();
      return;
    }
    if (!request.url!.startsWith('/api/')) {
      response.setHeader('Content-Type', 'text/html');
      response.end('<html><body>Community</body></html>');
      return;
    }
    response.setHeader('Content-Type', 'application/json');
    if (request.url === '/api/health')
      response.end(
        JSON.stringify({
          status: 'ready',
          storage: broken ? 'sqlite' : 'postgres',
          schemaVersion: 1,
          liveSubmission: false,
        }),
      );
    else if (request.url === '/api/campaign')
      response.end(
        JSON.stringify({
          reward: 'points-only',
          tokenClaims: false,
          leaderboard: [],
          metrics: { participants: 0 },
        }),
      );
    else if (request.url === '/api/trading/readiness')
      response.end(
        JSON.stringify({
          enabled: broken,
          realSettlementTested: false,
          transportImplemented: true,
          blockers: ['settlement'],
        }),
      );
    else if (request.url === '/api/protocol')
      response.end(
        broken
          ? '{}'
          : JSON.stringify({
              source: 'official-indexer',
              reconciled: false,
              summary: { source: { at: Date.now() } },
              trading: { indexedThroughBlock: 123 },
            }),
      );
    else if (request.url!.includes('BTC') && broken) {
      response.setHeader('Content-Length', '2000001');
      response.end();
    } else
      response.end(
        broken
          ? '{'
          : JSON.stringify({
              quote: {
                coin: request.url!.includes('BTC') ? 'BTC' : 'ETH',
                source: 'hyperliquid-bbo',
                time: Date.now(),
                midpointRaw: '123',
              },
              trading: { indexedThroughBlock: 123 },
              liveSubmission: false,
            }),
      );
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    const origin = 'http://127.0.0.1:' + address.port;
    const healthy = await probeApplication(origin);
    assert.equal(healthy.status, 'healthy');
    assert.equal(healthy.checks.length, 13);
    broken = true;
    const failed = await probeApplication(origin);
    assert.equal(failed.status, 'degraded');
    for (const path of [
      '/leaderboard',
      '/api/health',
      '/api/trading/readiness',
      '/api/protocol',
      '/api/market?coin=BTC',
      '/api/market?coin=ETH',
    ])
      assert.equal(failed.checks.find((row) => row.path === path)!.ok, false, path);
    assert.ok(methods.every((method) => method === 'GET'));
    assert.equal(failed.signedParticipationTested, false);
    assert.throws(() => applicationOrigin('https://user:password@example.com'), /origin/);
    assert.throws(() => applicationOrigin('http://example.com'), /origin/);
    assert.throws(() => applicationOrigin('https://example.com/path'), /origin/);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((done) => server.close(() => done()));
  }
});
