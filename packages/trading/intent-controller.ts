import { isAddress, type Hex } from 'viem';
import {
  actionTypes,
  identifyIntent,
  officialTypedData,
  type IntentMessage,
  type IntentType,
} from '../protocol/intents.js';
import { assertLiveSubmissionAllowed } from '../protocol/capabilities.js';
import {
  OfficialRelayerTransport,
  UnconfirmedIntentError,
  IntentRejectedError,
  normalizeOfficialMessage,
  type Acknowledgement,
} from './official-transport.js';
import type { Action, Envelope } from './relayer.js';
type Authority = { user: string; chainId: number; generation: number };
type Prepared = { action: Action; message: IntentMessage; authority: Authority };
type Pending = {
  envelope: Envelope;
  authority: Authority;
  phase: 'submitting' | 'acknowledged' | 'unconfirmed' | 'rejected';
  ack?: Acknowledgement;
};
export type NoncePorts = {
  read: (key: string) => string | null;
  write: (key: string, value: string) => void;
  lock: <T>(key: string, work: () => Promise<T>) => Promise<T>;
  seed: () => bigint;
};
export class CoordinatedNonces {
  constructor(private ports: NoncePorts) {}
  take(user: string, contract: string, chainId: number) {
    const key = `paperclub.officialNonce.v1:${chainId}:${contract.toLowerCase()}:${user.toLowerCase()}`;
    return this.ports.lock(key, async () => {
      const stored = this.ports.read(key);
      if (stored !== null && !/^(0|[1-9]\d*)$/.test(stored))
        throw new Error('Invalid stored nonce');
      const nonce = stored === null ? this.ports.seed() : BigInt(stored);
      if (nonce < 0n || nonce >= (1n << 256n) - 1n) throw new Error('Nonce exhausted');
      this.ports.write(key, String(nonce + 1n));
      return nonce;
    });
  }
}
export class OfficialIntentController {
  readonly pending = new Map<Hex, Pending>();
  private signing = new WeakSet<Prepared>();
  constructor(
    private options: {
      context: () => Authority;
      nonces: CoordinatedNonces;
      transport: Pick<OfficialRelayerTransport, 'submit' | 'status' | 'cancel'>;
      sign: (type: IntentType, message: IntentMessage) => Promise<Hex>;
      assertReady?: (action: Action | 'cancel') => void | Promise<void>;
      validateAction: (action: Action, fields: IntentMessage) => void | Promise<void>;
      now?: () => number;
    },
  ) {}
  private current(authority: Authority) {
    const latest = this.options.context();
    if (
      latest.user.toLowerCase() !== authority.user.toLowerCase() ||
      latest.chainId !== authority.chainId ||
      latest.generation !== authority.generation
    )
      throw new Error('Account or network changed; this intent is invalidated');
  }
  private async ready(action: Action | 'cancel') {
    await (this.options.assertReady ?? assertLiveSubmissionAllowed)(action);
  }
  private now() {
    return (this.options.now ?? Date.now)();
  }
  async prepare(action: Action, fields: IntentMessage): Promise<Prepared> {
    await this.ready(action);
    const authority = {
      ...this.options.context(),
      user: this.options.context().user.toLowerCase(),
    };
    if (authority.chainId !== 999 || !isAddress(authority.user, { strict: false }))
      throw new Error('HyperEVM wallet required');
    if (['user', 'nonce', 'deadline'].some((key) => key in fields))
      throw new Error('Authority fields cannot be overridden');
    await this.options.validateAction(action, fields);
    this.current(authority);
    const domain = officialTypedData(actionTypes[action], {
      user: authority.user,
      ...fields,
      nonce: 0n,
      deadline: 0n,
    }).domain;
    const nonce = await this.options.nonces.take(
      authority.user,
      domain.verifyingContract,
      authority.chainId,
    );
    this.current(authority);
    const message = normalizeOfficialMessage(actionTypes[action], {
      user: authority.user,
      ...fields,
      nonce,
      deadline: BigInt(Math.floor(this.now() / 1000) + 3600),
    });
    for (const value of Object.values(message)) if (Array.isArray(value)) Object.freeze(value);
    return Object.freeze({
      action,
      message: Object.freeze(message),
      authority: Object.freeze(authority),
    });
  }
  async submit(prepared: Prepared) {
    if (this.signing.has(prepared))
      throw new Error('Prepared intent already used; retry its signed ID instead');
    this.signing.add(prepared);
    await this.ready(prepared.action);
    this.current(prepared.authority);
    const signature = await this.options.sign(actionTypes[prepared.action], prepared.message);
    this.current(prepared.authority);
    const identity = await identifyIntent(
      actionTypes[prepared.action],
      prepared.message,
      signature,
    );
    if (identity.signer !== prepared.authority.user) throw new Error('Main wallet signer mismatch');
    const envelope = { action: prepared.action, message: prepared.message, signature };
    const record: Pending = { envelope, authority: prepared.authority, phase: 'submitting' };
    this.pending.set(identity.intentId, record);
    return this.send(identity.intentId, record);
  }
  private async send(id: Hex, record: Pending) {
    await this.ready(record.envelope.action);
    this.current(record.authority);
    try {
      const ack = await this.options.transport.submit(record.envelope);
      if (ack.intentId !== id || ack.action !== record.envelope.action)
        throw new UnconfirmedIntentError(id);
      this.current(record.authority);
      record.phase = 'acknowledged';
      record.ack = ack;
      return ack;
    } catch (error) {
      record.phase = error instanceof IntentRejectedError ? 'rejected' : 'unconfirmed';
      if (!(error instanceof UnconfirmedIntentError)) throw error;
      throw new UnconfirmedIntentError(id);
    }
  }
  retrySame(id: Hex) {
    const record = this.pending.get(id);
    if (!record) throw new Error('No retained signed intent');
    return this.send(id, record);
  }
  async status(id: Hex) {
    const record = this.pending.get(id);
    if (!record) throw new Error('Unknown intent');
    this.current(record.authority);
    return this.options.transport.status(id, record.authority.user);
  }
  async cancel(id: Hex) {
    const record = this.pending.get(id);
    if (!record) throw new Error('Unknown intent');
    await this.ready('cancel');
    this.current(record.authority);
    const message = {
      user: record.authority.user,
      intentId: id,
      deadline: BigInt(Math.floor(this.now() / 1000) + 3600),
    };
    const signature = await this.options.sign('CancelIntent', message);
    this.current(record.authority);
    const acknowledgement = await this.options.transport.cancel(
      id,
      message,
      signature,
      record.envelope.action,
    );
    // Cancellation acknowledgement is not proof that the order could not execute.
    return { ...acknowledgement, cancellationVerified: false };
  }
  invalidate() {
    this.pending.clear();
  }
}
