import { WindowLimiter } from '../../../packages/http/guards.js';
import { allowsRequest } from '../../../packages/http/origin.js';
const limiter = new WindowLimiter();
export function guardRead(request: Request, key: string, limit: number) {
  if (!allowsRequest(request, process.env))
    return Response.json({ error: 'Request origin is not allowed' }, { status: 403 });
  const result = limiter.consume(key, limit);
  if (!result.allowed)
    return Response.json(
      { error: 'Request rate limit. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(result.retryAfter) } },
    );
  return null;
}
