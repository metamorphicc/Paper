import { isAddress } from 'viem';
import { tradeHistory } from '../../../../../../../packages/protocol/history.js';
import { OfficialReadClient } from '../../../../../../../packages/protocol/official.js';
import { guardRead } from '../../../../../lib/request-guard';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: { params: Promise<{ address: string }> }) {
  const rejection = guardRead(request, 'profile-history', 30);
  if (rejection) return rejection;
  const { address } = await context.params,
    cursor = new URL(request.url).searchParams.get('cursor');
  if (
    !isAddress(address) ||
    (cursor !== null &&
      (cursor.length < 1 || cursor.length > 2048 || /[\u0000-\u001f\u007f]/.test(cursor)))
  )
    return Response.json({ error: 'Invalid address or history cursor' }, { status: 400 });
  try {
    return Response.json(await tradeHistory(address, new OfficialReadClient(), cursor));
  } catch {
    return Response.json(
      { error: 'Earlier trades could not be loaded. Try again.' },
      { status: 503 },
    );
  }
}
