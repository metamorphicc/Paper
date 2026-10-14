import 'server-only';
import { object } from '../../../packages/protocol/official';
import { actionTypes } from '../../../packages/protocol/intents';
import type { Action, Envelope } from '../../../packages/trading/relayer';
import {
  OfficialRelayerTransport,
  UnconfirmedIntentError,
  IntentRejectedError,
} from '../../../packages/trading/official-transport';
import release from '../../../config/trading-release.json';
export const officialTransport = new OfficialRelayerTransport({ buildId: release.observedBuildId });
export function envelope(value: unknown): Envelope {
  const input = object(value);
  if (
    typeof input.action !== 'string' ||
    !Object.hasOwn(actionTypes, input.action) ||
    typeof input.signature !== 'string' ||
    !/^0x[0-9a-fA-F]{130}$/.test(input.signature)
  )
    throw new Error('Invalid signed intent');
  return {
    action: input.action as Action,
    message: object(input.message) as Envelope['message'],
    signature: input.signature as Envelope['signature'],
  };
}
export function intentError(error: unknown) {
  if (error instanceof UnconfirmedIntentError)
    return Response.json(
      { phase: 'unconfirmed', intentId: error.intentId, error: error.message },
      { status: 202 },
    );
  if (error instanceof IntentRejectedError)
    return Response.json({ phase: 'rejected', code: error.code }, { status: 409 });
  return Response.json(
    {
      error:
        'Invalid intent or unavailable transport. No new signature should be created until its status is checked.',
    },
    { status: 400 },
  );
}
