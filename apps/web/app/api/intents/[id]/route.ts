import { guardRead } from '../../../../lib/request-guard';
import { officialTransport } from '../../../../lib/official-intents';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const rejection = guardRead(request, 'intent-status', 20);
  if (rejection) return rejection;
  const { id } = await context.params;
  const user = new URL(request.url).searchParams.get('user');
  if (!/^0x[0-9a-f]{64}$/.test(id) || !user || !/^0x[0-9a-fA-F]{40}$/.test(user))
    return Response.json({ error: 'Invalid intent or wallet address' }, { status: 400 });
  try {
    return Response.json(await officialTransport.status(id as `0x${string}`, user));
  } catch {
    return Response.json(
      { error: 'Intent status is unavailable. Settlement has not been verified.' },
      { status: 503 },
    );
  }
}
