import { campaign, assertLocalOrigin, campaignRequestBudget } from '../../../lib/campaign';
import { object } from '../../../../../packages/protocol/official.js';
import { boundedText, BodyLimitError } from '../../../../../packages/http/guards.js';
import { guardRead } from '../../../lib/request-guard';
import { CampaignError } from '../../../../../packages/community/persistent';
import { isAddress } from 'viem';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const rejection = guardRead(request, 'campaign-read', 60);
    if (rejection) return rejection;
    const address = new URL(request.url).searchParams.get('address');
    if (address !== null && !isAddress(address))
      return Response.json({ error: 'Invalid participant address' }, { status: 400 });
    const budget = await campaignRequestBudget('read');
    if (budget) return budget;
    const service = await campaign();
    return Response.json({
      campaign: 'founding-01',
      leaderboard: await service.leaderboard(),
      metrics: await service.metrics(),
      reward: 'points-only',
      tokenClaims: false,
      ...(address ? { participant: await service.participant(address) } : {}),
    });
  } catch {
    return Response.json({ error: 'Community could not be reached. Try again.' }, { status: 503 });
  }
}
export async function POST(request: Request) {
  try {
    const origin = assertLocalOrigin(request);
    const rejection = guardRead(request, 'campaign-write', 30);
    if (rejection) return rejection;
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      return Response.json({ error: 'JSON content type required' }, { status: 415 });
    const budget = await campaignRequestBudget('write');
    if (budget) return budget;
    const text = await boundedText(request, 10_000, 5000);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new CampaignError('Invalid JSON body');
    }
    const body = object(parsed);
    if (body.operation === 'challenge')
      return Response.json(
        await (
          await campaign()
        ).issue(String(body.address ?? ''), String(body.action ?? ''), origin),
      );
    if (
      body.operation === 'claim' &&
      typeof body.id === 'string' &&
      typeof body.signature === 'string' &&
      /^0x[0-9a-f]{130}$/i.test(body.signature)
    ) {
      return Response.json(
        await (
          await campaign()
        ).claim({
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
    throw new CampaignError('Unsupported campaign action');
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof CampaignError || error instanceof BodyLimitError
            ? error.message
            : 'Campaign action could not be completed. Try again.',
      },
      {
        status:
          error instanceof BodyLimitError
            ? 413
            : error instanceof CampaignError
              ? error.status
              : 503,
      },
    );
  }
}
