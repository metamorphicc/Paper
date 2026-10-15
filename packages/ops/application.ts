import { boundedText } from '../http/guards.js';
type Check = { path: string; status: number; ok: boolean; elapsedMs: number; reason?: string };
export function applicationOrigin(input: string) {
  const url = new URL(input);
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (
    (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('Set the application origin to an HTTPS origin without a path or credentials');
  return url.origin;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid response');
  return value as Record<string, unknown>;
}
const pages = ['/', '/trade', '/profile', '/leaderboard', '/rewards', '/research', '/treasury'];
function fresh(value: unknown) {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && Math.abs(Date.now() - value) < 60000
  );
}
function market(body: Record<string, unknown>, coin: string) {
  const quote = record(body.quote),
    trading = record(body.trading);
  return (
    quote.coin === coin &&
    quote.source === 'hyperliquid-bbo' &&
    fresh(quote.time) &&
    typeof quote.midpointRaw === 'string' &&
    /^[1-9]\d*$/.test(quote.midpointRaw) &&
    Number.isSafeInteger(trading.indexedThroughBlock) &&
    body.liveSubmission === false
  );
}
const apiChecks: Record<string, (body: Record<string, unknown>) => boolean> = {
  '/api/health': (v) =>
    v.status === 'ready' &&
    v.storage === 'postgres' &&
    Number.isSafeInteger(v.schemaVersion) &&
    Number(v.schemaVersion) >= 1 &&
    v.liveSubmission === false,
  '/api/campaign': (v) =>
    v.reward === 'points-only' &&
    v.tokenClaims === false &&
    Array.isArray(v.leaderboard) &&
    Number.isSafeInteger(record(v.metrics).participants),
  '/api/trading/readiness': (v) =>
    v.enabled === false &&
    v.realSettlementTested === false &&
    v.transportImplemented === true &&
    Array.isArray(v.blockers) &&
    v.blockers.length > 0,
  '/api/protocol': (v) =>
    v.source === 'official-indexer' &&
    v.reconciled === false &&
    fresh(record(record(v.summary).source).at) &&
    Number.isSafeInteger(record(v.trading).indexedThroughBlock),
  '/api/market?coin=BTC': (v) => market(v, 'BTC'),
  '/api/market?coin=ETH': (v) => market(v, 'ETH'),
};
/** GET-only operator probe. It never creates campaign participants, requests signatures or submits intents. */
export async function probeApplication(input: string, fetcher: typeof fetch = fetch) {
  const origin = applicationOrigin(input);
  const paths = [...pages, ...Object.keys(apiChecks)];
  const checks = new Array<Check>(paths.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (next < paths.length) {
        const index = next++,
          path = paths[index]!,
          started = Date.now();
        let status = 0;
        try {
          const response = await fetcher(origin + path, {
            method: 'GET',
            redirect: 'error',
            cache: 'no-store',
            signal: AbortSignal.timeout(20000),
          });
          status = response.status;
          const text = await boundedText(response, 2_000_000, 20000);
          const type = response.headers.get('content-type') ?? '';
          const valid = apiChecks[path]
            ? type.includes('application/json') && apiChecks[path]!(record(JSON.parse(text)))
            : type.includes('text/html') && /<html[\s>]/i.test(text) && /<\/html>/i.test(text);
          checks[index] = {
            path,
            status,
            ok: status === 200 && valid,
            elapsedMs: Date.now() - started,
            ...(status === 200 && valid
              ? {}
              : { reason: 'Unexpected HTTP status or response contract' }),
          };
        } catch {
          checks[index] = {
            path,
            status,
            ok: false,
            elapsedMs: Date.now() - started,
            reason: 'Request failed or response could not be validated',
          };
        }
      }
    }),
  );
  return {
    observedAtUtc: new Date().toISOString(),
    origin,
    status: checks.every((v) => v.ok) ? 'healthy' : 'degraded',
    readOnlyProbe: true,
    userWalletUsed: false,
    signedParticipationTested: false,
    checks,
  };
}
