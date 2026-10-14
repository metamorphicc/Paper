import { isAddress } from 'viem';
import { database, walletData } from '../../../../lib/server';
import { tradeHistory } from '../../../../../../packages/protocol/history.js';
import { readProfile } from '../../../../../../packages/protocol/read.js';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, context: { params: Promise<{ address: string }> }) {
  const { address } = await context.params;
  if (!isAddress(address)) return Response.json({ error: 'Некорректный адрес' }, { status: 400 });
  try {
    const [profile, trades, rpc] = await Promise.all([
      walletData(address),
      tradeHistory(address).catch(() => null),
      readProfile(address as `0x${string}`).catch(() => null),
    ]);
    return Response.json({
      ...profile,
      source: 'official-indexer',
      trades,
      pendingReward: rpc
        ? {
            source: 'rpc',
            block: rpc.blockNumber,
            observedAt: rpc.observedAtUtc,
            value: rpc.values.pendingReward,
          }
        : null,
      history: database().history(address),
      coverage: database().cursor('paper-transfers') ?? null,
    });
  } catch {
    return Response.json({ error: 'Данные адреса недоступны. Попробуйте позже.' }, { status: 503 });
  }
}
