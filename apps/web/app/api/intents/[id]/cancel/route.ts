import { guardRead } from '../../../../../lib/request-guard';
import { officialTransport, envelope, intentError } from '../../../../../lib/official-intents';
import { assertLiveSubmissionAllowed } from '../../../../../../../packages/protocol/capabilities';
import { boundedText } from '../../../../../../../packages/http/guards';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const rejection = guardRead(request, 'intent-cancel', 20);
  if (rejection) return rejection;
  try {
    assertLiveSubmissionAllowed();
  } catch {
    return Response.json(
      {
        error: 'Live cancellation is blocked pending verified integration.',
        liveSubmission: false,
      },
      { status: 403 },
    );
  }
  const { id } = await context.params;
  if (!/^0x[0-9a-f]{64}$/.test(id))
    return Response.json({ error: 'Invalid intent ID' }, { status: 400 });
  try {
    const input = envelope(JSON.parse(await boundedText(request, 16000)));
    return Response.json(
      await officialTransport.cancel(
        id as `0x${string}`,
        input.message,
        input.signature,
        input.action,
      ),
    );
  } catch (error) {
    return intentError(error);
  }
}
