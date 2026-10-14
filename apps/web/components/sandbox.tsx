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
  openPosition: 'Открытие',
  closePositions: 'Закрытие',
  paperStake: 'Stake',
  paperUnstake: 'Unstake',
  paperClaim: 'Claim',
  withdrawToCore: 'Withdrawal',
  registerSessionKey: 'Session key',
};
const statuses: Record<string, string> = {
  queued: 'В очереди',
  confirmed: 'Исполнено локально',
  failed: 'Ошибка',
  expired: 'Просрочено',
  cancelled: 'Отменено',
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
      setMessage('Локальный счёт готов. Все USDC и PAPER здесь виртуальные.');
    } catch {
      setMessage('Сохранённый локальный счёт повреждён. Очистите его перед продолжением.');
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
      setMessage(error instanceof Error ? error.message : 'Локальное действие не выполнено.');
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
        `${labels[action]}: ${statuses[receipt.status]}. Исполните локальную заявку или отмените её.`,
      );
    } catch (error) {
      if (relay.current!.receipts.has(id)) {
        setUnknown(id);
        setMessage('Ответ неизвестен. Проверьте ту же заявку; новая подпись не нужна.');
      } else throw error;
    }
  }
  const ledger = relay.current?.ledger,
    receipts = relay.current ? [...relay.current.receipts.values()].reverse() : [];
  return (
    <section className="sandbox-panel" data-testid="sandbox">
      <div className="section-heading">
        <h2>Локальный счёт</h2>
        <span className="tag">Sandbox · без средств</span>
      </div>
      <p className="fine-print">
        Mock relayer с отдельным signing domain. Он не отправляет запросы в Papertrade. Стартовый
        баланс: 2 500 виртуальных USDC.
      </p>
      {!enabled ? (
        <button className="button primary" onClick={activate}>
          Попробовать локально
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
              Проверка поведения
              <select
                aria-label="Поведение локального relayer"
                value={mode}
                onChange={(event) => setMode(event.target.value)}
              >
                <option value="normal">Обычное исполнение</option>
                <option value="queue">Выигрыш в очереди</option>
                <option value="outage">Relayer недоступен</option>
                <option value="timeout">Ответ потерян после приёма</option>
                <option value="paused">Открытия приостановлены</option>
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
              Открыть локально
            </button>
          </div>
          {!fresh && (
            <p className="fine-print error-text">Обновите BBO перед открытием локальной позиции.</p>
          )}
          {unknown && (
            <div className="campaign-actions">
              <button
                className="button"
                onClick={() =>
                  void run(() => {
                    const receipt = relay.current!.status(unknown);
                    setMessage(`Та же заявка: ${statuses[receipt.status]}`);
                    setUnknown(null);
                  })
                }
              >
                Проверить ту же заявку
              </button>
              <button
                className="button"
                onClick={() =>
                  void run(async () => {
                    if (pending.current) {
                      const receipt = await relay.current!.submit(pending.current);
                      setMessage(`Retry того же ID: ${statuses[receipt.status]}`);
                      setUnknown(null);
                    }
                  })
                }
              >
                Повторить тот же ID
              </button>
            </div>
          )}
          <div className="positions-list">
            <h3>Локальные позиции</h3>
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
                    Закрыть локально
                  </button>
                </div>
              ))
            ) : (
              <p>Открытых локальных позиций нет.</p>
            )}
          </div>
          <div className="local-operations">
            <h3>Staking и withdrawal · sandbox</h3>
            <div className="operation-fields">
              <label>
                Количество PAPER
                <input
                  aria-label="Локальное количество PAPER"
                  inputMode="decimal"
                  value={paperAmount}
                  onChange={(event) => setPaperAmount(event.target.value)}
                />
              </label>
              <label>
                Вывод USDC
                <input
                  aria-label="Локальный вывод USDC"
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
                      'Добавлено 10 виртуальных USDC rewards для проверки claim. Это не доходность протокола.',
                    );
                  })
                }
              >
                Тестовые rewards
              </button>
              <button
                className="button small"
                onClick={() =>
                  void run(() => {
                    relay.current!.releaseQueue();
                    setMessage('Локальная очередь погашена тестовым keeper.');
                  })
                }
              >
                Погасить очередь
              </button>
            </div>
            <p className="fine-print">
              Rewards и queue harvest задаются вручную для теста. Emissions используют условные 100
              PAPER/$ basis; этот стенд не прогнозирует live yield.
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
              Локальная сессия
            </button>
            <button
              className="button small"
              onClick={() =>
                void run(() => {
                  relay.current!.revoke(session.address);
                  setMessage(
                    'Локальный session key отозван. Wallet-права на staking/withdraw не делегировались.',
                  );
                })
              }
            >
              Отозвать сессию
            </button>
          </div>
          <div className="intent-list">
            <h3>Заявки и подтверждение</h3>
            {receipts.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Заявка</th>
                      <th>Статус</th>
                      <th>Действие</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipts.slice(0, 12).map((receipt) => (
                      <tr key={receipt.id}>
                        <td data-label="Заявка">
                          <span title={receipt.id}>
                            {labels[receipt.action]} · {receipt.id.slice(0, 10)}…
                          </span>
                        </td>
                        <td data-label="Статус">
                          {statuses[receipt.status]}
                          {receipt.reason && <small className="error-text">{receipt.reason}</small>}
                        </td>
                        <td data-label="Действие">
                          {receipt.status === 'queued' ? (
                            <div className="intent-buttons">
                              <button
                                className="button small"
                                disabled={busy}
                                onClick={() =>
                                  void run(() => {
                                    const result = relay.current!.settle(receipt.id, exit);
                                    setMessage(
                                      result.reason ??
                                        statuses[result.status] ??
                                        'Статус неизвестен',
                                    );
                                  })
                                }
                              >
                                Исполнить
                              </button>
                              <button
                                className="button small"
                                disabled={busy}
                                onClick={() =>
                                  void run(() => {
                                    relay.current!.cancel(receipt.id);
                                    setMessage('Локальная заявка отменена.');
                                  })
                                }
                              >
                                Отменить
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
              <p>Подписанных локальных заявок пока нет.</p>
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
              setMessage('Сброшен только виртуальный счёт.');
            }}
          >
            Сбросить локальный счёт
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
