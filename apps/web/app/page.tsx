import Link from 'next/link';
import { protocolData } from '../lib/server';
import { capabilities } from '../../../packages/protocol/capabilities.js';
import { amount, localTime } from '../lib/format';
export const dynamic = 'force-dynamic';
export default async function Overview() {
  let summary = null;
  let error = false;
  let stale = false;
  try {
    const data = await protocolData();
    summary = data.value;
    stale = data.stale;
  } catch {
    error = true;
  }
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="overline">PAPERTRADE / COMMUNITY</p>
          <h1> Start with the data. </h1>
          <p> Protocol state, PAPER ownership and trade risk in one place. </p>
        </div>
        <Link href="/trade" className="button primary">
          {' '}
          Open terminal ↗{' '}
        </Link>
      </section>
      <section className="protocol-hero" aria-label="Protocol state">
        <div className="hero-number">
          <span> Protocol LP </span>
          <strong>{amount(summary?.balances.lp)}</strong>
          <p> From the official indexer. Treasury includes user collateral. </p>
        </div>
        <div className="hero-details">
          <div>
            <span> Active positions </span>
            <strong>{summary?.activity.open.toLocaleString('en-US') ?? '—'}</strong>
          </div>
          <div>
            <span> Queued payouts </span>
            <strong>{amount(summary?.balances.queue)}</strong>
          </div>
          <div>
            <span> Staked PAPER </span>
            <strong>{amount(summary?.paper.staked, 'paper')}</strong>
          </div>
          <div>
            <span>Supply PAPER</span>
            <strong>{amount(summary?.paper.supply, 'paper')}</strong>
          </div>
        </div>
      </section>
      <div className={`source-line ${error ? 'error-text' : ''}`}>
        <span className="status-dot" />
        {summary
          ? `${stale ? 'Cached data' : 'Official API'} · block ${summary.source.block} · ${localTime(summary.source.at)} UTC`
          : 'Official API unavailable. Refresh this page later.'}
        <span> RPC reconciliation is incomplete </span>
      </div>
      <div className="split-layout">
        <section className="panel">
          <div className="section-heading">
            <h2> Available features </h2>
            <span> Integration status </span>
          </div>
          <div className="capability-list">
            {capabilities.map((item) => (
              <div key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.reason}</p>
                </div>
                <span className={`tag ${item.status === 'available' ? 'positive' : ''}`}>
                  {item.status === 'available'
                    ? 'Available'
                    : item.status === 'planned'
                      ? 'Planned'
                      : 'Unverified'}
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className="notes-column">
          <h2> Join without promises. </h2>
          <p>
            {' '}
            Explore the protocol, track your address and take part in the points campaign. Losses
            and trading volume earn no bonuses.{' '}
          </p>
          <Link href="/leaderboard" className="text-link">
            {' '}
            Community campaign →{' '}
          </Link>
          <div className="note">
            <strong> 1000x is the protocol ceiling. </strong>
            <p>
              {' '}
              Estimate net profit and distance to the bust price before opening a position. The
              local sandbox uses virtual funds.{' '}
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
