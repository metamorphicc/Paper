import { assertLiveSubmissionAllowed } from '../../../../../packages/protocol/capabilities.js';
export async function POST() {
  try {
    assertLiveSubmissionAllowed();
  } catch {
    return Response.json(
      {
        error: 'Live submission отключён: third-party access и settlement не подтверждены.',
        liveSubmission: false,
      },
      { status: 403 },
    );
  }
}
