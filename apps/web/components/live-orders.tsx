'use client';
import { useEffect, useRef, useState } from 'react';
import type { Hex } from 'viem';
import { useWallet } from './wallet';
import {
  CoordinatedNonces,
  OfficialIntentController,
} from '../../../packages/trading/intent-controller';
import {
  UnconfirmedIntentError,
  IntentRejectedError,
  type Acknowledgement,
} from '../../../packages/trading/official-transport';
import type { Envelope } from '../../../packages/trading/relayer';
import type { IntentMessage } from '../../../packages/protocol/intents';
type Readiness = { enabled: boolean; blockers: string[] };
const labels: Record<string, string> = {
  implementationSourceVerified: 'Contract source',
  exchangeDomainVerified: 'Exchange signing domain',
  cancellationDomainVerified: 'Cancellation signing domain',
  collateralLifecycleVerified: 'Deposit and withdrawal lifecycle',
  thirdPartyAccessVerified: 'Relayer access',
  settlementVerified: 'Settlement',
  sessionAuthorizationVerified: 'Session authorization',
  releaseApproved: 'Release review',
};
export default function LiveOrders({
  fields,
  fresh,
}: {
  fields: IntentMessage | null;
  fresh: boolean;
}) {
  const wallet = useWallet();
  const latest = useRef(wallet);
  latest.current = wallet;
  const freshRef = useRef(fresh);
  freshRef.current = fresh;
  const currentFields = useRef(fields);
  currentFields.current = fields;
  const [readiness, setReadiness] = useState<Readiness | null>(null),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState(''),
    [id, setId] = useState<Hex | null>(null);
  const controller = useRef<OfficialIntentController | null>(null);
  async function refresh() {
    try {
      const response = await fetch('/api/trading/readiness');
      if (!response.ok) throw new Error();
      setReadiness(await response.json());
    } catch {
      setReadiness(null);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  useEffect(() => {
    controller.current?.invalidate();
    controller.current = null;
    setId(null);
    setFeedback('');
  }, [wallet.generation]);
  async function ready() {
    const response = await fetch('/api/trading/readiness');
    const value = await response.json();
    if (!response.ok || value.enabled !== true) throw new Error('Live trading is unavailable.');
  }
  function createController() {
    const nonces = new CoordinatedNonces({
      read: (key) => localStorage.getItem(key),
      write: (key, value) => localStorage.setItem(key, value),
      seed: () => {
        const bytes = crypto.getRandomValues(new Uint8Array(3));
        return (
          (BigInt(bytes[0]!) * 65536n + BigInt(bytes[1]!) * 256n + BigInt(bytes[2]!) || 1n) * 256n
        );
      },
      lock: async (key, work) => {
        if (!navigator.locks) throw new Error('Browser nonce coordination is unavailable.');
        return navigator.locks.request(key, work);
      },
    });
    async function post(path: string, body: unknown): Promise<Acknowledgement> {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body, (_, v) => (typeof v === 'bigint' ? String(v) : v)),
      });
      const value = await response.json();
      if (response.status === 409 && typeof value.code === 'string')
        throw new IntentRejectedError(value.code);
      if (response.status === 202 && value.intentId)
        throw new UnconfirmedIntentError(value.intentId);
      if (!response.ok)
        throw new Error('The request could not be confirmed. Check its status before retrying.');
      return value;
    }
    return new OfficialIntentController({
      context: () => ({
        user: latest.current.address ?? '',
        chainId: latest.current.chainId ?? 0,
        generation: latest.current.generation,
      }),
      nonces,
      assertReady: ready,
      sign: async (type, message) => {
        const key = (value: IntentMessage | null) =>
          Object.entries(value ?? {})
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([name, value]) => name + ':' + String(value))
            .join('|');
        const expected =
          type === 'OpenPosition'
            ? key({
                instrumentId: message.instrumentId!,
                isLong: message.isLong!,
                size: message.size!,
                leverage: message.leverage!,
                useDebt: message.useDebt!,
              })
            : null;
        if (expected && (!freshRef.current || expected !== key(currentFields.current)))
          throw new Error('Order changed; fresh confirmation is required.');
        const signature = await latest.current.signOfficial(type, message);
        if (expected && (!freshRef.current || expected !== key(currentFields.current)))
          throw new Error('Order changed while signing.');
        return signature;
      },
      validateAction: async (action, message) => {
        if (action !== 'openPosition' || !freshRef.current)
          throw new Error('Fresh market data is required.');
        const response = await fetch(`/api/profile/${latest.current.address}`);
        const profile = await response.json();
        if (
          !response.ok ||
          profile.stale ||
          BigInt(profile.value.availableRaw) < BigInt(String(message.size))
        )
          throw new Error('Fresh available collateral is required.');
      },
      transport: {
        submit: (value: Envelope) => post('/api/intents', value),
        cancel: (intentId, message, signature, action) =>
          post(`/api/intents/${intentId}/cancel`, { action, message, signature }),
        status: async (intentId, user) => {
          const response = await fetch(`/api/intents/${intentId}?user=${user}`);
          if (!response.ok) throw new Error('Status is unavailable.');
          return response.json();
        },
      },
    });
  }
  async function run(operation: () => Promise<void>) {
    setBusy(true);
    setFeedback('');
    try {
      await operation();
    } catch (error) {
      const pending = controller.current?.pending;
      if (pending?.size) setId([...pending.keys()].at(-1)!);
      setFeedback(
        error instanceof IntentRejectedError
          ? 'The relayer rejected this request. Check the original intent status before taking another action.'
          : error instanceof UnconfirmedIntentError
            ? error.message
            : error instanceof Error && /required|unavailable|changed/.test(error.message)
              ? error.message
              : 'The request could not be confirmed. Check its status before retrying.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="live-blocked">
      <strong>{readiness?.enabled ? 'Live connection ready' : 'Live trading unavailable'}</strong>
      <p>Orders require your connected wallet signature and verified relayer access.</p>
      <div className="campaign-actions">
        <button
          className="button primary"
          disabled={
            busy ||
            !readiness?.enabled ||
            !wallet.address ||
            wallet.chainId !== 999 ||
            !fields ||
            !fresh ||
            !!id
          }
          onClick={() =>
            void run(async () => {
              controller.current ??= createController();
              const prepared = await controller.current.prepare('openPosition', fields!);
              const ack = await controller.current.submit(prepared);
              setId(ack.intentId);
              setFeedback('Relayer acknowledgement received. Settlement is not yet verified.');
            })
          }
        >
          {busy ? 'Processing…' : 'Sign and submit'}
        </button>
        <button className="button small" onClick={() => void refresh()} disabled={busy}>
          Check connection
        </button>
      </div>
      {id && (
        <>
          <p className="address-text">{id}</p>
          <div className="campaign-actions">
            <button
              className="button small"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const status = await controller.current!.status(id);
                  setFeedback(status.reason);
                })
              }
            >
              Check status
            </button>
            <button
              className="button small"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await controller.current!.retrySame(id);
                  setFeedback(
                    'Same signed intent acknowledged. Settlement is pending verification.',
                  );
                })
              }
            >
              Retry same intent
            </button>
            <button
              className="button small"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await controller.current!.cancel(id);
                  setFeedback('Cancellation acknowledged. Final cancellation is not yet verified.');
                })
              }
            >
              Request cancellation
            </button>
          </div>
        </>
      )}
      {feedback && (
        <p className="feedback" role="status">
          {feedback}
        </p>
      )}
      {readiness && !readiness.enabled && (
        <details>
          <summary>Connection requirements</summary>
          <ul>
            {readiness.blockers.map((key) => (
              <li key={key}>{labels[key] ?? 'Integration review'}</li>
            ))}
          </ul>
        </details>
      )}
      <a
        href="https://exchange.papertrade.xyz/trade/btc"
        className="text-link"
        target="_blank"
        rel="noreferrer"
      >
        Official trading ↗
      </a>
    </div>
  );
}
