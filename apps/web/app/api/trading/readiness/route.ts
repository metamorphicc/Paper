import { liveSubmissionReadiness } from '../../../../../../packages/protocol/capabilities';
import { guardRead } from '../../../../lib/request-guard';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const rejection = guardRead(request, 'trading-readiness', 30);
  if (rejection) return rejection;
  return Response.json({
    ...liveSubmissionReadiness(),
    transportImplemented: true,
    realSettlementTested: false,
    nonceCoordinationImplemented: true,
    signaturesRequested: false,
  });
}
