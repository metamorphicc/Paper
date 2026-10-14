import { isLocalRead, WindowLimiter } from '../../../packages/http/guards.js';
const limiter = new WindowLimiter();
export function guardRead(request: Request, key: string, limit: number) {
  if (!isLocalRead(request))
    return Response.json({ error: 'Use the local application origin' }, { status: 403 });
  const result = limiter.consume(key, limit);
  if (!result.allowed)
    return Response.json(
      { error: 'Local request rate limit. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(result.retryAfter) } },
    );
  return null;
}
