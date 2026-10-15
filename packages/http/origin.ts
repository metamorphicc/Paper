import { isLocalRead } from './guards.js';
export type AppEnvironment = Record<string, string | undefined>;
export function applicationOrigins(env: AppEnvironment) {
  const origins = new Set<string>();
  const values = [
    env.PAPERCLUB_APP_ORIGIN,
    ...[env.VERCEL_PROJECT_PRODUCTION_URL, env.VERCEL_URL]
      .filter(Boolean)
      .map((value) => 'https://' + value),
  ];
  for (const value of values) {
    if (!value) continue;
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error('Invalid application origin configuration');
    }
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    )
      throw new Error('Application origin must be a public HTTPS origin');
    origins.add(url.origin);
  }
  return [...origins];
}
export function allowsOrigin(origin: string, env: AppEnvironment) {
  return (
    (!env.VERCEL && /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) ||
    applicationOrigins(env).includes(origin)
  );
}
export function allowsRequest(request: Request, env: AppEnvironment) {
  if (!env.VERCEL && isLocalRead(request)) return true;
  const url = new URL(request.url),
    host = request.headers.get('host') ?? url.host,
    origin = request.headers.get('origin');
  const allowed = applicationOrigins(env);
  const configured = allowed.find((value) => new URL(value).host === host);
  if (!configured) return false;
  if (!(['localhost', '127.0.0.1'].includes(url.hostname) || url.host === host)) return false;
  if (origin && origin !== configured) return false;
  if (!['GET', 'HEAD'].includes(request.method) && origin !== configured) return false;
  return true;
}
