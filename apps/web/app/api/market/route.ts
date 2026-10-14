import { marketCandles, marketQuote } from '../../../../../packages/protocol/market.js';
import { OfficialReadClient } from '../../../../../packages/protocol/official.js';
export const dynamic = 'force-dynamic';
const api = new OfficialReadClient();
const cache = new Map<string, { at: number; value: unknown }>();
export async function GET(request: Request) {
  const coin = new URL(request.url).searchParams.get('coin') ?? 'BTC';
  if (coin !== 'BTC' && coin !== 'ETH')
    return Response.json({ error: 'Неподдерживаемый рынок' }, { status: 400 });
  const old = cache.get(coin);
  if (old && Date.now() - old.at < 5_000) return Response.json(old.value);
  try {
    const [quote, trading, candles] = await Promise.all([
      marketQuote(coin),
      api.trading(),
      marketCandles(coin).catch(() => []),
    ]);
    const value = {
      quote,
      trading,
      candles,
      fetchedAt: new Date().toISOString(),
      winFeeAssumption: '2% documented; live getter not independently reconciled',
      liveSubmission: false,
    };
    cache.set(coin, { at: Date.now(), value });
    return Response.json(value);
  } catch {
    return Response.json(
      { error: 'Рынок сейчас недоступен. Обновите данные позже.' },
      { status: 503 },
    );
  }
}
