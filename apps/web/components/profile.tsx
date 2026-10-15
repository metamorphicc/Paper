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
  const [tradePage, setTradePage] = useState<Result['trades']>(null),
    [activeCursor, setActiveCursor] = useState<string | null>(null),
    [cursorTrail, setCursorTrail] = useState<(string | null)[]>([]),
    [historyLoading, setHistoryLoading] = useState(false),
    [historyError, setHistoryError] = useState('');
  const historyLock = useRef(false);
  function resetHistory() {
    setTradePage(null);
    setActiveCursor(null);
    setCursorTrail([]);
    setHistoryLoading(false);
    setHistoryError('');
    historyLock.current = false;
  }
  async function load(value = address) {
    const current = ++generation.current;
    setError('');
    setResult(null);
    resetHistory();
    setLoading(false);
    if (!isAddress(value)) {
      setError('Enter a complete 0x address with 40 hexadecimal characters.');
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
        setError(error instanceof Error ? error.message : 'Could not load this address.');
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }
  async function showHistory(cursor: string | null, previous = false) {
    if (!result || historyLock.current) return;
    const capture = generation.current;
    historyLock.current = true;
    setHistoryLoading(true);
    setHistoryError('');
    try {
      let page: Result['trades'] = null;
      if (cursor !== null) {
        const response = await fetch(
          `/api/profile/${result.value.address}/trades?cursor=${encodeURIComponent(cursor)}`,
          { signal: AbortSignal.timeout(20000) },
        );
        if (!response.ok) throw new Error('Could not load this history page. Try again.');
        page = await response.json();
        if (
          !page ||
          !Array.isArray(page.items) ||
          (page.nextCursor !== null && typeof page.nextCursor !== 'string') ||
          (!previous &&
            page.nextCursor !== null &&
            [...cursorTrail, activeCursor, cursor].includes(page.nextCursor))
        )
          throw new Error('History returned an invalid continuation. Try refreshing the profile.');
      }
      if (capture === generation.current) {
        setTradePage(page);
        setActiveCursor(cursor);
        setCursorTrail((trail) => (previous ? trail.slice(0, -1) : [...trail, activeCursor]));
      }
    } catch (error) {
      if (capture === generation.current)
        setHistoryError(error instanceof Error ? error.message : 'Could not load history.');
    } finally {
      if (capture === generation.current) {
        historyLock.current = false;
        setHistoryLoading(false);
      }
    }
  }
  useEffect(() => {
    const value = params.get('address');
    if (value && isAddress(value)) {
      setAddress(value);
      void load(value);
    }
  }, [params]);
  const trades = tradePage ?? result?.trades;
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
          {' '}
          HyperEVM address{' '}
          <input
            id="address"
            value={address}
            onChange={(event) => {
              ++generation.current;
              setAddress(event.target.value);
              setResult(null);
              resetHistory();
              setLoading(false);
              setError('');
            }}
            placeholder="0x…"
            aria-invalid={!!error}
            spellCheck={false}
          />
        </label>
        <button className="button primary" disabled={loading}>
          {loading ? 'Loading…' : 'View'}
        </button>
      </form>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {!result && !error && (
        <div className="empty-state">
          <h2>Address lookup</h2>
          <p> Public Papertrade data is available without a signature or wallet connection. </p>
        </div>
      )}
      {result && (
        <>
          <div className="source-line">
            <span className="status-dot" /> Official wallet snapshot · block {result.value.block} ·{' '}
            {localTime(result.value.sourceAt)} UTC{' '}
            <span className="tag">{result.stale ? 'Cached data' : 'Fetched from API'}</span>
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
              <h2> Address performance </h2>
              <dl className="data-list">
                <div>
                  <dt>Realized net PnL</dt>
                  <dd>{amount(result.value.realizedPnlRaw, 'usd', false)}</dd>
                </div>
                <div>
                  <dt> Claimed staking USDC </dt>
                  <dd>{amount(result.value.claimedRaw, 'usd', false)}</dd>
                </div>
                <div>
                  <dt> Collateral in positions </dt>
                  <dd>{amount(result.value.lockedRaw, 'usd', false)}</dd>
                </div>
                <div>
                  <dt> Open positions </dt>
                  <dd>{result.value.openPositions.length}</dd>
                </div>
              </dl>
              <p className="fine-print">
                {' '}
                PendingBase is an accumulator snapshot, not the full current pendingReward.
                Claimable USDC is read separately below from the latest RPC state.{' '}
              </p>
            </section>
            <section className="notes-column">
              <h2>Balance definitions</h2>
              <p>
                {' '}
                Queued USDC is a claim on a future payout. PAPER has no assumed cash price; its
                balance is excluded from spendable funds.{' '}
              </p>
              <a
                className="text-link"
                href={`https://exchange.papertrade.xyz/portfolio?view=${result.value.address}`}
                target="_blank"
                rel="noreferrer"
              >
                {' '}
                Official portfolio ↗{' '}
              </a>
            </section>
          </div>
          <section className="panel history-panel">
            <div className="section-heading">
              <h2>On-chain PAPER activity</h2>
              <span>
                {result.coverage
                  ? `Blocks ${result.coverage.from_block}–${result.coverage.through_block}`
                  : 'History has not been indexed yet'}
              </span>
            </div>
            {result.history.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th> Block </th>
                      <th> Action </th>
                      <th>PAPER</th>
                      <th> Transaction </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.history.map((event, index) => (
                      <tr key={`${event.tx_hash}-${index}`}>
                        <td data-label="Block">{event.block_number}</td>
                        <td data-label="Action">
                          {event.from_address === '0x' + '0'.repeat(40)
                            ? 'Mint'
                            : event.to_address === result.value.address
                              ? 'Received'
                              : 'Sent'}
                        </td>
                        <td data-label="PAPER">{amount(event.amount_raw, 'paper')}</td>
                        <td data-label="Transaction">
                          <a
                            href={`https://hyperevmscan.io/tx/${event.tx_hash}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {' '}
                            Open ↗{' '}
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>
                {' '}
                No PAPER events for this address in the indexed range. Earlier activity may
                exist.{' '}
              </p>
            )}
          </section>
          <section className="panel history-panel">
            <div className="section-heading">
              <h2>Claimable staking USDC</h2>
              <span> Separate RPC read </span>
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
                ? `pendingReward · latest RPC · sampled head ${result.pendingReward.block} · ${localTime(result.pendingReward.observedAt)} UTC`
                : 'RPC read unavailable; an unknown reward is not treated as zero.'}
            </p>
          </section>
          <section className="panel history-panel">
            <div className="section-heading">
              <h2> Trade history </h2>
              <span> Official query API · latest 75 </span>
            </div>
            {trades?.items.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th> Market </th>
                      <th>Margin</th>
                      <th>Net PnL</th>
                      <th>PAPER</th>
                      <th> Trade </th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.items.map((row) => (
                      <tr key={`${row.txHash}-${row.positionId}`}>
                        <td data-label="Market">
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
                        <td data-label="Trade">
                          <a
                            href={`https://hyperevmscan.io/tx/${row.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {' '}
                            Open ↗{' '}
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>
                {trades
                  ? 'No completed trades on this history page.'
                  : 'History is unavailable. This does not mean there were no trades.'}
              </p>
            )}
            {trades && (
              <div className="campaign-actions" aria-label="Trade history pages">
                <button
                  className="button small"
                  disabled={historyLoading || cursorTrail.length === 0}
                  onClick={() => void showHistory(cursorTrail.at(-1) ?? null, true)}
                >
                  Newer trades
                </button>
                <span>Page {cursorTrail.length + 1}</span>
                <button
                  className="button small"
                  disabled={historyLoading || !trades.nextCursor}
                  onClick={() => void showHistory(trades.nextCursor)}
                >
                  Earlier trades
                </button>
              </div>
            )}
            {historyError && (
              <p role="status" className="feedback">
                {historyError}
              </p>
            )}
          </section>
        </>
      )}
    </>
  );
}
