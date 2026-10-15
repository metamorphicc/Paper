import { isAddress } from 'viem';
import { CAMPAIGN_ID, POINTS, type CampaignAction } from './constants.js';
export type CommunityChallenge = {
  id: string;
  message: string;
  expiresAt: number;
  action: CampaignAction;
  points: number;
};
export type Participant = { address: string; total: number; completed: CampaignAction[] };
export function validateParticipant(value: unknown, address: string): Participant {
  const v = value as Participant | null;
  if (
    !v ||
    typeof v.address !== 'string' ||
    v.address.toLowerCase() !== address.toLowerCase() ||
    !Number.isSafeInteger(v.total) ||
    !Array.isArray(v.completed) ||
    new Set(v.completed).size !== v.completed.length ||
    v.completed.some((action) => !Object.hasOwn(POINTS, action)) ||
    v.completed.reduce((sum, action) => sum + POINTS[action], 0) !== v.total
  )
    throw new Error('Participation data could not be verified. Try refreshing.');
  return v;
}
export function communityMessage(input: {
  address: string;
  action: CampaignAction;
  origin: string;
  nonce: string;
  expiresAt: number;
}) {
  return `Paperclub community points\nNo transaction. No token allowance. No trading permission.\nOrigin: ${input.origin}\nAddress: ${input.address.toLowerCase()}\nChain: 999\nCampaign: ${CAMPAIGN_ID}\nAction: ${input.action}\nNonce: ${input.nonce}\nExpires: ${new Date(input.expiresAt).toISOString()}`;
}
/** Only the exact expected origin/account/action/expiry proof may reach personal_sign. */
export function validateCommunityChallenge(
  value: unknown,
  expected: { address: string; action: CampaignAction; origin: string },
  now = Date.now(),
): CommunityChallenge {
  const v = value as CommunityChallenge | null;
  if (
    !v ||
    !isAddress(expected.address) ||
    !Object.hasOwn(POINTS, expected.action) ||
    typeof v.id !== 'string' ||
    !/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(v.id) ||
    typeof v.message !== 'string' ||
    v.message.length > 2000 ||
    v.action !== expected.action ||
    v.points !== POINTS[expected.action] ||
    !Number.isSafeInteger(v.expiresAt) ||
    v.expiresAt <= now ||
    v.expiresAt > now + 305000
  )
    throw new Error('The participation request is invalid or expired. Try again.');
  const nonce = /\nNonce: ([\da-f]{32})\n/.exec(v.message)?.[1];
  if (!nonce || v.message !== communityMessage({ ...expected, nonce, expiresAt: v.expiresAt }))
    throw new Error('The participation request does not match this account, action and website.');
  return v;
}
