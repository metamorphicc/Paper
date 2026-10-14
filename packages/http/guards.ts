export class WindowLimiter {
  private windows = new Map<string, { start: number; used: number }>();
  constructor(private now = () => Date.now()) {}
  consume(key: string, limit: number, windowMs = 60000) {
    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      !Number.isSafeInteger(windowMs) ||
      windowMs < 1
    )
      throw new Error('Invalid rate limit');
    let row = this.windows.get(key);
    if (!row || this.now() - row.start >= windowMs) {
      row = { start: this.now(), used: 0 };
      if (this.windows.size >= 64 && !this.windows.has(key))
        this.windows.delete(this.windows.keys().next().value!);
      this.windows.set(key, row);
    }
    if (row.used >= limit)
      return {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil((row.start + windowMs - this.now()) / 1000)),
      };
    row.used++;
    return { allowed: true, retryAfter: 0 };
  }
}
export class BodyLimitError extends Error {
  readonly status = 413;
  constructor() {
    super('Request or response body exceeds its byte limit');
  }
}
export async function boundedText(
  input: Pick<Request, 'body' | 'headers'>,
  maxBytes: number,
  timeoutMs = 12000,
) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 2_000_000)
    throw new Error('Invalid body limit');
  const declared = input.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes))
    throw new BodyLimitError();
  if (!input.body) return '';
  const reader = input.body.getReader(),
    chunks: Uint8Array[] = [];
  let total = 0,
    timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Body read timed out')), timeoutMs);
  });
  try {
    for (;;) {
      const result = await Promise.race([reader.read(), timeout]);
      if (result.done) break;
      total += result.value.byteLength;
      if (total > maxBytes) throw new BodyLimitError();
      chunks.push(result.value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } finally {
    clearTimeout(timer);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export function isLocalRead(request: Request) {
  const url = new URL(request.url),
    host = request.headers.get('host') ?? url.host,
    origin = request.headers.get('origin');
  return (
    url.protocol === 'http:' &&
    /^(127\.0\.0\.1|localhost):\d+$/.test(host) &&
    ['127.0.0.1', 'localhost'].includes(url.hostname) &&
    (!origin || origin === `${url.protocol}//${host}`)
  );
}
