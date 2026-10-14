import { assertLiveSubmissionAllowed } from '../../../../../packages/protocol/capabilities.js';
import { boundedText } from '../../../../../packages/http/guards';
import { guardRead } from '../../../lib/request-guard';
import { officialTransport, envelope, intentError } from '../../../lib/official-intents';
export async function POST(request: Request) {
  const rejection = guardRead(request, 'intent-submit', 20);
  if (rejection) return rejection;
  try {
    assertLiveSubmissionAllowed();
  } catch {
    return Response.json(
      {
        error: 'Live submission is disabled: third-party access and settlement are unverified.',
        liveSubmission: false,
      },
      { status: 403 },
    );
  }
  try {
    const input = envelope(JSON.parse(await boundedText(request, 16000)));
    return Response.json(await officialTransport.submit(input));
  } catch (error) {
    return intentError(error);
  }
}
