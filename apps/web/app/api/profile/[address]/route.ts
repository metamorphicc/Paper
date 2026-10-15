import { isAddress } from 'viem';
import { database, walletData } from '../../../../lib/server';
import { tradeHistory } from '../../../../../../packages/protocol/history.js';
import { readProfile } from '../../../../../../packages/protocol/read.js';
import { guardRead } from '../../../../lib/request-guard';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, context: { params: Promise<{ address: string }> }) {
  const rejection = guardRead(_request, 'profile', 20);
  if (rejection) return rejection;
  const { address } = await context.params;
  if (!isAddress(address)) return Response.json({ error: 'Invalid address' }, { status: 400 });
  try {
    const [profile, trades, rpc] = await Promise.all([
      walletData(address),
      tradeHistory(address).catch(() => null),
      readProfile(address as `0x${string}`).catch(() => null),
    ]);
    const db = await database();
    return Response.json({
      ...profile,
      source: 'official-indexer',
      trades,
      pendingReward: rpc
        ? {
            source: 'rpc',
            block: rpc.blockNumber,
            statePinned: rpc.statePinned,
            stateMode: rpc.stateMode,
            headAfter: rpc.headAfter,
            observedAt: rpc.observedAtUtc,
            value: rpc.values.pendingReward,
          }
        : null,
      history: await db.history(address),
      coverage: (await db.cursor('paper-transfers')) ?? null,
    });
  } catch {
    return Response.json(
      { error: 'Address data is unavailable. Try again later.' },
      { status: 503 },
    );
  }
}
