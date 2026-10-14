import 'server-only';
import { Campaign } from '../../../packages/community/campaign.js';
import { database } from './server';
let instance: Campaign | undefined;
export function campaign() { return instance ??= new Campaign(database()); }
export function assertLocalOrigin(request: Request) {
  const url = new URL(request.url), origin = request.headers.get('origin');
  if (!origin || origin !== url.origin || !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) throw new Error('Use the local application to sign this action');
  return origin;
}
