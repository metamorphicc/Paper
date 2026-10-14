import { OfficialReadClient } from '../../../../../packages/protocol/official.js';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const api = new OfficialReadClient();
    const [summary, trading] = await Promise.all([api.summary(), api.trading()]);
    return Response.json({
      source: 'official-indexer',
      fetchedAt: new Date().toISOString(),
      reconciled: false,
      summary,
      trading,
    });
  } catch {
    return Response.json(
      { error: 'Официальные данные сейчас недоступны', source: 'official-indexer' },
      { status: 503 },
    );
  }
}
