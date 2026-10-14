import { treasuryReceipts } from '../../../lib/treasury';
import { guardRead } from '../../../lib/request-guard';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const rejection = guardRead(request, 'treasury', 20);
  if (rejection) return rejection;
  try {
    const state = await treasuryReceipts();
    return Response.json(
      { ...state, liveSubmission: false },
      { status: state.status === 'unavailable' ? 503 : 200 },
    );
  } catch {
    return Response.json(
      {
        status: 'unavailable',
        error: 'Confirmed transfer data is unavailable.',
        liveSubmission: false,
      },
      { status: 503 },
    );
  }
}
