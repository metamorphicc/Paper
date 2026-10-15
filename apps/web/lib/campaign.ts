import 'server-only';
import { PersistentCampaign, CampaignError } from '../../../packages/community/persistent.js';
import { database } from './server';
import { allowsOrigin, allowsRequest } from '../../../packages/http/origin.js';
import { sharedCampaignBudget } from '../../../packages/http/shared-budget.js';
let instance: PersistentCampaign | undefined;
export async function campaign() {
  return (instance ??= new PersistentCampaign(
    (await database()).sql,
    () => Date.now(),
    (origin) => allowsOrigin(origin, process.env),
  ));
}
export function assertLocalOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || !allowsRequest(request, process.env))
    throw new CampaignError('Use the application origin to sign this action');
  return origin;
}
export async function campaignRequestBudget(scope: 'read' | 'write') {
  const result = await sharedCampaignBudget(
    (await database()).sql,
    scope,
    scope === 'read' ? 240 : 120,
  );
  return result.allowed
    ? null
    : Response.json(
        { error: 'Community is receiving too many requests. Try again shortly.' },
        {
          status: 429,
          headers: { 'Retry-After': String(result.retryAfter), 'Cache-Control': 'no-store' },
        },
      );
}
