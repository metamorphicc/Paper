import 'server-only';
import { PersistentCampaign, CampaignError } from '../../../packages/community/persistent.js';
import { database } from './server';
import { allowsOrigin, allowsRequest } from '../../../packages/http/origin.js';
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
