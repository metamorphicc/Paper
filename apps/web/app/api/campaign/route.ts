import { campaign, assertLocalOrigin } from '../../../lib/campaign';
import { object } from '../../../../../packages/protocol/official.js';
export const dynamic = 'force-dynamic';
export async function GET() { return Response.json({ campaign: 'founding-01', leaderboard: campaign().leaderboard(), metrics: campaign().metrics(), reward: 'points-only', tokenClaims: false }); }
export async function POST(request: Request) {
  try {
    const origin = assertLocalOrigin(request); const text = await request.text(); if (text.length > 10_000) throw new Error('Request too large');
    const body = object(JSON.parse(text));
    if (body.operation === 'challenge') return Response.json(campaign().issue(String(body.address ?? ''), String(body.action ?? ''), origin));
    if (body.operation === 'claim' && typeof body.id === 'string' && typeof body.signature === 'string' && /^0x[0-9a-f]{130}$/i.test(body.signature)) {
      return Response.json(await campaign().claim({ id: body.id, signature: body.signature as `0x${string}`, origin,
        answers: Array.isArray(body.answers) && body.answers.every(value => typeof value === 'string') ? body.answers : undefined,
        trackedAddress: typeof body.trackedAddress === 'string' ? body.trackedAddress : undefined }));
    }
    throw new Error('Unsupported campaign action');
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Campaign action failed' }, {status:400}); }
}
