import 'server-only';
import { Campaign } from '../../../packages/community/campaign.js';
import { database } from './server';
import { isLocalRead } from '../../../packages/http/guards.js';
let instance: Campaign | undefined;
export function campaign() {
  return (instance ??= new Campaign(database()));
}
export function assertLocalOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || !isLocalRead(request))
    throw new Error('Use the local application to sign this action');
  return origin;
}
