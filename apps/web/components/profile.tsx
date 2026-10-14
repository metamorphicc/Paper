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
          {' '}
          HyperEVM address{' '}
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
          <h2> Look up your address. </h2>
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
                Claimable USDC is read separately below from RPC, with its own block.{' '}
              </p>
            </section>
            <section className="notes-column">
              <h2> Keep liquidity separate. </h2>
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
                ? `pendingReward · block ${result.pendingReward.block} · ${localTime(result.pendingReward.observedAt)} UTC`
                : 'RPC read unavailable; an unknown reward is not treated as zero.'}
            </p>
          </section>
          <section className="panel history-panel">
            <div className="section-heading">
              <h2> Trade history </h2>
              <span> Official query API · latest 75 </span>
            </div>
            {result.trades?.items.length ? (
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
                    {result.trades.items.map((row) => (
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
                {result.trades
                  ? 'No completed trades on this history page.'
                  : 'History is unavailable. This does not mean there were no trades.'}
              </p>
            )}
            {result.trades?.nextCursor && (
              <p className="fine-print">
                {' '}
                Earlier trades exist; this version shows the latest 75.{' '}
              </p>
            )}
          </section>
        </>
      )}
    </>
  );
}
