'use client';
import { useEffect, useRef, useState } from 'react';
import { isAddress } from 'viem';
import { useSearchParams } from 'next/navigation';
import { amount, localTime } from '../lib/format';
import type { WalletProfile } from '../lib/server';
import type { TradeRow } from '../../../packages/protocol/history.js';
import type { Observation } from '../../../packages/protocol/read.js';
type Result = {
  value: WalletProfile;
  stale: boolean;
  observedAt: string;
  trades: { items: TradeRow[]; nextCursor: string | null } | null;
  pendingReward: { source: string; block: string; observedAt: string; value: Observation } | null;
  history: {
    block_number: number;
    tx_hash: string;
    from_address: string;
    to_address: string;
    amount_raw: string;
  }[];
  coverage: { from_block: number; through_block: number } | null;
};
export default function Profile() {
  const params = useSearchParams();
  const [address, setAddress] = useState(params.get('address') ?? '');
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  async function load(value = address) {
    const current = ++generation.current;
    setError('');
    setResult(null);
    setLoading(false);
    if (!isAddress(value)) {
      setError('Введите полный адрес 0x из 40 hex-символов.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/profile/${value}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (current === generation.current) setResult(data);
    } catch (error) {
      if (current === generation.current)
        setError(error instanceof Error ? error.message : 'Не удалось загрузить адрес.');
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    const value = params.get('address');
    if (value && isAddress(value)) {
      setAddress(value);
      void load(value);
    }
  }, [params]);
  return (
    <>
      <form
        className="address-form"
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <label htmlFor="address">
          Адрес HyperEVM
          <input
            id="address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="0x…"
            aria-invalid={!!error}
            spellCheck={false}
          />
        </label>
        <button className="button primary" disabled={loading}>
          {loading ? 'Загрузка…' : 'Посмотреть'}
        </button>
      </form>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {!result && !error && (
        <div className="empty-state">
          <h2>Откройте свой адрес.</h2>
          <p>Публичные данные Papertrade доступны без подписи и без подключения кошелька.</p>
        </div>
      )}
      {result && (
        <>
          <div className="source-line">
            <span className="status-dot" />
            Official wallet snapshot · блок {result.value.block} ·{' '}
            {localTime(result.value.sourceAt)} НСК
            <span className="tag">{result.stale ? 'Сохранённые данные' : 'Получено из API'}</span>
          </div>
          <div className="metric-strip">
            {[
              ['Available USDC', result.value.availableRaw, 'usd'],
              ['Queued USDC', result.value.queuedRaw, 'usd'],
              ['PAPER', result.value.paperRaw, 'paper'],
              ['Staked PAPER', result.value.stakedRaw, 'paper'],
            ].map(([title, raw, kind]) => (
              <div key={title}>
                <span>{title}</span>
                <strong>{amount(raw, kind as 'usd' | 'paper')}</strong>
              </div>
            ))}
          </div>
          <div className="split-layout">
            <section className="panel">
              <h2>Результат адреса</h2>
              <dl className="data-list">
                <div>
                  <dt>Realized net PnL</dt>
                  <dd>{amount(result.value.realizedPnlRaw, 'usd', false)}</dd>
                </div>
                <div>
                  <dt>Полученный staking USDC</dt>
                  <dd>{amount(result.value.claimedRaw, 'usd', false)}</dd>
                </div>
                <div>
                  <dt>Обеспечение в позициях</dt>
                  <dd>{amount(result.value.lockedRaw, 'usd', false)}</dd>
                </div>
                <div>
                  <dt>Открытые позиции</dt>
                  <dd>{result.value.openPositions.length}</dd>
                </div>
              </dl>
              <p className="fine-print">
                PendingBase — базовый accumulator snapshot, не полный текущий pendingReward.
                Claimable USDC показан ниже из отдельного RPC-чтения, с собственным блоком.
              </p>
            </section>
            <section className="notes-column">
              <h2>Ликвидность отдельно.</h2>
              <p>
                Queued USDC — требование на будущую выплату. PAPER не оценивается по предполагаемой
                цене; баланс токена не прибавляется к доступным деньгам.
              </p>
              <a
                className="text-link"
                href={`https://exchange.papertrade.xyz/portfolio?view=${result.value.address}`}
                target="_blank"
                rel="noreferrer"
              >
                Официальный портфель ↗
              </a>
            </section>
          </div>
          <section className="panel history-panel">
            <div className="section-heading">
              <h2>On-chain PAPER activity</h2>
              <span>
                {result.coverage
                  ? `Блоки ${result.coverage.from_block}–${result.coverage.through_block}`
                  : 'История ещё не индексировалась'}
              </span>
            </div>
            {result.history.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Блок</th>
                      <th>Действие</th>
                      <th>PAPER</th>
                      <th>Транзакция</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.history.map((event, index) => (
                      <tr key={`${event.tx_hash}-${index}`}>
                        <td data-label="Блок">{event.block_number}</td>
                        <td data-label="Действие">
                          {event.from_address === '0x' + '0'.repeat(40)
                            ? 'Mint'
                            : event.to_address === result.value.address
                              ? 'Получено'
                              : 'Отправлено'}
                        </td>
                        <td data-label="PAPER">{amount(event.amount_raw, 'paper')}</td>
                        <td data-label="Транзакция">
                          <a
                            href={`https://hyperevmscan.io/tx/${event.tx_hash}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Открыть ↗
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>
                В индексированном диапазоне нет PAPER events этого адреса. Это не означает
                отсутствие более ранней истории.
              </p>
            )}
          </section>
          <section className="panel history-panel">
            <div className="section-heading">
              <h2>Claimable staking USDC</h2>
              <span>Отдельное RPC-чтение</span>
            </div>
            <strong className="claimable-value">
              {amount(
                result.pendingReward?.value.status === 'ok' ? result.pendingReward.value.raw : null,
                'usd',
                false,
              )}
            </strong>
            <p className="fine-print">
              {result.pendingReward
                ? `pendingReward · блок ${result.pendingReward.block} · ${localTime(result.pendingReward.observedAt)} НСК`
                : 'RPC read недоступен; неизвестный reward не считается нулём.'}
            </p>
          </section>
          <section className="panel history-panel">
            <div className="section-heading">
              <h2>Торговая история</h2>
              <span>Official query API · последние 75</span>
            </div>
            {result.trades?.items.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Рынок</th>
                      <th>Margin</th>
                      <th>Net PnL</th>
                      <th>PAPER</th>
                      <th>Сделка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.items.map((row) => (
                      <tr key={`${row.txHash}-${row.positionId}`}>
                        <td data-label="Рынок">
                          {row.symbol} {row.isLong ? 'Long' : 'Short'} {row.leverage}x
                          {row.kind === 'Liquidated' ? ' · Bust' : ''}
                        </td>
                        <td data-label="Margin">{amount(row.marginRaw, 'usd', false)}</td>
                        <td
                          data-label="Net PnL"
                          className={BigInt(row.netPnlRaw) < 0n ? 'error-text' : 'positive-text'}
                        >
                          {amount(row.netPnlRaw, 'usd', false)}
                        </td>
                        <td data-label="PAPER">{amount(row.paperMintedRaw, 'paper')}</td>
                        <td data-label="Сделка">
                          <a
                            href={`https://hyperevmscan.io/tx/${row.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Открыть ↗
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>
                {result.trades
                  ? 'В этой странице истории нет завершённых сделок.'
                  : 'История сейчас недоступна. Это не означает отсутствие сделок.'}
              </p>
            )}
            {result.trades?.nextCursor && (
              <p className="fine-print">
                Есть более ранние сделки; эта версия показывает последние 75.
              </p>
            )}
          </section>
        </>
      )}
    </>
  );
}
