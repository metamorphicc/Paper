import report from '../../../../research/path-replay.json';
import ResearchChart from '../../components/research-chart';
import { amount } from '../../lib/format';
export default function ResearchPage() {
  return (
    <>
      <section className="page-heading">
        <div>
          <h1>Research</h1>
          <p>Historical prices with explicit assumptions. No funds are traded.</p>
        </div>
        <span className="tag">Research · public vault disabled</span>
      </section>
      <p className="source-line">
        BTC · {report.source.candles} completed 15-minute candles ·{' '}
        {report.source.fromUtc.slice(0, 10)}–{report.source.throughUtc.slice(0, 10)} UTC · captured{' '}
        {report.observedAtUtc} · current parameter block {report.source.currentTradingBlock}
      </p>
      <ResearchChart results={report.results} />
      <div className="split-layout">
        <section className="panel">
          <h2>What this replay assumes</h2>
          <p>
            Hypothetical $2,000 capital, $100 margin per leg, 100x leverage, delayed entries, $1
            action cost and a $400 loss-stop trigger. Current impact/buffer is held constant across
            historical prices. Win fee and PAPER emissions are assumptions.
          </p>
          <p>
            OHLC ordering and actual BBO/relayer execution are unknown. A stop blocks new openings
            but cannot cap loss in existing positions. These results are not a historical backtest
            or yield forecast.
          </p>
        </section>
        <section className="notes-column">
          <h2>Liquidity assumptions</h2>
          <p>
            PAPER has no assigned USDC value. Queued profit cannot fund withdrawals until
            settlement. Strategy losses, reserve requirements and actual receipts determine
            spendable capital.
          </p>
          <p>
            Contract-wallet integration remains unverified. Public deposits and live strategy
            execution are disabled.
          </p>
        </section>
      </div>
      <section className="panel">
        <h2>Paired-strategy sensitivities</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Scenario</th>
                <th>Cash</th>
                <th>Queued</th>
                <th>Economic result</th>
              </tr>
            </thead>
            <tbody>
              {report.sensitivity.map((row) => (
                <tr key={row.name}>
                  <td data-label="Scenario">{row.name}</td>
                  <td data-label="Cash">{amount(row.result.cashRaw)}</td>
                  <td data-label="Queued">{amount(row.result.queuedRaw)}</td>
                  <td data-label="Economic result">
                    {amount(row.result.netEquityRaw, 'usd', false)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <h2>Vault accounting under review</h2>
        <p>
          The local cash-only model reserves redemptions before payment and preserves earlier
          queued/PAPER entitlements when shares are redeemed. New deposits cannot pay old queued
          claims. These are accounting tests, not a deployable custody contract.
        </p>
        <p>
          Open-position NAV, bridging, real PAPER staking rights, recovery timing, contract-wallet
          signing and independent audit must be resolved before a public vault. Token/PAPER issuance
          and deposits are never reported as profit.
        </p>
      </section>
    </>
  );
}
