import { assertLiveSubmissionAllowed } from '../../../../../packages/protocol/capabilities.js';
export async function POST() {
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
}
