import tokenomics from '../../../../config/tokenomics.json';
import ClaimInspector from '../../components/claim-inspector';
import { amount } from '../../lib/format';
export default function RewardsPage() {
  return (
    <>
      <section className="page-heading">
        <div>
          <h1>Rules before rewards.</h1>
          <p>Token supply proposals, funded claims and explicit treasury limits.</p>
        </div>
        <span className="tag">Proposal · not launched</span>
      </section>
      <div className="metric-strip">
        <div>
          <span>Proposed token</span>
          <strong>{tokenomics.symbol}</strong>
        </div>
        <div>
          <span>Proposed fixed cap</span>
          <strong>{amount(tokenomics.capRaw, 'paper')}</strong>
        </div>
        <div>
          <span>Builder revenue assumed</span>
          <strong>$0</strong>
        </div>
        <div>
          <span>Live claims</span>
          <strong>Disabled</strong>
        </div>
      </div>
      <section className="panel">
        <div className="section-heading">
          <h2>Supply proposals</h2>
          <span>Draft parameters</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Scenario</th>
                <th>Community</th>
                <th>Liquidity</th>
                <th>Treasury</th>
                <th>Reserve</th>
              </tr>
            </thead>
            <tbody>
              {tokenomics.scenarios.map((row) => (
                <tr key={row.id}>
                  <td data-label="Scenario">{row.id}</td>
                  {[row.communityBps, row.liquidityBps, row.treasuryBps, row.reserveBps].map(
                    (bps, index) => (
                      <td
                        key={index}
                        data-label={['Community', 'Liquidity', 'Treasury', 'Reserve'][index]}
                      >
                        {bps / 100}%
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="fine-print">
          Name, ticker, allocations and liquidity remain proposals. No team/VC or fair-launch claim
          is made. CLUB has no claim on PAPER or USDC revenue. Existing points grant no token
          rights.
        </p>
      </section>
      <div className="split-layout">
        <section className="panel">
          <h2>Contract boundaries</h2>
          <p>
            Supply is minted once to explicit recipients. No privileged mint, transfer tax or
            upgrade proxy. Claims use an immutable root, budget, deadline and recovery address;
            replay is rejected.
          </p>
          <p>
            Local EVM tests cover supply, proof/domain binding, underfunded claims, replay, expiry
            and treasury limits. No public deployment has occurred.
          </p>
        </section>
        <section className="notes-column">
          <h2>Budget from cash.</h2>
          <p>
            Buybacks require settled revenue, spendable USDC, an operating reserve, a period limit
            and a fresh quote with bounded price impact. Queued claims and PAPER do not fund the
            budget.
          </p>
          <p>
            The treasury contract limits destinations and daily spending. It does not prove that a
            transfer executed a swap or burn; receipts must be reconciled separately.
          </p>
        </section>
      </div>
      <ClaimInspector />
    </>
  );
}
