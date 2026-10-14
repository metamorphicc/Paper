import Link from 'next/link';
import { protocolData } from '../lib/server';
import { capabilities } from '../../../packages/protocol/capabilities.js';
import { amount, localTime } from '../lib/format';
import OverviewMarkets from '../components/overview-markets';
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
          <p className="overline">PAPERTRADE / HYPEREVM</p>
          <h1>Overview</h1>
          <p>Markets, protocol liquidity and your PAPER activity.</p>
        </div>
        <Link href="/trade" className="button primary">
          Open terminal ↗
        </Link>
      </section>
      <section className="protocol-band" aria-label="Protocol state">
        <div className="protocol-band-heading">
          <p className="overline">PROTOCOL LIQUIDITY</p>
          <strong>{amount(summary?.balances.lp)}</strong>
          <p>USDC in the shared LP · reported by the official indexer</p>
        </div>
        <div className="hero-details">
          <div>
            <span>Active positions</span>
            <strong>{summary?.activity.open.toLocaleString('en-US') ?? '—'}</strong>
          </div>
          <div>
            <span>Queued payouts</span>
            <strong>{amount(summary?.balances.queue)}</strong>
          </div>
          <div>
            <span>Staked PAPER</span>
            <strong>{amount(summary?.paper.staked, 'paper')}</strong>
          </div>
          <div>
            <span>PAPER supply</span>
            <strong>{amount(summary?.paper.supply, 'paper')}</strong>
          </div>
        </div>
        <div className={`source-line ${error ? 'error-text' : ''}`}>
          <span className="status-dot" />
          {summary
            ? `${stale ? 'Cached data' : 'Official API'} · block ${summary.source.block} · ${localTime(summary.source.at)} UTC`
            : 'Official API unavailable. Refresh this page later.'}
          <span>RPC reconciliation incomplete</span>
        </div>
      </section>
      <OverviewMarkets />
      <section className="overview-actions" aria-label="Your workspace">
        <div>
          <p className="overline">COMMUNITY</p>
          <h2>Your participation</h2>
          <p>
            Track your address, complete the risk quiz and collect community points. Trading volume
            and losses earn no bonuses.
          </p>
          <Link href="/leaderboard" className="button primary">
            Open community →
          </Link>
        </div>
        <div className="quick-links">
          <Link className="quick-link" href="/profile">
            <div>
              <strong>Profile</strong>
              <p>Balances, staked PAPER and position history.</p>
            </div>
            <span aria-hidden="true">↗</span>
          </Link>
          <Link className="quick-link" href="/research">
            <div>
              <strong>Research</strong>
              <p>Compare historical scenarios and cash constraints.</p>
            </div>
            <span aria-hidden="true">↗</span>
          </Link>
          <Link className="quick-link" href="/rewards">
            <div>
              <strong>Rewards</strong>
              <p>Inspect a snapshot allocation and its claim proof.</p>
            </div>
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>
      <details className="integration-details">
        <summary>Integration status · live trading disabled</summary>
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
      </details>
    </>
  );
}
