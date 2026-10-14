import { isAddress, type Hex } from 'viem';
import { boundedText } from '../http/guards.js';
import {
  actionTypes,
  identifyIntent,
  intentTypes,
  officialTypedData,
  serializeSigned,
  type IntentMessage,
  type IntentType,
} from '../protocol/intents.js';
import { OFFICIAL_ORIGIN, OfficialReadClient, object } from '../protocol/official.js';
import { assertLiveSubmissionAllowed } from '../protocol/capabilities.js';
import type { Action, Envelope } from './relayer.js';

export class UnconfirmedIntentError extends Error {
  constructor(readonly intentId: Hex) {
    super(
      'Acknowledgement is unconfirmed. Check this intent ID before retrying; do not sign a new intent.',
    );
  }
}
export class IntentRejectedError extends Error {
  constructor(readonly code: string) {
    super(`Intent rejected: ${code}`);
  }
}
const rejectedCodes = new Set([
  'invalid_intent',
  'deadline_expired',
  'unauthorized_intent',
  'intent_conflict',
  'admission_rejected',
  'below_minimum_paper_stake',
  'below_minimum_withdrawal',
  'invalid_onward',
  'intake_action_paused',
  'rate_limited',
]);
export type Acknowledgement = {
  intentId: Hex;
  action: Action;
  phase: 'acknowledged';
  serverState: string;
  queueRevision?: string;
};
type Options = {
  fetcher?: typeof fetch;
  buildId?: string;
  now?: () => number;
  assertReleased?: (action: Action | 'cancel') => void | Promise<void>;
  sessionAuthorized?: (user: string, signer: string, action: Action) => Promise<boolean>;
  walletReader?: (user: string) => Promise<Record<string, unknown>>;
};
function uint(value: unknown, bits: number) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('Unsafe integer');
  const text = String(value);
  if (!/^(0|[1-9]\d*)$/.test(text) || text.length > 78) throw new Error('Invalid integer');
  const integer = BigInt(text);
  if (integer >= 1n << BigInt(bits)) throw new Error('Integer outside schema range');
  return integer;
}
export function normalizeOfficialMessage(type: IntentType, message: IntentMessage): IntentMessage {
  officialTypedData(type, message); // Exact field names, including rejection of extra fields.
  const result: IntentMessage = {};
  for (const field of intentTypes[type]) {
    const value = message[field.name];
    if (field.type === 'address') {
      if (typeof value !== 'string' || !isAddress(value, { strict: false }))
        throw new Error('Invalid address');
      result[field.name] = value.toLowerCase();
    } else if (field.type === 'bool') {
      if (typeof value !== 'boolean') throw new Error('Invalid boolean');
      result[field.name] = value;
    } else if (field.type === 'bytes32') {
      if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value))
        throw new Error('Invalid bytes32');
      result[field.name] = value.toLowerCase();
    } else if (field.type === 'uint256[]') {
      if (!Array.isArray(value) || value.length < 1 || value.length > 12)
        throw new Error('Invalid position list');
      const values = value.map((item) => uint(item, 256));
      if (new Set(values.map(String)).size !== values.length)
        throw new Error('Duplicate positions');
      result[field.name] = values;
    } else result[field.name] = uint(value, Number(field.type.slice(4)));
  }
  return result;
}
export class OfficialRelayerTransport {
  private readonly fetcher: typeof fetch;
  private readonly now: () => number;
  private retryAt = 0;
  constructor(private options: Options = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.now = options.now ?? Date.now;
  }
  private async released(action: Action | 'cancel') {
    await (this.options.assertReleased ?? assertLiveSubmissionAllowed)(action);
  }
  private deadline(message: IntentMessage) {
    const value = uint(message.deadline, 64),
      now = BigInt(Math.floor(this.now() / 1000));
    if (value <= now || value > now + 3600n) throw new Error('Expired or excessive deadline');
  }
  async submit(envelope: Envelope): Promise<Acknowledgement> {
    await this.released(envelope.action);
    const type = actionTypes[envelope.action];
    if (!type) throw new Error('Unknown action');
    const message = normalizeOfficialMessage(type, envelope.message);
    this.deadline(message);
    const identity = await identifyIntent(type, message, envelope.signature);
    const user = String(message.user);
    if (
      identity.signer !== user &&
      (!['openPosition', 'closePositions'].includes(envelope.action) ||
        !(await this.options.sessionAuthorized?.(user, identity.signer, envelope.action)))
    )
      throw new Error('Wallet signature or verified active session required');
    const body = { action: envelope.action, signed: serializeSigned(message, envelope.signature) };
    await this.released(envelope.action);
    return this.request('/intents', body, identity.intentId, envelope.action, true);
  }
  async cancel(
    id: Hex,
    message: IntentMessage,
    signature: Hex,
    action: Action,
  ): Promise<Acknowledgement> {
    await this.released('cancel');
    const normalized = normalizeOfficialMessage('CancelIntent', message);
    if (normalized.intentId !== id.toLowerCase()) throw new Error('Cancellation ID mismatch');
    this.deadline(normalized);
    const identity = await identifyIntent('CancelIntent', normalized, signature);
    if (identity.signer !== String(normalized.user))
      throw new Error('Main wallet cancellation signature required');
    const { intentId: _, ...body } = serializeSigned(normalized, signature);
    await this.released('cancel');
    return this.request(`/intents/${id.toLowerCase()}/cancel`, body, id, action, false);
  }
  private async request(
    path: string,
    body: unknown,
    id: Hex,
    action: Action,
    needsRevision: boolean,
  ): Promise<Acknowledgement> {
    if (this.now() < this.retryAt) throw new IntentRejectedError('rate_limited');
    const build = this.options.buildId;
    if (!build || !/^[a-zA-Z0-9._-]{1,64}$/.test(build))
      throw new Error('Reviewed official build ID required');
    try {
      const response = await this.fetcher(new URL(path, OFFICIAL_ORIGIN), {
        method: 'POST',
        redirect: 'error',
        credentials: 'omit',
        cache: 'no-store',
        signal: AbortSignal.timeout(12000),
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Papertrade-Build': build,
        },
        body: JSON.stringify(body),
      });
      if (response.status === 429) {
        const retry = response.headers.get('retry-after');
        const seconds = retry && /^\d+$/.test(retry) ? Math.min(3600, Number(retry)) : 30;
        this.retryAt = this.now() + seconds * 1000;
      }
      const value = object(JSON.parse(await boundedText(response, 64000)));
      const code =
        typeof value.code === 'string'
          ? value.code
          : typeof value.error === 'string'
            ? value.error
            : '';
      if ([400, 401, 403, 409, 422, 429].includes(response.status) && rejectedCodes.has(code))
        throw new IntentRejectedError(code);
      if (
        !response.ok ||
        value.ok === false ||
        value.error ||
        value.intentId !== id ||
        value.action !== action ||
        typeof value.state !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,40}$/.test(value.state)
      )
        throw new UnconfirmedIntentError(id);
      if (
        needsRevision &&
        (typeof value.queueRevision !== 'string' || !/^(0|[1-9]\d*)$/.test(value.queueRevision))
      )
        throw new UnconfirmedIntentError(id);
      return {
        intentId: id,
        action,
        phase: 'acknowledged',
        serverState: value.state,
        ...(needsRevision ? { queueRevision: String(value.queueRevision) } : {}),
      };
    } catch (error) {
      if (error instanceof IntentRejectedError || error instanceof UnconfirmedIntentError)
        throw error;
      throw new UnconfirmedIntentError(id);
    }
  }
  async status(id: Hex, user: string) {
    if (!/^0x[0-9a-f]{64}$/.test(id) || !isAddress(user, { strict: false }))
      throw new Error('Invalid status identity');
    const snapshot = await (
      this.options.walletReader ??
      ((address) => new OfficialReadClient(this.fetcher).wallet(address))
    )(user);
    if (String(snapshot.address).toLowerCase() !== user.toLowerCase())
      throw new Error('Wallet snapshot mismatch');
    const operation = Array.isArray(snapshot.operations)
      ? snapshot.operations.find(
          (row) =>
            row && typeof row === 'object' && (row as Record<string, unknown>).intentId === id,
        )
      : undefined;
    return {
      intentId: id,
      phase: operation ? 'observed-operation' : 'unconfirmed',
      source: 'official-wallet-snapshot',
      operation: operation ?? null,
      indexedThroughBlock: snapshot.indexedThroughBlock,
      settlementVerified: false,
      reason: operation
        ? 'Operation observed; settlement still needs transaction/event evidence.'
        : 'Absence from the queue is not evidence of settlement, cancellation or expiry.',
    };
  }
}
