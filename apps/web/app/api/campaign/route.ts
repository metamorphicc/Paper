import { campaign, assertLocalOrigin } from '../../../lib/campaign';
import { object } from '../../../../../packages/protocol/official.js';
import { boundedText, BodyLimitError } from '../../../../../packages/http/guards.js';
import { guardRead } from '../../../lib/request-guard';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const rejection = guardRead(request, 'campaign-read', 60);
  if (rejection) return rejection;
  return Response.json({
    campaign: 'founding-01',
    leaderboard: campaign().leaderboard(),
    metrics: campaign().metrics(),
    reward: 'points-only',
    tokenClaims: false,
  });
}
export async function POST(request: Request) {
  try {
    const origin = assertLocalOrigin(request);
    const rejection = guardRead(request, 'campaign-write', 30);
    if (rejection) return rejection;
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      return Response.json({ error: 'JSON content type required' }, { status: 415 });
    const text = await boundedText(request, 10_000, 5000);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('Invalid JSON body');
    }
    const body = object(parsed);
    if (body.operation === 'challenge')
      return Response.json(
        campaign().issue(String(body.address ?? ''), String(body.action ?? ''), origin),
      );
    if (
      body.operation === 'claim' &&
      typeof body.id === 'string' &&
      typeof body.signature === 'string' &&
      /^0x[0-9a-f]{130}$/i.test(body.signature)
    ) {
      return Response.json(
        await campaign().claim({
          id: body.id,
          signature: body.signature as `0x${string}`,
          origin,
          answers:
            Array.isArray(body.answers) && body.answers.every((value) => typeof value === 'string')
              ? body.answers
              : undefined,
          trackedAddress: typeof body.trackedAddress === 'string' ? body.trackedAddress : undefined,
        }),
      );
    }
    throw new Error('Unsupported campaign action');
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Campaign action failed' },
      { status: error instanceof BodyLimitError ? 413 : 400 },
    );
  }
}
