import { formatUnits } from 'viem';
import type { TreasuryReceiptState } from '../lib/treasury';
function value(raw: string, decimals: number) {
  const quantity = BigInt(raw);
  const exact = formatUnits(quantity, decimals);
  const [whole, fraction = ''] = formatUnits(quantity < 0n ? -quantity : quantity, decimals).split(
    '.',
  );
  const short = fraction.slice(0, 6).replace(/0+$/, '');
  const approximate = /[1-9]/.test(fraction.slice(6));
  return (
    <span title={exact}>
      {approximate ? '≈ ' : ''}
      {quantity < 0n ? '−' : ''}
      {BigInt(whole!).toLocaleString('en-US')}
      {short ? '.' + short : ''}
    </span>
  );
}
export default function TreasuryReceipts({ state }: { state: TreasuryReceiptState }) {
  if (state.status !== 'available')
    return (
      <section className="panel">
        <div className="section-heading">
          <h2>Confirmed transfers</h2>
          <span className="tag">
            {state.status === 'not-configured' ? 'Not connected' : 'Unavailable'}
          </span>
        </div>
        <p>
          {state.status === 'not-configured'
            ? 'The treasury address and tracked asset have not been selected. Confirmed balances and transfer history will appear here once they are connected.'
            : state.error}
        </p>
      </section>
    );
  const ledger = state.value;
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Confirmed transfers</h2>
        <span className={`tag ${ledger.reconciled ? 'positive' : ''}`}>
          {ledger.reconciled ? 'Balances reconcile' : 'Reconciliation mismatch'}
        </span>
      </div>
      <p>
        {ledger.symbol ?? 'Configured asset'} · {ledger.minConfirmations} confirmations · blocks{' '}
        {ledger.fromBlock}–{ledger.toBlock}
      </p>
      <div className="metric-strip">
        {[
          ['Confirmed balance', ledger.closingBalanceRaw],
          ['Received in window', ledger.receivedRaw],
          ['Sent in window', ledger.sentRaw],
          ['Net asset flow', ledger.netFlowRaw],
        ].map(([label, raw]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value(raw!, ledger.decimals)}</strong>
          </div>
        ))}
      </div>
      {!ledger.reconciled && (
        <p className="feedback" role="status">
          Transfer totals do not reconcile with the observed balances. Difference:{' '}
          {value(ledger.discrepancyRaw, ledger.decimals)}. These figures cannot establish spendable
          revenue.
        </p>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Direction</th>
              <th>Amount</th>
              <th>Block</th>
              <th>Transaction</th>
            </tr>
          </thead>
          <tbody>
            {ledger.transfers
              .slice(-25)
              .reverse()
              .map((row) => (
                <tr key={row.transactionHash + ':' + row.logIndex}>
                  <td data-label="Direction">
                    {row.direction === 'in'
                      ? 'Received'
                      : row.direction === 'out'
                        ? 'Sent'
                        : 'Self transfer'}
                  </td>
                  <td data-label="Amount">{value(row.amountRaw, ledger.decimals)}</td>
                  <td data-label="Block">{row.blockNumber}</td>
                  <td data-label="Transaction">
                    <a
                      href={`https://hyperevmscan.io/tx/${row.transactionHash}`}
                      target="_blank"
                      rel="noreferrer"
                      title={row.transactionHash}
                    >
                      {row.transactionHash.slice(0, 8)}…{row.transactionHash.slice(-4)} ↗
                    </a>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {ledger.transfers.length === 0 && (
        <p className="feedback">No transfers in this confirmed block window.</p>
      )}
      <p className="fine-print">
        Showing the latest {Math.min(25, ledger.transfers.length)} of {ledger.transfers.length}{' '}
        verified transfers in this window. Asset receipts are not automatically counted as revenue,
        buybacks or burns. Internal PAPER and queued protocol claims are separate.
      </p>
    </section>
  );
}
