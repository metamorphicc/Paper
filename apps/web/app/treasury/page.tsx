import { walletData } from '../../lib/server';
import { amount, localTime } from '../../lib/format';
import { isAddress } from 'viem';
export const dynamic = 'force-dynamic';
export default async function TreasuryPage() {
  const address = process.env.TREASURY_ADDRESS;
  let result = null;
  if (address && isAddress(address)) {
    try {
      result = await walletData(address);
    } catch {
      /* show unavailable, not zero */
    }
  }
  return (
    <>
      <section className="page-heading">
        <div>
          <h1> Account for every dollar. </h1>
          <p> Treasury, PAPER and queued payouts. Actual receipts only. </p>
        </div>
        <span className="tag"> Buyback disabled </span>
      </section>
      {!address ? (
        <div className="empty-state">
          <h2> No treasury address selected. </h2>
          <p>
            {' '}
            Token and treasury settings are planned. Configure a public TREASURY_ADDRESS to view it;
            unknown balances appear as an em dash.{' '}
          </p>
        </div>
      ) : (
        <p className="address-text">{address}</p>
      )}
      <div className="metric-strip">
        {[
          ['Available USDC', result?.value.availableRaw, 'usd'],
          ['Queued USDC', result?.value.queuedRaw, 'usd'],
          ['Staked PAPER', result?.value.stakedRaw, 'paper'],
          ['Claimed USDC', result?.value.claimedRaw, 'usd'],
        ].map(([label, raw, kind]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{amount(raw, kind as 'usd' | 'paper')}</strong>
          </div>
        ))}
      </div>
      <div className="split-layout">
        <section className="panel">
          <h2> Revenue sources </h2>
          <dl className="data-list">
            <div>
              <dt>Builder codes</dt>
              <dd> Not live </dd>
            </div>
            <div>
              <dt>Staking yield</dt>
              <dd>{amount(result?.value.claimedRaw, 'usd', false)}</dd>
            </div>
            <div>
              <dt> Buybacks / burn </dt>
              <dd> Disabled </dd>
            </div>
          </dl>
          <p className="fine-print">
            {' '}
            New deposits and token issuance are not revenue. PAPER and queued claims are excluded
            from liquid USDC.{' '}
          </p>
        </section>
        <section className="notes-column">
          <h2> Verifiable rules. </h2>
          <p>
            {' '}
            Treasury is read-only here. Trading, token launch, buybacks and rewards require defined
            rules and budgets.{' '}
          </p>
          {result && (
            <p className="fine-print">
              {' '}
              Official API · block {result.value.block} · {localTime(result.value.sourceAt)} UTC{' '}
              {result.stale ? '· cached data' : ''}
            </p>
          )}
        </section>
      </div>
    </>
  );
}
