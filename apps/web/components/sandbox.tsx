'use client';
import { useEffect, useRef, useState } from 'react';
import { privateKeyToAccount } from 'viem/accounts';
import { parseUnits, type Hex } from 'viem';
import {
  MockRelayer,
  sandboxId,
  sandboxTypedData,
  type Action,
} from '../../../packages/trading/relayer.js';
import { actionTypes, type IntentMessage } from '../../../packages/protocol/intents.js';
import type { Instrument, TradingState } from '../../../packages/protocol/official.js';
import { WAD } from '../../../packages/protocol/quote.js';
import { amount } from '../lib/format';

// Public deterministic demo keys, never wallets belonging to the user and never funded.
const demo = privateKeyToAccount(('0x' + '11'.repeat(32)) as Hex),
  session = privateKeyToAccount(('0x' + '44'.repeat(32)) as Hex);
const storageKey = 'paperclub.sandbox.v1';
const labels: Record<string, string> = {
  openPosition: 'Open',
  closePositions: 'Close',
  paperStake: 'Stake',
  paperUnstake: 'Unstake',
  paperClaim: 'Claim',
  withdrawToCore: 'Withdrawal',
  registerSessionKey: 'Session key',
};
const statuses: Record<string, string> = {
  queued: 'Queued',
  confirmed: 'Settled locally',
  failed: 'Failed',
  expired: 'Expired',
  cancelled: 'Cancelled',
};
export default function Sandbox({
  instrument,
  trading,
  entry,
  exit,
  margin,
  leverage,
  isLong,
  fresh,
}: {
  instrument: Instrument;
  trading: TradingState;
  entry: bigint;
  exit: bigint;
  margin: string;
  leverage: number;
  isLong: boolean;
  fresh: boolean;
}) {
  const relay = useRef<MockRelayer | null>(null),
    pending = useRef<Awaited<ReturnType<typeof makeEnvelope>> | null>(null);
  const [enabled, setEnabled] = useState(false),
    [, setRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [mode, setMode] = useState('normal'),
    [paperAmount, setPaperAmount] = useState('1000'),
    [withdrawAmount, setWithdrawAmount] = useState('10'),
    [unknown, setUnknown] = useState<Hex | null>(null);
  async function makeEnvelope(action: Action, fields: IntentMessage = {}, useSession = false) {
    const nonce = BigInt(Date.now()) * 1_000_000n + BigInt(Math.floor(Math.random() * 1_000_000));
    const payload = {
      user: demo.address,
      ...fields,
      nonce,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
    };
    const signer =
      useSession && relay.current?.ledger.sessions[session.address.toLowerCase()] ? session : demo;
    return {
      action,
      message: payload,
      signature: await signer.signTypedData(sandboxTypedData(actionTypes[action], payload)),
    };
  }
  function createFromStorage() {
    let state: ConstructorParameters<typeof MockRelayer>[4] | undefined;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw && raw.length < 1_000_000) {
        const parsed = JSON.parse(raw);
        if (
          parsed.version === 1 &&
          parsed.user === demo.address &&
          Array.isArray(parsed.state.receipts)
        )
          state = parsed.state;
      }
    } catch {
      /* corrupt local demo storage is not live money */
    }
    const value = new MockRelayer(demo.address, instrument, entry, () => Date.now(), state);
    value.configure(instrument, entry);
    value.minimumMarginRaw = BigInt(trading.minimumTradeSizeRaw);
    value.minimumNotionalRaw = BigInt(trading.minimumOpenNotionalRaw);
    value.minimumPaperStakeRaw = BigInt(trading.intake.minimumPaperStakeRaw);
    value.outage = mode === 'outage';
    value.ambiguousNext = mode === 'timeout';
    value.paused = trading.tradingPaused || mode === 'paused';
    value.queueProfit = mode === 'queue';
    return value;
  }
  function persist() {
    if (relay.current)
      localStorage.setItem(
        storageKey,
        JSON.stringify(
          { version: 1, user: demo.address, state: relay.current.serialize() },
          (_, value) => (typeof value === 'bigint' ? String(value) : value),
        ),
      );
    setRevision((value) => value + 1);
  }
  function activate() {
    try {
      relay.current = createFromStorage();
      setEnabled(true);
      setMessage('Local account ready. All USDC and PAPER here are virtual.');
    } catch {
      setMessage('Saved local account is invalid. Reset it before continuing.');
    }
  }
  useEffect(() => {
    if (relay.current) {
      relay.current.configure(instrument, entry);
      relay.current.outage = mode === 'outage';
      relay.current.paused = trading.tradingPaused || mode === 'paused';
      relay.current.queueProfit = mode === 'queue';
      relay.current.minimumMarginRaw = BigInt(trading.minimumTradeSizeRaw);
      relay.current.minimumNotionalRaw = BigInt(trading.minimumOpenNotionalRaw);
      relay.current.minimumPaperStakeRaw = BigInt(trading.intake.minimumPaperStakeRaw);
    }
  }, [instrument, entry, mode, trading]);
  async function run(operation: () => Promise<void> | void) {
    setBusy(true);
    setMessage('');
    try {
      if (navigator.locks) {
        await navigator.locks.request('paperclub-sandbox-ledger', async () => {
          if (enabled) relay.current = createFromStorage();
          await operation();
          persist();
        });
      } else {
        await operation();
        persist();
      }
    } catch (error) {
      persist();
      setMessage(error instanceof Error ? error.message : 'Local action failed.');
    } finally {
      setBusy(false);
    }
  }
  async function submit(action: Action, fields: IntentMessage = {}, sessionAllowed = false) {
    const envelope = await makeEnvelope(action, fields, sessionAllowed);
    pending.current = envelope;
    const id = sandboxId(actionTypes[action], envelope.message);
    try {
      const receipt = await relay.current!.submit(envelope);
      setUnknown(null);
      setMessage(
        `${labels[action]}: ${statuses[receipt.status]}. Settle or cancel this local intent.`,
      );
    } catch (error) {
      if (relay.current!.receipts.has(id)) {
        setUnknown(id);
        setMessage('Response unknown. Check the same intent; no new signature is needed.');
      } else throw error;
    }
  }
  const ledger = relay.current?.ledger,
    receipts = relay.current ? [...relay.current.receipts.values()].reverse() : [];
  return (
    <section className="sandbox-panel" data-testid="sandbox">
      <div className="section-heading">
        <h2> Local account </h2>
        <span className="tag"> Sandbox · virtual funds </span>
      </div>
      <p className="fine-print">
        {' '}
        Mock relayer with a separate signing domain. It sends no requests to Papertrade. Starting
        balance: 2,500 virtual USDC.{' '}
      </p>
      {!enabled ? (
        <button className="button primary" onClick={activate}>
          {' '}
          Try locally{' '}
        </button>
      ) : (
        <>
          <div className="metric-strip sandbox-balances">
            <div>
              <span>Available · virtual</span>
              <strong>{amount(String(relay.current!.available()))}</strong>
            </div>
            <div>
              <span>Queued · virtual</span>
              <strong>{amount(ledger?.queuedRaw)}</strong>
            </div>
            <div>
              <span>PAPER · virtual</span>
              <strong>{amount(ledger?.paperRaw, 'paper')}</strong>
            </div>
            <div>
              <span>Staked · virtual</span>
              <strong>{amount(ledger?.stakedRaw, 'paper')}</strong>
            </div>
          </div>
          <div className="sandbox-controls">
            <label>
              {' '}
              Test behavior{' '}
              <select
                aria-label="Local relayer behavior"
                value={mode}
                onChange={(event) => setMode(event.target.value)}
              >
                <option value="normal"> Normal execution </option>
                <option value="queue"> Profit enters queue </option>
                <option value="outage"> Relayer unavailable </option>
                <option value="timeout"> Response lost after acceptance </option>
                <option value="paused"> Opens paused </option>
              </select>
            </label>
            <button
              className="button primary"
              disabled={busy || !!unknown || !fresh}
              onClick={() =>
                void run(() =>
                  submit(
                    'openPosition',
                    {
                      instrumentId: instrument.id,
                      isLong,
                      size: parseUnits(margin, 18),
                      leverage,
                      useDebt: false,
                    },
                    true,
                  ),
                )
              }
            >
              {' '}
              Open locally{' '}
            </button>
          </div>
          {!fresh && (
            <p className="fine-print error-text"> Refresh BBO before opening a local position. </p>
          )}
          {unknown && (
            <div className="campaign-actions">
              <button
                className="button"
                onClick={() =>
                  void run(() => {
                    const receipt = relay.current!.status(unknown);
                    setMessage(`Same intent: ${statuses[receipt.status]}`);
                    setUnknown(null);
                  })
                }
              >
                {' '}
                Check same intent{' '}
              </button>
              <button
                className="button"
                onClick={() =>
                  void run(async () => {
                    if (pending.current) {
                      const receipt = await relay.current!.submit(pending.current);
                      setMessage(`Retry same ID: ${statuses[receipt.status]}`);
                      setUnknown(null);
                    }
                  })
                }
              >
                {' '}
                Retry same ID{' '}
              </button>
            </div>
          )}
          <div className="positions-list">
            <h3> Local positions </h3>
            {ledger?.positions.length ? (
              ledger.positions.map((position) => (
                <div key={position.id}>
                  <span>
                    #{position.id} · {position.instrumentId === 0 ? 'BTC' : 'ETH'} ·{' '}
                    {position.isLong ? 'Long' : 'Short'} {position.leverage}x ·{' '}
                    {amount(position.marginRaw)}
                  </span>
                  <button
                    className="button small"
                    disabled={busy || position.instrumentId !== instrument.id}
                    onClick={() =>
                      void run(() => submit('closePositions', { positionIds: [position.id] }, true))
                    }
                  >
                    {' '}
                    Close locally{' '}
                  </button>
                </div>
              ))
            ) : (
              <p> No open local positions. </p>
            )}
          </div>
          <div className="local-operations">
            <h3> Staking and withdrawal · sandbox </h3>
            <div className="operation-fields">
              <label>
                {' '}
                PAPER amount{' '}
                <input
                  aria-label="Local PAPER amount"
                  inputMode="decimal"
                  value={paperAmount}
                  onChange={(event) => setPaperAmount(event.target.value)}
                />
              </label>
              <label>
                {' '}
                USDC withdrawal{' '}
                <input
                  aria-label="Local USDC withdrawal"
                  inputMode="decimal"
                  value={withdrawAmount}
                  onChange={(event) => setWithdrawAmount(event.target.value)}
                />
              </label>
            </div>
            <div className="campaign-actions">
              <button
                className="button small"
                disabled={busy}
                onClick={() =>
                  void run(() => submit('paperStake', { amount: parseUnits(paperAmount, 18) }))
                }
              >
                Stake
              </button>
              <button
                className="button small"
                disabled={busy}
                onClick={() =>
                  void run(() => submit('paperUnstake', { amount: parseUnits(paperAmount, 18) }))
                }
              >
                Unstake
              </button>
              <button
                className="button small"
                disabled={busy}
                onClick={() => void run(() => submit('paperClaim'))}
              >
                Claim
              </button>
              <button
                className="button small"
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    submit('withdrawToCore', { amount: parseUnits(withdrawAmount, 6) }),
                  )
                }
              >
                Withdraw
              </button>
            </div>
            <div className="campaign-actions">
              <button
                className="button small"
                onClick={() =>
                  void run(() => {
                    relay.current!.distributeTestRewards(10n * WAD);
                    setMessage(
                      'Added 10 virtual USDC rewards to test a claim. This is not protocol yield.',
                    );
                  })
                }
              >
                {' '}
                Test rewards{' '}
              </button>
              <button
                className="button small"
                onClick={() =>
                  void run(() => {
                    relay.current!.releaseQueue();
                    setMessage('Local queue released by a test keeper.');
                  })
                }
              >
                {' '}
                Release queue{' '}
              </button>
            </div>
            <p className="fine-print">
              {' '}
              Rewards and queue releases are manual test inputs. Emissions use an assumed 100
              PAPER/$ basis; this sandbox does not predict live yield.{' '}
            </p>
          </div>
          <div className="campaign-actions">
            <button
              className="button small"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  submit('registerSessionKey', {
                    key: session.address,
                    expiry: BigInt(Math.floor(Date.now() / 1000) + 86400),
                    feeAddress: '0x' + '00'.repeat(20),
                  }),
                )
              }
            >
              {' '}
              Local session{' '}
            </button>
            <button
              className="button small"
              onClick={() =>
                void run(() => {
                  relay.current!.revoke(session.address);
                  setMessage(
                    'Local session key revoked. Wallet permission to stake or withdraw was never delegated.',
                  );
                })
              }
            >
              {' '}
              Revoke session{' '}
            </button>
          </div>
          <div className="intent-list">
            <h3> Intents and settlement </h3>
            {receipts.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th> Intent </th>
                      <th> Status </th>
                      <th> Action </th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipts.slice(0, 12).map((receipt) => (
                      <tr key={receipt.id}>
                        <td data-label="Intent">
                          <span title={receipt.id}>
                            {labels[receipt.action]} · {receipt.id.slice(0, 10)}…
                          </span>
                        </td>
                        <td data-label="Status">
                          {statuses[receipt.status]}
                          {receipt.reason && <small className="error-text">{receipt.reason}</small>}
                        </td>
                        <td data-label="Action">
                          {receipt.status === 'queued' ? (
                            <div className="intent-buttons">
                              <button
                                className="button small"
                                disabled={busy}
                                onClick={() =>
                                  void run(() => {
                                    const result = relay.current!.settle(receipt.id, exit);
                                    setMessage(
                                      result.reason ?? statuses[result.status] ?? 'Unknown status',
                                    );
                                  })
                                }
                              >
                                {' '}
                                Settle{' '}
                              </button>
                              <button
                                className="button small"
                                disabled={busy}
                                onClick={() =>
                                  void run(() => {
                                    relay.current!.cancel(receipt.id);
                                    setMessage('Local intent cancelled.');
                                  })
                                }
                              >
                                {' '}
                                Cancel{' '}
                              </button>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p> No signed local intents yet. </p>
            )}
          </div>
          <button
            className="button small"
            onClick={() => {
              localStorage.removeItem(storageKey);
              relay.current = new MockRelayer(demo.address, instrument, entry);
              pending.current = null;
              setUnknown(null);
              persist();
              setMessage('Only the virtual account was reset.');
            }}
          >
            {' '}
            Reset local account{' '}
          </button>
        </>
      )}
      {message && (
        <p className="feedback" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
