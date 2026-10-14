import { isAddress } from 'viem';
import { database, walletData } from '../../../../lib/server';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, context: { params: Promise<{address:string}> }) {
  const { address } = await context.params;
  if (!isAddress(address)) return Response.json({ error: 'Некорректный адрес' }, { status: 400 });
  try {
    const profile = await walletData(address);
    return Response.json({ ...profile, source: 'official-indexer', history: database().history(address), coverage: database().cursor('paper-transfers') ?? null });
  } catch { return Response.json({ error: 'Данные адреса недоступны. Попробуйте позже.' }, { status: 503 }); }
}
